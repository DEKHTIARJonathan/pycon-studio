/**
 * PlaybackController — single source of truth for audio playback.
 *
 * Owns the singleton <audio> element and the radioEngine. All transport
 * actions (play, pause, seek, next, previous) flow through here. UI
 * components must NOT call audio.play()/pause()/load() or radioEngine
 * methods directly; they read state from usePlayerStore for display and
 * call controller methods for actions.
 *
 * Why this exists:
 *
 *   Previously playback was driven by two systems at once: MiniPlayer's
 *   useEffect (reactive) and player-controls.ts (imperative). They raced
 *   on the same <audio> element, which caused intermittent play failures
 *   (AbortError from load() cancelling a pending play()), occasionally
 *   left the radio worklet running while <audio> was also playing
 *   (two songs at once), and dropped seeks before metadata loaded.
 *
 * Key invariants:
 *
 *   - Only PlaybackController writes to <audio>.{src, currentTime,
 *     volume} or calls audio.play()/pause()/load().
 *   - Only PlaybackController writes to usePlayerStore.{isPlaying,
 *     currentTime, duration}. Other code can write currentSong, queue,
 *     volume, muted, shuffle, repeat through their public setters.
 *   - All async transport actions are serialized via _runExclusive — at
 *     most one play()/load() is in flight at any time. Stale operations
 *     (token mismatch) no-op cleanly.
 *   - Mode switches are atomic: leaving radio always stops the
 *     radioEngine + radio store; entering radio always pauses + clears
 *     <audio>.src.
 */

import type { SongResponse } from "@/types/api";
import { usePlayerStore } from "@/stores/player-store";
import { useRadioStore } from "@/stores/radio-store";
import { resolveSongPlaybackUrl } from "@/lib/player-audio";
import { radioEngine } from "@/lib/audio/radio-engine";

type PreviewListener = (currentUrl: string | null) => void;

interface QueueIndexResult {
  song: SongResponse;
  index: number;
}

class PlaybackController {
  private _audio: HTMLAudioElement | null = null;
  private _audioListeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [];
  private _audioWaiters: Array<(el: HTMLAudioElement) => void> = [];

  private _opSeq = 0;
  private _running: Promise<unknown> = Promise.resolve();

  private _pendingSeek: number | null = null;
  private _previewListeners = new Set<PreviewListener>();
  private _rafToken: number | null = null;
  private _suppressTimeUpdateUntil = 0;

  // -- Audio element wiring (called by MiniPlayer on mount/unmount) --

  attachAudioElement(el: HTMLAudioElement): void {
    if (this._audio === el) return;
    if (this._audio) this.detachAudioElement();
    this._audio = el;
    el.preload = "auto";

    const { volume, muted } = usePlayerStore.getState();
    el.volume = muted ? 0 : volume;

    const add = <K extends keyof HTMLMediaElementEventMap>(
      type: K,
      handler: (this: HTMLAudioElement, ev: HTMLMediaElementEventMap[K]) => void,
    ) => {
      const listener = handler as EventListener;
      el.addEventListener(type, listener);
      this._audioListeners.push([type, listener]);
    };

    add("loadedmetadata", () => this._onLoadedMetadata());
    add("durationchange", () => this._onDurationChange());
    add("timeupdate", () => this._scheduleTimeUpdate());
    add("ended", () => this._onAudioEnded());
    add("error", () => this._onAudioError());

    // Resolve any callers that were waiting for the element to attach.
    const waiters = this._audioWaiters;
    this._audioWaiters = [];
    for (const w of waiters) w(el);
  }

  /**
   * Wait up to ~2s for the <audio> element to be attached. Returns null
   * if it never shows up (component unmounted, etc.). This handles the
   * very first playSong() call: the controller may run before the
   * MiniPlayer's mount effect has fired.
   */
  private _waitForAudio(timeoutMs = 2000): Promise<HTMLAudioElement | null> {
    if (this._audio) return Promise.resolve(this._audio);
    return new Promise((resolve) => {
      let settled = false;
      const cb = (el: HTMLAudioElement) => {
        if (settled) return;
        settled = true;
        resolve(el);
      };
      this._audioWaiters.push(cb);
      setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = this._audioWaiters.indexOf(cb);
        if (idx >= 0) this._audioWaiters.splice(idx, 1);
        resolve(this._audio);
      }, timeoutMs);
    });
  }

  detachAudioElement(): void {
    const el = this._audio;
    if (!el) return;
    for (const [type, listener] of this._audioListeners) {
      el.removeEventListener(type, listener);
    }
    this._audioListeners = [];
    this._audio = null;
  }

  // -- Public transport API --

  /** Play a single song. Replaces <audio>.src or radioEngine source. */
  async playSong(song: SongResponse, audioUrl?: string | null): Promise<void> {
    const token = ++this._opSeq;
    await this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      await this._playSongInternal(song, audioUrl ?? null, token);
    });
  }

  /** Set queue + play one song from it atomically. */
  async playFromQueue(
    songs: SongResponse[],
    song: SongResponse,
    audioUrls?: Record<string, string>,
  ): Promise<void> {
    const token = ++this._opSeq;
    await this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      usePlayerStore.setState({
        queue: songs,
        queueAudioUrls: audioUrls ?? {},
      });
      const url = audioUrls?.[song.id] ?? null;
      await this._playSongInternal(song, url, token);
    });
  }

  async toggle(): Promise<void> {
    const { isPlaying, currentSong } = usePlayerStore.getState();
    if (!currentSong) return;
    if (isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  async pause(): Promise<void> {
    const token = ++this._opSeq;
    await this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      this._pauseAll();
      usePlayerStore.setState({ isPlaying: false });
    });
  }

  async resume(): Promise<void> {
    const token = ++this._opSeq;
    await this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      const { currentSong, audioUrl, queueAudioUrls } = usePlayerStore.getState();
      if (!currentSong) return;
      const stationId = useRadioStore.getState().activeStationId;

      if (stationId) {
        if (radioEngine.currentSongId === currentSong.id) {
          radioEngine.resume();
          usePlayerStore.setState({ isPlaying: true });
          return;
        }
        if (radioEngine.hasBuffer(currentSong.id)) {
          const ok = await radioEngine.play(currentSong.id);
          if (token !== this._opSeq) return;
          if (ok) {
            usePlayerStore.setState({
              isPlaying: true,
              duration: radioEngine.duration,
              currentTime: 0,
            });
            return;
          }
        }
      }

      const url = resolveSongPlaybackUrl(
        currentSong,
        audioUrl ?? queueAudioUrls[currentSong.id],
      );
      await this._playElement(url, token, /*resumeOnly*/ false);
    });
  }

  async next(): Promise<void> {
    const token = ++this._opSeq;
    await this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      const target = this._computeNext();
      if (!target) {
        this._pauseAll();
        usePlayerStore.setState({ isPlaying: false, currentTime: 0 });
        return;
      }
      const { song } = target;
      const url = usePlayerStore.getState().queueAudioUrls[song.id] ?? null;
      await this._playSongInternal(song, url, token);
    });
  }

  async previous(): Promise<void> {
    const token = ++this._opSeq;
    await this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      const { queue, currentSong, queueAudioUrls } = usePlayerStore.getState();
      if (queue.length === 0) {
        // No queue: restart current track if any
        await this._restartCurrent(token);
        return;
      }
      const currentIdx = currentSong
        ? queue.findIndex((s) => s.id === currentSong.id)
        : -1;

      // At first track (or no current in queue): restart from 0
      if (currentIdx <= 0) {
        await this._restartCurrent(token);
        return;
      }

      const prev = queue[currentIdx - 1];
      const url = queueAudioUrls[prev.id] ?? null;
      await this._playSongInternal(prev, url, token);
    });
  }

  /**
   * Seek to absolute time in seconds. If the <audio> element doesn't
   * have metadata yet, the seek is queued and applied on
   * `loadedmetadata`. The store's `currentTime` is updated immediately
   * so the UI reflects the user's intent without waiting for the
   * audio's `seeked`/`timeupdate` events to bounce back.
   */
  seek(seconds: number): void {
    const stationId = useRadioStore.getState().activeStationId;
    const { duration } = usePlayerStore.getState();

    if (stationId) {
      const dur = radioEngine.duration || duration;
      const clamped = dur > 0 ? Math.max(0, Math.min(seconds, dur)) : Math.max(0, seconds);
      radioEngine.seek(clamped);
      usePlayerStore.setState({ currentTime: clamped });
      return;
    }

    const audio = this._audio;
    if (!audio) return;

    const target = Math.max(0, seconds);

    if (!isFinite(audio.duration) || audio.duration <= 0) {
      // Metadata not loaded yet — apply on loadedmetadata.
      this._pendingSeek = target;
      usePlayerStore.setState({ currentTime: target });
      return;
    }

    const clamped = Math.min(target, audio.duration);
    // Suppress timeupdate handling for a brief window so the browser's
    // intermediate `timeupdate` events during the seek don't snap the
    // store's currentTime back to the pre-seek value.
    this._suppressTimeUpdateUntil = Date.now() + 500;
    try {
      audio.currentTime = clamped;
    } catch {
      // Some browsers throw if the position isn't seekable yet — fall
      // back to deferred seek.
      this._pendingSeek = clamped;
    }
    usePlayerStore.setState({ currentTime: clamped });
  }

  seekRelative(deltaSeconds: number): void {
    const { currentTime } = usePlayerStore.getState();
    this.seek(currentTime + deltaSeconds);
  }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    usePlayerStore.setState({ volume: clamped, muted: clamped === 0 });
    if (this._audio) this._audio.volume = clamped;
    radioEngine.setVolume(clamped);
  }

  setMuted(muted: boolean): void {
    usePlayerStore.setState({ muted });
    const { volume } = usePlayerStore.getState();
    const eff = muted ? 0 : volume;
    if (this._audio) this._audio.volume = eff;
    radioEngine.setVolume(eff);
  }

  /** Called by useRadioPlayback when radioEngine fires onended. */
  handleRadioEnded(): void {
    const token = ++this._opSeq;
    void this._runExclusive(async () => {
      if (token !== this._opSeq) return;
      const { repeat, currentSong } = usePlayerStore.getState();
      if (repeat === "one" && currentSong) {
        const ok = await radioEngine.play(currentSong.id);
        if (token !== this._opSeq) return;
        if (ok) {
          usePlayerStore.setState({
            isPlaying: true,
            currentTime: 0,
            duration: radioEngine.duration,
          });
        }
        return;
      }

      const target = this._computeNext();
      if (!target) {
        this._pauseAll();
        usePlayerStore.setState({ isPlaying: false, currentTime: 0 });
        return;
      }
      const { song } = target;
      if (radioEngine.hasBuffer(song.id)) {
        // Update the UI's "current song" BEFORE awaiting radioEngine.play.
        // The worklet starts producing audio for the new track as soon as
        // its "load" message is handled, which can happen before this
        // async function resumes after the await — that's the window
        // where the UI used to keep showing the previous title while the
        // next track was already audible. By writing currentSong up-front
        // the title (and the rest of the now-playing metadata) tracks
        // the audio.
        usePlayerStore.setState({
          currentSong: song,
          audioUrl: usePlayerStore.getState().queueAudioUrls[song.id] ?? null,
          isPlaying: true,
          currentTime: 0,
          duration: radioEngine.duration,
        });
        const ok = await radioEngine.play(song.id);
        if (token !== this._opSeq) return;
        if (ok) {
          // Duration may only become known after the worklet has the
          // buffer loaded; refresh now that play() resolved.
          usePlayerStore.setState({ duration: radioEngine.duration });
          return;
        }
      }
      // Buffer not ready — pause and wait for radio generation pipeline
      this._pauseAll();
      usePlayerStore.setState({ isPlaying: false, currentTime: 0 });
    });
  }

  /**
   * Subscribe to "preview focus" events. The listener is invoked when:
   *   - The main controller starts playing a song (so previews pause).
   *   - Another preview claims focus via notifyPreviewStarted().
   *
   * Each listener should pause itself unless it owns the focus.
   * Returns an unsubscribe function. The argument passed is an opaque
   * identifier of who claimed focus (or null for "main player"); a
   * listener can ignore the call when its own id matches.
   */
  subscribePreview(listener: PreviewListener): () => void {
    this._previewListeners.add(listener);
    return () => {
      this._previewListeners.delete(listener);
    };
  }

  /**
   * Called by a preview UI when it starts playing. Pauses the main
   * player and notifies all other preview subscribers so they can
   * pause themselves. The previewId distinguishes which preview is
   * claiming focus so it doesn't pause itself.
   */
  notifyPreviewStarted(previewId: string | null = null): void {
    void this.pause();
    this._notifyPreview(previewId);
  }

  // -- Internals --

  private _runExclusive<T>(op: () => Promise<T>): Promise<T> {
    const next = this._running.then(op, op);
    this._running = next.catch(() => {});
    return next;
  }

  private async _playSongInternal(
    song: SongResponse,
    audioUrl: string | null,
    token: number,
  ): Promise<void> {
    const stationId = useRadioStore.getState().activeStationId;

    // Try radio path first if a station is active and song has a buffer
    if (stationId && radioEngine.hasBuffer(song.id)) {
      // Make sure the <audio> element isn't producing sound while the
      // worklet plays the same/another song.
      const audio = this._audio;
      if (audio && !audio.paused) audio.pause();

      // Update the UI's "current song" BEFORE awaiting radioEngine.play —
      // see handleRadioEnded for the rationale. Mirrors what the library
      // path below already does.
      usePlayerStore.setState({
        currentSong: song,
        audioUrl: audioUrl ?? null,
        isPlaying: true,
        currentTime: 0,
        duration: radioEngine.duration,
      });
      // Notify previews with null = "main player took focus" so any
      // active preview pauses (regardless of url match).
      this._notifyPreview(null);

      const ok = await radioEngine.play(song.id);
      if (token !== this._opSeq) return;
      if (ok) {
        usePlayerStore.setState({ duration: radioEngine.duration });
        return;
      }
    }

    // Library path. If a station is active, stop the radio first.
    if (stationId) {
      radioEngine.stop();
      useRadioStore.getState().stopStation();
    }

    const url = resolveSongPlaybackUrl(song, audioUrl);
    usePlayerStore.setState({
      currentSong: song,
      audioUrl: url,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
    });
    // Pause all previews — main player just claimed focus.
    this._notifyPreview(null);
    await this._playElement(url, token, /*resumeOnly*/ false);
  }

  private async _playElement(
    url: string,
    token: number,
    resumeOnly: boolean,
  ): Promise<void> {
    const audio = await this._waitForAudio();
    if (!audio) return;
    if (token !== this._opSeq) return;

    if (!resumeOnly && audio.src !== url) {
      // Reset pending seek when switching sources
      this._pendingSeek = null;
      audio.src = url;
      audio.load();
    }

    try {
      await audio.play();
      if (token !== this._opSeq) return;
      usePlayerStore.setState({ isPlaying: true });
    } catch (err) {
      if (token !== this._opSeq) return; // superseded — ignore
      // Real failure (autoplay blocked, decode error, etc.)
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") {
        // Caused by load() superseding play() — caller will retry; don't
        // change state.
        return;
      }
      usePlayerStore.setState({ isPlaying: false });
    }
  }

  private async _restartCurrent(token: number): Promise<void> {
    const { currentSong } = usePlayerStore.getState();
    if (!currentSong) return;
    const stationId = useRadioStore.getState().activeStationId;
    if (stationId && radioEngine.currentSongId === currentSong.id) {
      radioEngine.seek(0);
      radioEngine.resume();
      usePlayerStore.setState({ isPlaying: true, currentTime: 0 });
      return;
    }
    const audio = await this._waitForAudio();
    if (audio) {
      if (isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = 0;
        usePlayerStore.setState({ currentTime: 0 });
      } else {
        this._pendingSeek = 0;
      }
      try {
        await audio.play();
        if (token !== this._opSeq) return;
        usePlayerStore.setState({ isPlaying: true });
      } catch {
        if (token !== this._opSeq) return;
      }
    }
  }

  private _pauseAll(): void {
    const audio = this._audio;
    if (audio && !audio.paused) audio.pause();
    if (useRadioStore.getState().activeStationId && radioEngine.playing) {
      radioEngine.pause();
    }
  }

  private _computeNext(): QueueIndexResult | null {
    const { queue, currentSong, shuffle, repeat } = usePlayerStore.getState();
    if (queue.length === 0) return null;
    const currentIdx = currentSong
      ? queue.findIndex((s) => s.id === currentSong.id)
      : -1;
    let nextIdx: number;
    if (shuffle) {
      if (queue.length === 1) {
        nextIdx = 0;
      } else {
        // Pick any index other than the current
        do {
          nextIdx = Math.floor(Math.random() * queue.length);
        } while (nextIdx === currentIdx);
      }
    } else {
      nextIdx = currentIdx + 1;
      if (nextIdx >= queue.length) {
        if (repeat === "all") nextIdx = 0;
        else return null;
      }
    }
    return { song: queue[nextIdx], index: nextIdx };
  }

  private _notifyPreview(currentUrl: string | null): void {
    for (const listener of this._previewListeners) {
      try {
        listener(currentUrl);
      } catch {
        // listener errors must not break playback
      }
    }
  }

  // -- Audio element event handlers --

  private _onLoadedMetadata(): void {
    const audio = this._audio;
    if (!audio) return;
    if (isFinite(audio.duration) && audio.duration > 0) {
      usePlayerStore.setState({ duration: audio.duration });
    }
    if (this._pendingSeek != null && isFinite(audio.duration) && audio.duration > 0) {
      const t = Math.max(0, Math.min(this._pendingSeek, audio.duration));
      audio.currentTime = t;
      usePlayerStore.setState({ currentTime: t });
      this._pendingSeek = null;
    }
  }

  private _onDurationChange(): void {
    const audio = this._audio;
    if (!audio) return;
    if (isFinite(audio.duration) && audio.duration > 0) {
      usePlayerStore.setState({ duration: audio.duration });
    }
  }

  private _scheduleTimeUpdate(): void {
    if (this._rafToken != null) return;
    if (typeof requestAnimationFrame === "undefined") {
      this._flushTimeUpdate();
      return;
    }
    this._rafToken = requestAnimationFrame(() => {
      this._rafToken = null;
      this._flushTimeUpdate();
    });
  }

  private _flushTimeUpdate(): void {
    const audio = this._audio;
    if (!audio) return;
    if (audio.seeking) return;
    if (Date.now() < this._suppressTimeUpdateUntil) return;
    if (isFinite(audio.currentTime)) {
      usePlayerStore.setState({ currentTime: audio.currentTime });
    }
  }

  private _onAudioEnded(): void {
    const { repeat } = usePlayerStore.getState();
    if (repeat === "one") {
      const audio = this._audio;
      if (audio) {
        audio.currentTime = 0;
        const token = ++this._opSeq;
        audio.play().catch(() => {
          if (token === this._opSeq) {
            usePlayerStore.setState({ isPlaying: false });
          }
        });
        usePlayerStore.setState({ currentTime: 0, isPlaying: true });
      }
      return;
    }
    void this.next();
  }

  private _onAudioError(): void {
    // Audio element produced an error; reflect in store so UI can react.
    usePlayerStore.setState({ isPlaying: false });
  }
}

export const playbackController = new PlaybackController();
export type { PlaybackController };

/**
 * RadioAudioEngine — AudioWorklet-based playback for radio mode.
 *
 * Uses an AudioWorkletNode that holds exclusive ownership of the PCM sample
 * data (transferred via postMessage, zero-copy). The worklet thread has no
 * shared-memory contention with the main thread, and its process() reads from
 * locally-owned Float32Arrays — the most isolated path from memory to audio
 * output possible in a browser.
 *
 * This eliminates audio hiccups when MLX saturates the Metal GPU / unified
 * memory during VAE decode.
 *
 * Library playback continues using the <audio> element unchanged.
 */

function insecureContextHelp(): string {
  // Browsers gate AudioWorklet behind a secure context: https:// or
  // http://localhost (loopback is exempt). The dev launcher serves HTTPS on
  // the same port via a self-signed cert; if we're somehow on plain HTTP
  // anyway, tell the user how to switch.
  if (typeof window === "undefined") {
    return "AudioWorklet requires a secure context.";
  }
  const { hostname, port } = window.location;
  return (
    `AudioWorklet requires a secure context — this page was loaded over plain HTTP from ${hostname}:${port}. ` +
    `Open https://${hostname}:${port} instead and accept the self-signed-cert warning.`
  );
}

class RadioAudioEngine {
  private _ctx: AudioContext | null = null;
  private _gain: GainNode | null = null;
  private _worklet: AudioWorkletNode | null = null;
  private _modulePromise: Promise<void> | null = null;
  private _buffers = new Map<string, AudioBuffer>();
  private _currentSongId: string | null = null;

  private _offset = 0;
  private _startCtxTime = 0;
  private _playing = false;
  private _timeupdateInterval: ReturnType<typeof setInterval> | null = null;

  onended: (() => void) | null = null;
  ontimeupdate: ((time: number) => void) | null = null;
  /** Fired when playback can't start (e.g. AudioWorklet unavailable). */
  onerror: ((message: string) => void) | null = null;

  /**
   * Create the AudioContext and GainNode synchronously.
   * MUST be called within a user gesture (click/tap) so the browser allows
   * the context to enter the "running" state.
   */
  private ensureContextSync(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext({ latencyHint: 1.0, sampleRate: 48000 });
      this._gain = this._ctx.createGain();
      this._gain.connect(this._ctx.destination);
    }
    return this._ctx;
  }

  /**
   * Register the AudioWorklet module (async, but only needs to succeed once).
   * The AudioContext must already exist.
   *
   * Browsers only expose `AudioContext.audioWorklet` in a "secure context"
   * (https:// or http://localhost). When the dev server is reached over a
   * LAN IP like http://192.168.x.x:3000, the property is undefined and we
   * surface a clear error instead of a "Cannot read properties of undefined"
   * crash. If a previous attempt failed, the cached promise is cleared so
   * a later attempt (e.g. once the user opens via localhost) can retry.
   */
  private ensureWorklet(): Promise<void> {
    if (!this._modulePromise) {
      const ctx = this.ensureContextSync();
      if (!ctx.audioWorklet) {
        const reason = !globalThis.isSecureContext
          ? insecureContextHelp()
          : "AudioWorklet is not supported in this browser.";
        return Promise.reject(new Error(reason));
      }
      this._modulePromise = ctx.audioWorklet
        .addModule("/radio-worklet-processor.js")
        .catch((err) => {
          this._modulePromise = null;
          throw err;
        });
    }
    return this._modulePromise;
  }

  /**
   * Call within a user gesture to create + resume the AudioContext before
   * any async work (generation, decoding) begins. This prevents the browser
   * from blocking audio due to expired user gesture.
   */
  warmup(): void {
    const ctx = this.ensureContextSync();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  // -- Buffer management --

  cacheBuffer(songId: string, buffer: AudioBuffer): void {
    this._buffers.set(songId, buffer);
  }

  hasBuffer(songId: string): boolean {
    return this._buffers.has(songId);
  }

  clearBuffers(): void {
    this._buffers.clear();
  }

  // -- Playback --

  async play(songId: string): Promise<boolean> {
    const buffer = this._buffers.get(songId);
    if (!buffer) return false;

    this.stopWorklet();
    // Set immediately so duration getter works before await resolves
    this._currentSongId = songId;
    this._offset = 0;

    try {
      await this.ensureWorklet();
    } catch (err) {
      this._currentSongId = null;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[radioEngine] AudioWorklet unavailable: ${message}`);
      this.onerror?.(message);
      return false;
    }
    const ctx = this._ctx!;

    // If stop() or another play() was called during await, bail out
    if (this._currentSongId !== songId) return false;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Extract channel data — slice() copies from the cached AudioBuffer so the
    // cache stays intact for repeat / re-play. Transfer moves ownership to the
    // worklet thread (zero-copy handoff, no shared memory).
    const channels: Float32Array[] = [];
    const transferables: ArrayBuffer[] = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const copy = buffer.getChannelData(ch).slice();
      channels.push(copy);
      transferables.push(copy.buffer);
    }

    const worklet = new AudioWorkletNode(ctx, "radio-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [buffer.numberOfChannels],
    });
    worklet.connect(this._gain!);
    worklet.port.onmessage = (e) => {
      if (e.data.type === "ended") {
        this._playing = false;
        this._offset = 0;
        this.stopTimeupdateTimer();
        this.onended?.();
      }
    };
    worklet.port.postMessage(
      { type: "load", channels, length: buffer.length, startPos: 0 },
      transferables,
    );

    this._worklet = worklet;
    this._startCtxTime = ctx.currentTime;
    this._playing = true;
    this.startTimeupdateTimer();
    return true;
  }

  pause(): void {
    if (!this._playing || !this._worklet) return;
    this._offset = this.currentTime;
    this._worklet.port.postMessage({ type: "pause" });
    this._playing = false;
    this.stopTimeupdateTimer();
  }

  resume(): void {
    if (this._playing || !this._worklet || !this._ctx) return;
    this._worklet.port.postMessage({ type: "resume" });
    this._startCtxTime = this._ctx.currentTime;
    this._playing = true;
    this.startTimeupdateTimer();
  }

  seek(time: number): void {
    if (!this._worklet) return;
    const buffer = this._currentSongId
      ? this._buffers.get(this._currentSongId)
      : null;
    if (!buffer) return;

    this._offset = Math.max(0, Math.min(time, buffer.duration));
    const samplePos = Math.round(this._offset * buffer.sampleRate);
    this._worklet.port.postMessage({ type: "seek", position: samplePos });
    if (this._playing && this._ctx) {
      this._startCtxTime = this._ctx.currentTime;
    }
  }

  setVolume(v: number): void {
    if (this._gain) {
      this._gain.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  stop(): void {
    this.stopWorklet();
    this._currentSongId = null;
    this._offset = 0;
  }

  get currentTime(): number {
    if (!this._playing || !this._ctx) return this._offset;
    return this._offset + (this._ctx.currentTime - this._startCtxTime);
  }

  get duration(): number {
    const buffer = this._currentSongId
      ? this._buffers.get(this._currentSongId)
      : null;
    return buffer?.duration ?? 0;
  }

  get playing(): boolean {
    return this._playing;
  }

  get currentSongId(): string | null {
    return this._currentSongId;
  }

  get audioContext(): AudioContext | null {
    return this._ctx;
  }

  // -- Internal helpers --

  private stopWorklet(): void {
    if (this._worklet) {
      // Clear the message handler BEFORE posting stop. Any "ended" message
      // the old worklet already queued (or any message that arrives after
      // we move on) must not trigger radioEngine.onended again — that's
      // how spurious "auto-advance" events were skipping a track and
      // leaving the displayed song title out of sync with what was
      // audibly playing.
      this._worklet.port.onmessage = null;
      this._worklet.port.postMessage({ type: "stop" });
      this._worklet.disconnect();
      this._worklet = null;
    }
    this._playing = false;
    this.stopTimeupdateTimer();
  }

  private startTimeupdateTimer(): void {
    this.stopTimeupdateTimer();
    this._timeupdateInterval = setInterval(() => {
      if (this._playing && this.ontimeupdate) {
        this.ontimeupdate(this.currentTime);
      }
    }, 400);
  }

  private stopTimeupdateTimer(): void {
    if (this._timeupdateInterval !== null) {
      clearInterval(this._timeupdateInterval);
      this._timeupdateInterval = null;
    }
  }
}

export const radioEngine = new RadioAudioEngine();

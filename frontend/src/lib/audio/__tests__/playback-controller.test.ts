import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SongResponse } from "@/types/api";

// -- Mock radioEngine before importing the controller --
//
// vi.mock is hoisted; the factory may not reference module-scope vars,
// so we build the mock inside the factory and grab a reference via a
// dynamic import in the test file.

vi.mock("@/lib/audio/radio-engine", () => {
  const mock = {
    playing: false,
    currentSongId: null as string | null,
    duration: 0,
    hasBuffer: vi.fn(() => false),
    play: vi.fn(async (_id: string) => true),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
  };
  return { radioEngine: mock };
});

import { radioEngine } from "@/lib/audio/radio-engine";
import { playbackController } from "../playback-controller";
import { usePlayerStore } from "@/stores/player-store";
import { useRadioStore } from "@/stores/radio-store";

const radioMock = radioEngine as unknown as {
  playing: boolean;
  currentSongId: string | null;
  duration: number;
  hasBuffer: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
};

// -- Helpers --

function makeSong(id: string, overrides: Partial<SongResponse> = {}): SongResponse {
  return {
    id,
    title: `Song ${id}`,
    file_path: `${id}.flac`,
    file_format: "flac",
    duration_seconds: 60,
    sample_rate: 48000,
    file_size_bytes: 1000,
    caption: "",
    lyrics: "",
    bpm: 120,
    keyscale: "C major",
    timesignature: "4/4",
    vocal_language: "en",
    instrumental: false,
    is_favorite: false,
    rating: 0,
    tags: "",
    notes: "",
    parent_song_id: null,
    generation_history_id: null,
    variation_index: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

interface MockAudioOpts {
  /** Resolve play() after this many ms; if undefined, resolve sync. */
  playDelayMs?: number;
  /** If true, play() rejects with AbortError after delay. */
  abortPlay?: boolean;
}

function createMockAudio(opts: MockAudioOpts = {}): HTMLAudioElement {
  // Use a plain object to model the bits the controller touches.
  const listeners = new Map<string, Set<EventListener>>();
  const target = {
    src: "",
    currentTime: 0,
    duration: 60,
    paused: true,
    volume: 1,
    preload: "auto",
    addEventListener(type: string, l: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(l);
    },
    removeEventListener(type: string, l: EventListener) {
      listeners.get(type)?.delete(l);
    },
    dispatch(type: string) {
      const set = listeners.get(type);
      if (!set) return;
      for (const l of set) l(new Event(type));
    },
    load() {
      this.currentTime = 0;
    },
    async play() {
      if (opts.playDelayMs) {
        await new Promise((r) => setTimeout(r, opts.playDelayMs));
      }
      if (opts.abortPlay) {
        const err = new DOMException("aborted", "AbortError");
        throw err;
      }
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
  };
  return target as unknown as HTMLAudioElement;
}

// jsdom doesn't ship requestAnimationFrame in some versions — make it
// deterministic for tests.
beforeEach(() => {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(0), 0) as unknown as number;
    },
  });

  // Reset mocks
  radioMock.playing = false;
  radioMock.currentSongId = null;
  radioMock.duration = 0;
  radioMock.hasBuffer.mockReset().mockReturnValue(false);
  radioMock.play.mockReset().mockImplementation(async (id: string) => {
    radioMock.currentSongId = id;
    radioMock.playing = true;
    return true;
  });
  radioMock.pause.mockReset();
  radioMock.resume.mockReset();
  radioMock.seek.mockReset();
  radioMock.stop.mockReset().mockImplementation(() => {
    radioMock.currentSongId = null;
    radioMock.playing = false;
  });
  radioMock.setVolume.mockReset();

  // Reset stores
  usePlayerStore.setState(usePlayerStore.getInitialState());
  useRadioStore.setState({
    activeStationId: null,
    pendingStationId: null,
    isGenerating: false,
    songsGenerated: 0,
    stations: [],
  });
  // Detach any prior audio element so each test attaches its own.
  playbackController.detachAudioElement();
});

describe("PlaybackController.playSong", () => {
  it("sets currentSong, src, and isPlaying for a library song", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    const song = makeSong("a");

    await playbackController.playSong(song, "http://test/a.flac");

    expect(usePlayerStore.getState().currentSong?.id).toBe("a");
    expect(audio.src).toBe("http://test/a.flac");
    expect(audio.paused).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("rapid playSong(A)->playSong(B) only ends with B playing", async () => {
    const audio = createMockAudio({ playDelayMs: 30 });
    playbackController.attachAudioElement(audio);
    const a = makeSong("a");
    const b = makeSong("b");

    const p1 = playbackController.playSong(a, "http://test/a.flac");
    const p2 = playbackController.playSong(b, "http://test/b.flac");
    await Promise.all([p1, p2]);

    expect(audio.src).toBe("http://test/b.flac");
    expect(usePlayerStore.getState().currentSong?.id).toBe("b");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});

describe("PlaybackController.toggle", () => {
  it("rapid toggle calls converge on a deterministic state", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    const song = makeSong("a");
    await playbackController.playSong(song, "http://test/a.flac");

    // Five rapid toggles starting from playing=true => odd count => paused.
    await Promise.all([
      playbackController.toggle(),
      playbackController.toggle(),
      playbackController.toggle(),
      playbackController.toggle(),
      playbackController.toggle(),
    ]);

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(audio.paused).toBe(true);
  });
});

describe("PlaybackController.next at end-of-queue", () => {
  it("with repeat=off, next stops both engines", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    const songs = [makeSong("a"), makeSong("b")];
    await playbackController.playFromQueue(songs, songs[1], {
      a: "http://test/a.flac",
      b: "http://test/b.flac",
    });
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await playbackController.next();

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(audio.paused).toBe(true);
  });

  it("with repeat=all, next wraps to the first song", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    const songs = [makeSong("a"), makeSong("b")];
    usePlayerStore.setState({ repeat: "all" });
    await playbackController.playFromQueue(songs, songs[1], {
      a: "http://test/a.flac",
      b: "http://test/b.flac",
    });

    await playbackController.next();

    expect(usePlayerStore.getState().currentSong?.id).toBe("a");
    expect(audio.src).toBe("http://test/a.flac");
  });

  it("in radio mode, next at end calls radioEngine.pause", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    useRadioStore.setState({ activeStationId: "station-1" });
    radioMock.hasBuffer.mockReturnValue(true);
    radioMock.playing = true;

    const songs = [makeSong("a")];
    usePlayerStore.setState({
      currentSong: songs[0],
      queue: songs,
      isPlaying: true,
    });

    await playbackController.next();

    expect(radioMock.pause).toHaveBeenCalled();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });
});

describe("PlaybackController.previous at index 0", () => {
  it("restarts the current song from 0", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    const songs = [makeSong("a"), makeSong("b")];
    await playbackController.playFromQueue(songs, songs[0], {
      a: "http://test/a.flac",
      b: "http://test/b.flac",
    });
    audio.currentTime = 30;

    await playbackController.previous();

    expect(usePlayerStore.getState().currentSong?.id).toBe("a");
    expect(audio.currentTime).toBe(0);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});

describe("PlaybackController.seek", () => {
  it("applies seek immediately when metadata is loaded", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    const song = makeSong("a");
    await playbackController.playSong(song, "http://test/a.flac");
    (audio as unknown as { dispatch: (t: string) => void }).dispatch("loadedmetadata");

    playbackController.seek(15);

    expect(audio.currentTime).toBe(15);
    expect(usePlayerStore.getState().currentTime).toBe(15);
  });

  it("ignores timeupdate events while seeking and during the suppression window", async () => {
    const audio = createMockAudio();
    Object.defineProperty(audio, "seeking", {
      configurable: true,
      writable: true,
      value: false,
    });
    playbackController.attachAudioElement(audio);
    const song = makeSong("a");
    await playbackController.playSong(song, "http://test/a.flac");
    (audio as unknown as { dispatch: (t: string) => void }).dispatch("loadedmetadata");

    // Seek to 30s.
    playbackController.seek(30);
    expect(usePlayerStore.getState().currentTime).toBe(30);

    // Simulate the browser dispatching a stale timeupdate that reads
    // the OLD currentTime back. Before our suppression window, this
    // would have snapped the slider back. Now it must be ignored.
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      writable: true,
      value: 5,
    });
    (audio as unknown as { dispatch: (t: string) => void }).dispatch("timeupdate");
    // Process pending RAF
    await new Promise((r) => setTimeout(r, 5));
    expect(usePlayerStore.getState().currentTime).toBe(30);
  });

  it("defers seek until loadedmetadata when duration is unknown", async () => {
    const audio = createMockAudio();
    Object.defineProperty(audio, "duration", {
      configurable: true,
      get() {
        return NaN;
      },
    });
    playbackController.attachAudioElement(audio);
    const song = makeSong("a");
    await playbackController.playSong(song, "http://test/a.flac");

    playbackController.seek(20);
    expect(audio.currentTime).toBe(0);

    // Now metadata becomes available
    Object.defineProperty(audio, "duration", {
      configurable: true,
      writable: true,
      value: 60,
    });
    (audio as unknown as { dispatch: (t: string) => void }).dispatch("loadedmetadata");

    expect(audio.currentTime).toBe(20);
    expect(usePlayerStore.getState().currentTime).toBe(20);
  });
});

describe("PlaybackController mode invariant", () => {
  it("library->radio->library transitions never leave both engines audible", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);

    // Play a library song
    await playbackController.playSong(makeSong("lib1"), "http://test/lib1.flac");
    expect(audio.paused).toBe(false);
    expect(radioMock.playing).toBe(false);

    // Enter radio mode and start a radio song (simulate)
    useRadioStore.setState({ activeStationId: "station-1" });
    radioMock.hasBuffer.mockReturnValue(true);
    await playbackController.playSong(makeSong("rad1"));
    expect(radioMock.play).toHaveBeenCalledWith("rad1");
    expect(audio.paused).toBe(true); // <audio> stays paused while radio plays

    // Switch back to a library song while radio is active.
    radioMock.hasBuffer.mockReturnValue(false);
    await playbackController.playSong(makeSong("lib2"), "http://test/lib2.flac");
    expect(radioMock.stop).toHaveBeenCalled();
    expect(useRadioStore.getState().activeStationId).toBeNull();
    expect(audio.src).toBe("http://test/lib2.flac");
    expect(audio.paused).toBe(false);
  });
});

describe("PlaybackController.handleRadioEnded", () => {
  it("stops radio when playNext returns null with repeat=off", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    useRadioStore.setState({ activeStationId: "station-1" });
    radioMock.hasBuffer.mockReturnValue(true);
    radioMock.playing = true;

    const songs = [makeSong("a")];
    usePlayerStore.setState({
      currentSong: songs[0],
      queue: songs,
      isPlaying: true,
    });

    playbackController.handleRadioEnded();
    // Wait for the chained promise
    await new Promise((r) => setTimeout(r, 0));

    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(radioMock.pause).toHaveBeenCalled();
    // Crucial: should NOT replay the just-finished song.
    expect(radioMock.play).not.toHaveBeenCalled();
  });

  it("repeat=one replays the current song", async () => {
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    useRadioStore.setState({ activeStationId: "station-1" });
    radioMock.hasBuffer.mockReturnValue(true);

    const song = makeSong("a");
    usePlayerStore.setState({
      currentSong: song,
      queue: [song],
      repeat: "one",
      isPlaying: true,
    });

    playbackController.handleRadioEnded();
    await new Promise((r) => setTimeout(r, 0));

    expect(radioMock.play).toHaveBeenCalledWith("a");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("auto-advances currentSong BEFORE awaiting radioEngine.play", async () => {
    // Regression test for "radio shows the previous song's title for a
    // brief window while the next track is already audible." The store's
    // currentSong must flip to the next track as soon as we decide to
    // play it, not after radioEngine.play resolves.
    const audio = createMockAudio();
    playbackController.attachAudioElement(audio);
    useRadioStore.setState({ activeStationId: "station-1" });
    radioMock.hasBuffer.mockReturnValue(true);
    radioMock.playing = true;

    let resolvePlay: (value: boolean) => void = () => {};
    radioMock.play.mockImplementation(
      (id: string) =>
        new Promise<boolean>((resolve) => {
          radioMock.currentSongId = id;
          radioMock.playing = true;
          resolvePlay = resolve;
        }),
    );

    const a = makeSong("a");
    const b = makeSong("b");
    usePlayerStore.setState({
      currentSong: a,
      queue: [a, b],
      queueAudioUrls: { a: "http://test/a.flac", b: "http://test/b.flac" },
      isPlaying: true,
    });

    playbackController.handleRadioEnded();
    // Yield to microtasks so handleRadioEnded reaches the await
    await Promise.resolve();
    await Promise.resolve();

    // The title (currentSong) must already show b even though play()
    // hasn't resolved yet.
    expect(usePlayerStore.getState().currentSong?.id).toBe("b");

    resolvePlay(true);
    await new Promise((r) => setTimeout(r, 0));

    expect(usePlayerStore.getState().currentSong?.id).toBe("b");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWaveSurfer } from "../use-wavesurfer";

// Mock WaveSurfer.js
const mockPlay = vi.fn();
const mockPause = vi.fn();
const mockPlayPause = vi.fn();
const mockSeekTo = vi.fn();
const mockDestroy = vi.fn();
const mockGetDuration = vi.fn().mockReturnValue(200);
const mockOn = vi.fn();

const mockWsInstance = {
  play: mockPlay,
  pause: mockPause,
  playPause: mockPlayPause,
  seekTo: mockSeekTo,
  destroy: mockDestroy,
  getDuration: mockGetDuration,
  on: mockOn,
};

vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn(() => mockWsInstance),
  },
}));

function createContainerRef() {
  const div = document.createElement("div");
  return { current: div };
}

describe("useWaveSurfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state with no URL", () => {
    const containerRef = createContainerRef();
    const { result } = renderHook(() => useWaveSurfer(containerRef, null));

    expect(result.current.isReady).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
  });

  it("initializes WaveSurfer with a URL", async () => {
    const containerRef = createContainerRef();
    const { result } = renderHook(() =>
      useWaveSurfer(containerRef, "http://test/audio.flac", { height: 80 }),
    );

    // Wait for the async init
    await vi.dynamicImportSettled();

    const WaveSurfer = (await import("wavesurfer.js")).default;
    expect(WaveSurfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        container: containerRef.current,
        height: 80,
        url: "http://test/audio.flac",
      }),
    );
  });

  it("destroys WaveSurfer on unmount", async () => {
    const containerRef = createContainerRef();
    const { unmount } = renderHook(() =>
      useWaveSurfer(containerRef, "http://test/audio.flac"),
    );

    await vi.dynamicImportSettled();
    unmount();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it("exposes play, pause, playPause, seekTo callbacks", () => {
    const containerRef = createContainerRef();
    const { result } = renderHook(() => useWaveSurfer(containerRef, null));

    expect(typeof result.current.play).toBe("function");
    expect(typeof result.current.pause).toBe("function");
    expect(typeof result.current.playPause).toBe("function");
    expect(typeof result.current.seekTo).toBe("function");
  });

  it("destroys and recreates when URL changes", async () => {
    const containerRef = createContainerRef();
    const { rerender } = renderHook(
      ({ url }) => useWaveSurfer(containerRef, url),
      { initialProps: { url: "http://test/a.flac" as string | null } },
    );

    await vi.dynamicImportSettled();

    rerender({ url: "http://test/b.flac" });
    // Cleanup of old instance triggers destroy
    expect(mockDestroy).toHaveBeenCalled();
  });
});

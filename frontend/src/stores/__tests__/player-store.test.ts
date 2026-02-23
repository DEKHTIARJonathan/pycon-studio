import { describe, it, expect, beforeEach } from "vitest";
import { usePlayerStore } from "../player-store";
import type { SongResponse } from "@/types/api";

function makeSong(overrides: Partial<SongResponse> = {}): SongResponse {
  return {
    id: "song-1",
    title: "Test Song",
    file_path: "test.flac",
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

describe("player-store", () => {
  beforeEach(() => {
    usePlayerStore.setState(usePlayerStore.getInitialState());
  });

  it("has correct initial state", () => {
    const state = usePlayerStore.getState();
    expect(state.currentSong).toBeNull();
    expect(state.audioUrl).toBeNull();
    expect(state.queue).toEqual([]);
    expect(state.queueAudioUrls).toEqual({});
    expect(state.isPlaying).toBe(false);
    expect(state.currentTime).toBe(0);
    expect(state.duration).toBe(0);
    expect(state.volume).toBe(0.8);
    expect(state.muted).toBe(false);
    expect(state.shuffle).toBe(false);
    expect(state.repeat).toBe("off");
    expect(state.showFullPlayer).toBe(false);
    expect(state.showMiniQueue).toBe(false);
  });

  it("setVolume updates volume and auto-mutes at 0", () => {
    usePlayerStore.getState().setVolume(0);
    expect(usePlayerStore.getState().volume).toBe(0);
    expect(usePlayerStore.getState().muted).toBe(true);

    usePlayerStore.getState().setVolume(0.5);
    expect(usePlayerStore.getState().volume).toBe(0.5);
    expect(usePlayerStore.getState().muted).toBe(false);
  });

  it("toggleMute flips muted state", () => {
    usePlayerStore.getState().toggleMute();
    expect(usePlayerStore.getState().muted).toBe(true);
    usePlayerStore.getState().toggleMute();
    expect(usePlayerStore.getState().muted).toBe(false);
  });

  it("toggleShuffle flips shuffle state", () => {
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(true);
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(false);
  });

  it("cycleRepeat cycles through off -> all -> one -> off", () => {
    expect(usePlayerStore.getState().repeat).toBe("off");

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("all");

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("one");

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("off");
  });

  it("setQueue replaces the queue and audio urls", () => {
    const songs = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    usePlayerStore.getState().setQueue(songs, { a: "url-a" });
    expect(usePlayerStore.getState().queue).toEqual(songs);
    expect(usePlayerStore.getState().queueAudioUrls).toEqual({ a: "url-a" });
  });

  it("addToQueue appends and stores optional audioUrl", () => {
    const song1 = makeSong({ id: "s1" });
    const song2 = makeSong({ id: "s2" });

    usePlayerStore.getState().addToQueue(song1, "url-1");
    expect(usePlayerStore.getState().queue).toHaveLength(1);
    expect(usePlayerStore.getState().queueAudioUrls).toEqual({ s1: "url-1" });

    usePlayerStore.getState().addToQueue(song2);
    expect(usePlayerStore.getState().queue).toHaveLength(2);
    expect(usePlayerStore.getState().queueAudioUrls).toEqual({ s1: "url-1" });
  });

  it("removeFromQueue removes the song and its url", () => {
    const songs = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    usePlayerStore.getState().setQueue(songs, { a: "url-a", b: "url-b" });

    usePlayerStore.getState().removeFromQueue("a");
    expect(usePlayerStore.getState().queue.map((s) => s.id)).toEqual(["b"]);
    expect(usePlayerStore.getState().queueAudioUrls).toEqual({ b: "url-b" });
  });

  it("toggleFullPlayer flips showFullPlayer", () => {
    usePlayerStore.getState().toggleFullPlayer();
    expect(usePlayerStore.getState().showFullPlayer).toBe(true);

    usePlayerStore.getState().toggleFullPlayer();
    expect(usePlayerStore.getState().showFullPlayer).toBe(false);
  });

  it("toggleFullPlayer also closes the mini queue", () => {
    usePlayerStore.setState({ showMiniQueue: true });
    usePlayerStore.getState().toggleFullPlayer();
    expect(usePlayerStore.getState().showMiniQueue).toBe(false);
  });

  it("toggleMiniQueue flips showMiniQueue", () => {
    usePlayerStore.getState().toggleMiniQueue();
    expect(usePlayerStore.getState().showMiniQueue).toBe(true);
    usePlayerStore.getState().toggleMiniQueue();
    expect(usePlayerStore.getState().showMiniQueue).toBe(false);
  });
});

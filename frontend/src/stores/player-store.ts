/**
 * Player state store.
 *
 * NOTE: Playback (calling audio.play(), pausing the radio engine, queue
 * indexing for next/previous, etc.) is owned by PlaybackController in
 * `@/lib/audio/playback-controller`. This store holds only the data the
 * UI renders. Components should call controller methods to change
 * playback; only the controller writes `isPlaying`, `currentTime`,
 * `duration`, `currentSong`, and `audioUrl`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SongResponse } from "@/types/api";

interface PlayerState {
  // Playback data (controller-owned for write)
  currentSong: SongResponse | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // Queue
  queue: SongResponse[];
  queueAudioUrls: Record<string, string>;

  // User preferences
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";

  // UI state
  showFullPlayer: boolean;
  showMiniQueue: boolean;

  // Public setters (UI-safe; do not directly start/stop playback)
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setQueue: (songs: SongResponse[], audioUrls?: Record<string, string>) => void;
  addToQueue: (song: SongResponse, audioUrl?: string) => void;
  removeFromQueue: (songId: string) => void;
  toggleFullPlayer: () => void;
  toggleMiniQueue: () => void;
}

export const usePlayerStore = create<PlayerState>()(persist((set) => ({
  currentSong: null,
  audioUrl: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  queue: [],
  queueAudioUrls: {},
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  showFullPlayer: false,
  showMiniQueue: false,

  setVolume: (volume) => set({ volume, muted: volume === 0 }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => {
      const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
      const idx = modes.indexOf(s.repeat);
      return { repeat: modes[(idx + 1) % modes.length] };
    }),
  setQueue: (songs, audioUrls) =>
    set({ queue: songs, queueAudioUrls: audioUrls ?? {} }),
  addToQueue: (song, audioUrl) =>
    set((s) => ({
      queue: [...s.queue, song],
      queueAudioUrls: audioUrl
        ? { ...s.queueAudioUrls, [song.id]: audioUrl }
        : s.queueAudioUrls,
    })),
  removeFromQueue: (songId) =>
    set((s) => {
      const nextUrls = { ...s.queueAudioUrls };
      delete nextUrls[songId];
      return {
        queue: s.queue.filter((song) => song.id !== songId),
        queueAudioUrls: nextUrls,
      };
    }),
  toggleFullPlayer: () =>
    set((s) => ({ showFullPlayer: !s.showFullPlayer, showMiniQueue: false })),
  toggleMiniQueue: () => set((s) => ({ showMiniQueue: !s.showMiniQueue })),
}), {
  name: "pip-install-bangers-player",
  // Only persist user preferences. Playback state and queue are runtime
  // concerns; rehydrating them led to stale URLs and confusing behavior
  // when the dev server restarted.
  partialize: (state) => ({
    volume: state.volume,
    muted: state.muted,
    shuffle: state.shuffle,
    repeat: state.repeat,
  }),
}));

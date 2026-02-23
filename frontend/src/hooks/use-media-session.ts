"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { playbackController } from "@/lib/audio/playback-controller";

export function useMediaSession() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Wire up media key action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => { void playbackController.resume(); }],
      ["pause", () => { void playbackController.pause(); }],
      ["nexttrack", () => { void playbackController.next(); }],
      ["previoustrack", () => { void playbackController.previous(); }],
    ];

    for (const [action, handler] of handlers) {
      navigator.mediaSession.setActionHandler(action, handler);
    }

    return () => {
      for (const [action] of handlers) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, []);

  // Update metadata when current song changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.caption || "conda install bangers",
        album: "conda install bangers",
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentSong]);

  // Update playback state
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);
}

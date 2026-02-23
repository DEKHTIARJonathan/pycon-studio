"use client";

import { playbackController } from "@/lib/audio/playback-controller";

/**
 * Returns the singleton PlaybackController. Use this from UI components
 * to drive playback (play, pause, seek, next, previous). Reads of
 * playback state should still go through usePlayerStore so React
 * re-renders correctly.
 */
export function usePlaybackController() {
  return playbackController;
}

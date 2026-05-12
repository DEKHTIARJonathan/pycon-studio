"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRadioStore } from "@/stores/radio-store";
import { usePlayerStore } from "@/stores/player-store";
import { generateNextTrack } from "@/lib/api/radio-client";
import { getSongAudioUrl } from "@/lib/api/client";
import { radioEngine } from "@/lib/audio/radio-engine";
import { playbackController } from "@/lib/audio/playback-controller";
import {
  acquireGenLock,
  releaseGenLock,
  forceReleaseGenLock,
  createRadioAbortController,
  abortRadioRequests,
  decodeAndCacheAudio,
} from "@/lib/audio/radio-helpers";
import { useGpuStore } from "@/stores/gpu-store";
import { toast } from "sonner";
import type { SongResponse } from "@/types/api";

// Monotonically increasing session counter. Each startStation call gets a new
// session. Async continuations bail out when the session has changed (i.e. the
// station was stopped or restarted).
let _sessionCounter = 0;
let _activeSession = 0;

export function useRadio() {
  const queryClient = useQueryClient();
  const activeStationId = useRadioStore((s) => s.activeStationId);
  const pendingStationId = useRadioStore((s) => s.pendingStationId);
  const isGenerating = useRadioStore((s) => s.isGenerating);
  const setIsGenerating = useRadioStore((s) => s.setIsGenerating);
  const incrementSongsGenerated = useRadioStore((s) => s.incrementSongsGenerated);
  const stopStationBase = useRadioStore((s) => s.stopStation);

  const setQueue = usePlayerStore((s) => s.setQueue);

  const startStation = useCallback(
    async (stationId: string) => {
      const currentActiveStationId = useRadioStore.getState().activeStationId;
      if (currentActiveStationId) {
        if (currentActiveStationId !== stationId) {
          useRadioStore.getState().setPendingStation(stationId);
        }
        return;
      }

      // Abort any in-flight requests from a previous session
      abortRadioRequests();
      forceReleaseGenLock();
      radioEngine.stop();
      radioEngine.clearBuffers();

      // Must be called synchronously within user gesture to unlock AudioContext
      radioEngine.warmup();

      // Start a new session
      _sessionCounter += 1;
      const session = _sessionCounter;
      _activeSession = session;

      const abortCtrl = createRadioAbortController();
      const signal = abortCtrl.signal;

      useRadioStore.getState().startStation(stationId);
      useGpuStore.getState().setHolder("radio");
      acquireGenLock();

      setIsGenerating(true);
      try {
        const result1 = await generateNextTrack(stationId, signal);
        if (session !== _activeSession) return; // cancelled

        if (!result1.success || !result1.song) {
          toast.error("Radio generation failed", {
            description: result1.error ?? "Unknown error",
          });
          radioEngine.stop();
          useRadioStore.getState().stopStation();
          usePlayerStore.setState({ isPlaying: false });
          return;
        }

        if (result1.success && result1.song) {
          const song1 = result1.song as SongResponse;
          const url1 = getSongAudioUrl(song1.id);

          await decodeAndCacheAudio(song1.id);
          if (session !== _activeSession) return; // cancelled

          // Cache buffer BEFORE handing off to the controller — the
          // controller checks radioEngine.hasBuffer() to take the radio
          // path instead of the <audio> path.
          setQueue([song1], { [song1.id]: url1 });
          await playbackController.playSong(song1, url1);
          if (session !== _activeSession) return; // cancelled
          incrementSongsGenerated();
        }
      } catch (err) {
        // Abort errors are expected when session is cancelled
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        // Only clean up if this is still the active session
        if (session === _activeSession) {
          queryClient.invalidateQueries({ queryKey: ["stations"] });
          queryClient.invalidateQueries({ queryKey: ["station-detail", stationId] });
          releaseGenLock();
          setIsGenerating(false);
          useGpuStore.getState().clear();
        }
      }
    },
    [setQueue, setIsGenerating, incrementSongsGenerated, queryClient],
  );

  const stopStation = useCallback(() => {
    // Invalidate the current session so any in-flight async work bails out
    _sessionCounter += 1;
    _activeSession = _sessionCounter;

    // Abort all in-flight fetch requests
    abortRadioRequests();

    // Force-release the gen lock so useRadioPlayback doesn't get stuck
    forceReleaseGenLock();

    radioEngine.stop();
    radioEngine.clearBuffers();
    stopStationBase();
    useGpuStore.getState().clear();
  }, [stopStationBase]);

  return {
    activeStationId,
    pendingStationId,
    isGenerating,
    startStation,
    stopStation,
    songsGenerated: useRadioStore.getState().songsGenerated,
  };
}

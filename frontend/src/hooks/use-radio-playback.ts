"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRadioStore } from "@/stores/radio-store";
import { usePlayerStore } from "@/stores/player-store";
import { generateNextTrack } from "@/lib/api/radio-client";
import { getSongAudioUrl } from "@/lib/api/client";
import { radioEngine } from "@/lib/audio/radio-engine";
import { ambientNoise } from "@/lib/audio/ambient-noise";
import { useAmbientStore } from "@/stores/ambient-store";
import { playbackController } from "@/lib/audio/playback-controller";
import {
  BUFFER_THRESHOLD,
  RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  acquireGenLock,
  releaseGenLock,
  isGenLocked,
  getRadioSignal,
  decodeAndCacheAudio,
  prefetchAudio,
} from "@/lib/audio/radio-helpers";
import { useGpuStore } from "@/stores/gpu-store";
import { toast } from "sonner";
import type { SongResponse } from "@/types/api";

/**
 * Persistent radio playback hook — runs in AppShell so callbacks survive
 * tab navigation. No-op when no station is active.
 */
export function useRadioPlayback(): void {
  const queryClient = useQueryClient();
  const activeStationId = useRadioStore((s) => s.activeStationId);
  const pendingStationId = useRadioStore((s) => s.pendingStationId);
  const isGenerating = useRadioStore((s) => s.isGenerating);
  const setIsGenerating = useRadioStore((s) => s.setIsGenerating);
  const incrementSongsGenerated = useRadioStore((s) => s.incrementSongsGenerated);

  const queue = usePlayerStore((s) => s.queue);
  const currentSong = usePlayerStore((s) => s.currentSong);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retryDelayRef = useRef(RETRY_DELAY_MS);

  const generateTrack = useCallback(async () => {
    const radioState = useRadioStore.getState();
    const stationId = radioState.pendingStationId ?? radioState.activeStationId;
    if (!stationId || !acquireGenLock()) return;

    const signal = getRadioSignal();

    useGpuStore.getState().setHolder("radio");
    setIsGenerating(true);
    try {
      const result = await generateNextTrack(stationId, signal);

      // Bail out if station was stopped or the pending target changed during
      // the request. The generated file may exist, but it should not enter the
      // active radio queue.
      const latestRadioState = useRadioStore.getState();
      const latestTargetId = latestRadioState.pendingStationId ?? latestRadioState.activeStationId;
      if (!latestRadioState.activeStationId || latestTargetId !== stationId) {
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
        return;
      }

      if (!result.success || !result.song) {
        toast.error("Radio generation failed", {
          description: result.error ?? "Unknown error",
        });
        radioEngine.stop();
        useRadioStore.getState().stopStation();
        usePlayerStore.setState({ isPlaying: false });
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
        return;
      }

      if (result.success && result.song) {
        const song = result.song as SongResponse;
        const audioUrl = getSongAudioUrl(song.id);

        const { currentSong: current, setQueue, addToQueue } = usePlayerStore.getState();
        if (!current) {
          await decodeAndCacheAudio(song.id);
          if (!useRadioStore.getState().activeStationId) {
            releaseGenLock();
            setIsGenerating(false);
            useGpuStore.getState().clear();
            return;
          }
          // Buffer is cached; route through the controller so the
          // <audio> element + radio engine stay in sync (mode invariant).
          setQueue([song], { [song.id]: audioUrl });
          await playbackController.playSong(song, audioUrl);
        } else {
          const switchingToPending = useRadioStore.getState().pendingStationId === stationId;
          if (switchingToPending) {
            await decodeAndCacheAudio(song.id);
            const latestState = useRadioStore.getState();
            const latestTarget = latestState.pendingStationId ?? latestState.activeStationId;
            if (!latestState.activeStationId || latestTarget !== stationId) {
              releaseGenLock();
              setIsGenerating(false);
              useGpuStore.getState().clear();
              return;
            }
          }
          const currentUrls = usePlayerStore.getState().queueAudioUrls;
          if (switchingToPending) {
            setQueue(
              [current, song],
              {
                ...(current.id in currentUrls ? { [current.id]: currentUrls[current.id] } : {}),
                [song.id]: audioUrl,
              },
            );
            useRadioStore.getState().promotePendingStation();
          } else {
            addToQueue(song);
            usePlayerStore.setState({
              queueAudioUrls: { ...currentUrls, [song.id]: audioUrl },
            });
            prefetchAudio(song.id);
          }
        }
        incrementSongsGenerated();

        queryClient.invalidateQueries({ queryKey: ["stations"] });
        queryClient.invalidateQueries({ queryKey: ["station-detail", stationId] });
        retryDelayRef.current = RETRY_DELAY_MS;
      }
    } catch (err) {
      // Abort errors are expected on stop — don't retry
      if (err instanceof DOMException && err.name === "AbortError") {
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
        return;
      }

      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
      retryTimeoutRef.current = setTimeout(() => {
        releaseGenLock();
        setIsGenerating(false);
        useGpuStore.getState().clear();
      }, delay);
      return;
    }
    releaseGenLock();
    setIsGenerating(false);
    useGpuStore.getState().clear();
  }, [setIsGenerating, incrementSongsGenerated, queryClient]);

  // Wire engine ontimeupdate
  useEffect(() => {
    if (!activeStationId) {
      radioEngine.ontimeupdate = null;
      return;
    }
    radioEngine.ontimeupdate = (time: number) => {
      usePlayerStore.setState({ currentTime: time });
    };
    return () => {
      radioEngine.ontimeupdate = null;
    };
  }, [activeStationId]);

  // Wire engine onerror: surface AudioWorklet failures (e.g. insecure
  // context when the app is reached via LAN IP) instead of letting an
  // uncaught rejection bubble to the runtime overlay.
  useEffect(() => {
    if (!activeStationId) {
      radioEngine.onerror = null;
      return;
    }
    radioEngine.onerror = (message: string) => {
      toast.error("Radio playback unavailable", { description: message });
      useRadioStore.getState().stopStation();
      usePlayerStore.setState({ isPlaying: false });
    };
    return () => {
      radioEngine.onerror = null;
    };
  }, [activeStationId]);

  // Wire engine onended: route through controller so the
  // repeat/playNext/stop logic lives in one place.
  useEffect(() => {
    if (!activeStationId) {
      radioEngine.onended = null;
      return;
    }
    radioEngine.onended = () => {
      playbackController.handleRadioEnded();
    };
    return () => {
      radioEngine.onended = null;
    };
  }, [activeStationId]);

  // Auto-generate when buffer is low
  useEffect(() => {
    if (!activeStationId || isGenLocked() || isGenerating) return;

    const currentIdx = currentSong
      ? queue.findIndex((s) => s.id === currentSong.id)
      : -1;
    const remaining = queue.length - currentIdx - 1;

    if (pendingStationId || remaining < BUFFER_THRESHOLD) {
      generateTrack();
    }
  }, [activeStationId, pendingStationId, queue.length, currentSong?.id, isGenerating, generateTrack]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Ambient noise: start/stop with station
  useEffect(() => {
    if (activeStationId) {
      const ctx = radioEngine.audioContext;
      if (ctx) {
        ambientNoise.attachContext(ctx);
        const { enabled, effect, volume } = useAmbientStore.getState();
        ambientNoise.setConfig({ effect, volume });
        if (enabled) ambientNoise.start();
      }
    } else {
      ambientNoise.stop();
    }
    return () => {
      ambientNoise.stop();
    };
  }, [activeStationId]);

  // Ambient noise: react to store changes in real-time
  useEffect(() => {
    const unsub = useAmbientStore.subscribe((state) => {
      if (!activeStationId) return;
      ambientNoise.setConfig({ effect: state.effect, volume: state.volume });
      if (state.enabled && !ambientNoise.running) {
        const ctx = radioEngine.audioContext;
        if (ctx) {
          ambientNoise.attachContext(ctx);
          ambientNoise.start();
        }
      } else if (!state.enabled && ambientNoise.running) {
        ambientNoise.stop();
      }
    });
    return unsub;
  }, [activeStationId]);
}

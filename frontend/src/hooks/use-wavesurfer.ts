"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import { playbackController } from "@/lib/audio/playback-controller";

// Cache resolved primary rgb to avoid repeated DOM thrashing
let _primaryRgbCache: { theme: string; rgb: [number, number, number] } | null = null;

function resolvePrimaryRgb(): [number, number, number] | null {
  if (typeof document === "undefined") return null;
  const theme = document.documentElement.getAttribute("data-theme") ?? "__default__";
  if (_primaryRgbCache?.theme === theme) return _primaryRgbCache.rgb;

  // Let the browser fully resolve var(--primary) to a background color,
  // then draw it to a 1x1 canvas and read back the pixel to get reliable RGB
  const temp = document.createElement("div");
  temp.style.backgroundColor = "var(--primary)";
  temp.style.position = "fixed";
  temp.style.left = "-9999px";
  temp.style.width = "1px";
  temp.style.height = "1px";
  document.body.appendChild(temp);
  const resolved = getComputedStyle(temp).backgroundColor;
  temp.remove();

  if (!resolved || resolved === "transparent" || resolved === "rgba(0, 0, 0, 0)") {
    return null;
  }

  // Draw the resolved color to a canvas and read the pixel
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = resolved;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  _primaryRgbCache = { theme, rgb: [r, g, b] };
  return [r, g, b];
}

export function getPrimaryColor(opacity: number): string {
  const rgb = resolvePrimaryRgb();
  if (!rgb) return `rgba(168, 85, 247, ${opacity})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
}

export const WAVESURFER_DEFAULTS = {
  cursorColor: "transparent",
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
} as const;

interface WaveSurferOptions {
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  barWidth?: number;
  barGap?: number;
  barRadius?: number;
  interact?: boolean;
}

interface WaveSurferReturn {
  wsRef: RefObject<unknown>;
  isReady: boolean;
  hasError: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  playPause: () => void;
  seekTo: (progress: number) => void;
}

export function useWaveSurfer(
  containerRef: RefObject<HTMLDivElement | null>,
  url: string | null | undefined,
  options: WaveSurferOptions = {},
): WaveSurferReturn {
  const wsRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    let rafId: number;
    let unsubPreview: (() => void) | undefined;

    async function init() {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      if (cancelled || !containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: options.waveColor ?? getPrimaryColor(0.4),
        progressColor: options.progressColor ?? getPrimaryColor(0.8),
        cursorColor: options.cursorColor ?? WAVESURFER_DEFAULTS.cursorColor,
        barWidth: options.barWidth ?? WAVESURFER_DEFAULTS.barWidth,
        barGap: options.barGap ?? WAVESURFER_DEFAULTS.barGap,
        barRadius: options.barRadius ?? WAVESURFER_DEFAULTS.barRadius,
        height: options.height ?? 48,
        interact: options.interact,
        url: url!,
      });

      ws.on("ready", () => {
        if (cancelled) return;
        setIsReady(true);
        setDuration(ws.getDuration());
      });

      ws.on("decode", () => {
        if (cancelled) return;
        setDuration(ws.getDuration());
      });

      ws.on("timeupdate", (time: number) => {
        if (cancelled) return;
        setCurrentTime(time);
      });

      ws.on("error", () => {
        if (cancelled) return;
        setHasError(true);
      });

      ws.on("play", () => {
        setIsPlaying(true);
        // Tell the main player + sibling previews this preview now owns
        // focus (authoritative through controller).
        playbackController.notifyPreviewStarted(url ?? null);
      });
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => setIsPlaying(false));

      wsRef.current = ws;

      // Pause when either (a) main controller starts a song, or (b)
      // another preview claims focus. We compare against this
      // preview's id (its url) and skip self-notifications.
      unsubPreview = playbackController.subscribePreview((focusId) => {
        if (focusId === url) return;
        ws.pause();
      });
    }

    // Wait for the container ref to be in the DOM (handles conditional rendering)
    function waitForContainer() {
      if (cancelled) return;
      if (containerRef.current) {
        init();
      } else {
        rafId = requestAnimationFrame(waitForContainer);
      }
    }

    waitForContainer();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      unsubPreview?.();
      setIsReady(false);
      setHasError(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const play = useCallback(() => {
    wsRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    wsRef.current?.pause();
  }, []);

  const playPause = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const seekTo = useCallback((progress: number) => {
    wsRef.current?.seekTo(progress);
  }, []);

  return {
    wsRef: wsRef as RefObject<unknown>,
    isReady,
    hasError,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    playPause,
    seekTo,
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Maximize2,
} from "lucide-react";
import { usePlayerStore } from "@/stores/player-store";
import { useRadioStore } from "@/stores/radio-store";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MarqueeText } from "@/components/ui/marquee-text";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MiniPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = usePlaybackController();

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const toggleFullPlayer = usePlayerStore((s) => s.toggleFullPlayer);
  const showMiniQueue = usePlayerStore((s) => s.showMiniQueue);
  const toggleMiniQueue = usePlayerStore((s) => s.toggleMiniQueue);
  const activeStationId = useRadioStore((s) => s.activeStationId);

  // Hand off the <audio> element to the controller. The controller is
  // the only writer for src/play/pause/currentTime/volume.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    controller.attachAudioElement(el);
    return () => controller.detachAudioElement();
  }, [controller]);

  const [seekValue, setSeekValue] = useState<number | null>(null);

  // Render the <audio> element unconditionally, OUTSIDE the conditional
  // transport bar. If we put it inside the bar (which mounts/unmounts
  // when currentSong toggles between null and set), the very first
  // playSong() would race against React's mount: the controller would
  // call .play() on an element about to be replaced, and the new
  // element would have no src.
  return (
    <>
      <audio
        ref={audioRef}
        data-pip-install-bangers-player="true"
        className="hidden"
      />
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[72px] items-center border-t border-border bg-card px-4">

      {/* Song info */}
      <div className="flex min-w-0 items-center gap-3 sm:w-[280px]">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:flex">
          <span className="text-lg text-primary">&#9835;</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <MarqueeText text={currentSong.title} className="text-sm font-medium" />
            {activeStationId && (
              <span className="ml-0.5 shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                Radio
              </span>
            )}
          </div>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {currentSong.caption || "No description"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 sm:inline-flex"
                onClick={() => void controller.previous()}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => void controller.toggle()}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 sm:inline-flex"
                onClick={() => void controller.next()}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next</TooltipContent>
          </Tooltip>
        </div>
        <div className="hidden w-full max-w-md items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <Slider
            value={[seekValue ?? (duration > 0 ? (currentTime / duration) * 100 : 0)]}
            max={100}
            step={0.1}
            className="flex-1"
            onValueChange={([v]) => setSeekValue(v)}
            onValueCommit={([v]) => {
              const dur = duration > 0 ? duration : 0;
              if (dur > 0) controller.seek((v / 100) * dur);
              setSeekValue(null);
            }}
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden items-center justify-end gap-2 sm:flex sm:w-[180px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => controller.setMuted(!muted)}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{muted || volume === 0 ? "Unmute" : "Mute"}</TooltipContent>
        </Tooltip>
        <Slider
          value={[muted ? 0 : volume * 100]}
          max={100}
          step={1}
          className="w-24"
          onValueChange={([v]) => controller.setVolume(v / 100)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", showMiniQueue && "text-primary")}
              onClick={toggleMiniQueue}
              data-mini-queue-toggle
            >
              <ListMusic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Queue</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullPlayer}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Expand player</TooltipContent>
        </Tooltip>
      </div>
        </div>
      )}
    </>
  );
}

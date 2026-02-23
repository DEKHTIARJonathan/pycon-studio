"use client";

import { useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePlayerStore } from "@/stores/player-store";
import { useRadioStore } from "@/stores/radio-store";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { resolveSongPlaybackUrl } from "@/lib/player-audio";
import { useWaveSurfer } from "@/hooks/use-wavesurfer";
import { FullPlayerQueue } from "./full-player-queue";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function FullPlayer() {
  const controller = usePlaybackController();
  const showFullPlayer = usePlayerStore((s) => s.showFullPlayer);
  const toggleFullPlayer = usePlayerStore((s) => s.toggleFullPlayer);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const activeStationId = useRadioStore((s) => s.activeStationId);
  const resolvedUrl = currentSong ? resolveSongPlaybackUrl(currentSong, audioUrl) : null;

  const waveformRef = useRef<HTMLDivElement>(null);
  // Don't load waveform for radio mode (the audio source isn't the URL).
  useWaveSurfer(
    waveformRef,
    showFullPlayer && !activeStationId ? resolvedUrl : null,
    { height: 120 },
  );

  const [seekValue, setSeekValue] = useState<number | null>(null);

  return (
    <AnimatePresence>
      {showFullPlayer && currentSong && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-sm font-medium text-muted-foreground">Now Playing</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullPlayer}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>

          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: song details */}
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-8">
              {/* Song metadata */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{currentSong.title}</h1>
                {currentSong.caption && (
                  <p className="text-sm text-muted-foreground">{currentSong.caption}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {currentSong.bpm && (
                    <Badge variant="secondary">{currentSong.bpm} BPM</Badge>
                  )}
                  {currentSong.keyscale && (
                    <Badge variant="secondary">{currentSong.keyscale}</Badge>
                  )}
                  {currentSong.timesignature && (
                    <Badge variant="secondary">{currentSong.timesignature}</Badge>
                  )}
                  {currentSong.file_format && (
                    <Badge variant="outline">{currentSong.file_format.toUpperCase()}</Badge>
                  )}
                </div>
              </div>

              {/* Waveform */}
              <div ref={waveformRef} className="w-full rounded-lg border border-border bg-card p-4" />

              {/* Progress */}
              <div className="space-y-2">
                <Slider
                  value={[seekValue ?? (duration > 0 ? (currentTime / duration) * 100 : 0)]}
                  max={100}
                  step={0.1}
                  onValueChange={([v]) => setSeekValue(v)}
                  onValueCommit={([v]) => {
                    const dur = duration > 0 ? duration : 0;
                    if (dur > 0) controller.seek((v / 100) * dur);
                    setSeekValue(null);
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Transport controls */}
              <div className="flex items-center justify-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={shuffle ? "h-9 w-9 text-primary" : "h-9 w-9"}
                      onClick={toggleShuffle}
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{shuffle ? "Shuffle on" : "Shuffle"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => void controller.previous()}>
                      <SkipBack className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-14 w-14 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => void controller.toggle()}
                    >
                      {isPlaying ? (
                        <Pause className="h-6 w-6" />
                      ) : (
                        <Play className="h-6 w-6 ml-0.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => void controller.next()}>
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={repeat !== "off" ? "h-9 w-9 text-primary" : "h-9 w-9"}
                      onClick={cycleRepeat}
                    >
                      {repeat === "one" ? (
                        <Repeat1 className="h-4 w-4" />
                      ) : (
                        <Repeat className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat all" : "Repeat one"}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Volume */}
              <div className="flex items-center justify-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => controller.setMuted(!muted)}>
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
                  className="w-40"
                  onValueChange={([v]) => controller.setVolume(v / 100)}
                />
              </div>

              {/* Lyrics */}
              {currentSong.lyrics && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Lyrics</h3>
                  <ScrollArea className="h-48 rounded-md border border-border p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {currentSong.lyrics}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Right: queue panel (hidden below lg) */}
            <div className="hidden w-80 border-l border-border lg:block">
              <div className="p-4">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">Queue</h3>
                <ScrollArea className="h-[calc(100vh-140px)]">
                  <FullPlayerQueue />
                </ScrollArea>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

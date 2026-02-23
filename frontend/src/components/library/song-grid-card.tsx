"use client";

import { useRef } from "react";
import { Heart, Play, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useWaveSurfer } from "@/hooks/use-wavesurfer";
import { getSongAudioUrl } from "@/lib/api/client";
import { usePlayerStore } from "@/stores/player-store";
import type { SongResponse } from "@/types/api";
import Link from "next/link";

interface SongGridCardProps {
  song: SongResponse;
  selected: boolean;
  onToggleSelect: (songId: string) => void;
  onPlay: (song: SongResponse) => void;
}

export function SongGridCard({
  song,
  selected,
  onToggleSelect,
  onPlay,
}: SongGridCardProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const audioUrl = getSongAudioUrl(song.id);
  const { isPlaying, playPause } = useWaveSurfer(waveformRef, audioUrl, {
    height: 40,
  });
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isActive = currentSong?.id === song.id;

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
        isActive && "border-primary/50 bg-primary/5",
        selected && "ring-2 ring-primary",
      )}
    >
      <div
        className={cn(
          "absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100",
          selected && "opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(song.id)}
        />
      </div>

      {song.is_favorite && (
        <Heart className="absolute right-2 top-2 h-4 w-4 fill-red-500 text-red-500" />
      )}

      <div
        ref={waveformRef}
        className="mb-2 w-full cursor-pointer rounded"
        onClick={playPause}
      />

      <button
        onClick={() => onPlay(song)}
        className="absolute inset-x-0 top-0 flex h-[40px] items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
      >
        {isPlaying ? (
          <Pause className="h-6 w-6 text-primary drop-shadow" />
        ) : (
          <Play className="h-6 w-6 text-primary drop-shadow" />
        )}
      </button>

      <Link
        href={`/library/${song.id}`}
        className="block truncate text-sm font-medium hover:underline"
      >
        {song.title}
      </Link>

      {song.caption && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {song.caption}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {song.bpm && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {song.bpm} BPM
          </Badge>
        )}
        {song.keyscale && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {song.keyscale}
          </Badge>
        )}
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {song.file_format.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}

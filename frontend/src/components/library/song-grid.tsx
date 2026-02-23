"use client";

import { Music } from "lucide-react";
import type { SongResponse } from "@/types/api";
import { SongCard } from "./song-card";
import { SongGridCard } from "./song-grid-card";
import { SongCardSkeleton } from "./song-card-skeleton";

interface SongGridProps {
  songs: SongResponse[];
  isLoading: boolean;
  viewMode: "list" | "grid";
  selectedSongs: Set<string>;
  onToggleSelect: (songId: string) => void;
  onPlay: (song: SongResponse) => void;
  onAddToQueue: (song: SongResponse) => void;
  onEdit: (song: SongResponse) => void;
  onDelete: (song: SongResponse) => void;
  onRegenerate?: (song: SongResponse) => void;
  onShowVariations?: (song: SongResponse) => void;
  onExport?: (song: SongResponse) => void;
}

export function SongGrid({
  songs,
  isLoading,
  viewMode,
  selectedSongs,
  onToggleSelect,
  onPlay,
  onAddToQueue,
  onEdit,
  onDelete,
  onRegenerate,
  onShowVariations,
  onExport,
}: SongGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SongCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
        <Music className="h-12 w-12 text-muted-foreground/30" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No songs in your library yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Generate songs on the Create page and save them to your library
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {songs.map((song) => (
          <SongGridCard
            key={song.id}
            song={song}
            selected={selectedSongs.has(song.id)}
            onToggleSelect={onToggleSelect}
            onPlay={onPlay}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {songs.map((song) => (
        <SongCard
          key={song.id}
          song={song}
          selected={selectedSongs.has(song.id)}
          onToggleSelect={onToggleSelect}
          onPlay={onPlay}
          onAddToQueue={onAddToQueue}
          onEdit={onEdit}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          onShowVariations={onShowVariations}
          onExport={onExport}
        />
      ))}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Play,
  Heart,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  ListPlus,
  RefreshCw,
  GitBranch,
  Download,
  FileText,
  MessageSquareText,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlayerStore } from "@/stores/player-store";
import { updateSong } from "@/lib/api/client";
import type { SongResponse } from "@/types/api";
import { cn } from "@/lib/utils";
import { TextDialog } from "./text-dialog";

interface SongCardProps {
  song: SongResponse;
  selected?: boolean;
  onToggleSelect?: (songId: string) => void;
  onPlay: (song: SongResponse) => void;
  onAddToQueue: (song: SongResponse) => void;
  onEdit: (song: SongResponse) => void;
  onDelete: (song: SongResponse) => void;
  onRegenerate?: (song: SongResponse) => void;
  onShowVariations?: (song: SongResponse) => void;
  onExport?: (song: SongResponse) => void;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          className="p-0 text-muted-foreground/40 transition-colors hover:text-yellow-400"
          onClick={(e) => {
            e.stopPropagation();
            onChange(value === rating ? 0 : value);
          }}
        >
          <Star
            className={cn(
              "h-3.5 w-3.5",
              value <= rating && "fill-yellow-400 text-yellow-400",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function SongCard({
  song,
  selected,
  onToggleSelect,
  onPlay,
  onAddToQueue,
  onEdit,
  onDelete,
  onRegenerate,
  onShowVariations,
  onExport,
}: SongCardProps) {
  const [captionOpen, setCaptionOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const queryClient = useQueryClient();
  const currentSongId = usePlayerStore((s) => s.currentSong?.id);
  const isActive = currentSongId === song.id;
  const caption = song.caption.trim();
  const lyrics = song.lyrics.trim();

  const favoriteMutation = useMutation({
    mutationFn: () =>
      updateSong(song.id, { is_favorite: !song.is_favorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["songs"] }),
  });

  const ratingMutation = useMutation({
    mutationFn: (newRating: number) =>
      updateSong(song.id, { rating: newRating }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["songs"] }),
  });

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      favoriteMutation.mutate();
    },
    [favoriteMutation],
  );

  const handleRating = useCallback(
    (newRating: number) => {
      ratingMutation.mutate(newRating);
    },
    [ratingMutation],
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50",
        isActive && "border-primary/50 bg-primary/5",
      )}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(song.id)}
          className="mr-2"
        />
      )}

      {/* Play button */}
      <button
        type="button"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors hover:bg-primary/20",
          isActive && "bg-primary/20",
        )}
        onClick={() => onPlay(song)}
      >
        <Play
          className={cn(
            "h-4 w-4 text-primary",
            isActive && "fill-primary",
          )}
        />
      </button>

      {/* Title + caption */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/library/${song.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {song.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {song.caption || "No description"}
        </p>
      </div>

      {/* Metadata badges */}
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {song.bpm ? `${song.bpm} BPM` : ""}
      </span>
      <span className="hidden text-xs text-muted-foreground md:inline">
        {song.keyscale || ""}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {formatDuration(song.duration_seconds)}
      </span>

      {/* Format badge */}
      <Badge variant="secondary" className="hidden text-[10px] uppercase lg:inline-flex">
        {song.file_format}
      </Badge>

      {song.parent_song_id && (
        <Badge variant="secondary" className="hidden text-[10px] lg:inline-flex">
          Remix
        </Badge>
      )}

      {/* Star rating */}
      <div className="hidden md:flex">
        <StarRating rating={song.rating} onChange={handleRating} />
      </div>

      {/* Favorite */}
      <button
        type="button"
        className="p-1 transition-colors hover:text-red-400"
        onClick={handleFavorite}
        disabled={favoriteMutation.isPending}
      >
        <Heart
          className={cn(
            "h-4 w-4",
            song.is_favorite
              ? "fill-red-400 text-red-400"
              : "text-muted-foreground/40",
          )}
        />
      </button>

      {/* Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onPlay(song)}>
            <Play className="h-4 w-4" />
            Play
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddToQueue(song)}>
            <ListPlus className="h-4 w-4" />
            Add to Queue
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {caption && (
            <DropdownMenuItem onClick={() => setCaptionOpen(true)}>
              <MessageSquareText className="h-4 w-4" />
              View Caption
            </DropdownMenuItem>
          )}
          {lyrics && (
            <DropdownMenuItem onClick={() => setLyricsOpen(true)}>
              <FileText className="h-4 w-4" />
              View Lyrics
            </DropdownMenuItem>
          )}
          {onShowVariations && song.parent_song_id && (
            <DropdownMenuItem onClick={() => onShowVariations(song)}>
              <GitBranch className="h-4 w-4" />
              Variations
            </DropdownMenuItem>
          )}
          {onRegenerate && song.generation_history_id && (
            <DropdownMenuItem onClick={() => onRegenerate(song)}>
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </DropdownMenuItem>
          )}
          {onExport && (
            <DropdownMenuItem onClick={() => onExport(song)}>
              <Download className="h-4 w-4" />
              Export
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(song)}>
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(song)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {caption && (
        <TextDialog
          open={captionOpen}
          onOpenChange={setCaptionOpen}
          title="Caption"
          text={song.caption}
        />
      )}
      {lyrics && (
        <TextDialog
          open={lyricsOpen}
          onOpenChange={setLyricsOpen}
          title="Lyrics"
          text={song.lyrics}
        />
      )}
    </div>
  );
}

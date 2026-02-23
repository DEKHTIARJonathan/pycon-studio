"use client";

import { useState } from "react";
import { Play, Pencil, Trash2, Radio, ChevronDown, ListMusic, Loader2, Download } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { useRadio } from "@/hooks/use-radio";
import { usePlayerStore } from "@/stores/player-store";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { fetchStation, updateStation } from "@/lib/api/radio-client";
import { getSongAudioUrl, getStationExportUrl } from "@/lib/api/client";
import { exportZip } from "@/lib/export-utils";
import type { StationResponse, SongResponse } from "@/types/api";
import { cn } from "@/lib/utils";

interface StationCardProps {
  station: StationResponse;
  onEdit: (station: StationResponse) => void;
  onDelete: (station: StationResponse) => void;
}

function formatBpmRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "";
  if (min !== null && max !== null) return `${min}–${max} BPM`;
  if (min !== null) return `${min}+ BPM`;
  return `up to ${max} BPM`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StationCard({ station, onEdit, onDelete }: StationCardProps) {
  const queryClient = useQueryClient();
  const { activeStationId, pendingStationId, startStation } = useRadio();
  const isActive = activeStationId === station.id;
  const isPending = pendingStationId === station.id;
  const lyricsEnabled = !station.instrumental;
  const [expanded, setExpanded] = useState(false);

  const controller = usePlaybackController();
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const { data: stationDetail, isLoading: isLoadingSongs } = useQuery({
    queryKey: ["station-detail", station.id],
    queryFn: () => fetchStation(station.id),
    enabled: expanded,
  });

  const recentSongs = stationDetail?.recent_songs ?? [];

  const lyricsMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateStation(station.id, { instrumental: !enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
      queryClient.invalidateQueries({ queryKey: ["station-detail", station.id] });
    },
    onError: (err) => {
      toast.error(`Failed to update lyrics setting: ${err.message}`);
    },
  });

  const handleAddSongToQueue = (song: SongResponse) => {
    addToQueue(song, getSongAudioUrl(song.id));
  };

  const handlePlaySong = (song: SongResponse) => {
    void controller.playSong(song, getSongAudioUrl(song.id));
  };

  const handlePlayAll = () => {
    if (recentSongs.length === 0) return;
    const urls: Record<string, string> = {};
    for (const s of recentSongs) urls[s.id] = getSongAudioUrl(s.id);
    void controller.playFromQueue(recentSongs, recentSongs[0], urls);
  };

  const handleAddAllToQueue = () => {
    for (const song of recentSongs) {
      addToQueue(song, getSongAudioUrl(song.id));
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50",
        isActive && "border-primary/50 bg-primary/5",
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-medium text-primary">Playing</span>
        </div>
      )}
      {isPending && !isActive && (
        <div className="absolute top-3 right-3 text-xs font-medium text-primary">
          Pending
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Radio className="h-4 w-4 text-primary" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-sm font-medium">{station.name}</p>
          {station.mood && (
            <p className="truncate text-xs text-muted-foreground">
              {station.mood}
            </p>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {station.genre && (
          <Badge variant="secondary" className="text-xs">
            {station.genre}
          </Badge>
        )}
        {station.instrumental && (
          <Badge variant="secondary" className="text-xs">
            Instrumental
          </Badge>
        )}
        {!station.instrumental && (
          <Badge variant="secondary" className="text-xs">
            Lyrics
          </Badge>
        )}
        {formatBpmRange(station.bpm_min, station.bpm_max) && (
          <span className="text-xs text-muted-foreground">
            {formatBpmRange(station.bpm_min, station.bpm_max)}
          </span>
        )}
      </div>

      <div
        className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Label
          htmlFor={`station-lyrics-${station.id}`}
          className="cursor-pointer text-xs font-medium"
        >
          Lyrics
        </Label>
        <Switch
          id={`station-lyrics-${station.id}`}
          checked={lyricsEnabled}
          disabled={lyricsMutation.isPending}
          onCheckedChange={(checked) => lyricsMutation.mutate(checked)}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => startStation(station.id)}
              disabled={isActive || isPending}
            >
              <Play className="h-3.5 w-3.5" />
              {isActive ? "Playing" : isPending ? "Pending" : activeStationId ? "Switch" : "Play"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isActive
              ? "Currently playing"
              : isPending
                ? "Switch queued"
                : activeStationId
                  ? "Switch when the next track is ready"
                  : "Start this station"}
          </TooltipContent>
        </Tooltip>

        {/* Track history toggle */}
        {station.total_plays > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setExpanded((prev) => !prev)}
          >
            <ListMusic className="h-3.5 w-3.5" />
            {station.total_plays} {station.total_plays === 1 ? "track" : "tracks"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </Button>
        )}

        {!station.is_preset && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => onEdit(station)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit station</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100"
                  onClick={() => onDelete(station)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete station</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Expandable track history */}
      {expanded && (
        <div className="border-t border-border pt-3">
          {isLoadingSongs ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading tracks...</span>
            </div>
          ) : recentSongs.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No tracks yet</p>
          ) : (
            <div className="space-y-1">
              {/* Bulk actions */}
              <div className="flex items-center gap-2 pb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handlePlayAll}
                >
                  <Play className="h-3 w-3" />
                  Play All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleAddAllToQueue}
                >
                  <ListMusic className="h-3 w-3" />
                  Queue All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() =>
                    exportZip(
                      getStationExportUrl(station.id),
                      `${station.name}.zip`,
                    )
                  }
                >
                  <Download className="h-3 w-3" />
                  Export
                </Button>
              </div>

              {/* Track list */}
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {recentSongs.map((song) => (
                  <StationTrackRow
                    key={song.id}
                    song={song}
                    onPlay={handlePlaySong}
                    onAddToQueue={handleAddSongToQueue}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
      </ContextMenuTrigger>
      {!station.is_preset && (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEdit(station)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(station)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}

function StationTrackRow({
  song,
  onPlay,
  onAddToQueue,
}: {
  song: SongResponse;
  onPlay: (song: SongResponse) => void;
  onAddToQueue: (song: SongResponse) => void;
}) {
  const currentSongId = usePlayerStore((s) => s.currentSong?.id);
  const isActive = currentSongId === song.id;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent/50",
            isActive && "bg-primary/10",
          )}
          onClick={() => onPlay(song)}
        >
          <Play
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground",
              isActive && "fill-primary text-primary",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {song.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatDuration(song.duration_seconds)}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onPlay(song)}>
          <Play className="mr-2 h-4 w-4" />
          Play
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAddToQueue(song)}>
          <ListMusic className="mr-2 h-4 w-4" />
          Add to Queue
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

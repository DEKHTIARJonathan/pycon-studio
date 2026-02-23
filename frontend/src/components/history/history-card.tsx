"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { expandCollapse } from "@/lib/animations";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Play,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  AlertCircle,
  Music,
  Library,
  Save,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { saveSongToLibrary } from "@/lib/api/client";
import { getAudioUrl } from "@/lib/api/base";
import { cn, formatRelativeTime, formatDurationMs } from "@/lib/utils";
import type { GenerationHistoryEntry, SongResponse } from "@/types/api";

interface HistoryCardProps {
  entry: GenerationHistoryEntry;
  onRegenerate: (entry: GenerationHistoryEntry) => void;
  onDelete: (entry: GenerationHistoryEntry) => void;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/10 text-green-700 dark:text-green-500 border-green-500/20",
  failed: "bg-red-500/10 text-red-700 dark:text-red-500 border-red-500/20",
  running: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-500/20",
  pending: "bg-muted text-muted-foreground border-border",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  text2music: "Text-to-Music",
  music2music: "Remix",
};

export function HistoryCard({ entry, onRegenerate, onDelete }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const controller = usePlaybackController();
  const queryClient = useQueryClient();

  const caption = (entry.params.caption as string) ?? "";
  const lyrics = (entry.params.lyrics as string) ?? "";
  const statusStyle = STATUS_STYLES[entry.status] ?? STATUS_STYLES.pending;
  const taskLabel = TASK_TYPE_LABELS[entry.task_type] ?? entry.task_type;

  const buildSyntheticSong = useCallback(
    (result: { path: string; sample_rate?: number; key?: string }, index: number): SongResponse => {
      const filename = result.path.split(/[/\\]/).pop() ?? "";
      const ext = filename.split(".").pop() ?? "flac";
      return {
        id: `history-${entry.id}-${index}`,
        title: entry.title
          ? (entry.results.length > 1 ? `${entry.title} #${index + 1}` : entry.title)
          : (caption ? `${caption.slice(0, 40)}... (#${index + 1})` : `Generation #${index + 1}`),
        file_path: filename,
        file_format: ext,
        duration_seconds: null,
        sample_rate: result.sample_rate ?? 48000,
        file_size_bytes: null,
        caption,
        lyrics,
        bpm: (entry.params.bpm as number) ?? null,
        keyscale: (entry.params.keyscale as string) ?? "",
        timesignature: (entry.params.timesignature as string) ?? "",
        vocal_language: (entry.params.vocal_language as string) ?? "unknown",
        instrumental: (entry.params.instrumental as boolean) ?? false,
        is_favorite: false,
        rating: 0,
        tags: "",
        notes: "",
        parent_song_id: null,
        generation_history_id: entry.id,
        variation_index: index,
        created_at: entry.created_at,
        updated_at: entry.created_at,
      };
    },
    [entry, caption, lyrics],
  );

  const handlePlayResult = useCallback(
    (_result: { path: string; sample_rate?: number; key?: string }, index: number) => {
      const allSyntheticSongs = entry.results.map((r, i) => buildSyntheticSong(r, i));
      const urlMap = Object.fromEntries(
        entry.results.map((r, i) => [allSyntheticSongs[i].id, getAudioUrl(r.path)]),
      );
      void controller.playFromQueue(allSyntheticSongs, allSyntheticSongs[index], urlMap);
    },
    [entry.results, buildSyntheticSong, controller],
  );

  const saveMutation = useMutation({
    mutationFn: ({ result, index }: { result: { path: string; sample_rate?: number }; index: number }) => {
      const filename = result.path.split(/[/\\]/).pop() ?? "";
      const ext = filename.split(".").pop() ?? "flac";
      const title = entry.title
        ? (entry.results.length > 1 ? `${entry.title} #${index + 1}` : entry.title)
        : (caption
          ? `${caption.slice(0, 60)}${caption.length > 60 ? "..." : ""} (#${index + 1})`
          : `Generation ${index + 1}`);
      return saveSongToLibrary({
        title,
        file_path: result.path,
        file_format: ext,
        caption,
        lyrics,
        bpm: (entry.params.bpm as number) ?? null,
        keyscale: (entry.params.keyscale as string) ?? "",
        timesignature: (entry.params.timesignature as string) ?? "",
        vocal_language: (entry.params.vocal_language as string) ?? "unknown",
        instrumental: (entry.params.instrumental as boolean) ?? false,
        generation_history_id: entry.id,
        variation_index: index,
      });
    },
    onSuccess: (_data, { index }) => {
      setSavedIndices((prev) => new Set(prev).add(index));
      toast.success("Saved to library");
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  // Metadata items to show
  const metaItems: string[] = [];
  if (entry.params.bpm) metaItems.push(`${entry.params.bpm} BPM`);
  if (entry.params.keyscale) metaItems.push(entry.params.keyscale as string);
  if (entry.params.timesignature) metaItems.push(entry.params.timesignature as string);
  const duration = entry.params.duration as number | undefined;
  if (duration && duration > 0) metaItems.push(`${duration}s`);
  const seed = entry.params.seed as number | undefined;
  if (seed !== undefined && seed !== -1) metaItems.push(`seed: ${seed}`);
  if (entry.params.batch_size) metaItems.push(`batch: ${entry.params.batch_size}`);
  const ditModel = entry.params.dit_model as string | undefined;
  if (ditModel) metaItems.push(`DiT: ${ditModel}`);
  const lmModel = entry.params.lm_model as string | undefined;
  if (lmModel) metaItems.push(`LM: ${lmModel}`);
  const djModel = entry.params.dj_model as string | undefined;
  if (djModel) metaItems.push(`DJ: ${djModel}`);

  return (
    <div className="rounded-lg border border-border bg-card transition-colors hover:bg-accent/30">
      {/* Collapsed row — div instead of button to avoid nested button with DropdownMenuTrigger */}
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <Badge variant="outline" className={cn("shrink-0 text-[10px]", statusStyle)}>
          {entry.status}
        </Badge>

        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {taskLabel}
        </Badge>

        <span className="min-w-0 flex-1 truncate text-sm">
          {entry.title || caption || "No caption"}
        </span>

        {entry.audio_count > 0 && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Music className="h-3 w-3" />
            {entry.audio_count}
          </span>
        )}

        {entry.saved_song_count > 0 && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Library className="h-3 w-3" />
            {entry.saved_song_count}
          </span>
        )}

        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDurationMs(entry.duration_ms)}
        </span>

        <span className="shrink-0 text-xs text-muted-foreground">
          {entry.created_at ? formatRelativeTime(entry.created_at) : ""}
        </span>

        {/* Actions dropdown — stop propagation so click doesn't toggle expand */}
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRegenerate(entry)}>
                <RefreshCw className="h-4 w-4" />
                Re-generate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(entry)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            <div className="border-t border-border px-4 pb-4 pt-3 pl-11 space-y-3">
              {/* Full caption */}
              {caption && (
                <p className="text-sm text-foreground">{caption}</p>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                {metaItems.map((item) => (
                  <Badge key={item} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
                {lyrics && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-[22px] gap-1 px-2.5 text-xs"
                    onClick={() => setLyricsOpen(true)}
                  >
                    <FileText className="h-3 w-3" />
                    View Lyrics
                  </Button>
                )}
              </div>

              {/* Timestamps & counts */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {entry.started_at && (
                  <span>Started: {formatRelativeTime(entry.started_at)}</span>
                )}
                {entry.duration_ms !== null && (
                  <span>Duration: {formatDurationMs(entry.duration_ms)}</span>
                )}
                {entry.audio_count > 0 && (
                  <span>{entry.audio_count} result{entry.audio_count !== 1 ? "s" : ""}</span>
                )}
                {entry.saved_song_count > 0 && (
                  <span>{entry.saved_song_count} saved to library</span>
                )}
              </div>

              {/* Error message */}
              {entry.status === "failed" && entry.error_message && (
                <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{entry.error_message}</span>
                </div>
              )}

              {/* Audio results */}
              {entry.status === "completed" && entry.results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Audio Results</p>
                  {entry.results.map((result, index) => {
                    const isSaved = savedIndices.has(index) || entry.saved_song_count > index;
                    const isSaving = saveMutation.isPending && (saveMutation.variables as { index: number })?.index === index;

                    return (
                      <div
                        key={result.path ?? index}
                        className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handlePlayResult(result, index)}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Play
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => saveMutation.mutate({ result, index })}
                          disabled={isSaved || isSaving}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          {isSaved ? "Saved" : "Save to Library"}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Result {index + 1}
                        </span>
                        {result.key && (
                          <span className="text-xs text-muted-foreground">{result.key}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics dialog */}
      {lyrics && (
        <Dialog open={lyricsOpen} onOpenChange={setLyricsOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Lyrics</DialogTitle>
            </DialogHeader>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {lyrics.replace(/\\n/g, "\n")}
            </pre>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

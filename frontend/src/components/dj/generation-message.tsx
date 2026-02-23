"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Music, Loader2, ExternalLink, FileText, Play, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { fetchHistoryEntry, saveSongToLibrary } from "@/lib/api/client";
import { getAudioUrl } from "@/lib/api/base";
import type { DJMessageResponse, SongResponse } from "@/types/api";

interface GenerationParams {
  genre?: string;
  bpm?: number;
  duration?: number;
  key?: string;
  keyscale?: string;
  instrumental?: boolean;
  caption?: string;
  lyrics?: string;
  timesignature?: string;
  vocal_language?: string;
  [key: string]: unknown;
}

interface GenerationMessageProps {
  message: DJMessageResponse;
  isGenerating?: boolean;
}

function parseGenerationParams(json: string | null): GenerationParams | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as GenerationParams;
  } catch {
    return null;
  }
}

/** Short params displayed as inline badges. */
const BADGE_PARAMS: Record<string, string> = {
  genre: "Genre",
  bpm: "BPM",
  duration: "Duration",
  instrumental: "Instrumental",
  keyscale: "Key",
  timesignature: "Time",
  vocal_language: "Language",
};

function formatBadgeValue(key: string, value: unknown): string {
  if (key === "duration") return `${value}s`;
  if (key === "instrumental") return value ? "Yes" : "No";
  if (key === "vocal_language" && value === "unknown") return "";
  return String(value);
}

export function GenerationMessage({
  message,
  isGenerating = false,
}: GenerationMessageProps) {
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const params = parseGenerationParams(message.generation_params_json);
  const jobId = message.generation_job_id;
  const controller = usePlaybackController();
  const queryClient = useQueryClient();

  // Fetch history entry to get audio results (jobId = historyId)
  const { data: historyEntry } = useQuery({
    queryKey: ["history-entry", jobId],
    queryFn: () => fetchHistoryEntry(jobId!),
    enabled: !!jobId && !isGenerating,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000; // Poll while running
    },
  });

  const hasResults = historyEntry?.status === "completed" && historyEntry.results.length > 0;
  const isSaved = savedLocally || (historyEntry?.saved_song_count ?? 0) > 0;

  if (!params && !jobId) return null;

  const badgeEntries = params
    ? Object.entries(BADGE_PARAMS)
        .map(([key, label]) => {
          const value = params[key];
          if (value === null || value === undefined || value === "") return null;
          const display = formatBadgeValue(key, value);
          if (!display) return null;
          return { key, label, display };
        })
        .filter(Boolean) as { key: string; label: string; display: string }[]
    : [];

  const caption = params?.caption ? String(params.caption) : "";
  const lyrics = params?.lyrics ? String(params.lyrics) : "";

  const handlePlay = () => {
    if (!historyEntry || !hasResults) return;
    const results = historyEntry.results;
    const syntheticSongs: SongResponse[] = results.map((r, i) => ({
      id: `dj-${jobId}-${i}`,
      title: caption ? `${caption.slice(0, 40)}... (#${i + 1})` : `DJ Generation #${i + 1}`,
      file_path: r.path.split(/[/\\]/).pop() ?? "",
      file_format: (r.path.split(/[/\\]/).pop() ?? "").split(".").pop() ?? "flac",
      duration_seconds: null,
      sample_rate: r.sample_rate ?? 48000,
      file_size_bytes: null,
      caption,
      lyrics,
      bpm: params?.bpm ?? null,
      keyscale: params?.keyscale ?? "",
      timesignature: params?.timesignature ?? "",
      vocal_language: params?.vocal_language ?? "unknown",
      instrumental: params?.instrumental ?? false,
      is_favorite: false,
      rating: 0,
      tags: "",
      notes: "",
      parent_song_id: null,
      generation_history_id: jobId ?? null,
      variation_index: i,
      created_at: message.created_at,
      updated_at: message.created_at,
    }));
    const urlMap = Object.fromEntries(
      results.map((r, i) => [syntheticSongs[i].id, getAudioUrl(r.path)]),
    );
    void controller.playFromQueue(syntheticSongs, syntheticSongs[0], urlMap);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!historyEntry || !hasResults) throw new Error("No results to save");
      const result = historyEntry.results[0];
      const filename = result.path.split(/[/\\]/).pop() ?? "";
      const ext = filename.split(".").pop() ?? "flac";
      const title = historyEntry.title
        || (caption ? `${caption.slice(0, 60)}${caption.length > 60 ? "..." : ""}` : "DJ Generation");
      return saveSongToLibrary({
        title,
        file_path: result.path,
        file_format: ext,
        caption,
        lyrics,
        bpm: params?.bpm ?? null,
        keyscale: params?.keyscale ?? "",
        timesignature: params?.timesignature ?? "",
        vocal_language: params?.vocal_language ?? "unknown",
        instrumental: params?.instrumental ?? false,
        generation_history_id: jobId ?? null,
        variation_index: 0,
      });
    },
    onSuccess: () => {
      setSavedLocally(true);
      toast.success("Saved to library");
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["history-entry", jobId] });
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Music className="h-4 w-4" />
      </div>

      <Card className="min-w-0 flex-1 overflow-hidden">
        <CardContent className="space-y-3 p-3">
          {/* Message text */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: "anywhere" }}>{message.content}</p>
          )}

          {/* Generation parameters */}
          {(badgeEntries.length > 0 || caption || lyrics) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Generation Parameters
              </p>

              {/* Caption */}
              {caption && (
                <p className="text-xs italic text-muted-foreground" style={{ overflowWrap: "anywhere" }}>
                  {caption}
                </p>
              )}

              {/* Compact badges */}
              {badgeEntries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {badgeEntries.map(({ key, label, display }) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {label}: {display}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Lyrics button */}
              {lyrics && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setLyricsOpen(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Lyrics
                </Button>
              )}
            </div>
          )}

          {/* Generating spinner */}
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </div>
          )}

          {/* Action buttons */}
          {!isGenerating && jobId && (
            <div className="flex flex-wrap gap-2">
              {hasResults && (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePlay}>
                    <Play className="h-3.5 w-3.5" />
                    Play
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => saveMutation.mutate()}
                    disabled={isSaved || saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {isSaved ? "Saved" : "Save to Library"}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href="/history">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View in History
                </a>
              </Button>
            </div>
          )}

          {/* Running status */}
          {!isGenerating && jobId && historyEntry?.status === "running" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </div>
          )}

          {/* Failed status */}
          {!isGenerating && historyEntry?.status === "failed" && historyEntry.error_message && (
            <p className="text-xs text-red-500">{historyEntry.error_message}</p>
          )}
        </CardContent>
      </Card>

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

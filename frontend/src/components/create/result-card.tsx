"use client";

import { useRef, useState, useCallback } from "react";
import { useWaveSurfer } from "@/hooks/use-wavesurfer";
import { Play, Pause, Save, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGenerationStore } from "@/stores/generation-store";
import { usePlayerStore } from "@/stores/player-store";
import { saveSongToLibrary } from "@/lib/api/client";
import { getAudioUrl } from "@/lib/api/base";
import { cn } from "@/lib/utils";
import type { AudioResult } from "@/types/api";

interface ResultCardProps {
  result: AudioResult;
  index: number;
  batchSize: number;
  historyId: string | null;
  jobId: string;
  onPlayInMiniPlayer: (jobId: string, index: number) => void;
}

export function ResultCard({ result, index, batchSize, historyId, jobId, onPlayInMiniPlayer }: ResultCardProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const saved = useGenerationStore(
    (s) => s.activeJobs.find((j) => j.jobId === jobId)?.savedVariants.includes(index) ?? false,
  );
  const markVariantSaved = useGenerationStore((s) => s.markVariantSaved);

  const queryClient = useQueryClient();
  const currentSongId = usePlayerStore((s) => s.currentSong?.id);
  const isActive = currentSongId === `gen-${jobId}-${index}`;
  const activeMode = useGenerationStore((s) => s.activeMode);
  const remixSourceId = useGenerationStore((s) => s.remixForm.sourceSongId);
  const audioUrl = getAudioUrl(result.path);
  const { isPlaying, playPause } = useWaveSurfer(waveformRef, audioUrl);

  // Cross-card preview coordination: WaveSurfer instances share the
  // wavesurfer.js global so only one plays at a time, but explicit
  // pause-on-other-play is handled by the controller subscription in
  // use-wavesurfer (it pauses each card when the main player starts).
  // For preview-vs-preview, wavesurfer.js's internal audio element
  // handles it.

  const handlePlayInMiniPlayer = useCallback(() => {
    onPlayInMiniPlayer(jobId, index);
  }, [onPlayInMiniPlayer, jobId, index]);

  const generatedTitle = useGenerationStore(
    (s) => s.activeJobs.find((j) => j.jobId === jobId)?.generatedTitle ?? null,
  );

  const handleSave = useCallback(async () => {
    if (isSaving || saved) return;
    setIsSaving(true);
    try {
      const filename = result.path.split(/[/\\]/).pop() ?? "";
      const ext = filename.split(".").pop() ?? "flac";
      const caption = (result.params?.caption as string) ?? "";
      let title: string;
      if (generatedTitle) {
        title = batchSize > 1 ? `${generatedTitle} #${index + 1}` : generatedTitle;
      } else {
        title = caption
          ? `${caption.slice(0, 60)}${caption.length > 60 ? "..." : ""} (#${index + 1})`
          : `Generation ${index + 1}`;
      }
      const parentSongId = activeMode === "Remix" ? remixSourceId : null;
      await saveSongToLibrary({
        title,
        file_path: result.path,
        file_format: ext,
        caption,
        lyrics: (result.params?.lyrics as string) ?? "",
        bpm: (result.params?.bpm as number) ?? null,
        keyscale: (result.params?.keyscale as string) ?? "",
        timesignature: (result.params?.timesignature as string) ?? "",
        vocal_language: (result.params?.vocal_language as string) ?? "unknown",
        instrumental: (result.params?.instrumental as boolean) ?? false,
        generation_history_id: historyId,
        variation_index: index,
        parent_song_id: parentSongId || null,
      });
      markVariantSaved(jobId, index);
      queryClient.invalidateQueries({ queryKey: ["songs"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [result, index, batchSize, historyId, isSaving, saved, queryClient, activeMode, remixSourceId, markVariantSaved, jobId, generatedTitle]);

  const seed = result.params?.seed;
  const lyrics = (result.params?.lyrics as string) ?? "";

  return (
    <Card className={cn(isActive && "border-primary/50 bg-primary/5")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate mr-2">
            {generatedTitle
              ? (batchSize > 1 ? `${generatedTitle} #${index + 1}` : generatedTitle)
              : `Result ${index + 1}`}
          </span>
          {seed !== undefined && (
            <Badge variant="secondary" className="text-xs">
              Seed: {String(seed)}
            </Badge>
          )}
        </div>

        <div ref={waveformRef} className="w-full cursor-pointer" onClick={playPause} />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={playPause}>
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Preview
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePlayInMiniPlayer}>
            <Play className="h-3.5 w-3.5" />
            Player
          </Button>
          {lyrics && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setLyricsOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" />
              Lyrics
            </Button>
          )}
          <Button
            variant={saved ? "secondary" : "default"}
            size="sm"
            className="ml-auto gap-1.5"
            onClick={handleSave}
            disabled={isSaving || saved}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saved ? "Saved" : "Save to Library"}
          </Button>
        </div>
      </CardContent>

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
    </Card>
  );
}

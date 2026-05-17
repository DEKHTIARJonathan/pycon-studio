"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Play,
  ListPlus,
  RefreshCw,
  Trash2,
  Save,
  Loader2,
  Star,
  Download,
  Expand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TextDialog } from "./text-dialog";
import { useWaveSurfer } from "@/hooks/use-wavesurfer";
import { usePlayerStore } from "@/stores/player-store";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { useGenerationStore } from "@/stores/generation-store";
import {
  fetchSong,
  fetchHistoryEntry,
  updateSong,
  deleteSong,
  getSongAudioUrl,
  getSongDownloadUrl,
  fetchSongVariations,
} from "@/lib/api/client";
import { exportSongFile } from "@/lib/export-utils";
import { cn } from "@/lib/utils";
import type { SongResponse } from "@/types/api";
import Link from "next/link";

interface SongDetailClientProps {
  songId: string;
}

interface SongForm {
  title: string;
  caption: string;
  lyrics: string;
  rating: number;
  tags: string;
  notes: string;
}

function songToForm(song: SongResponse): SongForm {
  return {
    title: song.title,
    caption: song.caption,
    lyrics: song.lyrics,
    rating: song.rating,
    tags: song.tags,
    notes: song.notes,
  };
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SongDetailClient({ songId }: SongDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const waveformRef = useRef<HTMLDivElement>(null);

  const controller = usePlaybackController();
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const audioUrl = getSongAudioUrl(songId);
  const { isReady, hasError, isPlaying, playPause } = useWaveSurfer(waveformRef, audioUrl, {
    height: 80,
  });

  const { data: song, isLoading } = useQuery({
    queryKey: ["song", songId],
    queryFn: () => fetchSong(songId),
  });

  const { data: variations } = useQuery({
    queryKey: ["variations", songId],
    queryFn: () => fetchSongVariations(songId),
  });

  const [form, setForm] = useState<SongForm>({
    title: "",
    caption: "",
    lyrics: "",
    rating: 0,
    tags: "",
    notes: "",
  });
  const [isDirty, setIsDirty] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  useEffect(() => {
    if (song) {
      setForm(songToForm(song));
      setIsDirty(false);
    }
  }, [song]);

  const updateForm = useCallback((partial: Partial<SongForm>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setIsDirty(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSong(songId, {
        title: form.title,
        caption: form.caption,
        lyrics: form.lyrics,
        rating: form.rating,
        tags: form.tags,
        notes: form.notes,
      }),
    onSuccess: () => {
      toast.success("Song updated");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["song", songId] });
      queryClient.invalidateQueries({ queryKey: ["songs"] });
    },
    onError: () => toast.error("Failed to update song"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSong(songId),
    onSuccess: () => {
      toast.success("Song deleted");
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      router.push("/library");
    },
    onError: () => toast.error("Failed to delete song"),
  });

  const handleRegenerate = useCallback(async () => {
    if (!song?.generation_history_id) return;
    try {
      const entry = await fetchHistoryEntry(song.generation_history_id);
      useGenerationStore.getState().loadFromHistoryParams(entry.params);
      router.push("/create");
    } catch {
      toast.error("Failed to load generation parameters");
    }
  }, [song, router]);

  const handlePlay = useCallback(() => {
    if (!song) return;
    void controller.playSong(song, audioUrl);
  }, [song, audioUrl, controller]);

  const handleAddToQueue = useCallback(() => {
    if (!song) return;
    addToQueue(song, audioUrl);
    toast.success("Added to queue");
  }, [song, audioUrl, addToQueue]);

  const handleExport = useCallback(() => {
    if (!song) return;
    exportSongFile(getSongDownloadUrl(song.id), `${song.title}.${song.file_format}`);
  }, [song]);

  if (isLoading) return <SongDetailSkeleton />;
  if (!song) {
    return (
      <div className="space-y-4">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Library
        </Link>
        <p className="text-muted-foreground">Song not found.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Back button */}
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Library
      </Link>

      {/* Song header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{song.title}</h1>
        <div className="flex flex-wrap gap-2">
          {song.duration_seconds !== null && (
            <Badge variant="secondary">
              {formatDuration(song.duration_seconds)}
            </Badge>
          )}
          {song.bpm && (
            <Badge variant="secondary">{song.bpm} BPM</Badge>
          )}
          {song.keyscale && (
            <Badge variant="secondary">{song.keyscale}</Badge>
          )}
          {song.timesignature && (
            <Badge variant="secondary">{song.timesignature}</Badge>
          )}
          <Badge variant="secondary">
            {song.file_format.toUpperCase()}
          </Badge>
          {song.instrumental && (
            <Badge variant="outline">Instrumental</Badge>
          )}
          {song.parent_song_id && (
            <Badge variant="secondary">Remix</Badge>
          )}
        </div>
      </div>

      {/* Waveform */}
      <Card>
        <CardContent className="p-4">
          <div
            ref={waveformRef}
            className={cn("w-full", isReady && "cursor-pointer")}
            onClick={playPause}
          />
          {!isReady && !hasError && (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {hasError && (
            <div className="flex h-20 items-center justify-center">
              <p className="text-sm text-muted-foreground">Audio file unavailable</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePlay} className="gap-2">
          <Play className="h-4 w-4" /> Play
        </Button>
        <Button variant="outline" onClick={handleAddToQueue} className="gap-2">
          <ListPlus className="h-4 w-4" /> Add to Queue
        </Button>
        {song.generation_history_id && (
          <Button variant="outline" onClick={handleRegenerate} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Regenerate
          </Button>
        )}
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
        <Button
          variant="destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="ml-auto gap-2"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete
        </Button>
      </div>

      {/* Metadata form */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-title">Title</Label>
            <Input
              id="detail-title"
              value={form.title}
              onChange={(e) => updateForm({ title: e.target.value })}
            />
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-caption">Caption</Label>
            <div className="relative">
              <Textarea
                id="detail-caption"
                value={form.caption}
                onChange={(e) => updateForm({ caption: e.target.value })}
                rows={2}
                className={cn(form.caption.trim() && "pr-10")}
              />
              {form.caption.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  aria-label="Expand caption"
                  onClick={() => setCaptionOpen(true)}
                >
                  <Expand className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Lyrics */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-lyrics">Lyrics</Label>
            <div className="relative">
              <Textarea
                id="detail-lyrics"
                value={form.lyrics}
                onChange={(e) => updateForm({ lyrics: e.target.value })}
                rows={6}
                className={cn("font-mono text-xs", form.lyrics.trim() && "pr-10")}
              />
              {form.lyrics.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  aria-label="Expand lyrics"
                  onClick={() => setLyricsOpen(true)}
                >
                  <Expand className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="p-0.5 transition-colors hover:text-yellow-400"
                  onClick={() =>
                    updateForm({
                      rating: value === form.rating ? 0 : value,
                    })
                  }
                >
                  <Star
                    className={cn(
                      "h-5 w-5",
                      value <= form.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-tags">Tags</Label>
            <Input
              id="detail-tags"
              value={form.tags}
              onChange={(e) => updateForm({ tags: e.target.value })}
              placeholder="comma-separated tags"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-notes">Notes</Label>
            <Textarea
              id="detail-notes"
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              rows={2}
            />
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Variation tree */}
      {variations &&
        (variations.ancestors.length > 0 ||
          variations.children.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Variation Tree</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ancestors */}
              {variations.ancestors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ancestors
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {variations.ancestors.map((ancestor, idx) => (
                      <span key={ancestor.id} className="flex items-center gap-2">
                        <Link
                          href={`/library/${ancestor.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {ancestor.title}
                        </Link>
                        {idx < variations.ancestors.length - 1 && (
                          <span className="text-muted-foreground">&rarr;</span>
                        )}
                      </span>
                    ))}
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className="text-sm font-medium">{song.title}</span>
                  </div>
                </div>
              )}

              {/* Children */}
              {variations.children.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Variations ({variations.children.length})
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {variations.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/library/${child.id}`}
                        className="rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                      >
                        <p className="truncate text-sm font-medium">
                          {child.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {child.caption || "No description"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      {form.caption.trim() && (
        <TextDialog
          open={captionOpen}
          onOpenChange={setCaptionOpen}
          title="Caption"
          text={form.caption}
        />
      )}
      {form.lyrics.trim() && (
        <TextDialog
          open={lyricsOpen}
          onOpenChange={setLyricsOpen}
          title="Lyrics"
          text={form.lyrics}
        />
      )}
    </motion.div>
  );
}

function SongDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

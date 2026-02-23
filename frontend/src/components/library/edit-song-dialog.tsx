"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSong } from "@/lib/api/client";
import type { SongResponse } from "@/types/api";
import { cn } from "@/lib/utils";

interface EditSongDialogProps {
  song: SongResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSongDialog({
  song,
  open,
  onOpenChange,
}: EditSongDialogProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setCaption(song.caption);
      setLyrics(song.lyrics);
      setRating(song.rating);
      setTags(song.tags);
      setNotes(song.notes);
    }
  }, [song]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!song) throw new Error("No song to update");
      return updateSong(song.id, {
        title,
        caption,
        lyrics,
        rating,
        tags,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Song updated");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`Failed to update song: ${err.message}`);
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutation.mutate();
    },
    [mutation],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Song</DialogTitle>
          <DialogDescription>
            Update song metadata and details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-caption">Caption</Label>
            <Textarea
              id="edit-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
            />
          </div>

          {/* Lyrics */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-lyrics">Lyrics</Label>
            <Textarea
              id="edit-lyrics"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
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
                  onClick={() => setRating(value === rating ? 0 : value)}
                >
                  <Star
                    className={cn(
                      "h-5 w-5",
                      value <= rating
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
            <Label htmlFor="edit-tags">Tags</Label>
            <Input
              id="edit-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma-separated tags"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

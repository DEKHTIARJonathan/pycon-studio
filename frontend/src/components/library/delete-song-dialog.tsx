"use client";

import { Loader2 } from "lucide-react";
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
import { deleteSong } from "@/lib/api/client";
import type { SongResponse } from "@/types/api";

interface DeleteSongDialogProps {
  song: SongResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteSongDialog({
  song,
  open,
  onOpenChange,
}: DeleteSongDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (!song) throw new Error("No song to delete");
      return deleteSong(song.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Song deleted");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`Failed to delete song: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Song</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">
              {song?.title ?? "this song"}
            </span>{" "}
            and its audio file. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, HeartOff, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkDeleteSongs, bulkUpdateSongs } from "@/lib/api/client";
import { toast } from "sonner";

interface BulkActionsBarProps {
  selectedSongs: Set<string>;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedSongs,
  onClearSelection,
}: BulkActionsBarProps) {
  const queryClient = useQueryClient();
  const songIds = Array.from(selectedSongs);

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) =>
      bulkUpdateSongs(songIds, { is_favorite: isFavorite }),
    onSuccess: (_, isFavorite) => {
      toast.success(
        `${songIds.length} songs ${isFavorite ? "favorited" : "unfavorited"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      onClearSelection();
    },
    onError: () => toast.error("Failed to update songs"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => bulkDeleteSongs(songIds),
    onSuccess: (data) => {
      toast.success(`${data.deleted} songs deleted`);
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      onClearSelection();
    },
    onError: () => toast.error("Failed to delete songs"),
  });

  return (
    <AnimatePresence>
      {selectedSongs.size > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-lg"
        >
          <Badge variant="secondary">{selectedSongs.size} selected</Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => favoriteMutation.mutate(true)}
            disabled={favoriteMutation.isPending}
          >
            <Heart className="h-3.5 w-3.5" /> Favorite
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => favoriteMutation.mutate(false)}
            disabled={favoriteMutation.isPending}
          >
            <HeartOff className="h-3.5 w-3.5" /> Unfavorite
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onClearSelection}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

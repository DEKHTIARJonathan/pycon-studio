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
import { deleteHistoryEntry } from "@/lib/api/client";
import type { GenerationHistoryEntry } from "@/types/api";

interface DeleteHistoryDialogProps {
  entry: GenerationHistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteHistoryDialog({
  entry,
  open,
  onOpenChange,
}: DeleteHistoryDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (!entry) throw new Error("No entry to delete");
      return deleteHistoryEntry(entry.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      toast.success("History entry deleted");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`Failed to delete history entry: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete History Entry</DialogTitle>
          <DialogDescription>
            This will permanently delete this generation history record. Songs
            saved to your library will not be affected.
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

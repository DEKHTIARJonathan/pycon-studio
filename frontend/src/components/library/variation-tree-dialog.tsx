"use client";

import { Play, Loader2, GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { fetchSongVariations, getSongAudioUrl } from "@/lib/api/client";
import type { SongResponse } from "@/types/api";
import { cn } from "@/lib/utils";

interface VariationTreeDialogProps {
  song: SongResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SongTreeItem({
  song,
  indent,
  isCurrent,
}: {
  song: SongResponse;
  indent: number;
  isCurrent: boolean;
}) {
  const controller = usePlaybackController();

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2",
        isCurrent && "bg-primary/10 border border-primary/30",
      )}
      style={{ marginLeft: indent * 20 }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => void controller.playSong(song, getSongAudioUrl(song.id))}
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{song.title}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(song.created_at).toLocaleDateString()}
        </p>
      </div>
      {isCurrent && (
        <Badge variant="secondary" className="text-[10px]">
          Current
        </Badge>
      )}
    </div>
  );
}

export function VariationTreeDialog({
  song,
  open,
  onOpenChange,
}: VariationTreeDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["song-variations", song?.id],
    queryFn: () => fetchSongVariations(song!.id),
    enabled: open && !!song,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Variation Tree
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {data.ancestors.map((ancestor, i) => (
              <SongTreeItem
                key={ancestor.id}
                song={ancestor}
                indent={i}
                isCurrent={false}
              />
            ))}
            <SongTreeItem
              song={data.song}
              indent={data.ancestors.length}
              isCurrent={true}
            />
            {data.children.map((child) => (
              <SongTreeItem
                key={child.id}
                song={child}
                indent={data.ancestors.length + 1}
                isCurrent={false}
              />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No variation data available
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

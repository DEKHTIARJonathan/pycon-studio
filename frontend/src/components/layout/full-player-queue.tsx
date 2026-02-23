"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePlayerStore } from "@/stores/player-store";
import { ListMusic, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveSongPlaybackUrl } from "@/lib/player-audio";
import { usePlaybackController } from "@/hooks/use-playback-controller";

export function FullPlayerQueue() {
  const queue = usePlayerStore((s) => s.queue);
  const queueAudioUrls = usePlayerStore((s) => s.queueAudioUrls);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const controller = usePlaybackController();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: queue.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <ListMusic className="h-8 w-8 opacity-40" />
        <p className="text-sm">Queue is empty</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const song = queue[virtualItem.index];
          const index = virtualItem.index;
          const isActive = currentSong?.id === song.id;
          return (
            <div
              key={`${song.id}-${index}`}
              className="absolute left-0 w-full"
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <button
                onClick={() => {
                  void controller.playSong(
                    song,
                    resolveSongPlaybackUrl(song, queueAudioUrls[song.id]),
                  );
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
                  isActive && "bg-white/10 text-primary",
                )}
              >
                {isActive ? (
                  <Play className="h-3.5 w-3.5 flex-shrink-0 fill-current" />
                ) : (
                  <span className="w-3.5 flex-shrink-0 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{song.title}</p>
                  {song.caption && (
                    <p className="truncate text-xs text-muted-foreground">
                      {song.caption}
                    </p>
                  )}
                </div>
                {song.duration_seconds && (
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(song.duration_seconds / 60)}:
                    {String(Math.floor(song.duration_seconds % 60)).padStart(2, "0")}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { History } from "lucide-react";
import { HistoryCard } from "./history-card";
import { HistoryCardSkeleton } from "./history-card-skeleton";
import type { GenerationHistoryEntry } from "@/types/api";

interface HistoryListProps {
  entries: GenerationHistoryEntry[];
  isLoading: boolean;
  onRegenerate: (entry: GenerationHistoryEntry) => void;
  onDelete: (entry: GenerationHistoryEntry) => void;
}

export function HistoryList({ entries, isLoading, onRegenerate, onDelete }: HistoryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <HistoryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
        <History className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">No generation history yet</p>
        <p className="text-xs text-muted-foreground/60">
          Generate music on the Create page to see your history here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry) => (
        <HistoryCard
          key={entry.id}
          entry={entry}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function HistoryCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-64 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  );
}

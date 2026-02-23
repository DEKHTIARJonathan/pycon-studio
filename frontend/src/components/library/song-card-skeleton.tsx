"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function SongCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-10 rounded-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  );
}

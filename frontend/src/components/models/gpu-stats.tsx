"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGpuStats } from "@/lib/api/client";

export function GpuStats() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["gpu-stats"],
    queryFn: fetchGpuStats,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !stats) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">GPU stats unavailable</p>
        </CardContent>
      </Card>
    );
  }

  const pct = stats.vram_percent ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4" />
          GPU
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Device</span>
          <Badge variant="secondary">{stats.device || "unknown"}</Badge>
        </div>

        {stats.vram_total_mb != null && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">VRAM</span>
              <span>
                {stats.vram_used_mb?.toFixed(0)} / {stats.vram_total_mb.toFixed(0)} MB
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}

        {stats.vram_used_mb != null && stats.vram_total_mb == null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Allocated</span>
            <span>{stats.vram_used_mb.toFixed(0)} MB</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

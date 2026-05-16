"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGpuStats } from "@/lib/api/client";
import type { GpuDeviceStats } from "@/types/api";

function shortLabel(gpu: GpuDeviceStats): string {
  return (gpu.label || gpu.node_id || gpu.name || "GPU")
    .replace(/^spark-/, "")
    .replace(/-music$/, "")
    .replace(/-lm-chat$/, "");
}

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

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

  const vramPct = stats.vram_percent ?? 0;
  const gpus = stats.gpus ?? [];

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

        {gpus.length > 0 ? (
          <div className="space-y-2">
            {gpus.map((gpu, index) => (
              <div
                key={gpu.uuid || `${gpu.node_id}-${index}`}
                className="rounded-md border border-border p-2"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{shortLabel(gpu)}</span>
                  <span className="shrink-0 font-mono">
                    {gpu.error ? "error" : pct(gpu.utilization_gpu_percent)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {gpu.holder ? gpu.holder : gpu.busy ? "busy" : gpu.name || "idle"}
                </div>
              </div>
            ))}
          </div>
        ) : stats.vram_total_mb != null ? (
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
                style={{ width: `${vramPct}%` }}
              />
            </div>
          </>
        ) : null}

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

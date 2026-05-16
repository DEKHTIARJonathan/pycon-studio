"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Cpu, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchGpuStats } from "@/lib/api/client";
import type { GpuDeviceStats, GpuStats } from "@/types/api";

type GpuMonitorInsetProps = {
  hasMiniPlayer: boolean;
};

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function watts(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-- W";
  return `${value.toFixed(0)} W`;
}

function fallbackGpus(stats: GpuStats | undefined): GpuDeviceStats[] {
  if (!stats) return [];
  if (stats.gpus?.length) return stats.gpus;
  return [
    {
      node_id: "local",
      node_role: "",
      label: "local",
      device_index: 0,
      name: stats.device || "GPU",
      uuid: "",
      utilization_gpu_percent: null,
      utilization_memory_percent: null,
      vram_used_mb: stats.vram_used_mb ?? null,
      vram_total_mb: stats.vram_total_mb ?? null,
      vram_percent: stats.vram_percent ?? null,
      power_draw_w: null,
      power_limit_w: null,
      busy: false,
      holder: null,
      error: stats.error ?? "",
    },
  ];
}

function shortLabel(gpu: GpuDeviceStats): string {
  const label = gpu.label || gpu.node_id || gpu.name || "GPU";
  return label
    .replace(/^spark-/, "")
    .replace(/-music$/, "")
    .replace(/-lm-chat$/, "");
}

function utilizationWidth(gpu: GpuDeviceStats): string {
  const value = gpu.utilization_gpu_percent;
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function GpuMonitorInset({ hasMiniPlayer }: GpuMonitorInsetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["gpu-stats", "inset"],
    queryFn: fetchGpuStats,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
  });

  const gpus = fallbackGpus(data);
  const hasData = gpus.length > 0;
  const hasGpuError = gpus.some((gpu) => gpu.error);
  const statusLabel = isLoading && !hasData
    ? "loading"
    : isError && !hasData
      ? "offline"
      : hasGpuError
        ? "degraded"
        : "live";

  return (
    <aside
      className={cn(
        "fixed right-3 z-30 w-[min(440px,calc(100vw-1.5rem))] rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur md:right-6",
        hasMiniPlayer ? "bottom-24" : "bottom-3 md:bottom-6",
      )}
      aria-label="GPU utilization"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-sm font-extrabold uppercase tracking-normal">
            GPU
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      </div>

      <div className="space-y-3">
        {gpus.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            GPU stats unavailable
          </div>
        ) : (
          gpus.map((gpu, index) => (
            <div key={gpu.uuid || `${gpu.node_id}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 font-medium">
                  <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{shortLabel(gpu)}</span>
                </span>
                <span className="shrink-0 font-mono text-sm">
                  {gpu.error ? "error" : pct(gpu.utilization_gpu_percent)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    gpu.error ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: gpu.error ? "100%" : utilizationWidth(gpu) }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">
                  {gpu.holder ? gpu.holder : gpu.busy ? "busy" : gpu.name || "idle"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono">
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  pwr {watts(gpu.power_draw_w)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

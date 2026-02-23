"use client";

import { useGpuStore } from "@/stores/gpu-store";

interface GenerationProgressProps {
  progress: number;
  stage: string;
}

export function GenerationProgress({ progress, stage }: GenerationProgressProps) {
  const gpuHolder = useGpuStore((s) => s.holder);
  const pct = Math.min(Math.max(progress * 100, 0), 100);

  // Show a "waiting for GPU" banner when another consumer holds the GPU
  const isWaitingForGpu = gpuHolder !== null && gpuHolder !== "generation" && pct === 0;

  return (
    <div className="space-y-2">
      {isWaitingForGpu && (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          Waiting for GPU ({gpuHolder} generating)...
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {`${stage || "Preparing..."} — ${pct.toFixed(0)}%`}
      </p>
    </div>
  );
}

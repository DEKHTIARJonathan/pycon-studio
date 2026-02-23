"use client";

import { useCallback, useState } from "react";
import { Loader2, Check, X, AlertCircle, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenerationStore } from "@/stores/generation-store";
import { cancelJob } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

function JobRow({
  job,
  onRemove,
}: {
  job: ReturnType<typeof useGenerationStore.getState>["activeJobs"][number];
  onRemove: (id: string) => void;
}) {
  const label =
    job.status === "cancelling"
      ? "Cancelling..."
      : job.generatedTitle ??
        (job.status === "completed"
          ? "Complete"
          : job.status === "failed"
            ? "Failed"
            : job.status === "running"
              ? job.stage || "Generating..."
              : "Waiting...");

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80">
      {/* Status icon */}
      {(job.status === "running" || job.status === "cancelling") && (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      )}
      {job.status === "queued" && (
        <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-sidebar-foreground/30" />
      )}
      {job.status === "completed" && (
        <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
      )}
      {job.status === "failed" && (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
      )}

      {/* Label + progress */}
      <span className="min-w-0 flex-1 truncate">
        {label}
        {job.status === "running" && job.progress > 0 && (
          <span className="ml-1 text-sidebar-foreground/50">
            {Math.round(job.progress * 100)}%
          </span>
        )}
      </span>

      {/* Remove / cancel button — hidden while running (DiT) and cancelling */}
      {job.status !== "running" && job.status !== "cancelling" && (
        <button
          onClick={() => onRemove(job.jobId)}
          className="shrink-0 rounded p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function SidebarQueue({ collapsed }: { collapsed: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const allJobs = useGenerationStore((s) => s.activeJobs);
  const hideJob = useGenerationStore((s) => s.hideJob);
  const clearJobs = useGenerationStore((s) => s.clearJobs);

  const activeJobs = allJobs.filter((j) => !j.hiddenFromQueue);

  const updateJob = useGenerationStore((s) => s.updateJob);

  const handleRemove = useCallback(
    (jobId: string) => {
      const job = allJobs.find((j) => j.jobId === jobId);
      if (job && job.status === "queued") {
        // Show "Cancelling..." in queue — generation hook handles cleanup
        updateJob(jobId, { status: "cancelling" });
        cancelJob(jobId).catch(() => {
          // Cancel endpoint failed (tempJobId 404) — generation hook will clean up
        });
      } else {
        // Completed/failed — hide from queue but keep results in create view
        hideJob(jobId);
      }
    },
    [allJobs, updateJob, hideJob],
  );

  if (activeJobs.length === 0) return null;

  const activeCount = activeJobs.filter(
    (j) => j.status === "queued" || j.status === "running" || j.status === "cancelling",
  ).length;

  const hasFinished = activeJobs.some(
    (j) => j.status === "completed" || j.status === "failed",
  );

  // Collapsed sidebar: just show a badge icon
  if (collapsed) {
    return (
      <div className="border-t border-sidebar-border px-2 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative flex justify-center">
              <ListMusic className="h-5 w-5 text-sidebar-foreground/60" />
              {activeCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {activeCount > 0
              ? `${activeCount} generation${activeCount !== 1 ? "s" : ""} active`
              : `${activeJobs.length} generation${activeJobs.length !== 1 ? "s" : ""} finished`}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground"
      >
        <span className="flex-1 text-left">Queue</span>
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {/* Job list */}
      {expanded && (
        <>
          <ScrollArea className={cn("px-2", activeJobs.length > 4 && "h-36")}>
            <div className="space-y-0.5 pb-1">
              {activeJobs.map((job) => (
                <JobRow key={job.jobId} job={job} onRemove={handleRemove} />
              ))}
            </div>
          </ScrollArea>

          {hasFinished && (
            <div className="px-4 pb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearJobs}
                className="h-6 w-full text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground"
              >
                Clear All
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

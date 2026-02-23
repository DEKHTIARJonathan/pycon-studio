"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { switchDitModel, switchLmModel, downloadModel } from "@/lib/api/client";
import type { ModelInfo, AvailableModel } from "@/types/api";

interface ModelCardsProps {
  title: string;
  models: ModelInfo[];
  availableModels?: AvailableModel[];
  modelType: "dit" | "lm";
  loadingModelName?: string | null;
}

export function ModelCards({
  title,
  models,
  availableModels = [],
  modelType,
  loadingModelName,
}: ModelCardsProps) {
  const queryClient = useQueryClient();

  const switchModelMutation = useMutation({
    mutationFn: (name: string) =>
      modelType === "dit" ? switchDitModel(name) : switchLmModel(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["health"] });
    },
    onError: (err) => toast.error(`Switch failed: ${err.message}`),
  });

  const downloadMutation = useMutation({
    mutationFn: (name: string) => downloadModel(name),
    onSuccess: (_data, name) => {
      toast.success(`Download started for ${name}`);
      queryClient.invalidateQueries({ queryKey: ["available-models"] });
    },
    onError: (err) => toast.error(`Download failed: ${err.message}`),
  });

  const installedNames = new Set(models.map((m) => m.name));
  const notInstalledAvailable = availableModels.filter(
    (am) => am.downloading || (!am.installed && !installedNames.has(am.name)),
  );
  const availableByName = new Map(availableModels.map((am) => [am.name, am]));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {models.length === 0 && notInstalledAvailable.length === 0 ? (
          <p className="text-sm text-muted-foreground">No models found</p>
        ) : (
          <>
            {models.map((model) => {
              const description = availableByName.get(model.name)?.description;
              const loading =
                loadingModelName === model.name ||
                (switchModelMutation.isPending && switchModelMutation.variables === model.name);
              return (
                <div
                  key={model.name}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    {description ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-medium cursor-help">{model.name}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {description}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-sm font-medium">{model.name}</span>
                    )}
                  </div>
                  {model.is_active ? (
                    <Button variant="outline" size="sm" className="pointer-events-none text-green-500 border-green-500/30">
                      Selected
                      <Check className="ml-1 h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => switchModelMutation.mutate(model.name)}
                      disabled={switchModelMutation.isPending}
                    >
                      {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {models.some((m) => m.is_active) ? "Switch" : "Load"}
                    </Button>
                  )}
                </div>
              );
            })}

            {notInstalledAvailable.map((model) => {
              const tooltipText = [
                model.description,
                model.size_mb > 0
                  ? `~${model.size_mb >= 1000 ? `${(model.size_mb / 1000).toFixed(1)} GB` : `${model.size_mb} MB`} download.`
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
              const pct = Math.round(model.download_progress * 100);
              const loading =
                model.downloading ||
                (downloadMutation.isPending && downloadMutation.variables === model.name);

              return (
                <div
                  key={model.name}
                  className="rounded-lg border border-dashed border-border p-3 opacity-75"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {tooltipText ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm font-medium cursor-help">{model.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {tooltipText}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm font-medium">{model.name}</span>
                      )}
                      {model.downloading ? (
                        <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400">
                          Downloading{pct > 0 ? ` ${pct}%` : ""}
                        </Badge>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadMutation.mutate(model.name)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </>
                      )}
                    </Button>
                  </div>
                  {model.downloading && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

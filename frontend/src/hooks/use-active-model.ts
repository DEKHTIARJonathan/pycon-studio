"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api/client";
import type { GenerationMode } from "@/stores/generation-store";

export type ModelType = "base" | "sft" | "turbo" | "unknown";

export interface ActiveModelInfo {
  modelName: string;
  modelType: ModelType;
  supportedModes: GenerationMode[];
  supportsCfg: boolean;
  isLoaded: boolean;
  lmLoaded: boolean;
  noModelSelected: boolean;
}

const BASE_MODES: GenerationMode[] = ["Simple", "Custom", "Remix"];
const STANDARD_MODES: GenerationMode[] = ["Simple", "Custom", "Remix"];

function detectModelType(ditModel: string): ModelType {
  const lower = ditModel.toLowerCase();
  if (lower.includes("turbo")) return "turbo";
  if (lower.includes("sft")) return "sft";
  if (lower.includes("base")) return "base";
  return "unknown";
}

export function useActiveModel(): ActiveModelInfo {
  // Updates arrive via the global /api/ws/health subscription mounted in
  // AppShell (useHealthWs). queryFn still runs once on cache miss as a seed.
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
  });

  const modelName = data?.dit_model ?? "";
  const modelType = modelName ? detectModelType(modelName) : "unknown";
  const isLoaded = data?.dit_model_loaded ?? false;
  const lmLoaded = data?.lm_model_loaded ?? false;
  const noModelSelected = !modelName;

  const supportedModes = modelType === "base" ? BASE_MODES : STANDARD_MODES;
  const supportsCfg = modelType !== "turbo" && modelType !== "unknown";

  return {
    modelName,
    modelType,
    supportedModes,
    supportsCfg,
    isLoaded,
    lmLoaded,
    noModelSelected,
  };
}

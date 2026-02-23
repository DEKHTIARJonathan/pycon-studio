"use client";

import { Loader2, MapPin, Music2, Sparkles } from "lucide-react";
import { useActiveModel } from "@/hooks/use-active-model";
import { BangersPageHero } from "@/components/layout/bangers-page-hero";
import { GenerationForm } from "./generation-form";
import { ResultsPanel } from "./results-panel";

function EngineInfoLine() {
  const { modelName, isLoaded } = useActiveModel();

  const loading = Boolean(modelName) && !isLoaded;

  const label = loading
    ? "Engine loading"
    : modelName
      ? `Engine: ACE-Step ${modelName}`
      : "Engine: ACE-Step \u2014 no model selected";

  return (
    <p className="text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </p>
  );
}

export function CreatePageClient() {
  return (
    <div className="space-y-6">
      <BangersPageHero
        titleId="create-title"
        kicker="Local studio"
        chips={[
          { icon: Sparkles, label: "Create" },
          { icon: Music2, label: "Remix" },
          { icon: MapPin, label: "Long Beach Mix" },
        ]}
      />

      <div className="bangers-section-bar">
        <p className="text-xs font-extrabold uppercase text-primary">Create</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <GenerationForm />
        <div className="space-y-3">
          <ResultsPanel />
          <EngineInfoLine />
        </div>
      </div>
    </div>
  );
}

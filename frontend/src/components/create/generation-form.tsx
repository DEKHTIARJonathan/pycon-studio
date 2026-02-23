"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useGenerationStore } from "@/stores/generation-store";
import { useGeneration } from "@/hooks/use-generation";
import { useActiveModel } from "@/hooks/use-active-model";
import { ModeSelector } from "./mode-selector";
import { SimpleMode } from "./modes/simple-mode";
import { CustomMode } from "./modes/custom-mode";
import { RemixMode } from "./modes/remix-mode";
import { AdvancedSettings } from "./advanced-settings";
import { GenerateButton } from "./generate-button";
import { AutoGenControls } from "./auto-gen-controls";

function NoModelNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">No ACE-Step model selected</p>
        <p className="mt-0.5 text-destructive/90">
          <Link href="/models" className="underline underline-offset-2 hover:text-destructive">
            Choose a model on the Models page
          </Link>{" "}
          to start generating.
        </p>
      </div>
    </div>
  );
}

export function GenerationForm() {
  const activeMode = useGenerationStore((s) => s.activeMode);
  const isCancelling = useGenerationStore((s) =>
    s.activeJobs.some((j) => j.status === "cancelling"),
  );
  const { submit, canSubmit, isGenerating, formatCaption, isFormatting, canFormat, undoFormat, canUndoFormat } = useGeneration();
  const activeModel = useActiveModel();

  return (
    <div className="space-y-4">
      <ModeSelector />

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        {activeMode === "Simple" && <SimpleMode />}
        {activeMode === "Custom" && (
          <CustomMode
            formatCaption={formatCaption}
            isFormatting={isFormatting}
            canFormat={canFormat}
            onUndo={undoFormat}
            canUndo={canUndoFormat}
            lmLoaded={activeModel.lmLoaded}
          />
        )}
        {activeMode === "Remix" && <RemixMode />}
      </div>

      <AdvancedSettings />

      {activeModel.noModelSelected && <NoModelNotice />}

      <GenerateButton
        onClick={submit}
        disabled={!canSubmit}
        isGenerating={isGenerating}
        isCancelling={isCancelling}
      />

      <AutoGenControls />
    </div>
  );
}

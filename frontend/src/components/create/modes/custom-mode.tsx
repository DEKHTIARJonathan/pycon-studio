"use client";

import { CaptionInput } from "@/components/create/caption-input";
import { LyricsEditor } from "@/components/create/lyrics-editor";
import { MetadataControls } from "@/components/create/metadata-controls";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useGenerationStore } from "@/stores/generation-store";

interface CustomModeProps {
  formatCaption: () => Promise<void>;
  isFormatting: boolean;
  canFormat: boolean;
  onUndo: () => void;
  canUndo: boolean;
  lmLoaded: boolean;
}

export function CustomMode({
  formatCaption,
  isFormatting,
  canFormat,
  onUndo,
  canUndo,
  lmLoaded,
}: CustomModeProps) {
  const form = useGenerationStore((s) => s.customForm);
  const update = useGenerationStore((s) => s.updateCustomForm);
  const resetCustomForm = useGenerationStore((s) => s.resetCustomForm);

  return (
    <div className="space-y-4">
      <CaptionInput
        value={form.caption}
        onChange={(v) => update({ caption: v })}
        showFormat={lmLoaded}
        onFormat={formatCaption}
        isFormatting={isFormatting}
        canFormat={canFormat}
        onUndo={onUndo}
        canUndo={canUndo}
      />

      <LyricsEditor
        value={form.lyrics}
        onChange={(v) => update({ lyrics: v })}
        disabled={form.instrumental}
      />

      <MetadataControls
        bpm={form.bpm}
        onBpmChange={(v) => update({ bpm: v })}
        keyscale={form.keyscale}
        onKeyscaleChange={(v) => update({ keyscale: v === "_auto" ? "" : v })}
        timesignature={form.timesignature}
        onTimesignatureChange={(v) => update({ timesignature: v === "_auto" ? "" : v })}
        instrumental={form.instrumental}
        onInstrumentalChange={(v) => update({ instrumental: v })}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={resetCustomForm}
        className="h-7 gap-1.5 text-xs text-muted-foreground"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Form
      </Button>
    </div>
  );
}

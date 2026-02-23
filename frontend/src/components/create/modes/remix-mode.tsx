"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AudioUploadZone } from "@/components/create/audio-upload-zone";
import { CaptionInput } from "@/components/create/caption-input";
import { LyricsEditor } from "@/components/create/lyrics-editor";
import { useGenerationStore } from "@/stores/generation-store";

export function RemixMode() {
  const form = useGenerationStore((s) => s.remixForm);
  const update = useGenerationStore((s) => s.updateRemixForm);

  return (
    <div className="space-y-4">
      <AudioUploadZone
        filePath={form.audioFilePath}
        fileName={form.audioFileName}
        onUpload={(path, name) =>
          update({ audioFilePath: path, audioFileName: name })
        }
        onRemove={() => update({ audioFilePath: "", audioFileName: "" })}
      />

      <CaptionInput
        value={form.caption}
        onChange={(v) => update({ caption: v })}
      />

      <LyricsEditor
        value={form.lyrics}
        onChange={(v) => update({ lyrics: v })}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Cover Strength</Label>
          <span className="text-xs text-muted-foreground">
            {form.coverStrength.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[form.coverStrength]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => update({ coverStrength: v })}
        />
      </div>

    </div>
  );
}

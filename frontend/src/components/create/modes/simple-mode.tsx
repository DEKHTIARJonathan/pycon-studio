"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGenerationStore } from "@/stores/generation-store";

export function SimpleMode() {
  const form = useGenerationStore((s) => s.simpleForm);
  const update = useGenerationStore((s) => s.updateSimpleForm);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="simple-prompt">Describe your music</Label>
        <Textarea
          id="simple-prompt"
          value={form.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="A dreamy lo-fi beat with soft piano and gentle rain sounds..."
          className="min-h-[120px] resize-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="simple-instrumental"
          checked={form.instrumental}
          onCheckedChange={(v) => update({ instrumental: v })}
        />
        <Label htmlFor="simple-instrumental" className="cursor-pointer">
          Instrumental
        </Label>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createStation } from "@/lib/api/radio-client";

interface CreateStationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const INITIAL_FORM = {
  name: "",
  description: "",
  genre: "",
  mood: "",
  caption_template: "",
  instrumental: false,
  bpm_min: "",
  bpm_max: "",
  keyscale: "",
  timesignature: "",
} as const;

type FormState = {
  name: string;
  description: string;
  genre: string;
  mood: string;
  caption_template: string;
  instrumental: boolean;
  bpm_min: string;
  bpm_max: string;
  keyscale: string;
  timesignature: string;
};

export function CreateStationDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateStationDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM });

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const bpmMin = form.bpm_min ? Number(form.bpm_min) : undefined;
      const bpmMax = form.bpm_max ? Number(form.bpm_max) : undefined;

      return createStation({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        genre: form.genre.trim() || undefined,
        mood: form.mood.trim() || undefined,
        instrumental: form.instrumental,
        caption_template: form.caption_template.trim() || undefined,
        bpm_min: bpmMin ?? null,
        bpm_max: bpmMax ?? null,
        keyscale: form.keyscale.trim() || undefined,
        timesignature: form.timesignature.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
      toast.success("Station created");
      setForm({ ...INITIAL_FORM });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (err) => {
      toast.error(`Failed to create station: ${err.message}`);
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutation.mutate();
    },
    [mutation],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Station</DialogTitle>
          <DialogDescription>
            Configure a new radio station that generates music based on your
            preferences.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="station-name">Name</Label>
            <Input
              id="station-name"
              placeholder="My Station"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="station-description">Description</Label>
            <Input
              id="station-description"
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>

          {/* Genre + Mood */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="station-genre">Genre</Label>
              <Input
                id="station-genre"
                placeholder="e.g. Jazz, Rock"
                value={form.genre}
                onChange={(e) => updateField("genre", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-mood">Mood</Label>
              <Input
                id="station-mood"
                placeholder="e.g. Chill, Energetic"
                value={form.mood}
                onChange={(e) => updateField("mood", e.target.value)}
              />
            </div>
          </div>

          {/* Caption Template */}
          <div className="space-y-1.5">
            <Label htmlFor="station-caption-template">Caption Template</Label>
            <Textarea
              id="station-caption-template"
              placeholder="e.g. A {mood} {genre} track with warm textures"
              value={form.caption_template}
              onChange={(e) => updateField("caption_template", e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{mood}"} and {"{genre}"} as placeholders. Leave empty for
              auto-generated captions.
            </p>
          </div>

          {/* Lyrics */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="station-lyrics" className="cursor-pointer">
              Lyrics
            </Label>
            <Switch
              id="station-lyrics"
              checked={!form.instrumental}
              onCheckedChange={(checked) =>
                updateField("instrumental", !checked)
              }
            />
          </div>

          {/* BPM Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="station-bpm-min">BPM Min</Label>
              <Input
                id="station-bpm-min"
                type="number"
                placeholder="60"
                value={form.bpm_min}
                onChange={(e) => updateField("bpm_min", e.target.value)}
                min={0}
                max={300}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-bpm-max">BPM Max</Label>
              <Input
                id="station-bpm-max"
                type="number"
                placeholder="180"
                value={form.bpm_max}
                onChange={(e) => updateField("bpm_max", e.target.value)}
                min={0}
                max={300}
              />
            </div>
          </div>

          {/* Key/Scale + Time Signature */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="station-keyscale">Key / Scale</Label>
              <Input
                id="station-keyscale"
                placeholder="e.g. C major"
                value={form.keyscale}
                onChange={(e) => updateField("keyscale", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-timesignature">Time Signature</Label>
              <Input
                id="station-timesignature"
                placeholder="e.g. 4/4"
                value={form.timesignature}
                onChange={(e) => updateField("timesignature", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.name.trim() || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

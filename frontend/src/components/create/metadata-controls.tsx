"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KEYSCALE_NOTES,
  KEYSCALE_ACCIDENTALS,
  KEYSCALE_MODES,
  VALID_TIME_SIGNATURES,
  BPM_MIN,
  BPM_MAX,
} from "@/lib/constants";

interface MetadataControlsProps {
  bpm: number | null;
  onBpmChange: (bpm: number | null) => void;
  keyscale: string;
  onKeyscaleChange: (keyscale: string) => void;
  timesignature: string;
  onTimesignatureChange: (timesig: string) => void;
  instrumental: boolean;
  onInstrumentalChange: (instrumental: boolean) => void;
}

function buildKeyscaleOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [
    { value: "", label: "Auto" },
  ];
  for (const note of KEYSCALE_NOTES) {
    for (const acc of KEYSCALE_ACCIDENTALS) {
      for (const mode of KEYSCALE_MODES) {
        const val = `${note}${acc} ${mode}`;
        options.push({ value: val, label: val });
      }
    }
  }
  return options;
}

const keyscaleOptions = buildKeyscaleOptions();

export function MetadataControls({
  bpm,
  onBpmChange,
  keyscale,
  onKeyscaleChange,
  timesignature,
  onTimesignatureChange,
  instrumental,
  onInstrumentalChange,
}: MetadataControlsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>BPM</Label>
          <span className="text-xs text-muted-foreground">
            {bpm ?? "Auto"}
          </span>
        </div>
        <Slider
          value={[bpm ?? 120]}
          min={BPM_MIN}
          max={BPM_MAX}
          step={1}
          onValueChange={([v]) => onBpmChange(v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Key</Label>
          <Select value={keyscale} onValueChange={onKeyscaleChange}>
            <SelectTrigger>
              <SelectValue placeholder="Auto" />
            </SelectTrigger>
            <SelectContent>
              {keyscaleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || "_auto"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Time Signature</Label>
          <Select value={timesignature} onValueChange={onTimesignatureChange}>
            <SelectTrigger>
              <SelectValue placeholder="Auto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_auto">Auto</SelectItem>
              {VALID_TIME_SIGNATURES.map((ts) => (
                <SelectItem key={ts} value={ts}>
                  {ts}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="instrumental"
          checked={instrumental}
          onCheckedChange={onInstrumentalChange}
        />
        <Label htmlFor="instrumental" className="cursor-pointer">
          Instrumental
        </Label>
      </div>
    </div>
  );
}

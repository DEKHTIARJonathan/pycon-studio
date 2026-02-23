"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerationStore } from "@/stores/generation-store";
import { useActiveModel } from "@/hooks/use-active-model";
import {
  INFERENCE_STEPS_MIN,
  INFERENCE_STEPS_MAX,
  GUIDANCE_SCALE_MIN,
  GUIDANCE_SCALE_MAX,
  SHIFT_MIN,
  SHIFT_MAX,
  BATCH_SIZE_MIN,
  BATCH_SIZE_MAX,
  LM_TEMPERATURE_MIN,
  LM_TEMPERATURE_MAX,
  AUDIO_FORMATS,
} from "@/lib/constants";

function AceStepAdvancedSettings() {
  const settings = useGenerationStore((s) => s.advancedSettings);
  const update = useGenerationStore((s) => s.updateAdvancedSettings);
  const { supportsCfg } = useActiveModel();

  return (
    <div className="space-y-4">
      {/* Inference Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label>Inference Steps</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Number of denoising steps. Higher = better quality, slower. Default: 8 for turbo, 32+ for base models.</TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground">
            {settings.inferenceSteps}
          </span>
        </div>
        <Slider
          value={[settings.inferenceSteps]}
          min={INFERENCE_STEPS_MIN}
          max={INFERENCE_STEPS_MAX}
          step={1}
          onValueChange={([v]) => update({ inferenceSteps: v })}
        />
      </div>

      {/* Guidance Scale */}
      <div className={`space-y-2 ${!supportsCfg ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label>Guidance Scale</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>How closely to follow the prompt. Higher = more faithful.</TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground">
            {settings.guidanceScale}
          </span>
        </div>
        <Slider
          value={[settings.guidanceScale]}
          min={GUIDANCE_SCALE_MIN}
          max={GUIDANCE_SCALE_MAX}
          step={0.5}
          onValueChange={([v]) => update({ guidanceScale: v })}
          disabled={!supportsCfg}
        />
        {!supportsCfg && (
          <p className="text-xs text-muted-foreground">Not used by turbo models</p>
        )}
      </div>

      {/* Shift */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label>Shift</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Timestep shift factor for the diffusion noise schedule. Default 3.0 for both turbo and base models.</TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground">
            {settings.shift.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[settings.shift]}
          min={SHIFT_MIN}
          max={SHIFT_MAX}
          step={0.1}
          onValueChange={([v]) => update({ shift: v })}
        />
      </div>

      {/* Inference Method */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>Sampler</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>ODE = fast, deterministic. SDE = stochastic, adds noise each step for more variation.</TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={settings.inferMethod}
          onValueChange={(v) => update({ inferMethod: v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ode">ODE (Deterministic)</SelectItem>
            <SelectItem value="sde">SDE (Stochastic)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Seed */}
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label>Seed</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Fixed seed for reproducible results. -1 = random.</TooltipContent>
          </Tooltip>
        </div>
        <Input
          type="number"
          value={settings.seed}
          onChange={(e) => update({ seed: parseInt(e.target.value) || -1 })}
          placeholder="-1 for random"
          className="h-8"
        />
      </div>

      {/* LM Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label>LM Temperature</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Controls creativity of lyrics/structure generation.</TooltipContent>
            </Tooltip>
          </div>
          <span className="text-xs text-muted-foreground">
            {settings.lmTemperature.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[settings.lmTemperature]}
          min={LM_TEMPERATURE_MIN}
          max={LM_TEMPERATURE_MAX}
          step={0.05}
          onValueChange={([v]) => update({ lmTemperature: v })}
        />
      </div>

      {/* Batch Size / Audio Format */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label>Batch Size</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Number of variations to generate per run.</TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={String(settings.batchSize)}
            onValueChange={(v) => update({ batchSize: parseInt(v) })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: BATCH_SIZE_MAX - BATCH_SIZE_MIN + 1 },
                (_, i) => i + BATCH_SIZE_MIN,
              ).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label>Format</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Output audio format.</TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={settings.audioFormat}
            onValueChange={(v) => update({ audioFormat: v })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

    </div>
  );
}

export function AdvancedSettings() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        Advanced Settings
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3">
          <AceStepAdvancedSettings />
        </div>
      )}
    </div>
  );
}

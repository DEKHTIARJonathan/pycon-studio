"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Server, CheckCircle2, XCircle, Loader2, Radio, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settings-store";
import { useGenerationStore } from "@/stores/generation-store";
import { fetchHealth, fetchSettings, updateSettings } from "@/lib/api/client";
import { fetchVaeThrottle, updateVaeThrottle, fetchDitThrottle, updateDitThrottle, resetThrottle, fetchThrottleScope, updateThrottleScope } from "@/lib/api/radio-client";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { DURATION_DEFAULT, DURATION_MAX, DURATION_MIN } from "@/lib/constants";

export default function SettingsPage() {
  const { backendUrl, setBackendUrl } = useSettingsStore();
  const setFastCreateMode = useGenerationStore((s) => s.setFastCreateMode);
  const [urlInput, setUrlInput] = useState(backendUrl);
  const queryClient = useQueryClient();

  // Health updates stream via the global /api/ws/health subscription
  // mounted in AppShell (useHealthWs); queryFn is the cache-miss seed.
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
  });

  const serverSettingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: healthQuery.isSuccess,
  });

  const settingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const handleSaveUrl = () => {
    setBackendUrl(urlInput);
    queryClient.invalidateQueries({ queryKey: ["health"] });
    toast.success("Backend URL updated");
  };

  const vaeThrottleQuery = useQuery({
    queryKey: ["vae-throttle"],
    queryFn: fetchVaeThrottle,
    enabled: healthQuery.isSuccess,
  });

  const vaeThrottleMutation = useMutation({
    mutationFn: updateVaeThrottle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vae-throttle"] });
      toast.success("Radio GPU settings saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const ditThrottleQuery = useQuery({
    queryKey: ["dit-throttle"],
    queryFn: fetchDitThrottle,
    enabled: healthQuery.isSuccess,
  });

  const ditThrottleMutation = useMutation({
    mutationFn: updateDitThrottle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dit-throttle"] });
      toast.success("DiT throttle saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const throttleResetMutation = useMutation({
    mutationFn: resetThrottle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vae-throttle"] });
      queryClient.invalidateQueries({ queryKey: ["dit-throttle"] });
      queryClient.invalidateQueries({ queryKey: ["throttle-scope"] });
      toast.success("Throttle settings reset to defaults");
    },
    onError: (err: Error) => {
      toast.error(`Failed to reset: ${err.message}`);
    },
  });

  const throttleScopeQuery = useQuery({
    queryKey: ["throttle-scope"],
    queryFn: fetchThrottleScope,
    enabled: healthQuery.isSuccess,
  });

  const throttleScopeMutation = useMutation({
    mutationFn: updateThrottleScope,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["throttle-scope"] });
      toast.success("Throttle scope updated");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  // Local slider state (synced from server, updated during drag)
  const [defaultDuration, setDefaultDuration] = useState(DURATION_DEFAULT);
  const [vaeChunkSize, setVaeChunkSize] = useState(128);
  const [vaeSleepMs, setVaeSleepMs] = useState(200);
  const [ditSleepMs, setDitSleepMs] = useState(200);

  useEffect(() => {
    const raw = serverSettingsQuery.data?.settings.default_duration;
    const parsed = Number.parseFloat(raw ?? "");
    if (Number.isFinite(parsed)) {
      setDefaultDuration(Math.max(
        DURATION_MIN,
        Math.min(DURATION_MAX, Math.round(parsed)),
      ));
    }
  }, [serverSettingsQuery.data]);

  useEffect(() => {
    if (vaeThrottleQuery.data) {
      setVaeChunkSize(vaeThrottleQuery.data.chunk_size);
      setVaeSleepMs(vaeThrottleQuery.data.sleep_ms);
    }
  }, [vaeThrottleQuery.data]);

  useEffect(() => {
    if (ditThrottleQuery.data) {
      setDitSleepMs(ditThrottleQuery.data.sleep_ms);
    }
  }, [ditThrottleQuery.data]);

  const health = healthQuery.data;
  const connected = healthQuery.isSuccess;
  const serverSettings = serverSettingsQuery.data?.settings ?? {};
  const boolSetting = (key: string, fallback: boolean) => {
    const value = serverSettings[key];
    if (value == null) return fallback;
    return value === "true";
  };

  const commitDefaultDuration = (value: number) => {
    const duration = Math.max(
      DURATION_MIN,
      Math.min(DURATION_MAX, Math.round(value)),
    );
    setDefaultDuration(duration);
    settingsMutation.mutate({ default_duration: String(duration) });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Backend Connection
          </CardTitle>
          <CardDescription>Backend URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backend-url">Backend URL</Label>
            <div className="flex gap-2">
              <Input
                id="backend-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://localhost:8000"
              />
              <Button onClick={handleSaveUrl} variant="secondary">
                Save
              </Button>
            </div>
          </div>

          <Separator />

          {/* Health status */}
          <div className="space-y-3">
            <Label>Server Status</Label>
            {healthQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking connection...
              </div>
            ) : connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Connected</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    v{health?.version}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Device:</span>{" "}
                    <span className="font-medium">{health?.device || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Backend:</span>{" "}
                    <span className="font-medium">ACE-Step</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DiT Model:</span>{" "}
                    <span className="font-medium">
                      {health?.dit_model || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">DiT:</span>
                    {health?.dit_model_loaded ? (
                      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                        Loaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                        Loading...
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">LM:</span>
                    {health?.lm_model_loaded ? (
                      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                        Loaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                        Loading...
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                Cannot connect to backend
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Server settings (from SQLite) */}
      {connected && serverSettingsQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Defaults</CardTitle>
            <CardDescription>
              Default values for music generation. Stored on the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="resident-models">Keep active models resident</Label>
                  <p className="text-xs text-muted-foreground">
                    Keeps the selected ACE-Step models loaded between generations.
                  </p>
                </div>
                <Switch
                  id="resident-models"
                  checked={boolSetting("keep_active_models_resident", true)}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({ keep_active_models_resident: checked ? "true" : "false" })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="parallel-pipeline">Parallel pipeline overlap</Label>
                  <p className="text-xs text-muted-foreground">
                    Allows helper LLM and CPU-side work to overlap with music stages when safe.
                  </p>
                </div>
                <Switch
                  id="parallel-pipeline"
                  checked={boolSetting("parallel_pipeline_enabled", false)}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({ parallel_pipeline_enabled: checked ? "true" : "false" })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="fast-create">Fast Create mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Simple mode sends your prompt directly instead of requiring LLM expansion.
                  </p>
                </div>
                <Switch
                  id="fast-create"
                  checked={boolSetting("fast_create_mode", true)}
                  onCheckedChange={(checked) => {
                    setFastCreateMode(checked);
                    settingsMutation.mutate({ fast_create_mode: checked ? "true" : "false" });
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="lyrics-guardrails">Lyrics guardrails</Label>
                  <p className="text-xs text-muted-foreground">
                    Reviews vocal lyrics with the loaded Chat LLM before music generation.
                  </p>
                </div>
                <Switch
                  id="lyrics-guardrails"
                  checked={boolSetting("lyrics_guardrails_enabled", true)}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({ lyrics_guardrails_enabled: checked ? "true" : "false" })
                  }
                />
              </div>
            </div>
            <div className="mb-5 space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="default-duration">Default Song Length</Label>
                  <p className="text-xs text-muted-foreground">
                    Used by Simple, Custom auto length, DJ, and preset radio generation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="default-duration"
                    type="number"
                    min={DURATION_MIN}
                    max={DURATION_MAX}
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(Number(e.target.value))}
                    onBlur={(e) => commitDefaultDuration(Number(e.target.value))}
                    className="h-8 w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>
              <Slider
                value={[defaultDuration]}
                min={DURATION_MIN}
                max={DURATION_MAX}
                step={1}
                onValueChange={([v]) => setDefaultDuration(v)}
                onValueCommit={([v]) => commitDefaultDuration(v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(serverSettingsQuery.data.settings).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 overflow-hidden rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <span className="shrink-0 text-muted-foreground">{key}</span>
                    <span className="truncate font-mono text-xs" title={value}>{value}</span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPU Throttle */}
      {connected && vaeThrottleQuery.data && ditThrottleQuery.data && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  GPU Throttle
                </CardTitle>
                <CardDescription>
                  Adds pauses between GPU-intensive steps to prevent audio
                  stuttering on Apple Silicon unified memory. Higher pause
                  values and smaller chunk sizes keep playback smooth but slow
                  down generation. If you don&apos;t hear any stuttering, reduce
                  pauses or increase chunk size for faster generation.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => throttleResetMutation.mutate()}
                disabled={throttleResetMutation.isPending}
                className="shrink-0"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {throttleScopeQuery.data && (
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="radio-only">Radio only</Label>
                  <p className="text-xs text-muted-foreground">
                    Only throttle during radio playback. Normal generation runs at full speed.
                  </p>
                </div>
                <Switch
                  id="radio-only"
                  checked={throttleScopeQuery.data.radio_only}
                  onCheckedChange={(checked) =>
                    throttleScopeMutation.mutate({ radio_only: checked })
                  }
                />
              </div>
            )}

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">DiT Diffusion</Label>
              <p className="text-xs text-muted-foreground">
                Each song requires 8 transformer forward passes on the GPU.
                A pause between steps lets the audio thread run uninterrupted.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pause between steps</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {ditSleepMs} ms
                </span>
              </div>
              <Slider
                value={[ditSleepMs]}
                min={0}
                max={500}
                step={25}
                onValueChange={([v]) => setDitSleepMs(v)}
                onValueCommit={([v]) =>
                  ditThrottleMutation.mutate({ sleep_ms: v })
                }
              />
              <p className="text-xs text-muted-foreground">
                Higher = smoother playback, slower generation.
                0 ms = no pause (fastest, may stutter).
              </p>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">VAE Decode</Label>
              <p className="text-xs text-muted-foreground">
                After diffusion, the VAE converts latents into audio. The decode
                is split into chunks with pauses between them so the GPU
                doesn&apos;t monopolize memory bandwidth.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Chunk size</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {vaeChunkSize} frames
                </span>
              </div>
              <Slider
                value={[vaeChunkSize]}
                min={128}
                max={2048}
                step={128}
                onValueChange={([v]) => setVaeChunkSize(v)}
                onValueCommit={([v]) =>
                  vaeThrottleMutation.mutate({
                    chunk_size: v,
                    sleep_ms: vaeSleepMs,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Smaller = more pauses, smoother playback.
                Larger = fewer pauses, faster generation.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pause between chunks</Label>
                <span className="font-mono text-xs text-muted-foreground">
                  {vaeSleepMs} ms
                </span>
              </div>
              <Slider
                value={[vaeSleepMs]}
                min={0}
                max={500}
                step={25}
                onValueChange={([v]) => setVaeSleepMs(v)}
                onValueCommit={([v]) =>
                  vaeThrottleMutation.mutate({
                    chunk_size: vaeChunkSize,
                    sleep_ms: v,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Higher = smoother playback, slower generation.
                0 ms = no pause (fastest, may stutter).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyboard shortcuts reference */}
      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Space", "Play / Pause"],
              ["M", "Mute / Unmute"],
              ["N", "Next track"],
              ["P", "Previous track"],
              ["\u2190 / \u2192", "Seek -5s / +5s"],
              ["\u2191 / \u2193", "Volume up / down"],
              ["F", "Toggle favorite"],
              ["1-5", "Rate current song"],
              ["Ctrl+Enter", "Generate"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="inline-flex h-6 min-w-[28px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs">
                  {key}
                </kbd>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

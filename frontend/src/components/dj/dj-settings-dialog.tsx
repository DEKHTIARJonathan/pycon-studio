"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { fetchDJInfo, updateDJSettings } from "@/lib/api/dj-client";

interface DJSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DJSettingsDialog({ open, onOpenChange }: DJSettingsDialogProps) {
  const queryClient = useQueryClient();

  const { data: info, isLoading } = useQuery({
    queryKey: ["dj-info"],
    queryFn: fetchDJInfo,
    retry: false,
    enabled: open,
  });

  const [systemPrompt, setSystemPrompt] = useState("");

  // Hydrate the textarea when the dialog opens or info changes.
  useEffect(() => {
    if (!open || !info) return;
    setSystemPrompt(info.system_prompt || info.default_system_prompt);
  }, [open, info]);

  const saveMutation = useMutation({
    mutationFn: updateDJSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["dj-info"], data);
      toast.success("DJ settings saved");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to save DJ settings: ${err.message}`);
    },
  });

  const handleResetToDefault = () => {
    if (!info) return;
    setSystemPrompt(info.default_system_prompt);
  };

  const handleSave = () => {
    if (!info) return;
    const trimmed = systemPrompt.trim();
    const isDefault =
      trimmed === "" || trimmed === info.default_system_prompt.trim();
    saveMutation.mutate({
      system_prompt: isDefault ? "" : systemPrompt,
    });
  };

  const isUsingDefault =
    info !== undefined &&
    (systemPrompt.trim() === "" ||
      systemPrompt.trim() === info.default_system_prompt.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>AI DJ Settings</DialogTitle>
          <DialogDescription>
            Customize the system prompt that steers DJ replies.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !info ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Active chat model:</span>{" "}
              {info.active_model ? (
                <span className="font-medium">{info.active_model}</span>
              ) : (
                <span className="italic text-muted-foreground">none selected</span>
              )}
              <span className="text-muted-foreground">
                {" "}
                &middot;{" "}
                <Link
                  href="/models"
                  className="underline hover:no-underline"
                  onClick={() => onOpenChange(false)}
                >
                  Change on Models page
                </Link>
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="dj-system-prompt"
                  className="text-sm font-medium"
                >
                  System prompt
                </label>
                {!isUsingDefault && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetToDefault}
                  >
                    Reset to default
                  </Button>
                )}
              </div>
              <Textarea
                id="dj-system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[12rem] flex-1 resize-none font-mono text-xs"
                placeholder="Override the default DJ instructions..."
              />
              <p className="text-xs text-muted-foreground">
                Leave matching the default to use the built-in DJ prompt.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !info}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

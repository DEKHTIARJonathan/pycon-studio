"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2, Undo2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface CaptionInputProps {
  value: string;
  onChange: (value: string) => void;
  showFormat?: boolean;
  onFormat?: () => void;
  isFormatting?: boolean;
  canFormat?: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
}

export function CaptionInput({
  value,
  onChange,
  showFormat = false,
  onFormat,
  isFormatting = false,
  canFormat = false,
  onUndo,
  canUndo = false,
}: CaptionInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="caption">Caption</Label>
        {showFormat && (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFormat}
                  disabled={!canFormat || isFormatting}
                  className="h-7 gap-1.5 text-xs"
                >
                  {isFormatting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Format
                </Button>
              </TooltipTrigger>
              <TooltipContent>Use AI to enhance your caption and lyrics</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`h-7 gap-1.5 text-xs transition-opacity duration-200 ${canUndo ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                  <Undo2 className="h-3 w-3" />
                  Undo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revert to pre-format values</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      <Textarea
        id="caption"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the music you want to create... (e.g., 'An upbeat pop song with catchy guitar riffs and energetic vocals')"
        className="min-h-[80px] resize-none"
      />
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const FILE_FORMATS = ["mp3", "wav", "flac", "ogg"] as const;
const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "2/4"] as const;

interface FilterChipsProps {
  fileFormat: string;
  onFileFormatChange: (value: string) => void;
  instrumental: boolean | null;
  onInstrumentalChange: (value: boolean | null) => void;
  timesignature: string;
  onTimesignatureChange: (value: string) => void;
  tag: string;
  onTagChange: (value: string) => void;
}

export function FilterChips({
  fileFormat,
  onFileFormatChange,
  instrumental,
  onInstrumentalChange,
  timesignature,
  onTimesignatureChange,
  tag,
  onTagChange,
}: FilterChipsProps) {
  const hasActiveFilters =
    fileFormat || instrumental !== null || timesignature || tag;

  const clearAll = () => {
    onFileFormatChange("");
    onInstrumentalChange(null);
    onTimesignatureChange("");
    onTagChange("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILE_FORMATS.map((fmt) => (
        <Button
          key={fmt}
          variant={fileFormat === fmt ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onFileFormatChange(fileFormat === fmt ? "" : fmt)}
        >
          {fmt.toUpperCase()}
        </Button>
      ))}

      <div className="h-4 w-px bg-border" />

      <Button
        variant={instrumental === true ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs"
        onClick={() => onInstrumentalChange(instrumental === true ? null : true)}
      >
        Instrumental
      </Button>
      <Button
        variant={tag === "radio" ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs"
        onClick={() => onTagChange(tag === "radio" ? "" : "radio")}
      >
        Radio
      </Button>

      <div className="h-4 w-px bg-border" />

      {TIME_SIGNATURES.map((ts) => (
        <Button
          key={ts}
          variant={timesignature === ts ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onTimesignatureChange(timesignature === ts ? "" : ts)}
        >
          {ts}
        </Button>
      ))}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={clearAll}
        >
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}

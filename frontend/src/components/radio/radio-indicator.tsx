"use client";

import { useRadioStore } from "@/stores/radio-store";
import { Badge } from "@/components/ui/badge";

export function RadioIndicator() {
  const activeStationId = useRadioStore((s) => s.activeStationId);

  if (!activeStationId) return null;

  return (
    <Badge
      variant="secondary"
      className="gap-1 border-primary/30 bg-primary/10 text-primary text-[10px] uppercase"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Radio
    </Badge>
  );
}

"use client";

import { Radio } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { StationResponse } from "@/types/api";
import { StationCard } from "./station-card";

interface StationGridProps {
  stations: StationResponse[];
  isLoading: boolean;
  onEdit: (station: StationResponse) => void;
  onDelete: (station: StationResponse) => void;
}

export function StationGrid({
  stations,
  isLoading,
  onEdit,
  onDelete,
}: StationGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  const presetStations = stations.filter((s) => s.is_preset);
  const customStations = stations.filter((s) => !s.is_preset);

  return (
    <div className="space-y-8">
      {/* Preset Stations */}
      {presetStations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Preset Stations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {presetStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      )}

      {presetStations.length > 0 && <Separator />}

      {/* Custom Stations */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Custom Stations</h2>
        {customStations.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card">
            <Radio className="h-12 w-12 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No custom stations yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Create a station to generate endless music tailored to your
                taste
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

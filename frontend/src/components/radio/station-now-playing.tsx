"use client";

import { Loader2, Square, SkipForward, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useRadio } from "@/hooks/use-radio";
import { useRadioStore } from "@/stores/radio-store";
import { playbackController } from "@/lib/audio/playback-controller";
import type { StationResponse } from "@/types/api";

interface StationNowPlayingProps {
  station: StationResponse | undefined;
  pendingStation?: StationResponse;
}

export function StationNowPlaying({ station, pendingStation }: StationNowPlayingProps) {
  const { isGenerating, stopStation } = useRadio();
  const songsGenerated = useRadioStore((s) => s.songsGenerated);

  if (!station) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Now Playing</CardTitle>
          <span className="relative ml-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">{station.name}</p>
          {station.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {station.description}
            </p>
          )}
        </div>

        {/* Generation status */}
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {pendingStation
                  ? `Switching to ${pendingStation.name} when the next track is ready...`
                  : "Generating next track..."}
              </span>
            </>
          ) : pendingStation ? (
            <span className="text-sm text-muted-foreground">
              Switching to {pendingStation.name} when the next track is ready
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Ready for next track
            </span>
          )}
        </div>

        {/* Stats + controls */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {songsGenerated} {songsGenerated === 1 ? "song" : "songs"}{" "}
            generated
          </span>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void playbackController.next()}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip to next track</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={stopStation}
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stop radio</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

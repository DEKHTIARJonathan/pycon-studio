import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StationResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({
  updateStation: vi.fn(),
  startStation: vi.fn(),
}));

vi.mock("@/hooks/use-radio", () => ({
  useRadio: () => ({
    activeStationId: null,
    pendingStationId: null,
    startStation: mocks.startStation,
  }),
}));

vi.mock("@/lib/api/radio-client", () => ({
  fetchStation: vi.fn(),
  updateStation: mocks.updateStation,
}));

vi.mock("@/lib/api/client", () => ({
  getSongAudioUrl: (id: string) => `/songs/${id}/audio`,
  getStationExportUrl: (id: string) => `/radio/stations/${id}/export`,
}));

vi.mock("@/lib/export-utils", () => ({
  exportZip: vi.fn(),
}));

import { StationCard } from "../station-card";

function makeStation(overrides: Partial<StationResponse> = {}): StationResponse {
  return {
    id: "station-1",
    name: "Preset Pop",
    description: "",
    is_preset: true,
    caption_template: "",
    genre: "pop",
    mood: "bright",
    instrumental: true,
    vocal_language: "unknown",
    bpm_min: null,
    bpm_max: null,
    keyscale: "",
    timesignature: "",
    advanced_params_json: "{}",
    total_plays: 0,
    last_played_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderCard(station: StationResponse) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StationCard
          station={station}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("StationCard", () => {
  beforeEach(() => {
    mocks.updateStation.mockReset();
    mocks.updateStation.mockResolvedValue(makeStation({ instrumental: false }));
    mocks.startStation.mockReset();
  });

  afterEach(cleanup);

  it("exposes a lyrics toggle for preset stations", () => {
    renderCard(makeStation({ is_preset: true }));

    expect(screen.getByRole("switch", { name: /lyrics/i })).toBeInTheDocument();
  });

  it("sends instrumental=false when lyrics are enabled", async () => {
    renderCard(makeStation({ instrumental: true }));

    await userEvent.click(screen.getByRole("switch", { name: /lyrics/i }));

    await waitFor(() => {
      expect(mocks.updateStation).toHaveBeenCalledWith(
        "station-1",
        { instrumental: false },
      );
    });
  });
});

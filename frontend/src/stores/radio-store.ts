import { create } from "zustand";
import type { StationResponse } from "@/types/api";

interface RadioState {
  stations: StationResponse[];
  activeStationId: string | null;
  pendingStationId: string | null;
  isGenerating: boolean;
  songsGenerated: number;

  setStations: (stations: StationResponse[]) => void;
  startStation: (id: string) => void;
  setPendingStation: (id: string | null) => void;
  promotePendingStation: () => void;
  stopStation: () => void;
  setIsGenerating: (v: boolean) => void;
  incrementSongsGenerated: () => void;
}

export const useRadioStore = create<RadioState>()((set) => ({
  stations: [],
  activeStationId: null,
  pendingStationId: null,
  isGenerating: false,
  songsGenerated: 0,

  setStations: (stations) => set({ stations }),
  startStation: (id) => set({ activeStationId: id, pendingStationId: null, songsGenerated: 0 }),
  setPendingStation: (id) => set({ pendingStationId: id }),
  promotePendingStation: () => set((s) => (
    s.pendingStationId
      ? { activeStationId: s.pendingStationId, pendingStationId: null }
      : {}
  )),
  stopStation: () => set({
    activeStationId: null,
    pendingStationId: null,
    isGenerating: false,
    songsGenerated: 0,
  }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  incrementSongsGenerated: () => set((s) => ({ songsGenerated: s.songsGenerated + 1 })),
}));

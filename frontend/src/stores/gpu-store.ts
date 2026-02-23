import { create } from "zustand";

type GpuHolder = "radio" | "generation" | "dj" | null;

interface GpuState {
  holder: GpuHolder;
  setHolder: (holder: GpuHolder) => void;
  clear: () => void;
}

export const useGpuStore = create<GpuState>()((set) => ({
  holder: null,
  setHolder: (holder) => set({ holder }),
  clear: () => set({ holder: null }),
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AmbientEffect } from "@/lib/audio/ambient-noise";

interface AmbientState {
  enabled: boolean;
  effect: AmbientEffect;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setEffect: (effect: AmbientEffect) => void;
  setVolume: (volume: number) => void;
}

export const useAmbientStore = create<AmbientState>()(
  persist(
    (set) => ({
      enabled: false,
      effect: "vinyl-crackle" as AmbientEffect,
      volume: 0.15,
      setEnabled: (enabled) => set({ enabled }),
      setEffect: (effect) => set({ effect }),
      setVolume: (volume) => set({ volume }),
    }),
    { name: "pip-install-bangers-ambient" },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getBaseUrl } from "@/lib/api/base";

interface SettingsState {
  backendUrl: string;
  setBackendUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: getBaseUrl(),
      setBackendUrl: (url) => {
        set({ backendUrl: url });
        localStorage.setItem("pip-install-bangers-backend-url", url);
      },
    }),
    { name: "pip-install-bangers-settings" },
  ),
);

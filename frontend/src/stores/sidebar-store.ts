import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      mobileOpen: false,
      toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
      setMobileOpen: (open) => set({ mobileOpen: open }),
    }),
    {
      name: "conda-install-bangers-sidebar",
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);

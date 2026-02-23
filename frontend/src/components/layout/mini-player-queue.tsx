"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePlayerStore } from "@/stores/player-store";
import { Button } from "@/components/ui/button";
import { FullPlayerQueue } from "./full-player-queue";

export function MiniPlayerQueue() {
  const showMiniQueue = usePlayerStore((s) => s.showMiniQueue);
  const toggleMiniQueue = usePlayerStore((s) => s.toggleMiniQueue);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-outside handler to dismiss
  useEffect(() => {
    if (!showMiniQueue) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-mini-queue-toggle]")) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        toggleMiniQueue();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showMiniQueue, toggleMiniQueue]);

  if (!currentSong) return null;

  return (
    <AnimatePresence>
      {showMiniQueue && (
        <motion.div
          ref={panelRef}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed bottom-[72px] right-0 z-[49] flex w-full max-w-sm flex-col border border-border bg-card shadow-xl sm:right-4 sm:rounded-t-lg"
          style={{ maxHeight: "min(60vh, 480px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium">Queue</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMiniQueue}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body — FullPlayerQueue manages its own scroll + virtualization */}
          <div className="flex-1 overflow-auto">
            <FullPlayerQueue />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

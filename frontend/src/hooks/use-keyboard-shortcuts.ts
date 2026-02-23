"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayerStore } from "@/stores/player-store";
import { updateSong } from "@/lib/api/client";
import { playbackController } from "@/lib/audio/playback-controller";

const SEEK_DELTA = 5;
const VOLUME_DELTA = 0.05;

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Never intercept when typing in form fields
      if (isInputFocused()) return;

      // Never intercept with Ctrl/Cmd (except Ctrl+Enter which is handled by GenerateButton)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const { currentSong, volume, muted } = usePlayerStore.getState();

      switch (e.key) {
        case " ": {
          e.preventDefault();
          if (currentSong) void playbackController.toggle();
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          if (!currentSong) break;
          playbackController.seekRelative(-SEEK_DELTA);
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          if (!currentSong) break;
          playbackController.seekRelative(SEEK_DELTA);
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          const newVol = Math.min(1, (muted ? 0 : volume) + VOLUME_DELTA);
          playbackController.setVolume(newVol);
          break;
        }

        case "ArrowDown": {
          e.preventDefault();
          const newVol = Math.max(0, (muted ? 0 : volume) - VOLUME_DELTA);
          playbackController.setVolume(newVol);
          break;
        }

        case "m":
        case "M": {
          e.preventDefault();
          if (currentSong) playbackController.setMuted(!muted);
          break;
        }

        case "n":
        case "N": {
          e.preventDefault();
          if (currentSong) void playbackController.next();
          break;
        }

        case "p":
        case "P": {
          e.preventDefault();
          if (currentSong) void playbackController.previous();
          break;
        }

        case "f":
        case "F": {
          e.preventDefault();
          if (!currentSong || currentSong.id.startsWith("result-")) break;
          updateSong(currentSong.id, {
            is_favorite: !currentSong.is_favorite,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["songs"] });
          });
          break;
        }

        case "e":
        case "E": {
          const { currentSong: cs, toggleFullPlayer } = usePlayerStore.getState();
          if (cs && !cs.id.startsWith("result-")) {
            e.preventDefault();
            toggleFullPlayer();
          }
          break;
        }

        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          e.preventDefault();
          if (!currentSong || currentSong.id.startsWith("result-")) break;
          const rating = Number(e.key);
          const newRating = currentSong.rating === rating ? 0 : rating;
          updateSong(currentSong.id, { rating: newRating }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["songs"] });
          });
          break;
        }

        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queryClient]);
}

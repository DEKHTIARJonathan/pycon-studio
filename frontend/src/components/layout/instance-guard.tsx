"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api/client";

const STORAGE_KEY = "pip-install-bangers-instance-id";

// localStorage keys for every persisted zustand store. Keep in sync with
// `name:` arguments to zustand's persist middleware so a backend reset
// also clears any client-side caches that would otherwise reference
// rows/files that no longer exist.
const PERSISTED_STORE_KEYS = [
  "pip-install-bangers-settings",
  "pip-install-bangers-player",
  "pip-install-bangers-ambient",
  "pip-install-bangers-sidebar",
] as const;

/**
 * Detects when the backend's persistent SQLite instance has been wiped
 * or replaced (e.g. via `mise run clean`) and clears any client-side
 * persisted state that references the old database.
 *
 * Without this guard the player would keep trying to fetch song IDs
 * that no longer exist and produce 404s on every audio request.
 */
export function InstanceGuard() {
  const reloadingRef = useRef(false);

  // Updates arrive via the global /api/ws/health subscription mounted in
  // AppShell (useHealthWs). On a backend restart with a new DB, the WS
  // reconnects and pushes the new instance_id, which triggers the wipe.
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    retry: false,
  });

  useEffect(() => {
    if (reloadingRef.current) return;
    if (typeof window === "undefined") return;

    const currentId = data?.instance_id;
    if (!currentId) return;

    const storedId = window.localStorage.getItem(STORAGE_KEY);
    if (storedId === null) {
      window.localStorage.setItem(STORAGE_KEY, currentId);
      return;
    }

    if (storedId === currentId) return;

    reloadingRef.current = true;
    for (const key of PERSISTED_STORE_KEYS) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(STORAGE_KEY, currentId);
    window.location.reload();
  }, [data?.instance_id]);

  return null;
}

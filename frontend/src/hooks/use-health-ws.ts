"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createHealthWebSocket } from "@/lib/api/client";
import type { HealthResponse } from "@/types/api";

/**
 * Subscribes once to /api/ws/health and writes every snapshot into the
 * `["health"]` React Query cache. All consumers of `useQuery({ queryKey:
 * ["health"] })` see updates without polling - the prior 5-observer poll
 * loop (~36 health calls/min when idle) is replaced by a single WS push.
 *
 * The HTTP `queryFn: fetchHealth` is still used as the initial seed on
 * cache miss, so a consumer that mounts before the WS connects gets
 * sensible data immediately.
 *
 * Mount once globally (e.g. AppShell). Reconnects with exponential backoff.
 */
export function useHealthWs() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = createHealthWebSocket(
        (snapshot: HealthResponse) => {
          queryClient.setQueryData<HealthResponse>(["health"], snapshot);
        },
        () => {
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
          reconnectTimer.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connectWs();
          }, delay);
        },
      );

      ws.onopen = () => {
        reconnectAttempts.current = 0;
      };

      ws.onclose = () => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current += 1;
          connectWs();
        }, delay);
      };

      wsRef.current = ws;
    } catch {
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectTimer.current = setTimeout(() => {
        reconnectAttempts.current += 1;
        connectWs();
      }, delay);
    }
  }, [queryClient]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connectWs]);
}

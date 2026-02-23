import { getSongAudioUrl } from "@/lib/api/client";
import { radioEngine } from "@/lib/audio/radio-engine";

export const BUFFER_THRESHOLD = 2;
export const RETRY_DELAY_MS = 8000;
export const MAX_RETRY_DELAY_MS = 60000;

// Module-level lock shared across all consumers.
// Prevents concurrent generation requests.
let _genLock = false;

export function acquireGenLock(): boolean {
  if (_genLock) return false;
  _genLock = true;
  return true;
}

export function releaseGenLock(): void {
  _genLock = false;
}

export function forceReleaseGenLock(): void {
  _genLock = false;
}

export function isGenLocked(): boolean {
  return _genLock;
}

// Session-scoped AbortController for cancelling in-flight radio requests.
let _abortController: AbortController | null = null;

export function createRadioAbortController(): AbortController {
  _abortController?.abort();
  _abortController = new AbortController();
  return _abortController;
}

export function abortRadioRequests(): void {
  _abortController?.abort();
  _abortController = null;
}

export function getRadioSignal(): AbortSignal | undefined {
  return _abortController?.signal;
}

export async function decodeAndCacheAudio(songId: string): Promise<void> {
  const url = getSongAudioUrl(songId);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, 48000);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  radioEngine.cacheBuffer(songId, audioBuffer);
}

export async function prefetchAudio(songId: string): Promise<void> {
  try {
    await decodeAndCacheAudio(songId);
  } catch {
    // Prefetch failed silently; engine will fall back gracefully
  }
}

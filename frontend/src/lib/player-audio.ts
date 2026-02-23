import type { SongResponse } from "@/types/api";
import { getAudioUrl, getBaseUrl } from "@/lib/api/base";

const SYNTHETIC_PREFIXES = ["gen-", "history-"];

export function isSyntheticPlayerSong(song: SongResponse): boolean {
  return SYNTHETIC_PREFIXES.some((prefix) => song.id.startsWith(prefix));
}

export function getLibrarySongAudioUrl(songId: string): string {
  return `${getBaseUrl()}/api/songs/${songId}/audio`;
}

export function resolveSongPlaybackUrl(
  song: SongResponse,
  explicitUrl?: string | null,
): string {
  if (explicitUrl) return explicitUrl;
  if (isSyntheticPlayerSong(song)) return getAudioUrl(song.file_path);
  return getLibrarySongAudioUrl(song.id);
}

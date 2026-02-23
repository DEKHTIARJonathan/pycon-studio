import { toast } from "sonner";

// Strip characters that browsers / OS filesystems reject in download names.
function sanitizeFilename(name: string): string {
  return (
    name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "download"
  );
}

/**
 * Trigger a browser download for `url` using an anchor click. The server is
 * expected to set `Content-Disposition: attachment` so the browser saves
 * instead of navigating, which also lets the user pick a location via the
 * browser's normal download UI.
 *
 * We deliberately do NOT use `window.showSaveFilePicker` (File System Access
 * API). It's flaky cross-origin behind a self-signed dev cert: the picker
 * resolves, the fetch succeeds, but `createWritable()` / `write()` silently
 * fail in degraded-security contexts. Plain anchor download is what works
 * when you paste the URL into the address bar, so we use that everywhere.
 */
function anchorDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function startDownload(url: string, filename: string): void {
  try {
    anchorDownload(url, sanitizeFilename(filename));
  } catch (err) {
    toast.error(
      `Failed to start download: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function exportSongFile(url: string, filename: string): Promise<void> {
  startDownload(url, filename);
}

export async function exportZip(url: string, filename: string): Promise<void> {
  startDownload(url, filename);
}

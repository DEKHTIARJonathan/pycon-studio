"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Library, MapPin, Music2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchSongs, fetchHistoryEntry, getSongAudioUrl, getSongDownloadUrl } from "@/lib/api/client";
import { exportSongFile } from "@/lib/export-utils";
import { BangersPageHero } from "@/components/layout/bangers-page-hero";
import { usePlayerStore } from "@/stores/player-store";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { useGenerationStore } from "@/stores/generation-store";
import type { SongResponse } from "@/types/api";
import { LibraryToolbar } from "./library-toolbar";
import { SongGrid } from "./song-grid";
import { FilterChips } from "./filter-chips";
import { BulkActionsBar } from "./bulk-actions-bar";
import { Pagination } from "./pagination";
import { EditSongDialog } from "./edit-song-dialog";
import { DeleteSongDialog } from "./delete-song-dialog";
import { VariationTreeDialog } from "./variation-tree-dialog";

export function LibraryClient() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [fileFormat, setFileFormat] = useState("");
  const [instrumental, setInstrumental] = useState<boolean | null>(null);
  const [timesignature, setTimesignature] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  const [editingSong, setEditingSong] = useState<SongResponse | null>(null);
  const [deletingSong, setDeletingSong] = useState<SongResponse | null>(null);
  const [variationSong, setVariationSong] = useState<SongResponse | null>(null);

  const router = useRouter();
  const controller = usePlaybackController();
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, sort, order, favoritesOnly]);

  const { data: songsData, isLoading } = useQuery({
    queryKey: [
      "songs",
      { search, sort, order, favoritesOnly, fileFormat, instrumental, timesignature, tag, page, pageSize },
    ],
    queryFn: () =>
      fetchSongs({
        search: search || undefined,
        sort,
        order,
        favorite: favoritesOnly || undefined,
        file_format: fileFormat || undefined,
        instrumental: instrumental ?? undefined,
        timesignature: timesignature || undefined,
        tag: tag || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  const songs = songsData?.items ?? [];
  const totalCount = songsData?.total ?? 0;

  const handlePlay = useCallback(
    (song: SongResponse) => {
      const urls: Record<string, string> = {};
      for (const s of songs) urls[s.id] = getSongAudioUrl(s.id);
      void controller.playFromQueue(songs, song, urls);
    },
    [songs, controller],
  );

  const handleAddToQueue = useCallback(
    (song: SongResponse) => {
      addToQueue(song, getSongAudioUrl(song.id));
    },
    [addToQueue],
  );

  const handleRegenerate = useCallback(
    async (song: SongResponse) => {
      if (!song.generation_history_id) return;
      try {
        const entry = await fetchHistoryEntry(song.generation_history_id);
        useGenerationStore.getState().loadFromHistoryParams(entry.params);
        router.push("/create");
      } catch {
        toast.error("Failed to load generation parameters");
      }
    },
    [router],
  );

  const handleExport = useCallback((song: SongResponse) => {
    exportSongFile(getSongDownloadUrl(song.id), `${song.title}.${song.file_format}`);
  }, []);

  const handleShowVariations = useCallback((song: SongResponse) => {
    setVariationSong(song);
  }, []);

  const handleOrderToggle = useCallback(() => {
    setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  const toggleSelection = useCallback((songId: string) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedSongs(new Set()), []);

  return (
    <div className="space-y-6">
      <BangersPageHero
        titleId="library-title"
        kicker="Record crate"
        chips={[
          { icon: Library, label: "Library" },
          { icon: Music2, label: "Saved Tracks" },
          { icon: MapPin, label: "Long Beach Mix" },
        ]}
      />

      <div className="bangers-section-bar flex items-center gap-3">
        <Library className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">Library</h2>
      </div>

      {/* Toolbar */}
      <LibraryToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        order={order}
        onOrderToggle={handleOrderToggle}
        favoritesOnly={favoritesOnly}
        onFavoritesToggle={setFavoritesOnly}
        totalCount={totalCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Filter chips */}
      <FilterChips
        fileFormat={fileFormat}
        onFileFormatChange={(v) => { setFileFormat(v); setPage(1); }}
        instrumental={instrumental}
        onInstrumentalChange={(v) => { setInstrumental(v); setPage(1); }}
        timesignature={timesignature}
        onTimesignatureChange={(v) => { setTimesignature(v); setPage(1); }}
        tag={tag}
        onTagChange={(v) => { setTag(v); setPage(1); }}
      />

      {/* Song list */}
      <SongGrid
          songs={songs}
          isLoading={isLoading}
          viewMode={viewMode}
          selectedSongs={selectedSongs}
          onToggleSelect={toggleSelection}
          onPlay={handlePlay}
          onAddToQueue={handleAddToQueue}
          onEdit={setEditingSong}
          onDelete={setDeletingSong}
          onRegenerate={handleRegenerate}
          onShowVariations={handleShowVariations}
          onExport={handleExport}
      />

      {/* Pagination */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={totalCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Bulk actions */}
      <BulkActionsBar selectedSongs={selectedSongs} onClearSelection={clearSelection} />

      {/* Dialogs */}
      <EditSongDialog
        song={editingSong}
        open={editingSong !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSong(null);
        }}
      />
      <DeleteSongDialog
        song={deletingSong}
        open={deletingSong !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSong(null);
        }}
      />
      <VariationTreeDialog
        song={variationSong}
        open={variationSong !== null}
        onOpenChange={(open) => {
          if (!open) setVariationSong(null);
        }}
      />
    </div>
  );
}

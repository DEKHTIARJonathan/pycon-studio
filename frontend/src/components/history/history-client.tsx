"use client";

import { useState, useCallback } from "react";
import { History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchHistory } from "@/lib/api/client";
import { useGenerationStore } from "@/stores/generation-store";
import type { GenerationHistoryEntry } from "@/types/api";
import { HistoryToolbar } from "./history-toolbar";
import { HistoryList } from "./history-list";
import { DeleteHistoryDialog } from "./delete-history-dialog";

export function HistoryClient() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [deletingEntry, setDeletingEntry] = useState<GenerationHistoryEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["history", { search, statusFilter, taskTypeFilter, sort, order }],
    queryFn: () =>
      fetchHistory({
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        task_type: taskTypeFilter !== "all" ? taskTypeFilter : undefined,
        sort,
        order,
      }),
    // Poll while any entry is still running so radio/DJ statuses auto-update
    refetchInterval: (query) => {
      const items = query.state.data?.items;
      if (items?.some((e) => e.status === "running")) return 3000;
      return false;
    },
  });

  const entries = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleRegenerate = useCallback(
    (entry: GenerationHistoryEntry) => {
      useGenerationStore.getState().loadFromHistoryParams(entry.params);
      router.push("/create");
    },
    [router],
  );

  const handleOrderToggle = useCallback(() => {
    setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">History</h1>
      </div>

      {/* Toolbar */}
      <HistoryToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        taskTypeFilter={taskTypeFilter}
        onTaskTypeFilterChange={setTaskTypeFilter}
        sort={sort}
        onSortChange={setSort}
        order={order}
        onOrderToggle={handleOrderToggle}
        totalCount={total}
      />

      {/* List */}
      <HistoryList
        entries={entries}
        isLoading={isLoading}
        onRegenerate={handleRegenerate}
        onDelete={setDeletingEntry}
      />

      {/* Delete dialog */}
      <DeleteHistoryDialog
        entry={deletingEntry}
        open={deletingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingEntry(null);
        }}
      />
    </div>
  );
}

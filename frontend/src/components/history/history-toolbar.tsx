"use client";

import { useState, useEffect } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HistoryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  taskTypeFilter: string;
  onTaskTypeFilterChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  order: string;
  onOrderToggle: () => void;
  totalCount: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
];

const TASK_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "text2music", label: "Text-to-Music" },
  { value: "music2music", label: "Remix" },
];

const SORT_OPTIONS = [
  { value: "created_at", label: "Date" },
  { value: "duration_ms", label: "Generation Time" },
  { value: "audio_count", label: "Results" },
];

export function HistoryToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  taskTypeFilter,
  onTaskTypeFilterChange,
  sort,
  onSortChange,
  order,
  onOrderToggle,
  totalCount,
}: HistoryToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search history..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Task type filter */}
      <Select value={taskTypeFilter} onValueChange={onTaskTypeFilterChange}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Order toggle */}
      <Button variant="outline" size="sm" onClick={onOrderToggle} className="gap-1.5">
        <ArrowUpDown className="h-3.5 w-3.5" />
        {order === "asc" ? "Asc" : "Desc"}
      </Button>

      {/* Count badge */}
      <Badge variant="secondary">{totalCount} entries</Badge>
    </div>
  );
}

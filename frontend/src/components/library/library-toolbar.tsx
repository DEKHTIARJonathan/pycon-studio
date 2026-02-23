"use client";

import { useState, useEffect } from "react";
import { Search, ArrowUpDown, LayoutList, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LibraryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  order: string;
  onOrderToggle: () => void;
  favoritesOnly: boolean;
  onFavoritesToggle: (value: boolean) => void;
  totalCount: number;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
}

const SORT_OPTIONS = [
  { value: "created_at", label: "Date Added" },
  { value: "title", label: "Title" },
  { value: "rating", label: "Rating" },
  { value: "bpm", label: "BPM" },
  { value: "duration_seconds", label: "Duration" },
];

export function LibraryToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  order,
  onOrderToggle,
  favoritesOnly,
  onFavoritesToggle,
  totalCount,
  viewMode,
  onViewModeChange,
}: LibraryToolbarProps) {
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
          placeholder="Search songs..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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

      {/* Favorites switch */}
      <div className="flex items-center gap-2">
        <Switch
          id="favorites-only"
          size="sm"
          checked={favoritesOnly}
          onCheckedChange={onFavoritesToggle}
        />
        <Label htmlFor="favorites-only" className="text-xs cursor-pointer">
          Favorites
        </Label>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1">
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewModeChange("list")}
        >
          <LayoutList className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewModeChange("grid")}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </div>

      {/* Count badge */}
      <Badge variant="secondary">{totalCount} songs</Badge>
    </div>
  );
}

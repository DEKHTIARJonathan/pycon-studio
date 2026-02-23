"use client";

import { Label } from "@/components/ui/label";

interface LyricsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PLACEHOLDER = `[verse]
Write your verse lyrics here
Each line on its own line

[chorus]
Write your chorus lyrics here
Repeat as needed

[bridge]
Optional bridge section`;

export function LyricsEditor({ value, onChange, disabled = false }: LyricsEditorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="lyrics">Lyrics</Label>
      <div className="relative rounded-md border border-input bg-background">
        <textarea
          id="lyrics"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={PLACEHOLDER}
          className="w-full min-h-[200px] resize-y bg-transparent px-3 py-2 text-sm font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

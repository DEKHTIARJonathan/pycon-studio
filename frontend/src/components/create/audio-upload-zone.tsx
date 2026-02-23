"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadAudio } from "@/lib/api/client";

interface AudioUploadZoneProps {
  filePath: string;
  fileName: string;
  onUpload: (filePath: string, fileName: string) => void;
  onRemove: () => void;
}

export function AudioUploadZone({
  filePath,
  fileName,
  onUpload,
  onRemove,
}: AudioUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const result = await uploadAudio(file);
        onUpload(result.file_path, file.name);
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (filePath) {
    return (
      <div className="space-y-2">
        <Label>Audio File</Label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
          <span className="flex-1 truncate text-sm">{fileName}</span>
          <Button variant="ghost" size="icon-xs" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Audio File</Label>
      <div
        className={`flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Drag & drop or click to upload audio
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

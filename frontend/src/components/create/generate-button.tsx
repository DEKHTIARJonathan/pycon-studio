"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  isGenerating: boolean;
  isCancelling?: boolean;
}

export function GenerateButton({
  onClick,
  disabled,
  isGenerating,
  isCancelling = false,
}: GenerateButtonProps) {
  const [modKey, setModKey] = useState("Ctrl");

  useEffect(() => {
    if (navigator.userAgent.includes("Mac")) {
      setModKey("⌘");
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!disabled) onClick();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClick, disabled]);

  return (
    <Button
      className="w-full gap-2"
      size="lg"
      onClick={onClick}
      disabled={disabled || isCancelling}
    >
      {isGenerating || isCancelling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {isCancelling ? "Cancelling..." : isGenerating ? "Generating..." : "Generate"}
      {!isGenerating && !isCancelling && (
        <kbd className="ml-1 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
          {modKey}+↵
        </kbd>
      )}
    </Button>
  );
}

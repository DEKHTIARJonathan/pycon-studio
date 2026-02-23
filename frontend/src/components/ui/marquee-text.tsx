"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
}

export function MarqueeText({ text, className }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  const checkOverflow = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const containerWidth = container.clientWidth;
    const textWidth = textEl.scrollWidth;
    const overflow = textWidth > containerWidth;
    setIsOverflowing(overflow);
    if (overflow) {
      setScrollDistance(textWidth - containerWidth);
    }
  }, []);

  useEffect(() => {
    checkOverflow();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);
    return () => observer.disconnect();
  }, [checkOverflow, text]);

  // Speed: ~20px/s, min 10s, max 24s — slow, calm scroll
  const duration = isOverflowing
    ? Math.min(Math.max(scrollDistance / 20, 10), 24)
    : 0;

  if (!isOverflowing) {
    return (
      <div ref={containerRef} className="min-w-0 overflow-hidden">
        <span ref={textRef} className={cn("block truncate", className)}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-w-0 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 6px, black calc(100% - 10px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 6px, black calc(100% - 10px), transparent)",
      }}
    >
      <span
        ref={textRef}
        className={cn("animate-marquee inline-block whitespace-nowrap", className)}
        style={{
          padding: "0 12px 0 2px",
          "--marquee-distance": `-${scrollDistance}px`,
          "--marquee-duration": `${duration}s`,
        } as React.CSSProperties}
      >
        {text}
      </span>
    </div>
  );
}

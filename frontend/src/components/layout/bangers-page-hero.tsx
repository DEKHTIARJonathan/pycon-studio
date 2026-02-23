"use client";

import { Terminal, type LucideIcon } from "lucide-react";

type BangersHeroChip = {
  icon: LucideIcon;
  label: string;
};

interface BangersPageHeroProps {
  titleId: string;
  kicker: string;
  chips: BangersHeroChip[];
}

export function BangersPageHero({
  titleId,
  kicker,
  chips,
}: BangersPageHeroProps) {
  return (
    <section className="bangers-page-hero" aria-labelledby={titleId}>
      <div>
        <p className="bangers-hero-kicker">
          <Terminal aria-hidden="true" />
          {kicker}
        </p>
        <h1 id={titleId} className="bangers-hero-title">
          conda install bangers
        </h1>
      </div>
      <div className="bangers-hero-meta" aria-label="Studio details">
        {chips.map(({ icon: Icon, label }) => (
          <span className="bangers-chip" key={label}>
            <Icon aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

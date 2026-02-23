import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Bot,
  Library,
  Music2,
  Radio,
  Sparkles,
  Terminal,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const workflows = [
  {
    href: "/create",
    icon: Sparkles,
    label: "Create",
    title: "Generate tracks",
    body: "Shape lyrics, style, tempo, and model settings into fresh local music.",
  },
  {
    href: "/radio",
    icon: Radio,
    label: "Radio",
    title: "Run stations",
    body: "Build always-on station flows that keep producing and playing new cuts.",
  },
  {
    href: "/dj",
    icon: Bot,
    label: "AI DJ",
    title: "Talk it out",
    body: "Chat with a DJ assistant that can turn direction into generation intent.",
  },
  {
    href: "/library",
    icon: Library,
    label: "Library",
    title: "Keep the heat",
    body: "Browse, replay, export, favorite, and organize everything worth saving.",
  },
] as const;

const stats = [
  ["Local-first", "Runs against your own backend and models"],
  ["ACE-Step", "Generation workflow tuned for fast iteration"],
  ["Studio loop", "Create, audition, save, remix, repeat"],
] as const;

export default function Home() {
  return (
    <div className="home-landing">
      <section className="home-hero-stage" aria-labelledby="home-title">
        <div className="home-hero-orbit" aria-hidden="true" />
        <div className="home-hero-vinyl" aria-hidden="true">
          <span />
        </div>
        <div className="home-eq" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>

        <div className="home-hero-content">
          <p className="bangers-hero-kicker">
            <Terminal aria-hidden="true" />
            Local music lab
          </p>
          <h1 id="home-title" className="home-hero-title">
            conda install bangers
          </h1>
          <div className="home-hero-actions">
            <Button asChild size="lg">
              <Link href="/create">
                <WandSparkles className="h-4 w-4" />
                Create a banger
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/radio">
                <Radio className="h-4 w-4" />
                Open radio
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="home-overview-band" aria-label="Project overview">
        <div className="home-overview-copy">
          <p className="text-xs font-extrabold uppercase text-primary">
            Overview
          </p>
          <h2>NVIDIA DGX SPARK rocking local music generation.</h2>
        </div>
        <dl className="home-stat-list">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="home-workflows" aria-label="Main workflows">
        {workflows.map(({ href, icon: Icon, label, title, body }) => (
          <Link href={href} className="home-workflow-card" key={href}>
            <span className="home-workflow-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="home-workflow-label">{label}</span>
            <strong>{title}</strong>
            <span>{body}</span>
            <span className="home-workflow-arrow">
              Open <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}

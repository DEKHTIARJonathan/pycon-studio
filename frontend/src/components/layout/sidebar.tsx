"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Library,
  History,
  ListMusic,
  Cpu,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Radio,
  MessageCircle,
  Terminal,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { usePlayerStore } from "@/stores/player-store";
import { SidebarQueue } from "@/components/layout/sidebar-queue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/dj", label: "AI DJ", icon: MessageCircle },
  { href: "/library", label: "Library", icon: Library },
  { href: "/history", label: "History", icon: History },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function BrandLockup({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        collapsed && "w-full justify-center",
      )}
    >
      <span className="bangers-brand-mark" aria-hidden="true">
        <Terminal />
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <span className="block truncate text-lg font-extrabold leading-tight text-foreground">
            AI DJ Booth
          </span>
          <span className="block text-[10px] font-extrabold uppercase text-primary">
            Long Beach Mix
          </span>
        </div>
      )}
    </div>
  );
}

function NavItems({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 px-2 py-4">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const hasPlayer = !!usePlayerStore((s) => s.currentSong);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-250 md:flex",
          collapsed ? "w-16" : "w-60",
          hasPlayer && "pb-[72px]",
        )}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandLockup collapsed={collapsed} />
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <NavItems collapsed={collapsed} />
          <SidebarQueue collapsed={collapsed} />
        </div>

        <div className="border-t border-sidebar-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground"
              >
                {collapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar md:hidden"
            >
              <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                <BrandLockup collapsed={false} />
              </div>

              <div className="flex flex-1 flex-col overflow-y-auto">
                <NavItems
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
                />
                <SidebarQueue collapsed={false} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

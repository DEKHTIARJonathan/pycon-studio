// AI DJ chat feature -- inspired by clockworksquirrel/ace-step-apple-silicon
// (conversational AI DJ interface)
"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  MapPin,
  MessageCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BangersPageHero } from "@/components/layout/bangers-page-hero";
import { useDJ } from "@/hooks/use-dj";
import { fetchDJInfo } from "@/lib/api/dj-client";
import { ConversationList } from "./conversation-list";
import { ChatPanel } from "./chat-panel";
import { DJSettingsDialog } from "./dj-settings-dialog";

export function DJClient() {
  const { loadConversations } = useDJ();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: info } = useQuery({
    queryKey: ["dj-info"],
    queryFn: fetchDJInfo,
    refetchInterval: 30_000,
    retry: false,
  });

  const hasChatLlm = Boolean(info?.active_model);
  const showMissingChatLlm = info !== undefined && !hasChatLlm;

  useEffect(() => {
    loadConversations().catch((err) => {
      const message = err instanceof Error ? err.message : "Unable to load DJ conversations";
      toast.error(message);
    });
  }, [loadConversations]);

  return (
    <div className="space-y-6">
      <BangersPageHero
        titleId="dj-title"
        kicker="AI DJ booth"
        chips={[
          { icon: MessageCircle, label: "Chat" },
          { icon: Sparkles, label: "Prompt to track" },
          { icon: MapPin, label: "Long Beach Mix" },
        ]}
      />

      <div className="flex min-h-[34rem] flex-col">
        <div className="bangers-section-bar flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">AI DJ</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="DJ settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        <div className="h-4 shrink-0" />

        {/* Missing chat LLM warning */}
        {showMissingChatLlm && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No chat model selected.{" "}
              <Link href="/models" className="font-medium underline hover:no-underline">
                Pick or download one on the Models page
              </Link>{" "}
              to start chatting with the DJ.
            </span>
          </div>
        )}

        {/* Main layout: sidebar + chat */}
        <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-border bg-card">
          {/* Sidebar -- hidden on mobile */}
          <aside className="hidden w-72 shrink-0 overflow-x-hidden overflow-y-auto border-r border-border md:block">
            <ConversationList />
          </aside>

          {/* Chat area */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ChatPanel hasChatLlm={hasChatLlm} />
          </div>
        </div>
      </div>

      {/* Settings dialog */}
      <DJSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

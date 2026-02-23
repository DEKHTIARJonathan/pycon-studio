"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDJ } from "@/hooks/use-dj";
import { ChatMessage } from "./chat-message";
import { GenerationMessage } from "./generation-message";

interface ChatPanelProps {
  hasChatLlm: boolean;
}

export function ChatPanel({ hasChatLlm }: ChatPanelProps) {
  const { messages, isSending, activeConversationId, sendMessage } = useDJ();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput("");
    await sendMessage(trimmed);
  }, [input, isSending, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Empty state when no conversation is active
  if (!activeConversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium">Start a conversation with the AI DJ</p>
          <p className="text-sm text-muted-foreground">
            Create a new conversation from the sidebar to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Message list */}
      <ScrollArea className="min-h-0 flex-1 px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Start a conversation with the AI DJ
              </p>
            </div>
          )}

          {messages.map((message) =>
            message.generation_params_json || message.generation_job_id ? (
              <GenerationMessage
                key={message.id}
                message={message}
                isGenerating={
                  message.generation_job_id !== null &&
                  message.id === messages[messages.length - 1]?.id &&
                  isSending
                }
              />
            ) : (
              <ChatMessage key={message.id} message={message} />
            ),
          )}

          {/* Thinking indicator */}
          {isSending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder={
              hasChatLlm
                ? "Ask the DJ anything..."
                : "Download a Chat LLM from the Models tab first..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || !hasChatLlm}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isSending || !input.trim() || !hasChatLlm}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

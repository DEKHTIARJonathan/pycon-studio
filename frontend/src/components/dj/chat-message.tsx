"use client";

import { User, Bot } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { DJMessageResponse } from "@/types/api";

interface ChatMessageProps {
  message: DJMessageResponse;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Role icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "min-w-0 flex-1 space-y-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm",
            isUser
              ? "ml-auto bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
          style={{ overflowWrap: "anywhere" }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        <p
          className={cn(
            "text-[10px] text-muted-foreground",
            isUser ? "text-right" : "text-left",
          )}
        >
          {formatRelativeTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

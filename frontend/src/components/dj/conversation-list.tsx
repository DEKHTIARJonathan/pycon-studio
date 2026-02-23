"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Trash2, MessageSquare, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useDJ } from "@/hooks/use-dj";
import { useDJStore } from "@/stores/dj-store";

export function ConversationList() {
  const conversations = useDJStore((s) => s.conversations);
  const {
    activeConversationId,
    startNewConversation,
    openConversation,
    removeConversation,
    renameConversation,
  } = useDJ();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the rename input when dialog opens
  useEffect(() => {
    if (renamingId) {
      // Small delay to wait for dialog mount
      const timer = setTimeout(() => renameInputRef.current?.select(), 50);
      return () => clearTimeout(timer);
    }
  }, [renamingId]);

  const handleNewConversation = useCallback(async () => {
    setIsCreating(true);
    try {
      await startNewConversation();
    } catch {
      toast.error("Failed to create conversation");
    }
    setIsCreating(false);
  }, [startNewConversation]);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await removeConversation(deletingId);
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
    setIsDeleting(false);
    setDeletingId(null);
  }, [deletingId, removeConversation]);

  const handleStartRename = useCallback(
    (id: string, currentTitle: string) => {
      setRenamingId(id);
      setRenameValue(currentTitle);
    },
    [],
  );

  const handleSubmitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    setIsRenaming(true);
    try {
      await renameConversation(renamingId, renameValue.trim());
      toast.success("Conversation renamed");
    } catch {
      toast.error("Failed to rename conversation");
    }
    setIsRenaming(false);
    setRenamingId(null);
  }, [renamingId, renameValue, renameConversation]);

  const deletingConversation = conversations.find((c) => c.id === deletingId);
  const renamingConversation = conversations.find((c) => c.id === renamingId);

  return (
    <div className="flex h-full flex-col">
      {/* New conversation button */}
      <div className="p-3">
        <Button
          className="w-full gap-2"
          onClick={handleNewConversation}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New Conversation
        </Button>
      </div>

      <Separator />

      {/* Conversation list — right-click for rename/delete */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No conversations yet
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <ContextMenu key={conversation.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                      onClick={() => openConversation(conversation.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openConversation(conversation.id);
                        }
                      }}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">
                          {conversation.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(conversation.updated_at)}
                        </p>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() =>
                        handleStartRename(conversation.id, conversation.title)
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeletingId(conversation.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog
        open={renamingId !== null}
        onOpenChange={(open) => {
          if (!open) setRenamingId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for{" "}
              <span className="font-medium text-foreground">
                {renamingConversation?.title ?? "this conversation"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmitRename();
              }
            }}
            maxLength={100}
            placeholder="Conversation name"
          />
          <p className="text-xs text-muted-foreground">
            {renameValue.length}/100
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRename}
              disabled={isRenaming || !renameValue.trim()}
            >
              {isRenaming && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deletingConversation?.title ?? "this conversation"}
              </span>{" "}
              and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useDJStore } from "@/stores/dj-store";
import { usePlayerStore } from "@/stores/player-store";
import {
  sendDJMessage,
  fetchConversation,
  createConversation,
  fetchConversations,
  deleteConversation,
  renameConversation as renameConversationApi,
} from "@/lib/api/dj-client";
import type { DJMessageResponse } from "@/types/api";

export function useDJ() {
  const activeConversationId = useDJStore((s) => s.activeConversationId);
  const messages = useDJStore((s) => s.messages);
  const isSending = useDJStore((s) => s.isSending);
  const setConversations = useDJStore((s) => s.setConversations);
  const setActiveConversation = useDJStore((s) => s.setActiveConversation);
  const setMessages = useDJStore((s) => s.setMessages);
  const addMessage = useDJStore((s) => s.addMessage);
  const setIsSending = useDJStore((s) => s.setIsSending);

  const loadConversations = useCallback(async () => {
    const convs = await fetchConversations();
    setConversations(convs);
  }, [setConversations]);

  const openConversation = useCallback(
    async (id: string) => {
      setActiveConversation(id);
      const detail = await fetchConversation(id);
      setMessages(detail.messages);
    },
    [setActiveConversation, setMessages],
  );

  const startNewConversation = useCallback(async () => {
    const conv = await createConversation("New Conversation");
    setActiveConversation(conv.id);
    setMessages([]);
    await loadConversations();
    return conv;
  }, [setActiveConversation, setMessages, loadConversations]);

  const removeConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (activeConversationId === id) {
        setActiveConversation(null);
        setMessages([]);
      }
      await loadConversations();
    },
    [activeConversationId, setActiveConversation, setMessages, loadConversations],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversationApi(id, title);
      await loadConversations();
    },
    [loadConversations],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || !content.trim()) return;

      // Add optimistic user message
      const userMsg: DJMessageResponse = {
        id: `temp-${Date.now()}`,
        conversation_id: activeConversationId,
        role: "user",
        content,
        generation_params_json: null,
        generation_job_id: null,
        created_at: new Date().toISOString(),
      };
      addMessage(userMsg);
      setIsSending(true);

      try {
        const result = await sendDJMessage(activeConversationId, content);
        addMessage(result.message);

        if (result.fallback_notice) {
          toast.warning(result.fallback_notice);
        }

        // Refresh sidebar titles (auto-rename on first message)
        await loadConversations();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Sorry, I had trouble processing that.";
        toast.error(message);
        addMessage({
          id: `error-${Date.now()}`,
          conversation_id: activeConversationId,
          role: "assistant",
          content: message,
          generation_params_json: null,
          generation_job_id: null,
          created_at: new Date().toISOString(),
        });
      } finally {
        setIsSending(false);
      }
    },
    [activeConversationId, addMessage, setIsSending, loadConversations],
  );

  return {
    conversations: useDJStore.getState().conversations,
    activeConversationId,
    messages,
    isSending,
    loadConversations,
    openConversation,
    startNewConversation,
    removeConversation,
    renameConversation,
    sendMessage,
  };
}

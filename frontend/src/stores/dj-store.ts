import { create } from "zustand";
import type { DJConversationResponse, DJMessageResponse } from "@/types/api";

interface DJState {
  conversations: DJConversationResponse[];
  activeConversationId: string | null;
  messages: DJMessageResponse[];
  isSending: boolean;

  setConversations: (conversations: DJConversationResponse[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: DJMessageResponse[]) => void;
  addMessage: (message: DJMessageResponse) => void;
  setIsSending: (v: boolean) => void;
}

export const useDJStore = create<DJState>()((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isSending: false,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setIsSending: (v) => set({ isSending: v }),
}));

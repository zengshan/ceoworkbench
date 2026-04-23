import { create } from 'zustand';
import { canvasCards, chatMessages, conversationThreads, mockPendingItems, railItems } from './mock-data';
import type { CanvasCardRecord, ChatMessage, ConversationThread, PendingItem, RailItem } from './types';

type WorkbenchState = {
  railItems: RailItem[];
  conversationThreads: ConversationThread[];
  chatMessages: ChatMessage[];
  canvasCards: CanvasCardRecord[];
  pendingItems: PendingItem[];
  selectedThreadId: string | null;
  selectedCardId: string;
  selectThread: (threadId: string) => void;
  selectCard: (cardId: string) => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  railItems,
  conversationThreads,
  chatMessages,
  canvasCards,
  pendingItems: mockPendingItems,
  selectedThreadId: 'thread-manager',
  selectedCardId: 'approval-1',
  selectThread: (threadId) =>
    set((state) => ({
      selectedThreadId: state.selectedThreadId === threadId ? null : threadId,
    })),
  selectCard: (cardId) => set({ selectedCardId: cardId }),
}));

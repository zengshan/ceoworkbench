import { create } from 'zustand';
import { canvasCards, chatMessages, conversationThreads, mockPendingItems, railItems, stageScene, teamDepartments } from './mock-data';
import type {
  CanvasCardRecord,
  ChatMessage,
  ConversationThread,
  PendingItem,
  RailItem,
  StageFocusId,
  StageSceneRecord,
  TeamDepartment,
  WorkspaceView,
} from './types';

export type WorkbenchState = {
  railItems: RailItem[];
  conversationThreads: ConversationThread[];
  chatMessages: ChatMessage[];
  teamDepartments: TeamDepartment[];
  stageScene: StageSceneRecord;
  canvasCards: CanvasCardRecord[];
  pendingItems: PendingItem[];
  workspaceOpen: boolean;
  workspaceView: WorkspaceView;
  lastWorkspaceThreadId: string | null;
  workspaceUnreadCount: number;
  selectedThreadId: string | null;
  selectedCardId: string;
  activeStageFocusId: StageFocusId;
  selectedStageCardIds: Record<StageFocusId, string | null>;
  setWorkspaceOpen: (open: boolean) => void;
  setWorkspaceView: (view: WorkspaceView) => void;
  selectThread: (threadId: string) => void;
  selectCard: (cardId: string) => void;
  setActiveStageFocus: (focusId: StageFocusId) => void;
  selectStageCard: (focusId: StageFocusId, cardId: string | null) => void;
};

const initialSelectedStageCardIds: Record<StageFocusId, string | null> = {
  ceo: 'ceo-progress',
  office: 'office-judgment',
  design: 'design-progress',
  engineering: 'engineering-progress',
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  railItems,
  conversationThreads,
  chatMessages,
  teamDepartments,
  stageScene,
  canvasCards,
  pendingItems: mockPendingItems,
  workspaceOpen: false,
  workspaceView: 'conversations',
  lastWorkspaceThreadId: 'thread-manager',
  workspaceUnreadCount: conversationThreads.reduce((total, thread) => total + (thread.unreadCount ?? 0), 0),
  selectedThreadId: 'thread-manager',
  selectedCardId: 'approval-1',
  activeStageFocusId: 'ceo',
  selectedStageCardIds: initialSelectedStageCardIds,
  setWorkspaceOpen: (open) =>
    set((state) => ({
      workspaceOpen: open,
      selectedThreadId: open
        ? state.lastWorkspaceThreadId ?? state.selectedThreadId ?? state.conversationThreads[0]?.id ?? null
        : state.selectedThreadId,
    })),
  setWorkspaceView: (view) => set({ workspaceView: view }),
  selectThread: (threadId) =>
    set({
      selectedThreadId: threadId,
      lastWorkspaceThreadId: threadId,
    }),
  selectCard: (cardId) => set({ selectedCardId: cardId }),
  setActiveStageFocus: (focusId) =>
    set((state) => ({
      activeStageFocusId: focusId,
      selectedStageCardIds: {
        ...state.selectedStageCardIds,
        [focusId]:
          state.selectedStageCardIds[focusId] ??
          state.stageScene.clusters.find((cluster) => cluster.id === focusId)?.cards[0]?.id ??
          null,
      },
    })),
  selectStageCard: (focusId, cardId) =>
    set((state) => ({
      selectedStageCardIds: {
        ...state.selectedStageCardIds,
        [focusId]: cardId,
      },
    })),
}));

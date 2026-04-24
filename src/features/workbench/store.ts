import { create } from 'zustand';
import { canvasCards, chatMessages, conversationThreads, mockPendingItems, railItems, stageScene, teamDepartments } from './mock-data';
import type {
  CanvasCardRecord,
  ChatMessage,
  ConversationThread,
  LeftRailView,
  PendingItem,
  RailItem,
  StageFocusId,
  StageSceneRecord,
  TeamDepartment,
} from './types';

export type WorkbenchState = {
  railItems: RailItem[];
  conversationThreads: ConversationThread[];
  chatMessages: ChatMessage[];
  teamDepartments: TeamDepartment[];
  stageScene: StageSceneRecord;
  canvasCards: CanvasCardRecord[];
  pendingItems: PendingItem[];
  leftRailView: LeftRailView;
  selectedThreadId: string | null;
  selectedCardId: string;
  activeStageFocusId: StageFocusId;
  selectedStageCardIds: Record<StageFocusId, string | null>;
  setLeftRailView: (view: LeftRailView) => void;
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
  leftRailView: 'conversations',
  selectedThreadId: 'thread-manager',
  selectedCardId: 'approval-1',
  activeStageFocusId: 'ceo',
  selectedStageCardIds: initialSelectedStageCardIds,
  setLeftRailView: (view) => set({ leftRailView: view }),
  selectThread: (threadId) =>
    set((state) => ({
      selectedThreadId: state.selectedThreadId === threadId ? null : threadId,
    })),
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

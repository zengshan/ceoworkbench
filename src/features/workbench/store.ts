import { create } from 'zustand';
import { canvasCards, chatMessages, conversationThreads, mockPendingItems, railItems, stageLayers, teamDepartments } from './mock-data';
import type {
  CanvasCardRecord,
  ChatMessage,
  ConversationThread,
  LeftRailView,
  PendingItem,
  RailItem,
  StageLayer,
  StageLayerId,
  TeamDepartment,
} from './types';

const resolveStageSelection = (
  layers: StageLayer[],
  layerId: StageLayerId,
): Pick<WorkbenchState, 'activeStageLayerId' | 'selectedStageCardId'> => {
  const nextLayer = layers.find((layer) => layer.id === layerId) ?? layers[0];

  return {
    activeStageLayerId: nextLayer.id,
    selectedStageCardId: nextLayer.cards[0]?.id ?? null,
  };
};

type WorkbenchState = {
  railItems: RailItem[];
  conversationThreads: ConversationThread[];
  chatMessages: ChatMessage[];
  teamDepartments: TeamDepartment[];
  stageLayers: StageLayer[];
  canvasCards: CanvasCardRecord[];
  pendingItems: PendingItem[];
  leftRailView: LeftRailView;
  selectedThreadId: string | null;
  selectedCardId: string;
  activeStageLayerId: StageLayerId;
  selectedStageCardId: string | null;
  setLeftRailView: (view: LeftRailView) => void;
  selectThread: (threadId: string) => void;
  selectCard: (cardId: string) => void;
  setActiveStageLayer: (layerId: StageLayerId) => void;
  selectStageCard: (cardId: string | null) => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  railItems,
  conversationThreads,
  chatMessages,
  teamDepartments,
  stageLayers,
  canvasCards,
  pendingItems: mockPendingItems,
  leftRailView: 'conversations',
  selectedThreadId: 'thread-manager',
  selectedCardId: 'approval-1',
  ...resolveStageSelection(stageLayers, 'ceo'),
  setLeftRailView: (view) => set({ leftRailView: view }),
  selectThread: (threadId) =>
    set((state) => ({
      selectedThreadId: state.selectedThreadId === threadId ? null : threadId,
    })),
  selectCard: (cardId) => set({ selectedCardId: cardId }),
  setActiveStageLayer: (layerId) =>
    set((state) => {
      if (state.activeStageLayerId === layerId) {
        return {};
      }

      return resolveStageSelection(state.stageLayers, layerId);
    }),
  selectStageCard: (cardId) => set({ selectedStageCardId: cardId }),
}));

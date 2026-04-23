'use client';

import { useMemo } from 'react';
import { useWorkbenchStore } from '@/features/workbench/store';
import { groupPendingItems } from '@/features/workbench/utils';
import { CanvasBoard } from './canvas-board';
import { CommandBar } from './command-bar';
import { ConversationRail } from './conversation-rail';
import { DetailsDrawer } from './details-drawer';
import { WorkbenchHeader } from './workbench-header';

export function WorkbenchShell() {
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const chatMessages = useWorkbenchStore((state) => state.chatMessages);
  const canvasCards = useWorkbenchStore((state) => state.canvasCards);
  const pendingItems = useWorkbenchStore((state) => state.pendingItems);
  const selectedCardId = useWorkbenchStore((state) => state.selectedCardId);

  const pendingGroups = useMemo(() => groupPendingItems(pendingItems), [pendingItems]);
  const selectedCard = canvasCards.find((card) => card.id === selectedCardId) ?? canvasCards[0];
  const pendingGroupsWithDetail = pendingGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      recommendation: item.recommendation,
      impact: item.impact,
    })),
  }));

  return (
    <main className="min-h-screen p-4 md:p-6">
      <WorkbenchHeader />
      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <ConversationRail threads={conversationThreads} messages={chatMessages} pendingGroups={pendingGroups} />
        <CanvasBoard cards={canvasCards} selectedCardId={selectedCard.id} />
        <DetailsDrawer card={selectedCard} pendingGroups={pendingGroupsWithDetail} />
      </div>
      <CommandBar />
    </main>
  );
}

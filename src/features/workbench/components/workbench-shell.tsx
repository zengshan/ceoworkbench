'use client';

import { useMemo } from 'react';
import { useWorkbenchStore } from '@/features/workbench/store';
import { groupPendingItems } from '@/features/workbench/utils';
import { CanvasBoard } from './canvas-board';
import { ConversationRail } from './conversation-rail';
import { WorkbenchHeader } from './workbench-header';

export function WorkbenchShell() {
  const leftRailView = useWorkbenchStore((state) => state.leftRailView);
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const chatMessages = useWorkbenchStore((state) => state.chatMessages);
  const teamDepartments = useWorkbenchStore((state) => state.teamDepartments);
  const pendingItems = useWorkbenchStore((state) => state.pendingItems);

  const pendingGroups = useMemo(() => groupPendingItems(pendingItems), [pendingItems]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <WorkbenchHeader />
      <div
        className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"
        data-testid="workbench-shell-grid"
      >
        <ConversationRail
          leftRailView={leftRailView}
          threads={conversationThreads}
          messages={chatMessages}
          teamDepartments={teamDepartments}
          pendingGroups={pendingGroups}
        />
        <CanvasBoard />
      </div>
    </main>
  );
}

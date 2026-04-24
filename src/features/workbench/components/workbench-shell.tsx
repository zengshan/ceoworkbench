'use client';

import { useWorkbenchStore } from '@/features/workbench/store';
import { CanvasBoard } from './canvas-board';
import { WorkbenchHeader } from './workbench-header';
import { WorkspaceFab } from './workspace-fab';
import { WorkspaceOverlay } from './workspace-overlay';

export function WorkbenchShell() {
  const workspaceOpen = useWorkbenchStore((state) => state.workspaceOpen);
  const workspaceUnreadCount = useWorkbenchStore((state) => state.workspaceUnreadCount);
  const setWorkspaceOpen = useWorkbenchStore((state) => state.setWorkspaceOpen);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <WorkbenchHeader />
      <div className="mt-5 grid grid-cols-1 gap-4" data-testid="workbench-shell-grid">
        <div
          className={
            workspaceOpen
              ? 'pointer-events-none transition duration-300 blur-[8px] saturate-[0.86]'
              : 'transition duration-300'
          }
          data-testid="stage-shell"
        >
          <CanvasBoard />
        </div>
      </div>
      <WorkspaceFab
        unreadCount={workspaceUnreadCount}
        open={workspaceOpen}
        onClick={() => setWorkspaceOpen(!workspaceOpen)}
      />
      <WorkspaceOverlay />
    </main>
  );
}

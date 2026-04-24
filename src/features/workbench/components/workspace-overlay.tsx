'use client';

import { useEffect } from 'react';
import { useWorkbenchStore } from '@/features/workbench/store';
import { WorkspaceConversationPane } from './workspace-conversation-pane';
import { WorkspaceSidebar } from './workspace-sidebar';

export function WorkspaceOverlay() {
  const workspaceOpen = useWorkbenchStore((state) => state.workspaceOpen);
  const setWorkspaceOpen = useWorkbenchStore((state) => state.setWorkspaceOpen);

  useEffect(() => {
    if (!workspaceOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWorkspaceOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setWorkspaceOpen, workspaceOpen]);

  if (!workspaceOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 md:p-8">
      <button
        type="button"
        aria-label="关闭工作区遮罩"
        data-testid="workspace-backdrop"
        className="absolute inset-0 bg-[rgba(229,223,212,0.48)] backdrop-blur-md"
        onClick={() => setWorkspaceOpen(false)}
      />
      <section
        aria-modal="true"
        role="dialog"
        data-testid="workspace-overlay"
        className="relative z-10 grid h-[min(88vh,860px)] w-full max-w-[1280px] grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-[34px] border border-[rgba(64,44,22,0.12)] bg-[rgba(255,252,247,0.96)] shadow-[0_36px_90px_rgba(42,31,16,0.2)]"
      >
        <WorkspaceSidebar />
        <WorkspaceConversationPane />
      </section>
    </div>
  );
}

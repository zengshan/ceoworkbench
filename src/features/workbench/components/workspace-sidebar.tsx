'use client';

import clsx from 'clsx';
import { useWorkbenchStore } from '@/features/workbench/store';
import type { WorkspaceView } from '@/features/workbench/types';
import { WorkspaceTeamList } from './workspace-team-list';

const tabs: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'conversations', label: '对话' },
  { id: 'team', label: '团队成员' },
];

export function WorkspaceSidebar() {
  const workspaceView = useWorkbenchStore((state) => state.workspaceView);
  const setWorkspaceView = useWorkbenchStore((state) => state.setWorkspaceView);
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const selectedThreadId = useWorkbenchStore((state) => state.selectedThreadId);
  const selectThread = useWorkbenchStore((state) => state.selectThread);
  const teamDepartments = useWorkbenchStore((state) => state.teamDepartments);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[rgba(64,44,22,0.08)] bg-[rgba(250,247,240,0.94)] p-4">
      <div className="grid grid-cols-2 rounded-full border border-[var(--line)] bg-white/78 p-1">
        {tabs.map((tab) => {
          const active = workspaceView === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setWorkspaceView(tab.id)}
              className={clsx(
                'rounded-full px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,122,97,0.18)]'
                  : 'text-[var(--muted)]',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-0 flex-1">
        {workspaceView === 'conversations' ? (
          <div className="space-y-2 overflow-y-auto pr-1">
            {conversationThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => selectThread(thread.id)}
                className={clsx(
                  'w-full rounded-[20px] px-4 py-3 text-left transition',
                  selectedThreadId === thread.id
                    ? 'border border-[var(--line-strong)] bg-white shadow-[0_12px_24px_rgba(42,31,16,0.06)]'
                    : 'border border-transparent bg-white/58 hover:border-[var(--line)] hover:bg-white/80',
                )}
              >
                <div className="text-sm font-semibold">{thread.title}</div>
                <div className="mt-2 text-sm text-[var(--muted)] line-clamp-2">{thread.lastMessage}</div>
              </button>
            ))}
          </div>
        ) : (
          <WorkspaceTeamList departments={teamDepartments} />
        )}
      </div>
    </aside>
  );
}

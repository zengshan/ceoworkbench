'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { useWorkbenchStore } from '@/features/workbench/store';

export function WorkspaceConversationPane() {
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const chatMessages = useWorkbenchStore((state) => state.chatMessages);
  const selectedThreadId = useWorkbenchStore((state) => state.selectedThreadId);
  const setWorkspaceOpen = useWorkbenchStore((state) => state.setWorkspaceOpen);

  const activeThread = useMemo(
    () => conversationThreads.find((thread) => thread.id === selectedThreadId) ?? conversationThreads[0] ?? null,
    [conversationThreads, selectedThreadId],
  );

  const messages = useMemo(
    () => chatMessages.filter((message) => message.threadId === activeThread?.id),
    [activeThread?.id, chatMessages],
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-white/96">
      <div className="flex items-center justify-between border-b border-[rgba(64,44,22,0.08)] px-6 py-5">
        <h2 data-testid="workspace-title" className="text-lg font-semibold">
          {activeThread?.title ?? 'CEO 和总经理的聊天'}
        </h2>
        <button
          type="button"
          aria-label="关闭工作区"
          onClick={() => setWorkspaceOpen(false)}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          关闭
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#fff,#faf8f3)] px-6 py-5">
        {messages.map((message) => (
          <div key={message.id} className={message.side === 'right' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={clsx(
                'max-w-[70%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-[0_10px_20px_rgba(70,52,30,0.06)]',
                message.side === 'right'
                  ? 'bg-[rgba(243,224,192,0.78)] text-[var(--text)]'
                  : 'border border-[var(--line)] bg-white text-[var(--text)]',
              )}
            >
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {message.author}
              </div>
              <div>{message.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[rgba(64,44,22,0.08)] bg-[rgba(252,249,243,0.96)] px-5 py-4">
        <div data-testid="workspace-input" className="rounded-[20px] border border-[var(--line)] bg-white px-4 py-3">
          <input
            className="w-full border-none bg-transparent text-sm outline-none"
            placeholder="继续给总经理或部门下达任务..."
          />
        </div>
      </div>
    </section>
  );
}

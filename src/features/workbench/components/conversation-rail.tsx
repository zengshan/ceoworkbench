'use client';

import { Panel } from '@/components/ui/panel';
import { Pill } from '@/components/ui/pill';
import { useWorkbenchStore } from '@/features/workbench/store';
import type { ChatMessage, ConversationThread, LeftRailView, TeamDepartment } from '@/features/workbench/types';

type PendingGroup = {
  projectName: string;
  projectPriority: 'P0' | 'P1' | 'P2';
  items: {
    id: string;
    title: string;
    severity: 'light' | 'medium' | 'heavy';
  }[];
};

function ThreadButton({ thread }: { thread: ConversationThread }) {
  const selectedThreadId = useWorkbenchStore((state) => state.selectedThreadId);
  const selectThread = useWorkbenchStore((state) => state.selectThread);
  const expanded = selectedThreadId === thread.id;

  return (
    <button
      type="button"
      onClick={() => selectThread(thread.id)}
      aria-expanded={expanded}
      aria-controls={`thread-panel-${thread.id}`}
      className={`w-full rounded-[22px] border p-4 text-left transition ${
        expanded
          ? 'border-transparent bg-white/95'
          : 'border-transparent bg-white/65 hover:border-[var(--line)] hover:bg-white/90'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{thread.title}</div>
        <Pill
          label={thread.statusLabel}
          tone={thread.statusLabel.includes('阻塞') ? 'danger' : thread.kind === 'manager' ? 'accent' : 'neutral'}
        />
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{thread.lastMessage}</p>
      {thread.unreadCount ? (
        <div className="mt-3 text-xs font-medium text-[var(--accent)]">{thread.unreadCount} 条新变化</div>
      ) : null}
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`flex ${message.side === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-[0_10px_20px_rgba(70,52,30,0.06)] ${
          message.side === 'right'
            ? 'bg-[rgba(243,224,192,0.85)] text-[var(--text)]'
            : 'border border-[var(--line)] bg-white text-[var(--text)]'
        }`}
      >
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{message.author}</div>
        <div>{message.body}</div>
      </div>
    </div>
  );
}

function ThreadConversation({
  thread,
  messages,
  pendingGroups,
}: {
  thread: ConversationThread;
  messages: ChatMessage[];
  pendingGroups: PendingGroup[];
}) {
  const selectedThreadId = useWorkbenchStore((state) => state.selectedThreadId);
  const expanded = selectedThreadId === thread.id;

  return (
    <div
      data-testid={`thread-card-${thread.id}`}
      className={`overflow-hidden rounded-[24px] border transition ${
        expanded
          ? 'border-[var(--line-strong)] bg-white shadow-[0_16px_30px_rgba(70,52,30,0.08)]'
          : 'border-transparent bg-transparent'
      }`}
    >
      <ThreadButton thread={thread} />
      {expanded ? (
        <div
          id={`thread-panel-${thread.id}`}
          className="border-t border-[var(--line)] bg-[rgba(255,255,255,0.74)] px-4 pb-4 pt-3"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="text-sm font-semibold">{thread.title}</div>
            <Pill label={thread.statusLabel} tone={thread.kind === 'manager' ? 'accent' : 'neutral'} />
          </div>
          <div className="mt-4 space-y-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
          {thread.kind === 'manager' ? <ManagerDecisionCards pendingGroups={pendingGroups} /> : null}
          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white px-4 py-3">
            <div className="text-sm text-[var(--muted)]">
              {thread.kind === 'manager' ? '直接在这里给总经理下达任务或批示。' : '直接在这里继续和部门群沟通。'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ManagerDecisionCards({ pendingGroups }: { pendingGroups: PendingGroup[] }) {
  return (
    <div className="mt-4 space-y-3 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.7)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">待你决策</div>
        <Pill label="跟随总经理会话" tone="accent" />
      </div>
      {pendingGroups.map((group) => (
        <div key={group.projectName} className="rounded-[18px] border border-[var(--line)] bg-white/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{group.projectName}</div>
            <Pill label={group.projectPriority} tone="accent" />
          </div>
          <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {group.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span>{item.title}</span>
                <Pill label={item.severity} tone={item.severity === 'heavy' ? 'danger' : 'warning'} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LeftRailTabs({ selectedView }: { selectedView: LeftRailView }) {
  const setLeftRailView = useWorkbenchStore((state) => state.setLeftRailView);

  return (
    <div className="grid w-full max-w-[188px] grid-cols-2 rounded-full border border-[var(--line)] bg-white/70 p-1">
      {[
        { id: 'conversations', label: '对话' },
        { id: 'team', label: '团队成员' },
      ].map((tab) => {
        const active = selectedView === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setLeftRailView(tab.id as LeftRailView)}
            className={`rounded-full px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(31,122,97,0.18)]' : 'text-[var(--muted)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function TeamDepartmentBlock({ department }: { department: TeamDepartment }) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-white/82 p-4 shadow-[0_12px_24px_rgba(70,52,30,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{department.name}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">{department.summary}</div>
        </div>
        <Pill label={`${department.agents.length} 位 agent`} tone="neutral" />
      </div>
      <div className="mt-4 space-y-2">
        {department.agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.8)] px-4 py-3"
          >
            <div className="text-sm font-medium text-[var(--text)]">{agent.name}</div>
            {agent.title ? <div className="mt-1 text-sm text-[var(--muted)]">{agent.title}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationRail({
  leftRailView,
  threads,
  messages,
  teamDepartments,
  pendingGroups,
}: {
  leftRailView: LeftRailView;
  threads: ConversationThread[];
  messages: ChatMessage[];
  teamDepartments: TeamDepartment[];
  pendingGroups: PendingGroup[];
}) {
  return (
    <Panel className="flex min-h-[760px] flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">左侧工作区</div>
        <LeftRailTabs selectedView={leftRailView} />
      </div>

      {leftRailView === 'conversations' ? (
        <div className="space-y-2">
          {threads.map((thread) => (
            <ThreadConversation
              key={thread.id}
              thread={thread}
              messages={messages.filter((message) => message.threadId === thread.id)}
              pendingGroups={pendingGroups}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {teamDepartments.map((department) => (
            <TeamDepartmentBlock key={department.id} department={department} />
          ))}
        </div>
      )}
    </Panel>
  );
}

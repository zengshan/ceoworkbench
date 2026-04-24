# Workspace Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the persistent left work rail with a stage-first shell plus a centered communication overlay opened from a floating `工作区` button.

**Architecture:** Keep the current CEO-centered stage wall as the default surface, add explicit workspace state to the store, and move conversation/team UI into a dedicated overlay composed of focused subcomponents. Reuse the existing conversation and team mock data so V1 validates the new shell hierarchy without rewriting the message model.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, Tailwind CSS, Vitest, Playwright

---

## File Structure

### Create

- `src/features/workbench/components/workspace-fab.tsx` - Bottom-right floating `工作区` trigger with unread badge and open/close state.
- `src/features/workbench/components/workspace-overlay.tsx` - Backdrop, centered panel, close controls, and focus-trap wrapper.
- `src/features/workbench/components/workspace-sidebar.tsx` - Left pane with `对话 / 团队成员` switch and either thread list or team list.
- `src/features/workbench/components/workspace-conversation-pane.tsx` - Right pane with conversation title, message stream, and input bar.
- `src/features/workbench/components/workspace-team-list.tsx` - Team-members rendering for the sidebar.

### Modify

- `src/features/workbench/types.ts` - Add workspace-related types.
- `src/features/workbench/store.ts` - Add workspace state and actions.
- `src/features/workbench/store.test.ts` - Verify workspace state rules.
- `src/features/workbench/components/workbench-shell.tsx` - Replace the two-column shell with stage-first layout and overlay composition.
- `src/features/workbench/components/workbench-header.tsx` - Expose a stable hook for bottom-left config presence if needed by the shell tests.
- `src/features/workbench/components/conversation-rail.tsx` - Remove or shrink to shared UI helpers if still reused; otherwise delete after migration.
- `src/features/workbench/components/workbench-shell.test.tsx` - Replace old persistent-rail assertions with overlay behavior tests.
- `tests/e2e/workbench.spec.ts` - Cover stage-first layout, overlay open/close, and sidebar switching.

### Delete

- `src/features/workbench/components/conversation-rail.tsx` - Delete if no reusable parts remain after extraction into overlay components.

## Task 1: Add workspace state to the store

**Files:**
- Modify: `src/features/workbench/types.ts`
- Modify: `src/features/workbench/store.ts`
- Modify: `src/features/workbench/store.test.ts`

- [ ] **Step 1: Add the failing store test for workspace defaults**

Add this test block to `src/features/workbench/store.test.ts`:

```ts
it('tracks workspace overlay defaults separately from stage focus', () => {
  const state = useWorkbenchStore.getState();

  expect(state.workspaceOpen).toBe(false);
  expect(state.workspaceView).toBe('conversations');
  expect(state.lastWorkspaceThreadId).toBe('thread-manager');
  expect(state.workspaceUnreadCount).toBe(2);
  expect(state.activeStageFocusId).toBe('ceo');
});
```

- [ ] **Step 2: Add the failing store test for restoring the last thread on open**

Add this test block to `src/features/workbench/store.test.ts`:

```ts
it('restores the last workspace thread when reopening the overlay', () => {
  const store = useWorkbenchStore.getState();

  store.selectThread('thread-design');
  store.setWorkspaceOpen(false);
  store.setWorkspaceOpen(true);

  expect(useWorkbenchStore.getState().selectedThreadId).toBe('thread-design');
  expect(useWorkbenchStore.getState().lastWorkspaceThreadId).toBe('thread-design');
});
```

- [ ] **Step 3: Add the failing store test for keeping thread selection while switching tabs**

Add this test block to `src/features/workbench/store.test.ts`:

```ts
it('keeps the selected thread while switching workspace tabs', () => {
  const store = useWorkbenchStore.getState();

  store.selectThread('thread-engineering');
  store.setWorkspaceView('team');
  store.setWorkspaceView('conversations');

  expect(useWorkbenchStore.getState().selectedThreadId).toBe('thread-engineering');
});
```

- [ ] **Step 4: Run the targeted store tests and confirm they fail**

Run: `npm test -- src/features/workbench/store.test.ts`

Expected: FAIL with missing `workspaceOpen`, `workspaceView`, `lastWorkspaceThreadId`, `workspaceUnreadCount`, `setWorkspaceOpen`, or `setWorkspaceView` members.

- [ ] **Step 5: Add workspace types**

Update `src/features/workbench/types.ts` with these declarations:

```ts
export type WorkspaceView = 'conversations' | 'team';

export type WorkspaceUnreadBadge = {
  count: number;
  hasAttention: boolean;
};
```

Also replace any remaining `LeftRailView` usage in this feature with `WorkspaceView`.

- [ ] **Step 6: Add workspace state and actions to the store**

Update the `WorkbenchState` type in `src/features/workbench/store.ts`:

```ts
  workspaceOpen: boolean;
  workspaceView: WorkspaceView;
  lastWorkspaceThreadId: string | null;
  workspaceUnreadCount: number;
  setWorkspaceOpen: (open: boolean) => void;
  setWorkspaceView: (view: WorkspaceView) => void;
```

Initialize and implement them like this:

```ts
  workspaceOpen: false,
  workspaceView: 'conversations',
  lastWorkspaceThreadId: 'thread-manager',
  workspaceUnreadCount: conversationThreads.reduce(
    (total, thread) => total + (thread.unreadCount ?? 0),
    0,
  ),
  setWorkspaceOpen: (open) =>
    set((state) => ({
      workspaceOpen: open,
      selectedThreadId: open
        ? state.lastWorkspaceThreadId ??
          state.selectedThreadId ??
          state.conversationThreads[0]?.id ??
          null
        : state.selectedThreadId,
    })),
  setWorkspaceView: (view) => set({ workspaceView: view }),
```

Adjust `selectThread` so it remembers the last open conversation:

```ts
  selectThread: (threadId) =>
    set((state) => ({
      selectedThreadId: threadId,
      lastWorkspaceThreadId: threadId,
    })),
```

- [ ] **Step 7: Run the targeted store tests and make sure they pass**

Run: `npm test -- src/features/workbench/store.test.ts`

Expected: PASS with all store tests green.

- [ ] **Step 8: Commit the store state work**

```bash
git add src/features/workbench/types.ts src/features/workbench/store.ts src/features/workbench/store.test.ts
git commit -m "feat: add workspace overlay state"
```

## Task 2: Replace the default shell with a stage-first layout

**Files:**
- Modify: `src/features/workbench/components/workbench-shell.tsx`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`
- Create: `src/features/workbench/components/workspace-fab.tsx`

- [ ] **Step 1: Add the failing shell test for removing the persistent rail**

Add this test block to `src/features/workbench/components/workbench-shell.test.tsx`:

```tsx
it('renders the stage as the primary default surface without the old left rail', () => {
  render(<WorkbenchShell />);

  expect(screen.getByTestId('workbench-shell-grid')).toHaveClass('grid-cols-1');
  expect(screen.queryByText('左侧工作区')).not.toBeInTheDocument();
  expect(screen.getByTestId('workspace-fab')).toBeInTheDocument();
});
```

- [ ] **Step 2: Add the failing shell test for keeping config visible while closed**

Add this test block:

```tsx
it('shows config and workspace floating controls in default stage mode', () => {
  render(<WorkbenchShell />);

  expect(screen.getByTestId('workspace-fab')).toBeInTheDocument();
  expect(screen.getByTestId('config-fab')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the targeted shell tests and confirm they fail**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: FAIL because the old grid still renders the left rail and no floating controls exist.

- [ ] **Step 4: Create the floating workspace button component**

Create `src/features/workbench/components/workspace-fab.tsx`:

```tsx
'use client';

type WorkspaceFabProps = {
  unreadCount: number;
  open: boolean;
  onClick: () => void;
};

export function WorkspaceFab({ unreadCount, open, onClick }: WorkspaceFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="workspace-fab"
      aria-pressed={open}
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full border border-[rgba(31,122,97,0.18)] bg-white/96 px-5 py-3 text-sm font-semibold text-[var(--text)] shadow-[0_24px_60px_rgba(42,31,16,0.16)] backdrop-blur"
    >
      <span>工作区</span>
      {unreadCount > 0 ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--danger)] px-2 py-0.5 text-[11px] font-semibold text-white">
          {unreadCount}
        </span>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 5: Refactor the shell to be stage-first**

Replace `src/features/workbench/components/workbench-shell.tsx` with this structure:

```tsx
'use client';

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
        <CanvasBoard />
      </div>
      {!workspaceOpen ? (
        <button
          type="button"
          data-testid="config-fab"
          className="fixed bottom-6 left-6 z-30 rounded-full border border-[var(--line)] bg-white/88 px-4 py-3 text-sm text-[var(--muted)] shadow-[0_18px_40px_rgba(42,31,16,0.12)] backdrop-blur"
        >
          配置
        </button>
      ) : null}
      <WorkspaceFab
        unreadCount={workspaceUnreadCount}
        open={workspaceOpen}
        onClick={() => setWorkspaceOpen(!workspaceOpen)}
      />
      <WorkspaceOverlay />
    </main>
  );
}
```

- [ ] **Step 6: Run the targeted shell tests and make sure they pass**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: PASS for the new stage-first shell assertions while older left-rail assertions still fail until the overlay is added.

- [ ] **Step 7: Commit the shell layout change**

```bash
git add src/features/workbench/components/workbench-shell.tsx src/features/workbench/components/workspace-fab.tsx src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: make the stage shell workspace-first"
```

## Task 3: Build the centered workspace overlay shell

**Files:**
- Create: `src/features/workbench/components/workspace-overlay.tsx`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing shell test for opening the overlay**

Add this test block:

```tsx
it('opens a centered workspace overlay and hides config', async () => {
  const user = userEvent.setup();

  render(<WorkbenchShell />);
  await user.click(screen.getByTestId('workspace-fab'));

  expect(screen.getByTestId('workspace-overlay')).toBeInTheDocument();
  expect(screen.getByTestId('workspace-backdrop')).toBeInTheDocument();
  expect(screen.queryByTestId('config-fab')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add the failing shell test for closing via backdrop and Esc**

Add this test block:

```tsx
it('closes the workspace overlay via backdrop and escape', async () => {
  const user = userEvent.setup();

  render(<WorkbenchShell />);
  await user.click(screen.getByTestId('workspace-fab'));
  await user.click(screen.getByTestId('workspace-backdrop'));

  expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument();

  await user.click(screen.getByTestId('workspace-fab'));
  await user.keyboard('{Escape}');

  expect(screen.queryByTestId('workspace-overlay')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the targeted shell tests and confirm they fail**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: FAIL because `WorkspaceOverlay` does not exist and no close behavior is wired.

- [ ] **Step 4: Create the workspace overlay component**

Create `src/features/workbench/components/workspace-overlay.tsx`:

```tsx
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
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWorkspaceOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workspaceOpen, setWorkspaceOpen]);

  if (!workspaceOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 md:p-8">
      <button
        type="button"
        data-testid="workspace-backdrop"
        aria-label="关闭工作区"
        className="absolute inset-0 bg-[rgba(229,223,212,0.48)] backdrop-blur-md"
        onClick={() => setWorkspaceOpen(false)}
      />
      <section
        data-testid="workspace-overlay"
        className="relative z-10 grid h-[min(88vh,860px)] w-full max-w-[1280px] grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-[34px] border border-[rgba(64,44,22,0.12)] bg-[rgba(255,252,247,0.96)] shadow-[0_36px_90px_rgba(42,31,16,0.2)]"
      >
        <WorkspaceSidebar />
        <WorkspaceConversationPane />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Add stage de-emphasis while the overlay is open**

Update the `CanvasBoard` usage in `src/features/workbench/components/workbench-shell.tsx` to wrap the stage:

```tsx
      <div
        className={workspaceOpen ? 'pointer-events-none transition duration-300 blur-[8px] saturate-[0.86]' : 'transition duration-300'}
        data-testid="stage-shell"
      >
        <CanvasBoard />
      </div>
```

- [ ] **Step 6: Run the targeted shell tests and make sure they pass**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: PASS for overlay open/close coverage while sidebar/conversation-pane details may still fail until the next tasks land.

- [ ] **Step 7: Commit the overlay shell**

```bash
git add src/features/workbench/components/workbench-shell.tsx src/features/workbench/components/workspace-overlay.tsx src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: add centered workspace overlay shell"
```

## Task 4: Move conversation and team navigation into the overlay sidebar

**Files:**
- Create: `src/features/workbench/components/workspace-sidebar.tsx`
- Create: `src/features/workbench/components/workspace-team-list.tsx`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`
- Modify: `src/features/workbench/components/conversation-rail.tsx`

- [ ] **Step 1: Add the failing shell test for sidebar tab switching**

Add this test block:

```tsx
it('switches the workspace sidebar between conversations and team members', async () => {
  const user = userEvent.setup();

  render(<WorkbenchShell />);
  await user.click(screen.getByTestId('workspace-fab'));
  await user.click(screen.getByRole('button', { name: '团队成员' }));

  expect(screen.getByText('Office')).toBeInTheDocument();
  expect(screen.getByText('原画设计')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '对话' }));
  expect(screen.getByText('CEO 和总经理的聊天')).toBeInTheDocument();
});
```

- [ ] **Step 2: Add the failing shell test for preserving the selected thread across tab switches**

Add this test block:

```tsx
it('keeps the selected conversation while switching sidebar tabs', async () => {
  const user = userEvent.setup();

  render(<WorkbenchShell />);
  await user.click(screen.getByTestId('workspace-fab'));
  await user.click(screen.getByRole('button', { name: 'CEO 和设计部的聊天' }));
  await user.click(screen.getByRole('button', { name: '团队成员' }));
  await user.click(screen.getByRole('button', { name: '对话' }));

  expect(screen.getByTestId('workspace-title')).toHaveTextContent('CEO 和设计部的聊天');
});
```

- [ ] **Step 3: Run the targeted shell tests and confirm they fail**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: FAIL because the sidebar content is not implemented.

- [ ] **Step 4: Extract or rewrite the team-member list for overlay usage**

Create `src/features/workbench/components/workspace-team-list.tsx`:

```tsx
'use client';

import { Pill } from '@/components/ui/pill';
import type { TeamDepartment } from '@/features/workbench/types';

export function WorkspaceTeamList({ departments }: { departments: TeamDepartment[] }) {
  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      {departments.map((department) => (
        <div key={department.id} className="rounded-[22px] border border-[var(--line)] bg-white/84 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{department.name}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{department.summary}</div>
            </div>
            <Pill label={`${department.agents.length} 位 agent`} tone="neutral" />
          </div>
          <div className="mt-4 space-y-2">
            {department.agents.map((agent) => (
              <div key={agent.id} className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-sm font-medium">
                {agent.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Build the overlay sidebar**

Create `src/features/workbench/components/workspace-sidebar.tsx`:

```tsx
'use client';

import { useWorkbenchStore } from '@/features/workbench/store';
import { WorkspaceTeamList } from './workspace-team-list';

export function WorkspaceSidebar() {
  const workspaceView = useWorkbenchStore((state) => state.workspaceView);
  const setWorkspaceView = useWorkbenchStore((state) => state.setWorkspaceView);
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const selectedThreadId = useWorkbenchStore((state) => state.selectedThreadId);
  const selectThread = useWorkbenchStore((state) => state.selectThread);
  const teamDepartments = useWorkbenchStore((state) => state.teamDepartments);

  return (
    <aside className="flex h-full flex-col border-r border-[rgba(64,44,22,0.08)] bg-[rgba(250,247,240,0.94)] p-4">
      <div className="grid grid-cols-2 rounded-full border border-[var(--line)] bg-white/78 p-1">
        {[
          { id: 'conversations', label: '对话' },
          { id: 'team', label: '团队成员' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setWorkspaceView(tab.id as 'conversations' | 'team')}
            className={workspaceView === tab.id ? 'rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white' : 'rounded-full px-3 py-2 text-sm font-medium text-[var(--muted)]'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-0 flex-1">
        {workspaceView === 'conversations' ? (
          <div className="space-y-2 overflow-y-auto pr-1">
            {conversationThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => selectThread(thread.id)}
                className={selectedThreadId === thread.id ? 'w-full rounded-[20px] border border-[var(--line-strong)] bg-white px-4 py-3 text-left shadow-[0_12px_24px_rgba(42,31,16,0.06)]' : 'w-full rounded-[20px] border border-transparent bg-white/58 px-4 py-3 text-left'}
              >
                <div className="text-sm font-semibold">{thread.title}</div>
                <div className="mt-2 text-sm text-[var(--muted)]">{thread.lastMessage}</div>
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
```

- [ ] **Step 6: Remove or inline any now-dead rail-only helpers**

Delete `src/features/workbench/components/conversation-rail.tsx` if nothing is reused. If you keep any helper, move only the reusable bits and delete the old exported `ConversationRail`.

- [ ] **Step 7: Run the targeted shell tests and make sure they pass**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: PASS for sidebar tab and thread-preservation tests.

- [ ] **Step 8: Commit the sidebar migration**

```bash
git add src/features/workbench/components/workspace-sidebar.tsx src/features/workbench/components/workspace-team-list.tsx src/features/workbench/components/workbench-shell.test.tsx src/features/workbench/components/conversation-rail.tsx
git commit -m "feat: move navigation into workspace sidebar"
```

## Task 5: Add the right conversation pane and remove header status pills

**Files:**
- Create: `src/features/workbench/components/workspace-conversation-pane.tsx`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing shell test for the clean conversation header**

Add this test block:

```tsx
it('renders a clean workspace conversation header without status pills', async () => {
  const user = userEvent.setup();

  render(<WorkbenchShell />);
  await user.click(screen.getByTestId('workspace-fab'));

  expect(screen.getByTestId('workspace-title')).toHaveTextContent('CEO 和总经理的聊天');
  expect(screen.queryByText('2 项待确认')).not.toBeInTheDocument();
  expect(screen.queryByText('阻塞')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add the failing shell test for the shared input bar**

Add this test block:

```tsx
it('shows a dedicated input bar at the bottom of the conversation pane', async () => {
  const user = userEvent.setup();

  render(<WorkbenchShell />);
  await user.click(screen.getByTestId('workspace-fab'));

  expect(screen.getByTestId('workspace-input')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('继续给总经理或部门下达任务...')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the targeted shell tests and confirm they fail**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: FAIL because the right pane is not implemented.

- [ ] **Step 4: Create the conversation pane**

Create `src/features/workbench/components/workspace-conversation-pane.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { useWorkbenchStore } from '@/features/workbench/store';

export function WorkspaceConversationPane() {
  const selectedThreadId = useWorkbenchStore((state) => state.selectedThreadId);
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const chatMessages = useWorkbenchStore((state) => state.chatMessages);

  const activeThread = useMemo(
    () => conversationThreads.find((thread) => thread.id === selectedThreadId) ?? conversationThreads[0],
    [conversationThreads, selectedThreadId],
  );
  const messages = chatMessages.filter((message) => message.threadId === activeThread?.id);

  return (
    <section className="flex h-full min-h-0 flex-col bg-white/96">
      <div className="flex items-center justify-between border-b border-[rgba(64,44,22,0.08)] px-6 py-5">
        <h2 data-testid="workspace-title" className="text-lg font-semibold">
          {activeThread?.title}
        </h2>
        <button type="button" aria-label="关闭工作区" className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]">
          关闭
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#fff,#faf8f3)] px-6 py-5">
        {messages.map((message) => (
          <div key={message.id} className={message.side === 'right' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={message.side === 'right' ? 'max-w-[70%] rounded-[22px] bg-[rgba(243,224,192,0.78)] px-4 py-3 text-sm leading-6' : 'max-w-[70%] rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-sm leading-6'}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{message.author}</div>
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
```

- [ ] **Step 5: Wire the close button to the store**

Update the close button inside `WorkspaceConversationPane`:

```tsx
  const setWorkspaceOpen = useWorkbenchStore((state) => state.setWorkspaceOpen);
```

```tsx
        <button
          type="button"
          aria-label="关闭工作区"
          onClick={() => setWorkspaceOpen(false)}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          关闭
        </button>
```

- [ ] **Step 6: Run the targeted shell tests and make sure they pass**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx`

Expected: PASS for the conversation-pane header and input assertions.

- [ ] **Step 7: Commit the conversation pane**

```bash
git add src/features/workbench/components/workspace-conversation-pane.tsx src/features/workbench/components/workbench-shell.test.tsx src/features/workbench/components/workspace-overlay.tsx
git commit -m "feat: add workspace conversation pane"
```

## Task 6: Update end-to-end coverage and finish the migration

**Files:**
- Modify: `tests/e2e/workbench.spec.ts`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`
- Delete: `src/features/workbench/components/conversation-rail.tsx` (if still present)

- [ ] **Step 1: Add the failing Playwright test for opening and closing the workspace**

Add this test block to `tests/e2e/workbench.spec.ts`:

```ts
test('opens and closes the workspace overlay from the floating button', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('workspace-fab').click();
  await expect(page.getByTestId('workspace-overlay')).toBeVisible();
  await expect(page.getByTestId('stage-shell')).toHaveClass(/blur/);

  await page.getByTestId('workspace-backdrop').click();
  await expect(page.getByTestId('workspace-overlay')).toHaveCount(0);
});
```

- [ ] **Step 2: Add the failing Playwright test for sidebar switching**

Add this test block:

```ts
test('switches the workspace sidebar between conversations and team members', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('workspace-fab').click();
  await page.getByRole('button', { name: '团队成员', exact: true }).click();
  await expect(page.getByText('Office')).toBeVisible();
  await expect(page.getByText('原画设计')).toBeVisible();

  await page.getByRole('button', { name: '对话', exact: true }).click();
  await expect(page.getByTestId('workspace-title')).toHaveText('CEO 和总经理的聊天');
});
```

- [ ] **Step 3: Run the targeted e2e tests and confirm they fail**

Run: `npm run test:e2e -- --grep "workspace overlay|workspace sidebar"`

Expected: FAIL because the old e2e coverage still assumes a persistent left rail.

- [ ] **Step 4: Replace or remove outdated unit assertions tied to the old rail**

Delete or rewrite old assertions like these from `src/features/workbench/components/workbench-shell.test.tsx`:

```tsx
expect(screen.getByText('直接在这里给总经理下达任务或批示。')).toBeInTheDocument();
expect(screen.getByTestId('workbench-shell-grid')).toHaveClass('xl:grid-cols-[320px_minmax(0,1fr)]');
```

Replace them with stage-first and overlay-first assertions already added in previous tasks.

- [ ] **Step 5: Update the Playwright spec to the new shell**

Use this structure in `tests/e2e/workbench.spec.ts`:

```ts
test('renders the CEO-centered stage with a floating workspace entry', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'CEO层', exact: true })).toBeVisible();
  await expect(page.getByTestId('workspace-fab')).toBeVisible();
  await expect(page.getByTestId('config-fab')).toBeVisible();
  await expect(page.getByText('左侧工作区')).toHaveCount(0);
});
```

- [ ] **Step 6: Run the full verification set**

Run these commands:

```bash
npm test
npm run lint
npm run test:e2e -- --grep "CEO-centered stage|workspace overlay|workspace sidebar"
```

Expected:

- `npm test` → PASS
- `npm run lint` → PASS
- targeted Playwright run → PASS

- [ ] **Step 7: Commit the completed migration**

```bash
git add src/features/workbench/components/workbench-shell.test.tsx tests/e2e/workbench.spec.ts src/features/workbench/components/conversation-rail.tsx
git commit -m "test: cover the workspace overlay interaction model"
```

## Self-Review

- Spec coverage: The tasks cover stage-first shell layout, floating workspace entry, centered overlay, blurred backdrop, `对话 / 团队成员` switching, clean conversation header, state restoration, and regression coverage.
- Placeholder scan: No `TODO`, `TBD`, or “handle later” markers remain.
- Type consistency: The plan uses `workspaceOpen`, `workspaceView`, `lastWorkspaceThreadId`, and `workspaceUnreadCount` consistently across store, components, and tests.

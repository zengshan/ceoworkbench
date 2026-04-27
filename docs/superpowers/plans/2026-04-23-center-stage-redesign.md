# Center Stage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dense three-column CEO workbench with a two-column layout whose center area behaves like the layered stage in the wanman.ai reference, defaulting to `CEO层` and switching cleanly into department layers.

**Architecture:** Keep the existing left rail intact, remove the right drawer and bottom command bar from the shell, and replace the React Flow-driven center board with a stage renderer powered by explicit `stageLayers` mock data in the store. Split the new center stage into focused components so the shell, layer switcher, scene layout, and card presentation each have one job.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Tailwind CSS, Vitest, Playwright

---

## File Structure

### Create

- `src/features/workbench/components/stage-card.tsx` - Present a single board card with title, body, metadata, optional artifacts, and selected styling.
- `src/features/workbench/components/stage-layer-switcher.tsx` - Render the light segmented layer switcher for `CEO层`, `设计部`, and `开发部`.
- `src/features/workbench/components/stage-scene.tsx` - Render one active layer scene, including positioned cards, light connectors, and empty-state handling.
- `src/features/workbench/store.test.ts` - Verify store defaults and layer-switching behavior.

### Modify

- `src/features/workbench/types.ts` - Add stage-oriented types (`StageLayer`, `StageCard`, `StageConnection`, `StageLayerId`) and keep left-rail types intact.
- `src/features/workbench/mock-data.ts` - Add curated `stageLayers` mock data for the CEO, design, and engineering scenes.
- `src/features/workbench/store.ts` - Store `stageLayers`, `activeStageLayerId`, `selectedStageCardId`, and layer/card selection actions.
- `src/features/workbench/components/canvas-board.tsx` - Replace the current React Flow implementation with the stage renderer and layer switcher.
- `src/features/workbench/components/workbench-shell.tsx` - Remove the right drawer and bottom command bar, then render the new two-column shell.
- `src/features/workbench/components/workbench-shell.test.tsx` - Replace board assertions with stage-layout and layer-switching assertions.
- `tests/e2e/workbench.spec.ts` - Update end-to-end coverage for the new center stage and removed UI.

### Delete

- `src/features/workbench/components/details-drawer.tsx` - No longer used after the shell becomes two-column.
- `src/features/workbench/components/command-bar.tsx` - No longer used after work submission stays in the left conversation rail.

## Task 1: Add stage types, mock scenes, and store state

**Files:**
- Create: `src/features/workbench/store.test.ts`
- Modify: `src/features/workbench/types.ts`
- Modify: `src/features/workbench/mock-data.ts`
- Modify: `src/features/workbench/store.ts`

- [ ] **Step 1: Write the failing store test for default layer and switching**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from './store';

describe('workbench store stage layers', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      activeStageLayerId: 'ceo',
      selectedStageCardId: 'ceo-progress',
    });
  });

  it('defaults to CEO层 and switches layers in place', () => {
    const state = useWorkbenchStore.getState();

    expect(state.activeStageLayerId).toBe('ceo');
    expect(state.stageLayers.map((layer) => layer.label)).toEqual(['CEO层', '设计部', '开发部']);

    state.setActiveStageLayer('design');

    const nextState = useWorkbenchStore.getState();
    expect(nextState.activeStageLayerId).toBe('design');
    expect(nextState.selectedStageCardId).toBe('design-progress');
  });
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `npm test -- src/features/workbench/store.test.ts`

Expected: FAIL with TypeScript or runtime errors because `stageLayers`, `activeStageLayerId`, `selectedStageCardId`, or `setActiveStageLayer` do not exist yet.

- [ ] **Step 3: Add the minimal stage types needed by the new center stage**

```ts
export type StageLayerId = 'ceo' | 'design' | 'engineering';

export type StageCardTone = 'paper' | 'accent' | 'warning';

export type StageCardRecord = {
  id: string;
  title: string;
  body: string;
  owner: string;
  updatedAt: string;
  statusLabel?: string;
  artifactLabels?: string[];
  position: { x: number; y: number; w: number };
  rotation?: string;
  tone?: StageCardTone;
};

export type StageConnection = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type StageLayer = {
  id: StageLayerId;
  label: string;
  description: string;
  cards: StageCardRecord[];
  connections: StageConnection[];
};
```

- [ ] **Step 4: Add curated mock layers and wire them into the store**

```ts
export const stageLayers: StageLayer[] = [
  {
    id: 'ceo',
    label: 'CEO层',
    description: '本轮工作进度和各部门总结',
    cards: [
      {
        id: 'ceo-progress',
        title: '本轮工作进度',
        body: '总经理已收拢设计结果，当前只差你确认推荐方向，确认后即可进入开发。',
        owner: '总经理',
        updatedAt: '3m ago',
        statusLabel: '待确认',
        position: { x: 80, y: 84, w: 280 },
      },
      {
        id: 'ceo-design-summary',
        title: '设计部总结',
        body: '3 套首页方向和 spec 已提交，推荐稿已经给出取舍理由。',
        owner: '设计部',
        updatedAt: '12m ago',
        artifactLabels: ['three-directions.png', 'design-spec.md'],
        position: { x: 420, y: 112, w: 280 },
        rotation: '-2deg',
      },
      {
        id: 'ceo-engineering-summary',
        title: '开发部总结',
        body: '开发骨架已经准备，当前等待设计方向锁定后正式进入编码。',
        owner: '开发部',
        updatedAt: '5m ago',
        statusLabel: '等待输入',
        position: { x: 770, y: 248, w: 280 },
        rotation: '2deg',
      },
    ],
    connections: [
      { id: 'ceo-link-1', from: 'ceo-progress', to: 'ceo-design-summary' },
      { id: 'ceo-link-2', from: 'ceo-design-summary', to: 'ceo-engineering-summary' },
    ],
  },
];
```

```ts
type WorkbenchState = {
  // existing fields...
  stageLayers: StageLayer[];
  activeStageLayerId: StageLayerId;
  selectedStageCardId: string | null;
  setActiveStageLayer: (layerId: StageLayerId) => void;
  selectStageCard: (cardId: string | null) => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  // existing fields...
  stageLayers,
  activeStageLayerId: 'ceo',
  selectedStageCardId: 'ceo-progress',
  setActiveStageLayer: (layerId) =>
    set((state) => {
      const layer = state.stageLayers.find((entry) => entry.id === layerId) ?? state.stageLayers[0];
      return {
        activeStageLayerId: layer.id,
        selectedStageCardId: layer.cards[0]?.id ?? null,
      };
    }),
  selectStageCard: (cardId) => set({ selectedStageCardId: cardId }),
}));
```

- [ ] **Step 5: Run the store test to verify it passes**

Run: `npm test -- src/features/workbench/store.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 6: Commit the data-layer slice**

```bash
git add src/features/workbench/types.ts src/features/workbench/mock-data.ts src/features/workbench/store.ts src/features/workbench/store.test.ts
git commit -m "feat: add layered stage data model"
```

## Task 2: Replace React Flow with a stage renderer and layer switcher

**Files:**
- Create: `src/features/workbench/components/stage-card.tsx`
- Create: `src/features/workbench/components/stage-layer-switcher.tsx`
- Create: `src/features/workbench/components/stage-scene.tsx`
- Modify: `src/features/workbench/components/canvas-board.tsx`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing component test for the default CEO layer**

```ts
it('shows CEO层 by default and hides the old right-side workflow UI', () => {
  render(<WorkbenchShell />);

  expect(screen.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('本轮工作进度')).toBeInTheDocument();
  expect(screen.getByText('设计部总结')).toBeInTheDocument();
  expect(screen.getByText('开发部总结')).toBeInTheDocument();
  expect(screen.queryByText('公司大战略')).not.toBeInTheDocument();
  expect(screen.queryByText('给总经理下达项目任务')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "shows CEO层 by default"`

Expected: FAIL because the center board still renders `公司大战略`, React Flow content, and the old bottom command bar.

- [ ] **Step 3: Build the new stage presentation components**

```tsx
export function StageLayerSwitcher({
  layers,
  activeLayerId,
  onSelect,
}: {
  layers: StageLayer[];
  activeLayerId: StageLayerId;
  onSelect: (layerId: StageLayerId) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--line)] bg-white/80 p-1">
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          aria-pressed={layer.id === activeLayerId}
          onClick={() => onSelect(layer.id)}
          className={layer.id === activeLayerId ? 'rounded-full bg-[var(--accent)] px-4 py-2 text-white' : 'rounded-full px-4 py-2 text-[var(--muted)]'}
        >
          {layer.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
export function StageCard({
  card,
  selected,
  onSelect,
}: {
  card: StageCardRecord;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      className={selected ? 'shadow-[0_24px_60px_rgba(32,23,15,0.16)]' : 'shadow-[0_12px_32px_rgba(32,23,15,0.08)]'}
      style={{
        left: `${card.position.x}px`,
        top: `${card.position.y}px`,
        width: `${card.position.w}px`,
        transform: `rotate(${card.rotation ?? '0deg'})`,
      }}
    >
      <span>{card.title}</span>
      <span>{card.body}</span>
    </button>
  );
}
```

```tsx
export function StageScene({
  layer,
  selectedCardId,
  onSelectCard,
}: {
  layer: StageLayer;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
}) {
  if (layer.cards.length === 0) {
    return <div className="rounded-[28px] border border-[var(--line)] bg-white/50 p-10 text-sm text-[var(--muted)]">这个部门本轮还没有可汇报内容。</div>;
  }

  return (
    <div className="relative min-h-[760px] overflow-hidden rounded-[32px] border border-[rgba(84,60,34,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(248,242,231,0.92))]">
      {layer.cards.map((card) => (
        <StageCard key={card.id} card={card} selected={card.id === selectedCardId} onSelect={onSelectCard} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Replace `canvas-board.tsx` with the layer-driven stage**

```tsx
export function CanvasBoard() {
  const stageLayers = useWorkbenchStore((state) => state.stageLayers);
  const activeStageLayerId = useWorkbenchStore((state) => state.activeStageLayerId);
  const selectedStageCardId = useWorkbenchStore((state) => state.selectedStageCardId);
  const setActiveStageLayer = useWorkbenchStore((state) => state.setActiveStageLayer);
  const selectStageCard = useWorkbenchStore((state) => state.selectStageCard);

  const activeLayer = stageLayers.find((layer) => layer.id === activeStageLayerId) ?? stageLayers[0];

  return (
    <Panel className="min-h-[860px] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <StageLayerSwitcher layers={stageLayers} activeLayerId={activeLayer.id} onSelect={setActiveStageLayer} />
      </div>
      <StageScene layer={activeLayer} selectedCardId={selectedStageCardId} onSelectCard={selectStageCard} />
    </Panel>
  );
}
```

- [ ] **Step 5: Run the component test to verify it passes**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "shows CEO层 by default"`

Expected: PASS with the old center labels gone and the new stage labels visible.

- [ ] **Step 6: Commit the center-stage renderer**

```bash
git add src/features/workbench/components/stage-card.tsx src/features/workbench/components/stage-layer-switcher.tsx src/features/workbench/components/stage-scene.tsx src/features/workbench/components/canvas-board.tsx src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: replace flow board with layered stage"
```

## Task 3: Simplify the shell into the approved two-column layout

**Files:**
- Modify: `src/features/workbench/components/workbench-shell.tsx`
- Delete: `src/features/workbench/components/details-drawer.tsx`
- Delete: `src/features/workbench/components/command-bar.tsx`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing shell-layout test**

```ts
it('renders as a two-column shell without the right drawer or bottom command bar', () => {
  render(<WorkbenchShell />);

  expect(screen.getByTestId('workbench-shell-grid')).toHaveClass('xl:grid-cols-[320px_minmax(0,1fr)]');
  expect(screen.queryByText('立即动作')).not.toBeInTheDocument();
  expect(screen.queryByText('发送给总经理')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the shell-layout test to verify it fails**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "renders as a two-column shell"`

Expected: FAIL because the shell still mounts `DetailsDrawer`, `CommandBar`, and the old three-column grid.

- [ ] **Step 3: Strip the shell down to left rail plus center stage**

```tsx
export function WorkbenchShell() {
  const leftRailView = useWorkbenchStore((state) => state.leftRailView);
  const conversationThreads = useWorkbenchStore((state) => state.conversationThreads);
  const chatMessages = useWorkbenchStore((state) => state.chatMessages);
  const teamDepartments = useWorkbenchStore((state) => state.teamDepartments);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <WorkbenchHeader />
      <div data-testid="workbench-shell-grid" className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ConversationRail
          leftRailView={leftRailView}
          threads={conversationThreads}
          messages={chatMessages}
          teamDepartments={teamDepartments}
          pendingGroups={[]}
        />
        <CanvasBoard />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Delete the no-longer-used components**

```bash
rm src/features/workbench/components/details-drawer.tsx
rm src/features/workbench/components/command-bar.tsx
```

- [ ] **Step 5: Run the shell-layout test to verify it passes**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "renders as a two-column shell"`

Expected: PASS with no right drawer or bottom command UI left in the shell.

- [ ] **Step 6: Commit the layout cleanup**

```bash
git add src/features/workbench/components/workbench-shell.tsx src/features/workbench/components/workbench-shell.test.tsx src/features/workbench/components/details-drawer.tsx src/features/workbench/components/command-bar.tsx
git commit -m "refactor: simplify workbench shell layout"
```

## Task 4: Add department-layer switching and scene-specific assertions

**Files:**
- Modify: `src/features/workbench/mock-data.ts`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing interaction tests for department layers**

```ts
it('switches from CEO层 to 设计部 and shows only design-scene content', async () => {
  const user = userEvent.setup();
  render(<WorkbenchShell />);

  await user.click(screen.getByRole('button', { name: '设计部' }));

  expect(screen.getByText('设计部内部进度')).toBeInTheDocument();
  expect(screen.getByText('交给开发的内容')).toBeInTheDocument();
  expect(screen.queryByText('本轮工作进度')).not.toBeInTheDocument();
});

it('switches to 开发部 and shows the current blocker plus external dependency', async () => {
  const user = userEvent.setup();
  render(<WorkbenchShell />);

  await user.click(screen.getByRole('button', { name: '开发部' }));

  expect(screen.getByText('开发部内部进度')).toBeInTheDocument();
  expect(screen.getByText('等待设计最终确认')).toBeInTheDocument();
  expect(screen.queryByText('设计部总结')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the layer-switching tests to verify they fail**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "switches from CEO层|switches to 开发部"`

Expected: FAIL because the mock data still lacks full department scenes or the board does not yet render those labels.

- [ ] **Step 3: Fill the design and engineering stage scenes with approved content**

```ts
{
  id: 'design',
  label: '设计部',
  description: '设计部详细内部进度和对外协作',
  cards: [
    {
      id: 'design-progress',
      title: '设计部内部进度',
      body: '首页方向已经收拢到推荐稿，当前在补充开发前需要的说明和边界。',
      owner: '设计部',
      updatedAt: '8m ago',
      statusLabel: '收口中',
      position: { x: 120, y: 90, w: 290 },
    },
    {
      id: 'design-handoff',
      title: '交给开发的内容',
      body: '推荐稿、页面覆盖清单和组件状态说明会一起交付给开发部。',
      owner: '总经理',
      updatedAt: '5m ago',
      artifactLabels: ['recommended-full-app.png', 'design-spec.md'],
      position: { x: 520, y: 180, w: 290 },
    },
  ],
  connections: [{ id: 'design-link-1', from: 'design-progress', to: 'design-handoff', label: 'handoff' }],
}
```

```ts
{
  id: 'engineering',
  label: '开发部',
  description: '开发部详细内部进度和对外协作',
  cards: [
    {
      id: 'engineering-progress',
      title: '开发部内部进度',
      body: '页面骨架和状态管理方案已经准备，等确认后即可转入编码。',
      owner: '开发部',
      updatedAt: '4m ago',
      statusLabel: '待启动',
      position: { x: 130, y: 120, w: 290 },
    },
    {
      id: 'engineering-blocker',
      title: '等待设计最终确认',
      body: '如果推荐稿不锁定，组件拆分和页面实现会继续摇摆，开发不会正式开工。',
      owner: '总经理',
      updatedAt: '2m ago',
      statusLabel: '阻塞',
      position: { x: 560, y: 220, w: 290 },
      rotation: '1.5deg',
    },
  ],
  connections: [{ id: 'engineering-link-1', from: 'engineering-progress', to: 'engineering-blocker' }],
}
```

- [ ] **Step 4: Run the layer-switching tests to verify they pass**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "switches from CEO层|switches to 开发部"`

Expected: PASS with scene-specific card text changing as each layer button is clicked.

- [ ] **Step 5: Commit the layer-content slice**

```bash
git add src/features/workbench/mock-data.ts src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: add department stage scenes"
```

## Task 5: Update end-to-end coverage and run final verification

**Files:**
- Modify: `tests/e2e/workbench.spec.ts`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`
- Test: `src/features/workbench/store.test.ts`

- [ ] **Step 1: Rewrite the e2e spec around the new center stage**

```ts
test('renders the layered CEO workbench shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('CEO 工作台')).toBeVisible();
  await expect(page.getByRole('button', { name: /CEO 和总经理的聊天/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('本轮工作进度')).toBeVisible();
  await expect(page.getByText('发送给总经理')).toHaveCount(0);
});

test('switches stage layers in the center board', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '设计部' }).click();
  await expect(page.getByText('设计部内部进度')).toBeVisible();
  await expect(page.getByText('本轮工作进度')).toHaveCount(0);

  await page.getByRole('button', { name: '开发部' }).click();
  await expect(page.getByText('开发部内部进度')).toBeVisible();
  await expect(page.getByText('等待设计最终确认')).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e spec to verify it fails before the final wiring is complete**

Run: `npm run test:e2e -- --grep "layered CEO workbench shell|switches stage layers"`

Expected: FAIL until the new center stage is fully wired and the removed UI strings are gone.

- [ ] **Step 3: Run the focused unit suite and e2e suite after implementation**

Run: `npm test -- src/features/workbench/store.test.ts src/features/workbench/components/workbench-shell.test.tsx`

Expected: PASS with all stage-layer tests green.

Run: `npm run test:e2e -- --grep "renders the layered CEO workbench shell|switches stage layers|team members tab"`

Expected: PASS with the center-stage scenarios and the existing left-rail tab scenario all green.

- [ ] **Step 4: Run project-level verification**

Run: `npm run lint`

Expected: PASS with no ESLint errors.

Run: `npm test`

Expected: PASS with the full Vitest suite green.

Run: `npm run build`

Expected: PASS with the Next.js production build succeeding.

- [ ] **Step 5: Commit the verified redesign**

```bash
git add tests/e2e/workbench.spec.ts src/features/workbench/store.test.ts src/features/workbench/components/workbench-shell.test.tsx src/features/workbench/components/canvas-board.tsx src/features/workbench/components/stage-card.tsx src/features/workbench/components/stage-layer-switcher.tsx src/features/workbench/components/stage-scene.tsx src/features/workbench/mock-data.ts src/features/workbench/store.ts src/features/workbench/types.ts src/features/workbench/components/workbench-shell.tsx
git commit -m "feat: redesign center stage around layered company views"
```

## Spec Coverage Check

- Two-column shell with no right drawer: covered by Task 3.
- No bottom command bar: covered by Task 3 and Task 5 e2e assertions.
- Default `CEO层`: covered by Task 1 store state and Task 2 component assertions.
- Department layer switching in place: covered by Task 4 and Task 5.
- `CEO层` shows current-round progress and department summaries only: covered by Task 1 mock data and Task 2 assertions.
- Department layers show internal progress and cross-team dependencies only: covered by Task 4 mock data and tests.
- Lower-density visual stage closer to the wanman.ai reference: covered by Task 2 renderer structure and style constraints.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders remain.
- All new functions, types, actions, and test names are defined in earlier tasks before later tasks reference them.
- Every task includes explicit files, concrete code, exact commands, and expected outcomes.

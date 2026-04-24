# CEO-Centered Stage Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the center stage from isolated per-layer scenes into one persistent CEO-centered company wall where focus moves between organization clusters without losing surrounding context.

**Architecture:** Replace the current `StageLayer`-only renderer with a focus-based scene model that always renders `CEO`, `总经理`, `设计部`, and `开发部` together. Keep the existing left rail and shell, but refactor the center-stage data and rendering so cluster layout depends on the active focus while non-focused clusters stay visible in compressed form with persistent connectors.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Tailwind CSS, Vitest, Playwright

---

## File Structure

### Create

- `src/features/workbench/components/stage-cluster.tsx` - Render one organization cluster container, switching between focused and compressed layout while reusing `StageCard`.
- `src/features/workbench/components/stage-connector-layer.tsx` - Draw persistent connections between cluster anchors for the full company wall.

### Modify

- `src/features/workbench/types.ts` - Replace isolated stage-layer typing with focus-based cluster typing while keeping existing non-stage types intact.
- `src/features/workbench/mock-data.ts` - Replace `stageLayers` with a CEO-centered stage scene dataset containing persistent clusters and focus-specific positions.
- `src/features/workbench/store.ts` - Track active stage focus and selected card per focus while keeping left-rail state intact.
- `src/features/workbench/store.test.ts` - Verify focus switching, selected-card preservation, and cluster visibility contracts.
- `src/features/workbench/components/canvas-board.tsx` - Read the new focus-based scene model instead of isolated layers.
- `src/features/workbench/components/stage-layer-switcher.tsx` - Retain the switcher but change its semantics from “page tab” to “move focus to this cluster.”
- `src/features/workbench/components/stage-card.tsx` - Support focused vs compressed presentation without losing the existing visual tone model.
- `src/features/workbench/components/stage-scene.tsx` - Replace single-layer rendering with a persistent company wall that renders all clusters and all connectors at once.
- `src/features/workbench/components/workbench-shell.test.tsx` - Update component tests around the new CEO-centered default and focus-shift behavior.
- `tests/e2e/workbench.spec.ts` - Update Playwright to verify persistent surrounding clusters and focus shifts instead of isolated layer replacement.

## Task 1: Replace isolated stage-layer types with a focus-based company wall model

**Files:**
- Modify: `src/features/workbench/types.ts`
- Modify: `src/features/workbench/store.test.ts`
- Modify: `src/features/workbench/store.ts`
- Modify: `src/features/workbench/mock-data.ts`

- [ ] **Step 1: Write the failing store test for focus-based stage data**

```ts
it('keeps all organization clusters in the scene while moving focus', () => {
  const state = useWorkbenchStore.getState();

  expect(state.stageScene.focusOrder).toEqual(['ceo', 'manager', 'design', 'engineering']);
  expect(state.activeStageFocusId).toBe('ceo');
  expect(state.stageScene.clusters.map((cluster) => cluster.id)).toEqual(['ceo', 'manager', 'design', 'engineering']);

  state.setActiveStageFocus('design');

  const nextState = useWorkbenchStore.getState();
  expect(nextState.activeStageFocusId).toBe('design');
  expect(nextState.selectedStageCardIds.design).toBe('design-progress');
  expect(nextState.selectedStageCardIds.ceo).toBe('ceo-progress');
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `npm test -- src/features/workbench/store.test.ts -t "keeps all organization clusters in the scene while moving focus"`

Expected: FAIL because `stageScene`, `activeStageFocusId`, `selectedStageCardIds`, or `setActiveStageFocus` do not exist yet.

- [ ] **Step 3: Replace the stage typing with focus-based types**

```ts
export type StageFocusId = 'ceo' | 'manager' | 'design' | 'engineering';

export type StageClusterCardSize = 'focused' | 'supporting' | 'compressed';

export type StageClusterCardRecord = {
  id: string;
  title: string;
  body: string;
  owner: string;
  updatedAt: string;
  statusLabel?: string;
  artifactLabels?: string[];
  tone?: StageCardTone;
  rotation?: number;
  sizeHint?: StageClusterCardSize;
};

export type StageClusterLayout = {
  x: number;
  y: number;
  w: number;
  z: number;
  mode: 'focused' | 'supporting' | 'compressed';
};

export type StageClusterConnection = {
  id: string;
  fromClusterId: StageFocusId;
  toClusterId: StageFocusId;
  label?: string;
};

export type StageCluster = {
  id: StageFocusId;
  label: string;
  cards: StageClusterCardRecord[];
  layoutsByFocus: Record<StageFocusId, StageClusterLayout>;
};

export type StageSceneRecord = {
  focusOrder: StageFocusId[];
  clusters: StageCluster[];
  connections: StageClusterConnection[];
};
```

- [ ] **Step 4: Seed the CEO-centered scene and wire the store to it**

```ts
type WorkbenchState = {
  // existing fields...
  stageScene: StageSceneRecord;
  activeStageFocusId: StageFocusId;
  selectedStageCardIds: Record<StageFocusId, string | null>;
  setActiveStageFocus: (focusId: StageFocusId) => void;
  selectStageCard: (focusId: StageFocusId, cardId: string | null) => void;
};

const initialSelectedStageCardIds: Record<StageFocusId, string | null> = {
  ceo: 'ceo-progress',
  manager: 'manager-judgment',
  design: 'design-progress',
  engineering: 'engineering-progress',
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  // existing fields...
  stageScene,
  activeStageFocusId: 'ceo',
  selectedStageCardIds: initialSelectedStageCardIds,
  setActiveStageFocus: (focusId) =>
    set((state) => ({
      activeStageFocusId: focusId,
      selectedStageCardIds: {
        ...state.selectedStageCardIds,
        [focusId]:
          state.selectedStageCardIds[focusId] ??
          state.stageScene.clusters.find((cluster) => cluster.id === focusId)?.cards[0]?.id ??
          null,
      },
    })),
  selectStageCard: (focusId, cardId) =>
    set((state) => ({
      selectedStageCardIds: {
        ...state.selectedStageCardIds,
        [focusId]: cardId,
      },
    })),
}));
```

```ts
export const stageScene: StageSceneRecord = {
  focusOrder: ['ceo', 'manager', 'design', 'engineering'],
  clusters: [
    {
      id: 'ceo',
      label: 'CEO',
      cards: [
        {
          id: 'ceo-progress',
          title: '本轮工作进度',
          body: '总经理已收拢设计与开发节奏，当前你看到的是整家公司围绕这轮判断的推进关系。',
          owner: 'CEO',
          updatedAt: '2m ago',
          statusLabel: '中心视角',
          tone: 'accent',
        },
        {
          id: 'ceo-direction',
          title: '当前主判断',
          body: '先锁设计方向，再释放开发启动，避免公司继续在输入不稳定的状态里空转。',
          owner: 'CEO',
          updatedAt: '5m ago',
          statusLabel: '当前判断',
        },
      ],
      layoutsByFocus: {
        ceo: { x: 410, y: 150, w: 310, z: 40, mode: 'focused' },
        manager: { x: 110, y: 74, w: 180, z: 10, mode: 'compressed' },
        design: { x: 100, y: 84, w: 180, z: 10, mode: 'compressed' },
        engineering: { x: 110, y: 86, w: 180, z: 10, mode: 'compressed' },
      },
    },
  ],
  connections: [
    { id: 'ceo-manager', fromClusterId: 'ceo', toClusterId: 'manager', label: '汇报' },
    { id: 'manager-design', fromClusterId: 'manager', toClusterId: 'design', label: '分派' },
    { id: 'design-engineering', fromClusterId: 'design', toClusterId: 'engineering', label: '交接' },
  ],
};
```

- [ ] **Step 5: Run the store test to verify it passes**

Run: `npm test -- src/features/workbench/store.test.ts -t "keeps all organization clusters in the scene while moving focus"`

Expected: PASS with the new focus-based store contract green.

- [ ] **Step 6: Commit the stage-model foundation**

```bash
git add src/features/workbench/types.ts src/features/workbench/mock-data.ts src/features/workbench/store.ts src/features/workbench/store.test.ts
git commit -m "feat: model workbench stage as focus-based company wall"
```

## Task 2: Render persistent surrounding clusters instead of isolated layers

**Files:**
- Create: `src/features/workbench/components/stage-cluster.tsx`
- Create: `src/features/workbench/components/stage-connector-layer.tsx`
- Modify: `src/features/workbench/components/stage-card.tsx`
- Modify: `src/features/workbench/components/stage-scene.tsx`
- Modify: `src/features/workbench/components/canvas-board.tsx`
- Modify: `src/features/workbench/components/stage-layer-switcher.tsx`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing component test for the CEO-centered default scene**

```ts
it('keeps CEO at the center while surrounding departments stay visible', () => {
  render(<WorkbenchShell />);

  expect(screen.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('本轮工作进度')).toBeInTheDocument();
  expect(screen.getByText('总经理')).toBeInTheDocument();
  expect(screen.getByText('设计部')).toBeInTheDocument();
  expect(screen.getByText('开发部')).toBeInTheDocument();
  expect(screen.getAllByText('设计部内部进度')[0]).toBeInTheDocument();
  expect(screen.getAllByText('开发部内部进度')[0]).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "keeps CEO at the center while surrounding departments stay visible"`

Expected: FAIL because the current stage still renders only the active isolated layer.

- [ ] **Step 3: Create a cluster container and connector layer**

```tsx
export function StageCluster({
  cluster,
  layout,
  selectedCardId,
  onSelectCard,
}: {
  cluster: StageCluster;
  layout: StageClusterLayout;
  selectedCardId: string | null;
  onSelectCard: (clusterId: StageFocusId, cardId: string) => void;
}) {
  return (
    <div
      className={layout.mode === 'focused' ? 'absolute transition-all duration-300' : 'absolute opacity-85 transition-all duration-300'}
      style={{ left: layout.x, top: layout.y, width: layout.w, zIndex: layout.z }}
      data-cluster={cluster.id}
    >
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{cluster.label}</div>
      <div className={layout.mode === 'focused' ? 'space-y-3' : 'space-y-2'}>
        {cluster.cards.map((card) => (
          <StageCard
            key={card.id}
            card={card}
            mode={layout.mode}
            selected={card.id === selectedCardId}
            onSelect={() => onSelectCard(cluster.id, card.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

```tsx
export function StageConnectorLayer({
  connectors,
  anchors,
}: {
  connectors: StageClusterConnection[];
  anchors: Record<StageFocusId, { x: number; y: number }>;
}) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      {connectors.map((connector) => {
        const from = anchors[connector.fromClusterId];
        const to = anchors[connector.toClusterId];
        const midX = (from.x + to.x) / 2;

        return (
          <g key={connector.id}>
            <path
              d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              stroke="rgba(64,44,22,0.22)"
              strokeDasharray="8 8"
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Refactor the stage renderer around all clusters plus active focus**

```tsx
export function CanvasBoard() {
  const stageScene = useWorkbenchStore((state) => state.stageScene);
  const activeStageFocusId = useWorkbenchStore((state) => state.activeStageFocusId);
  const selectedStageCardIds = useWorkbenchStore((state) => state.selectedStageCardIds);
  const setActiveStageFocus = useWorkbenchStore((state) => state.setActiveStageFocus);
  const selectStageCard = useWorkbenchStore((state) => state.selectStageCard);

  return (
    <Panel className="flex min-h-[760px] flex-col gap-4 p-4">
      <StageLayerSwitcher focusOrder={stageScene.focusOrder} activeFocusId={activeStageFocusId} onChange={setActiveStageFocus} />
      <StageScene
        scene={stageScene}
        activeFocusId={activeStageFocusId}
        selectedStageCardIds={selectedStageCardIds}
        onSelectCard={selectStageCard}
      />
    </Panel>
  );
}
```

```tsx
export function StageScene({
  scene,
  activeFocusId,
  selectedStageCardIds,
  onSelectCard,
}: {
  scene: StageSceneRecord;
  activeFocusId: StageFocusId;
  selectedStageCardIds: Record<StageFocusId, string | null>;
  onSelectCard: (focusId: StageFocusId, cardId: string) => void;
}) {
  const anchors = Object.fromEntries(
    scene.clusters.map((cluster) => {
      const layout = cluster.layoutsByFocus[activeFocusId];
      return [cluster.id, { x: layout.x + layout.w / 2, y: layout.y + 80 }];
    }),
  ) as Record<StageFocusId, { x: number; y: number }>;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="relative min-h-[780px] min-w-[1180px] overflow-hidden rounded-[30px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,239,223,0.72))]">
        <StageConnectorLayer connectors={scene.connections} anchors={anchors} />
        {scene.clusters.map((cluster) => (
          <StageCluster
            key={cluster.id}
            cluster={cluster}
            layout={cluster.layoutsByFocus[activeFocusId]}
            selectedCardId={selectedStageCardIds[cluster.id]}
            onSelectCard={onSelectCard}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the component test to verify it passes**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "keeps CEO at the center while surrounding departments stay visible"`

Expected: PASS with the CEO-centered scene and surrounding clusters visible together.

- [ ] **Step 6: Commit the persistent company-wall renderer**

```bash
git add src/features/workbench/components/stage-cluster.tsx src/features/workbench/components/stage-connector-layer.tsx src/features/workbench/components/stage-card.tsx src/features/workbench/components/stage-scene.tsx src/features/workbench/components/stage-layer-switcher.tsx src/features/workbench/components/canvas-board.tsx src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: render CEO-centered persistent stage wall"
```

## Task 3: Make focus shifts behave like camera movement instead of page replacement

**Files:**
- Modify: `src/features/workbench/mock-data.ts`
- Modify: `src/features/workbench/store.ts`
- Modify: `src/features/workbench/store.test.ts`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing focus-shift tests**

```ts
it('moves design into focus while keeping CEO visible as a secondary cluster', async () => {
  const user = userEvent.setup();
  render(<WorkbenchShell />);

  await user.click(screen.getByRole('button', { name: '设计部' }));

  expect(screen.getByRole('button', { name: '设计部' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getAllByText('设计部内部进度')[0]).toBeInTheDocument();
  expect(screen.getAllByText('本轮工作进度')[0]).toBeInTheDocument();
  expect(screen.getByTestId('cluster-design')).toHaveAttribute('data-mode', 'focused');
  expect(screen.getByTestId('cluster-ceo')).toHaveAttribute('data-mode', 'compressed');
});

it('keeps non-focused clusters visible in compressed mode after switching to 开发部', async () => {
  const user = userEvent.setup();
  render(<WorkbenchShell />);

  await user.click(screen.getByRole('button', { name: '开发部' }));

  expect(screen.getByTestId('cluster-engineering')).toHaveAttribute('data-mode', 'focused');
  expect(screen.getByTestId('cluster-manager')).toHaveAttribute('data-mode', 'compressed');
  expect(screen.getByTestId('cluster-design')).toHaveAttribute('data-mode', 'compressed');
});
```

- [ ] **Step 2: Run the focus-shift tests to verify they fail**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "moves design into focus|keeps non-focused clusters visible"`

Expected: FAIL because the current mock layouts and cluster metadata do not yet distinguish focused vs compressed layouts explicitly.

- [ ] **Step 3: Add focus-specific cluster layouts that keep CEO visible after department focus**

```ts
{
  id: 'design',
  label: '设计部',
  cards: [
    {
      id: 'design-progress',
      title: '设计部内部进度',
      body: '首页方向已经收口到推荐稿，当前在补交给开发的结构说明与边界细节。',
      owner: '设计部',
      updatedAt: '6m ago',
      statusLabel: '主簇',
    },
    {
      id: 'design-handoff',
      title: '交给开发的内容',
      body: '推荐稿、页面覆盖清单与组件说明会一起交接给开发部，避免进入实现后再返工。',
      owner: '设计部',
      updatedAt: '4m ago',
      statusLabel: '交接',
    },
  ],
  layoutsByFocus: {
    ceo: { x: 130, y: 120, w: 190, z: 18, mode: 'supporting' },
    manager: { x: 130, y: 118, w: 170, z: 14, mode: 'compressed' },
    design: { x: 420, y: 150, w: 320, z: 40, mode: 'focused' },
    engineering: { x: 108, y: 120, w: 170, z: 12, mode: 'compressed' },
  },
}
```

```ts
{
  id: 'engineering',
  label: '开发部',
  cards: [
    {
      id: 'engineering-progress',
      title: '开发部内部进度',
      body: '开发骨架与状态管理已经就位，一旦输入锁定就直接进入页面实现。',
      owner: '开发部',
      updatedAt: '5m ago',
      statusLabel: '主簇',
    },
    {
      id: 'engineering-blocker',
      title: '等待设计最终确认',
      body: '推荐稿未完全锁定前，开发仍然会保持压缩准备状态，避免错误启动。',
      owner: '开发部',
      updatedAt: '3m ago',
      statusLabel: '阻塞',
      tone: 'warning',
    },
  ],
  layoutsByFocus: {
    ceo: { x: 860, y: 132, w: 190, z: 18, mode: 'supporting' },
    manager: { x: 850, y: 132, w: 170, z: 12, mode: 'compressed' },
    design: { x: 876, y: 134, w: 170, z: 12, mode: 'compressed' },
    engineering: { x: 420, y: 150, w: 320, z: 40, mode: 'focused' },
  },
}
```

- [ ] **Step 4: Run the focus-shift tests to verify they pass**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "moves design into focus|keeps non-focused clusters visible"`

Expected: PASS with focus shifts preserving CEO and compressing the other clusters.

- [ ] **Step 5: Commit the focus-shift behavior**

```bash
git add src/features/workbench/mock-data.ts src/features/workbench/store.ts src/features/workbench/store.test.ts src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: shift stage focus without losing company context"
```

## Task 4: Tighten stage-card presentation for focused vs compressed cluster states

**Files:**
- Modify: `src/features/workbench/components/stage-card.tsx`
- Modify: `src/features/workbench/components/stage-cluster.tsx`
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Add the failing UI-state test for compressed clusters**

```ts
it('renders compressed clusters with lower emphasis but preserved identity', async () => {
  const user = userEvent.setup();
  render(<WorkbenchShell />);

  await user.click(screen.getByRole('button', { name: '设计部' }));

  expect(screen.getByTestId('cluster-ceo')).toHaveAttribute('data-mode', 'compressed');
  expect(screen.getByTestId('cluster-ceo')).toHaveTextContent('本轮工作进度');
  expect(screen.getByTestId('cluster-manager')).toHaveAttribute('data-mode', 'compressed');
});
```

- [ ] **Step 2: Run the compressed-cluster test to verify it fails**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "renders compressed clusters with lower emphasis"`

Expected: FAIL because the current cluster/card components do not yet expose compressed-mode semantics clearly enough.

- [ ] **Step 3: Make `StageCard` and `StageCluster` render focused and compressed modes differently**

```tsx
export function StageCard({
  card,
  mode,
  selected,
  onSelect,
}: {
  card: StageClusterCardRecord;
  mode: 'focused' | 'supporting' | 'compressed';
  selected: boolean;
  onSelect: () => void;
}) {
  const compact = mode === 'compressed';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'w-full rounded-[24px] border text-left transition',
        compact ? 'p-3 shadow-[0_10px_24px_rgba(58,42,24,0.05)]' : 'p-5 shadow-[0_18px_36px_rgba(58,42,24,0.08)]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={compact ? 'text-[11px] font-semibold text-[var(--muted)]' : 'text-xs font-semibold text-[var(--muted)]'}>
          {card.statusLabel ?? '工作卡'}
        </div>
        <div className="text-xs text-[var(--muted)]">{card.updatedAt}</div>
      </div>
      <div className={compact ? 'mt-2 text-sm font-semibold' : 'mt-3 text-lg font-semibold'}>{card.title}</div>
      {!compact ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.body}</p> : null}
    </button>
  );
}
```

- [ ] **Step 4: Run the compressed-cluster test to verify it passes**

Run: `npm test -- src/features/workbench/components/workbench-shell.test.tsx -t "renders compressed clusters with lower emphasis"`

Expected: PASS with compressed clusters still visible but less dominant than the focused cluster.

- [ ] **Step 5: Commit the cluster-density polish**

```bash
git add src/features/workbench/components/stage-card.tsx src/features/workbench/components/stage-cluster.tsx src/features/workbench/components/workbench-shell.test.tsx
git commit -m "feat: compress non-focused workbench clusters"
```

## Task 5: Update Playwright and run full verification for the CEO-centered wall

**Files:**
- Modify: `tests/e2e/workbench.spec.ts`
- Test: `src/features/workbench/store.test.ts`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Rewrite the e2e coverage around the persistent company wall**

```ts
test('renders the CEO-centered company wall by default', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('CEO 工作台')).toBeVisible();
  await expect(page.getByRole('button', { name: 'CEO层' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('本轮工作进度')).toBeVisible();
  await expect(page.getByText('总经理')).toBeVisible();
  await expect(page.getByText('设计部')).toBeVisible();
  await expect(page.getByText('开发部')).toBeVisible();
});

test('moves focus to 设计部 while keeping CEO visible', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '设计部' }).click();
  await expect(page.getByRole('button', { name: '设计部' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('设计部内部进度')).toBeVisible();
  await expect(page.getByText('交给开发的内容')).toBeVisible();
  await expect(page.getByText('本轮工作进度')).toBeVisible();
});
```

- [ ] **Step 2: Run the relevant e2e target to verify it fails before final wiring**

Run: `npm run test:e2e -- --grep "CEO-centered company wall|moves focus to 设计部"`

Expected: FAIL until the new persistent-cluster behavior is fully wired.

- [ ] **Step 3: Run focused verification on the completed implementation**

Run: `npm test -- src/features/workbench/store.test.ts src/features/workbench/components/workbench-shell.test.tsx`

Expected: PASS with the updated store and component tests all green.

Run: `npm run test:e2e -- --grep "CEO-centered company wall|moves focus to 设计部|team members tab"`

Expected: PASS with the revised stage behavior and the left-rail team-members flow both green.

- [ ] **Step 4: Run project-level verification**

Run: `npm run lint`

Expected: PASS with no ESLint errors.

Run: `npm test`

Expected: PASS with the full Vitest suite green.

Run: `npm run build`

Expected: PASS with the Next.js production build succeeding.

- [ ] **Step 5: Commit the verified revision**

```bash
git add tests/e2e/workbench.spec.ts src/features/workbench/store.test.ts src/features/workbench/components/workbench-shell.test.tsx src/features/workbench/components/canvas-board.tsx src/features/workbench/components/stage-scene.tsx src/features/workbench/components/stage-cluster.tsx src/features/workbench/components/stage-connector-layer.tsx src/features/workbench/components/stage-card.tsx src/features/workbench/components/stage-layer-switcher.tsx src/features/workbench/mock-data.ts src/features/workbench/store.ts src/features/workbench/types.ts
git commit -m "feat: center workbench stage around persistent company clusters"
```

## Spec Coverage Check

- CEO-centered default view: covered by Tasks 1-3.
- Persistent surrounding clusters for 总经理 / 设计部 / 开发部: covered by Tasks 1-2.
- 2-3 card clusters instead of single summary tiles: covered by Tasks 1 and 3.
- Focus shift instead of full scene replacement: covered by Task 3.
- CEO remains visible after department focus: covered by Task 3.
- Non-focused departments compress instead of disappearing: covered by Task 4.
- Relationship lines remain visible: covered by Task 2.
- No extra decision/system cluster: covered by Task 1 mock data constraints.
- Updated component and e2e coverage: covered by Tasks 2-5.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders remain.
- All planned functions, types, and tests are named concretely before later tasks rely on them.
- Every task includes explicit files, commands, and expected outcomes.

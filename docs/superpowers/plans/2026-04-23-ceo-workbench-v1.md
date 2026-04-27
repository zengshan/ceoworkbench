# CEO Workbench V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first visible version of the CEO workbench: a Next.js app with a the wanman.ai reference-inspired executive workspace containing the left conversation rail, center company canvas, right details drawer, and bottom CEO command bar.

**Architecture:** Use a single Next.js App Router application with TypeScript. Keep V1 intentionally local-first: Tailwind for styling, React Flow for the central canvas, Zustand for shared workbench state, and mocked company data stored in a typed feature module so the visual shell, object model, and panel interactions work before login, database, or AI runtime integration.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, React Flow, Zustand, Vitest, Testing Library, Playwright

---

## File Map

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `.gitignore`
- Create: `eslint.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/components/ui/pill.tsx`
- Create: `src/components/ui/panel.tsx`
- Create: `src/features/workbench/types.ts`
- Create: `src/features/workbench/mock-data.ts`
- Create: `src/features/workbench/store.ts`
- Create: `src/features/workbench/utils.ts`
- Create: `src/features/workbench/components/workbench-shell.tsx`
- Create: `src/features/workbench/components/conversation-rail.tsx`
- Create: `src/features/workbench/components/rail-section.tsx`
- Create: `src/features/workbench/components/canvas-board.tsx`
- Create: `src/features/workbench/components/canvas-card.tsx`
- Create: `src/features/workbench/components/details-drawer.tsx`
- Create: `src/features/workbench/components/command-bar.tsx`
- Create: `src/features/workbench/components/workbench-header.tsx`
- Create: `src/features/workbench/components/workbench-shell.test.tsx`
- Create: `src/features/workbench/utils.test.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/workbench.spec.ts`

### Task 1: Scaffold the app foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `.gitignore`
- Create: `eslint.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "ceo-workbench",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@xyflow/react": "^12.8.5",
    "clsx": "^2.1.1",
    "next": "^15.3.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "@playwright/test": "^1.52.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.14.1",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "eslint": "^9.24.0",
    "eslint-config-next": "^15.3.1",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.1.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

- [ ] **Step 2: Add base config files**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: false,
  },
};

export default nextConfig;
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```js
// postcss.config.mjs
export default {};
```

```txt
# .gitignore
.next
node_modules
playwright-report
test-results
coverage
```

- [ ] **Step 3: Add the root app shell**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEO Workbench",
  description: "A CEO operating system for a one-person AI company.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
import { WorkbenchShell } from "@/features/workbench/components/workbench-shell";

export default function Home() {
  return <WorkbenchShell />;
}
```

- [ ] **Step 4: Add the global visual foundation**

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "@xyflow/react/dist/style.css";

:root {
  --bg: #f3efe7;
  --bg-strong: #ebe5d9;
  --panel: rgba(255, 252, 247, 0.88);
  --panel-strong: #fffaf3;
  --line: rgba(64, 44, 22, 0.12);
  --line-strong: rgba(64, 44, 22, 0.22);
  --text: #20170f;
  --muted: #6f6254;
  --accent: #1f7a61;
  --accent-soft: rgba(31, 122, 97, 0.12);
  --warning: #b65a28;
  --danger: #9e3b2f;
  --shadow: 0 20px 45px rgba(70, 52, 30, 0.08);
  --radius-xl: 28px;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
}

body {
  margin: 0;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.65), transparent 30%),
    radial-gradient(circle at bottom right, rgba(232,220,196,0.6), transparent 28%),
    var(--bg);
  font-family: "SF Pro Display", "Segoe UI", sans-serif;
}
```

- [ ] **Step 5: Install dependencies and verify the app boots**

Run: `pnpm install`
Expected: dependencies install without error.

Run: `pnpm build`
Expected: Next.js production build succeeds.

### Task 2: Define the V1 workbench domain model

**Files:**
- Create: `src/features/workbench/types.ts`
- Create: `src/features/workbench/mock-data.ts`
- Create: `src/features/workbench/utils.ts`
- Create: `src/features/workbench/utils.test.ts`

- [ ] **Step 1: Write the failing utility test for grouped pending items**

```ts
// src/features/workbench/utils.test.ts
import { describe, expect, it } from "vitest";
import { groupPendingItems } from "./utils";
import { mockPendingItems } from "./mock-data";

describe("groupPendingItems", () => {
  it("groups items by project priority then severity", () => {
    const groups = groupPendingItems(mockPendingItems);

    expect(groups[0].projectName).toBe("wanman.ai iOS App");
    expect(groups[0].items[0].severity).toBe("heavy");
    expect(groups[1].projectPriority).toBe("P1");
  });
});
```

- [ ] **Step 2: Run the utility test to verify it fails**

Run: `pnpm test src/features/workbench/utils.test.ts`
Expected: FAIL because the utility module does not exist yet.

- [ ] **Step 3: Define the shared V1 types and mock data**

```ts
// src/features/workbench/types.ts
export type RailSectionKey = "manager" | "departments" | "pending" | "archive";
export type ItemSeverity = "light" | "medium" | "heavy";
export type ProjectPriority = "P0" | "P1" | "P2";
export type OversightMode = "normal" | "watch" | "critical";

export type RailItem = {
  id: string;
  section: RailSectionKey;
  title: string;
  summary: string;
  statusLabel: string;
  count?: number;
};

export type CanvasLane = "ceo" | "manager" | "design" | "engineering" | "decisions";
export type CanvasCardType = "project" | "task" | "deliverable" | "approval" | "report";

export type CanvasCardRecord = {
  id: string;
  lane: CanvasLane;
  type: CanvasCardType;
  title: string;
  summary: string;
  owner: string;
  status: string;
  updatedAt: string;
  tags: string[];
  projectId: string;
};

export type PendingItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectPriority: ProjectPriority;
  title: string;
  itemType: "approval" | "risk" | "confirmation";
  severity: ItemSeverity;
  recommendation: string;
  impact: string;
};
```

```ts
// src/features/workbench/mock-data.ts
import type { CanvasCardRecord, PendingItem, RailItem } from "./types";

export const railItems: RailItem[] = [
  {
    id: "manager-1",
    section: "manager",
    title: "总经理汇报",
    summary: "已拆解 2 个项目，wanman.ai iOS App 进入设计确认阶段。",
    statusLabel: "2 项待你确认",
    count: 2,
  },
  {
    id: "dept-1",
    section: "departments",
    title: "设计部",
    summary: "首页方向与 spec 已提交，等待汇总批示。",
    statusLabel: "进行中",
  },
  {
    id: "dept-2",
    section: "departments",
    title: "开发部",
    summary: "等待设计方向锁定后进入编码。",
    statusLabel: "待输入",
  },
  {
    id: "pending-1",
    section: "pending",
    title: "待处理事项",
    summary: "wanman.ai iOS App 有 3 个事项等待处理。",
    statusLabel: "P0 项目优先",
    count: 3,
  },
  {
    id: "archive-1",
    section: "archive",
    title: "历史归档",
    summary: "上周完成 4 个事项，可随时回看。",
    statusLabel: "4 条记录",
    count: 4,
  },
];

export const canvasCards: CanvasCardRecord[] = [
  {
    id: "project-1",
    lane: "ceo",
    type: "project",
    title: "wanman.ai 新 iOS App 设计与启动",
    summary: "CEO 要求总经理组织一版完整的 iOS 设计方案，并在进入开发前完成关键确认。",
    owner: "CEO",
    status: "active",
    updatedAt: "5m ago",
    tags: ["P0", "watch"],
    projectId: "wanman",
  },
  {
    id: "report-1",
    lane: "manager",
    type: "report",
    title: "总经理阶段汇报",
    summary: "已完成设计探索与 spec 草稿，建议先确认推荐方向再进入开发。",
    owner: "总经理",
    status: "awaiting_ceo",
    updatedAt: "3m ago",
    tags: ["汇报", "建议"],
    projectId: "wanman",
  },
  {
    id: "task-1",
    lane: "design",
    type: "task",
    title: "输出 3 套首页设计方向",
    summary: "覆盖完整首页信息层级，并附推荐方案与取舍说明。",
    owner: "设计部",
    status: "submitted",
    updatedAt: "12m ago",
    tags: ["设计", "首页"],
    projectId: "wanman",
  },
  {
    id: "deliverable-1",
    lane: "design",
    type: "deliverable",
    title: "wanman-ios-app-design-spec.md",
    summary: "设计稿与 spec 已提交，包含推荐视觉方向与页面覆盖清单。",
    owner: "Designer",
    status: "ready",
    updatedAt: "9m ago",
    tags: ["交付物", "Spec"],
    projectId: "wanman",
  },
  {
    id: "approval-1",
    lane: "decisions",
    type: "approval",
    title: "是否按推荐方案进入开发",
    summary: "若不确认，开发部门将暂停等待，当前建议按方案 B 推进。",
    owner: "CEO",
    status: "pending",
    updatedAt: "2m ago",
    tags: ["Heavy", "待审批"],
    projectId: "wanman",
  },
  {
    id: "task-2",
    lane: "engineering",
    type: "task",
    title: "准备开发启动骨架",
    summary: "在方向锁定后接手结构搭建、状态管理和组件实现。",
    owner: "开发部",
    status: "blocked",
    updatedAt: "1m ago",
    tags: ["阻塞", "等待设计确认"],
    projectId: "wanman",
  },
];

export const mockPendingItems: PendingItem[] = [
  {
    id: "pending-w1",
    projectId: "wanman",
    projectName: "wanman.ai iOS App",
    projectPriority: "P0",
    title: "是否按推荐方案进入开发",
    itemType: "approval",
    severity: "heavy",
    recommendation: "按方案 B 推进，返工风险最低。",
    impact: "如果不处理，开发将暂停等待。",
  },
  {
    id: "pending-w2",
    projectId: "wanman",
    projectName: "wanman.ai iOS App",
    projectPriority: "P0",
    title: "首页视觉方向是否锁定为推荐稿",
    itemType: "confirmation",
    severity: "medium",
    recommendation: "锁定推荐稿，其余方向留作后续迭代参考。",
    impact: "如果不处理，设计与开发会继续摇摆。",
  },
  {
    id: "pending-b1",
    projectId: "brand-refresh",
    projectName: "Brand Refresh",
    projectPriority: "P1",
    title: "设计改稿可能影响两天排期",
    itemType: "risk",
    severity: "medium",
    recommendation: "先锁品牌首页，再延后次级页面。",
    impact: "如果继续扩展范围，项目交付会顺延。",
  },
];
```

- [ ] **Step 4: Implement the grouping utility**

```ts
// src/features/workbench/utils.ts
import type { PendingItem, ProjectPriority } from "./types";

const priorityRank: Record<ProjectPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const severityRank = {
  heavy: 0,
  medium: 1,
  light: 2,
};

export function groupPendingItems(items: PendingItem[]) {
  const grouped = new Map<string, { projectName: string; projectPriority: ProjectPriority; items: PendingItem[] }>();

  for (const item of items) {
    const current = grouped.get(item.projectId);
    if (current) {
      current.items.push(item);
      continue;
    }

    grouped.set(item.projectId, {
      projectName: item.projectName,
      projectPriority: item.projectPriority,
      items: [item],
    });
  }

  return [...grouped.values()]
    .sort((a, b) => priorityRank[a.projectPriority] - priorityRank[b.projectPriority])
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]),
    }));
}
```

- [ ] **Step 5: Run the utility test to verify it passes**

Run: `pnpm test src/features/workbench/utils.test.ts`
Expected: PASS.

### Task 3: Build the shared workbench store

**Files:**
- Create: `src/features/workbench/store.ts`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Write the failing integration test for selecting cards from the rail**

```tsx
// src/features/workbench/components/workbench-shell.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WorkbenchShell } from "./workbench-shell";

describe("WorkbenchShell", () => {
  it("shows details when a canvas card is selected", async () => {
    const user = userEvent.setup();
    render(<WorkbenchShell />);

    await user.click(screen.getByText("是否按推荐方案进入开发"));

    expect(screen.getByText("如果不处理，开发将暂停等待。"))..toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `pnpm test src/features/workbench/components/workbench-shell.test.tsx`
Expected: FAIL because the workbench components do not exist yet.

- [ ] **Step 3: Implement the shared store**

```ts
// src/features/workbench/store.ts
import { create } from "zustand";
import { canvasCards, mockPendingItems, railItems } from "./mock-data";
import type { CanvasCardRecord, PendingItem, RailItem } from "./types";

type WorkbenchState = {
  railItems: RailItem[];
  canvasCards: CanvasCardRecord[];
  pendingItems: PendingItem[];
  selectedCardId: string;
  selectCard: (cardId: string) => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  railItems,
  canvasCards,
  pendingItems: mockPendingItems,
  selectedCardId: "approval-1",
  selectCard: (cardId) => set({ selectedCardId: cardId }),
}));
```

- [ ] **Step 4: Run the component test to confirm it still fails on missing UI pieces**

Run: `pnpm test src/features/workbench/components/workbench-shell.test.tsx`
Expected: FAIL because the shell components are not implemented yet.

### Task 4: Build the workbench UI shell

**Files:**
- Create: `src/components/ui/pill.tsx`
- Create: `src/components/ui/panel.tsx`
- Create: `src/features/workbench/components/workbench-header.tsx`
- Create: `src/features/workbench/components/rail-section.tsx`
- Create: `src/features/workbench/components/conversation-rail.tsx`
- Create: `src/features/workbench/components/canvas-card.tsx`
- Create: `src/features/workbench/components/canvas-board.tsx`
- Create: `src/features/workbench/components/details-drawer.tsx`
- Create: `src/features/workbench/components/command-bar.tsx`
- Create: `src/features/workbench/components/workbench-shell.tsx`
- Test: `src/features/workbench/components/workbench-shell.test.tsx`

- [ ] **Step 1: Create the reusable primitives**

```tsx
// src/components/ui/pill.tsx
import clsx from "clsx";

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "warning" | "danger" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tone === "accent" && "bg-[var(--accent-soft)] text-[var(--accent)]",
        tone === "warning" && "bg-[rgba(182,90,40,0.12)] text-[var(--warning)]",
        tone === "danger" && "bg-[rgba(158,59,47,0.12)] text-[var(--danger)]",
        tone === "neutral" && "bg-[rgba(32,23,15,0.06)] text-[var(--muted)]",
      )}
    >
      {label}
    </span>
  );
}
```

```tsx
// src/components/ui/panel.tsx
import clsx from "clsx";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-[28px] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow)] backdrop-blur-sm", className)}>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Implement the workbench layout and child components**

```tsx
// src/features/workbench/components/workbench-shell.tsx
"use client";

import { useMemo } from "react";
import { useWorkbenchStore } from "@/features/workbench/store";
import { groupPendingItems } from "@/features/workbench/utils";
import { WorkbenchHeader } from "./workbench-header";
import { ConversationRail } from "./conversation-rail";
import { CanvasBoard } from "./canvas-board";
import { DetailsDrawer } from "./details-drawer";
import { CommandBar } from "./command-bar";

export function WorkbenchShell() {
  const railItems = useWorkbenchStore((state) => state.railItems);
  const canvasCards = useWorkbenchStore((state) => state.canvasCards);
  const pendingItems = useWorkbenchStore((state) => state.pendingItems);
  const selectedCardId = useWorkbenchStore((state) => state.selectedCardId);

  const selectedCard = canvasCards.find((card) => card.id === selectedCardId) ?? canvasCards[0];
  const pendingGroups = useMemo(() => groupPendingItems(pendingItems), [pendingItems]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <WorkbenchHeader />
      <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <ConversationRail railItems={railItems} pendingGroups={pendingGroups} />
        <CanvasBoard cards={canvasCards} selectedCardId={selectedCard.id} />
        <DetailsDrawer card={selectedCard} pendingGroups={pendingGroups} />
      </div>
      <CommandBar />
    </main>
  );
}
```

- [ ] **Step 3: Implement the remaining components to satisfy the test**

Code in these files should follow this responsibility split:
- `workbench-header.tsx`: top header with company name, goal, search pill, and CEO avatar block
- `conversation-rail.tsx`: left rail with sections `总经理汇报`, `部门协作`, `待处理事项`, `历史归档`
- `rail-section.tsx`: titled section shell for the rail
- `canvas-card.tsx`: card visuals with type, owner, status, summary, tags
- `canvas-board.tsx`: React Flow board with fixed lane labels and nodes derived from `canvasCards`
- `details-drawer.tsx`: selected card details plus grouped pending items preview
- `command-bar.tsx`: bottom floating command composer

Required behavior:
- clicking a rail item or canvas card updates the selected card via `selectCard`
- the selected approval card shows its impact text in the drawer
- layout works in a single column on small screens and 3 columns on xl screens

- [ ] **Step 4: Run the component test to verify it passes**

Run: `pnpm test src/features/workbench/components/workbench-shell.test.tsx`
Expected: PASS.

### Task 5: Add a smoke E2E test and verify the first version

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/workbench.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

```ts
// tests/e2e/workbench.spec.ts
import { test, expect } from "@playwright/test";

test("renders the CEO workbench shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("CEO 工作台")).toBeVisible();
  await expect(page.getByText("总经理汇报")).toBeVisible();
  await expect(page.getByText("是否按推荐方案进入开发")).toBeVisible();
});
```

- [ ] **Step 2: Add the Playwright config**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 3: Run the E2E test to verify the shell passes**

Run: `pnpm test:e2e`
Expected: PASS.

- [ ] **Step 4: Run final verification**

Run: `pnpm lint`
Expected: PASS.

Run: `pnpm test`
Expected: PASS.

Run: `pnpm build`
Expected: PASS.

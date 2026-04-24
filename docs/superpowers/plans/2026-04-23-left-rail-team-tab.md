# Left Rail Team Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `团队成员` tab to the left rail so the CEO can switch from chat threads to a compact, real-only org view that groups existing agents under each department.

**Architecture:** Keep the workbench shell layout unchanged and scope the new behavior to the left rail. Reuse the same rounded-box visual language as the conversation rail, but replace profile-style cards with department group blocks that list the existing agents inside each real department.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, Tailwind CSS, Vitest, Playwright

---

### Task 1: Reshape the team data for department grouping

**Files:**
- Modify: `src/features/workbench/types.ts`
- Modify: `src/features/workbench/mock-data.ts`
- Modify: `src/features/workbench/store.ts`

- [ ] Define a `LeftRailView` union plus lightweight department and agent types in `src/features/workbench/types.ts`.
- [ ] Replace the profile-card mock data in `src/features/workbench/mock-data.ts` with real department groups such as `CEO办公室` / `设计部` / `开发部`, each containing only the agents that actually exist.
- [ ] Extend the Zustand store in `src/features/workbench/store.ts` with `leftRailView` and `setLeftRailView`.

### Task 2: Add the failing grouped-view tests first

**Files:**
- Modify: `src/features/workbench/components/workbench-shell.test.tsx`
- Modify: `tests/e2e/workbench.spec.ts`

- [ ] Add a failing unit test proving the left rail renders `对话 | 团队成员` and can switch to the grouped team view.
- [ ] Add a failing unit test proving the grouped view shows department boxes like `CEO办公室`, `设计部`, `开发部` and nested agent names.
- [ ] Add a failing e2e test proving the CEO can click `团队成员` and see the grouped real-only departments without changing the center board.
- [ ] Run the targeted tests and confirm they fail for the expected missing-feature reason.

### Task 3: Implement the grouped team-members tab

**Files:**
- Modify: `src/features/workbench/components/conversation-rail.tsx`
- Modify: `src/features/workbench/components/workbench-shell.tsx`

- [ ] Keep the current conversation view intact under the `对话` tab.
- [ ] Replace the profile-card team view with department chat-style group blocks.
- [ ] Show only real departments and their nested agent names, without capability tags or current responsibility content.
- [ ] Preserve the existing `demo.jpg`-inspired styling so the grouped view feels like the same left-rail system as the conversation view.

### Task 4: Verify the feature end-to-end

**Files:**
- Verify only

- [ ] Run `npm test -- src/features/workbench/components/workbench-shell.test.tsx`.
- [ ] Run `npm test -- next.config.test.ts`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e`.

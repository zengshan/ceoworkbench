# Center Stage Redesign

Date: 2026-04-23
Status: Drafted from approved conversation direction

## Goal

Refactor the current CEO workbench so the main screen follows the wanman.ai reference much more closely:
- the left side remains the communication workspace
- the center becomes the single operational stage
- the right-side details panel is removed
- the bottom command bar is removed

The result should feel like a live company operating surface, not a dense dashboard.

## Product Intent

The CEO should open the page and immediately understand two things:
- what the company is doing this round
- what each department has already produced or is blocked on

The center stage should not try to show every type of operational metadata. It should only show the layer currently being inspected and keep the information sparse, visual, and management-readable.

## Scope

This redesign only covers the center and surrounding layout shell.

In scope:
- remove the right column
- remove the bottom command area
- replace the current center React Flow board with a layer-based stage
- add top-level layer switching for `CEO层` and department layers
- simplify the displayed content to match the approved V1 structure

Out of scope:
- left-rail behavior changes
- cross-view linking from team members into the center
- real backend persistence
- live multi-agent execution
- editing company strategy inline

## Recommended Approach

Use a single stage component with a shared visual frame and switch the content by active layer.

Why this approach:
- it matches the reference image better than keeping the current flowchart canvas
- it keeps the CEO mental model simple because each layer uses the same frame
- it reduces information density without losing the sense of work moving across the company
- it lets the implementation reuse the existing mock-data pattern while replacing only the center presentation model

Alternatives considered:
- keep React Flow and merely hide some cards: rejected because it still feels like a systems diagram rather than the calm story-board in the wanman.ai reference
- create fully different layouts per department: rejected because the switching experience would feel fragmented and harder to scan

## Layout Architecture

### Shell

The page becomes a two-column layout:
- left: `ConversationRail`
- center: `CenterStage`

Removed from the shell:
- `DetailsDrawer`
- `CommandBar`

The shell remains responsive, but desktop stays the primary target for this iteration.

### Center Stage

The center stage has three stacked regions:

1. Layer switcher
   - light segmented control
   - visible options include `CEO层`, `设计部`, `开发部`
   - active layer updates the stage content in place

2. Stage canvas
   - one large calm board with generous whitespace
   - contains a small number of cards and light relationship lines
   - no secondary dashboard banners, summary strips, or explanation copy

3. Optional stage footer metadata
   - omitted in V1 unless needed for very small labels such as current layer context
   - default is no extra footer copy

## Content Model

The center no longer renders generic cards grouped by technical lane. It renders curated layer scenes.

### Layer types

- `CEO层`
  - current-round progress cards
  - department summary cards
  - one or more decision / confirmation cards only when they are materially relevant

- `设计部`
  - internal design progress
  - current outputs
  - dependencies on CEO, the general manager, or development

- `开发部`
  - development readiness or execution status
  - current blockers
  - dependencies on design or management decisions

Additional departments can later reuse the same layer structure.

### Card semantics

Cards should read like operational notes or work artifacts, not KPI widgets.

Each card should contain only the minimum useful management context:
- title
- short body
- owner or source
- updated time
- optional linked artifact labels
- optional state chip when necessary

Cards should avoid:
- dense metric grids
- repeated labels
- generic dashboard phrasing
- redundant descriptions already visible in the left-side conversations

## Visual Structure

The stage should mimic the feeling of the wanman.ai reference:
- off-white spacious background
- soft board boundaries
- lightly rotated or staggered cards where helpful
- sparse connectors between meaningful handoffs
- no heavy panel chrome

The board should feel inspectable but not noisy. Empty space is intentional.

Visual hierarchy:
- first: active layer and the main cards
- second: movement between cards
- third: timestamps and supporting labels

## Interaction Model

### Layer switching

- default active layer is `CEO层`
- switching layers keeps the user on the same page and reuses the same board shell
- the transition should feel light and direct, not like a route change

### Card interaction

V1 card interaction stays minimal:
- hover can raise a card slightly
- click can mark a card selected for visual emphasis
- clicking a card does not open a right drawer

If deeper context is needed, the user uses the left rail conversation for that person or department.

## Data Model Changes

Introduce a stage-oriented model separate from the existing flowchart lane model.

Suggested shape:
- `StageLayer`
  - `id`
  - `label`
  - `kind`
  - `cards`
  - `connections`

- `StageCard`
  - `id`
  - `layerId`
  - `title`
  - `body`
  - `owner`
  - `updatedAt`
  - `statusLabel?`
  - `artifactLabels?`
  - `position`
  - `rotation?`
  - `accent?`

- `StageConnection`
  - `id`
  - `from`
  - `to`
  - `label?`

The store should track:
- available stage layers
- active stage layer id
- optional selected stage card id

The existing mock data can remain the source of truth for the left rail, while the center gets its own curated `stageLayers` dataset.

## Component Changes

### `src/features/workbench/components/workbench-shell.tsx`

- remove `DetailsDrawer`
- remove `CommandBar`
- render a two-column layout
- pass stage data and active layer state into the new center component

### `src/features/workbench/components/canvas-board.tsx`

Replace the current React Flow implementation with a stage renderer that:
- shows the layer switcher
- renders the active layer's cards on a fixed board
- draws simple connectors with lightweight absolute-positioned elements or SVG

The file may keep the same exported component name if that reduces churn, but its role changes from flow diagram to story-board stage.

### Supporting components

Create small focused components if needed:
- `stage-layer-switcher.tsx`
- `stage-scene.tsx`
- `stage-card.tsx`

This helps keep `canvas-board.tsx` from becoming another overloaded file.

## Data Flow

1. Store initializes with mock `stageLayers` and `activeStageLayerId = ceo`
2. `WorkbenchShell` reads the active layer state
3. `CanvasBoard` renders only the active layer scene
4. User switches layer
5. Store updates `activeStageLayerId`
6. Center stage rerenders with the new department scene

The left rail does not need to update in response during this version.

## Error Handling and Empty States

This is still a local prototype, so error handling stays light but explicit.

- if the active layer id is missing, fall back to `CEO层`
- if a layer has no cards, show a very small empty-state note inside the board
- if connections reference missing cards, skip drawing those connectors

The UI should fail quietly rather than breaking the page.

## Testing Strategy

### Component tests

Update `src/features/workbench/components/workbench-shell.test.tsx` to verify:
- `CEO层` is the default layer
- the right drawer is absent
- the bottom command bar is absent
- switching to `设计部` shows design-scene content
- switching to `开发部` shows engineering-scene content

### End-to-end tests

Update `tests/e2e/workbench.spec.ts` to verify:
- the layer switcher is visible
- the default board is the CEO scene
- clicking department layers updates the central stage
- removed UI areas no longer appear

## Acceptance Criteria

- the page renders as two columns with no right-side drawer
- the page has no bottom command bar
- the center defaults to `CEO层`
- the center supports switching to department layers in place
- `CEO层` only shows current-round progress and department summaries
- department layers only show internal progress and cross-team dependencies
- the visual density is noticeably lower than the current dashboard-style board
- the central experience feels closer to the wanman.ai reference than the current React Flow layout

## Risks and Guardrails

Main risk: overbuilding the center scene back into another dashboard.

Guardrails:
- keep card count low per layer
- remove explanatory filler copy
- avoid adding side summaries outside the stage
- treat whitespace as part of the design, not unused area

Second risk: losing useful context by simplifying too much.

Guardrail:
- preserve management-readable summaries inside the cards themselves, and rely on the left conversation rail for deeper detail

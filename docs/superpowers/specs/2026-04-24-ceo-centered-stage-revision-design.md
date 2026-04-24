# CEO-Centered Stage Revision

Date: 2026-04-24
Status: Drafted from approved visual + terminal feedback

## Goal

Revise the current center-stage design so it follows `demo.jpg` more closely than the current "single active layer" interpretation.

The main change is structural:
- the stage is no longer treated as a one-layer-at-a-time board
- the CEO stays at the center of a persistent company relationship scene
- other departments remain visible around the CEO as smaller clustered groups
- switching departments changes the camera focus, not the page model

The result should feel like one living company wall whose focus moves, not a tab panel that swaps scenes.

## Product Intent

The CEO should always feel like they are looking at one operating company, not entering isolated department views.

At a glance, the center stage should communicate:
- who is currently in focus
- which departments are already active around that focus
- how work flows between those departments
- how the company still relates back to the CEO

The center stage should feel simpler than a dashboard but more connected than the current center implementation.

## Approved Direction

This revision follows the visual direction we converged on in discussion:
- use the `B2` direction as the base
- keep the CEO in the middle for the default view
- arrange surrounding departments as small clustered cards around the CEO
- preserve visible relationship lines between groups
- when a department is clicked, shift the viewpoint so that department becomes the main center cluster
- do not completely remove the CEO from view after focus changes

This is intentionally closer to the "story wall" feel from `demo.jpg` than the current stage.

## Scope

In scope:
- redesign the center-stage spatial model
- replace the current "one dominant layer at a time" presentation
- keep a persistent surrounding organization view on stage
- update the stage interaction model from tab-like switching to camera-like focus movement
- update tests and mock data to fit the new scene contract

Out of scope:
- left-rail concept changes
- auth, persistence, or backend integration
- new departments beyond the current real organization
- creation flow

## Persistent Stage Model

The stage should always show one company wall with four persistent organizational clusters:
- CEO
- 总经理
- 设计部
- 开发部

No additional always-visible cluster should be added for:
- 决策事项
- 关键事项
- system metadata

Those may still exist as card content inside a cluster, but they should not become separate long-lived stage regions.

## Default CEO View

The default view opens with:
- CEO as the center cluster
- 总经理, 设计部, 开发部 arranged around it
- visible relationship lines connecting the active work flow

This center view should feel like "the company around the CEO," not "the CEO tab."

The surrounding clusters should not collapse to a single status chip. Each department should read as a small card group, more like the distributed piles in `demo.jpg`.

## Cluster Composition

Each non-central organization group should render as a compact cluster of two to three small cards.

Examples:
- 总经理 cluster
  - current judgment
  - current report
  - current request or coordination state

- 设计部 cluster
  - internal progress
  - handoff to development
  - optional design artifact/status card

- 开发部 cluster
  - internal progress
  - current blocker
  - optional readiness / next-step card

The center cluster may be slightly larger than the surrounding clusters, but the whole scene should still feel like one board instead of one huge panel plus side widgets.

## Focus Shift Behavior

Clicking a department does not replace the stage with a new standalone page.

Instead, it should behave like a focus shift:
- the selected department becomes the new center cluster
- the CEO remains visible in the scene as a smaller secondary cluster
- the other departments remain visible in compressed form
- relationship lines remain present so the handoff chain still reads clearly

This means the stage always preserves context.

The intended feeling is:
- same board
- same company
- same relationships
- different focal point

## Compression Rules

When a cluster is not the current focus, it should be compressed rather than removed.

Compressed state should:
- keep the cluster visible
- keep its relationship lines visible
- keep enough card structure to preserve identity
- reduce visual weight compared with the focused cluster

Compressed state should not:
- disappear fully
- turn into unrelated badges
- lose all cluster structure

This is important because the user explicitly wants the relationships to stay readable even while focusing on one department.

## Visual Hierarchy

The hierarchy should now be:
1. focused cluster
2. CEO or department clusters surrounding it
3. relationship lines
4. small metadata inside cards

Compared with the current implementation, the revision should:
- reduce the feeling of a flat tab switcher
- increase the feeling of spatial company structure
- keep the board sparse and readable
- look more like a pinned wall than a dashboard grid

## Layer Switcher Semantics

The existing top switcher can remain as a fast navigation aid, but it should no longer imply that each option is an isolated page.

It now means:
- "move focus to this organization cluster"

The switcher remains useful for speed, but the stage itself should communicate continuity more strongly than the switcher does.

## Data Model Changes

The current `StageLayer` model is too isolated for this revision because each layer is treated as a self-contained scene.

The revised center stage should move toward a focus-based model.

Suggested shape:
- `StageFocusId`
  - `ceo`
  - `manager`
  - `design`
  - `engineering`

- `StageCluster`
  - `id`
  - `label`
  - `cards`
  - `positionByFocus`
  - `connections`

- `StageCard`
  - keep current card semantics
  - allow `size` or `density` hints if useful for focused vs compressed rendering

Instead of "render the active layer only," the renderer should:
- render all current clusters
- choose one cluster as focused
- position and size each cluster based on the active focus

This better matches the approved interaction model.

## Renderer Changes

The current renderer already has useful building blocks:
- `StageCard`
- `StageScene`
- `StageLayerSwitcher`

But `StageScene` needs to evolve from:
- one layer with cards

to:
- one full company scene with multiple clusters
- cluster positions that change by focus
- persistent connectors across the whole wall

The next implementation should prefer:
- focused cluster containers
- smaller cluster wrappers for surrounding departments
- connection drawing across cluster anchors instead of single-card-only assumptions

## Testing Changes

Component and e2e tests should stop thinking in terms of "only one layer exists at a time."

They should verify:
- CEO is central by default
- surrounding clusters remain visible in the default view
- clicking `设计部` moves design into focus
- CEO remains visible after focus shifts
- non-focused clusters compress instead of disappearing
- relationship context is preserved while focus moves

## Acceptance Criteria

- default view centers the CEO
- 总经理, 设计部, 开发部 remain visible around the CEO in clustered form
- each surrounding department is expressed as a 2-3 card cluster rather than a single summary tile
- relationship lines remain visible in the default CEO view
- clicking a department shifts focus instead of replacing the whole scene
- after focus shift, CEO remains visible as a smaller secondary cluster
- non-focused departments remain visible in compressed form
- no persistent extra cluster is introduced for decisions or system metadata
- the stage feels closer to `demo.jpg` than the current single-layer stage

## Risks and Guardrails

Main risk: the revision drifts back into a dense graph diagram.

Guardrails:
- keep only real departments visible
- keep card count low per cluster
- avoid adding separate "system" clusters
- preserve whitespace between clusters

Second risk: the focus shift feels like a cheap resize instead of a meaningful camera move.

Guardrails:
- define explicit focused vs compressed cluster layouts
- keep CEO present after department focus
- preserve connections so the scene still reads as one wall

Third risk: the switcher visually contradicts the stage model.

Guardrail:
- treat the switcher as a shortcut only
- make the board continuity visually stronger than the tab metaphor

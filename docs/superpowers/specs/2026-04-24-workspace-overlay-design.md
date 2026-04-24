# Workspace Overlay Design

Date: 2026-04-24

## Goal

Replace the always-visible left work rail with a larger, on-demand communication workspace so the CEO's default view stays focused on the company stage, while conversations get a dedicated, higher-quality interaction surface when opened.

## Why This Change

The current layout makes the communication area permanently consume horizontal space, even when the CEO is primarily inspecting the company wall. That works against the product's core value: the stage is the main operating view, and communication is a secondary mode entered when needed.

The new model should feel like this:

- Default mode: look at the company
- Communication mode: enter a dedicated communication room
- Switching between the two should be clear, reversible, and visually calm

## Approved Product Decisions

- The center stage remains the default homepage and should expand to effectively own the screen width.
- The current left work area becomes an on-demand overlay opened from a floating `工作区` button.
- The `工作区` entry sits at the bottom-right and is the primary floating action.
- The existing configuration button stays at the bottom-left in default mode.
- When the workspace opens, the stage stays behind as a blurred presence only; attention returns to communication.
- The workspace uses a centered large panel, not a slide-out drawer.
- The workspace panel keeps visible outer margins so the user still senses the stage behind it.
- The overlay keeps two modes in the left column: `对话` and `团队成员`.
- The right column shows the active conversation.
- The conversation header does not show status pills such as `阻塞`, `已提交`, or `2 项待确认`.
- The workspace should reopen to the last visited conversation when possible; otherwise it defaults to `CEO 和总经理的聊天`.
- Stage focus and workspace state stay independent.

## Scope

### In Scope for V1

- Remove the always-visible left rail from the default shell layout.
- Expand the center stage to become the primary full-width operating area.
- Add a floating `工作区` entry button with unread indicator support.
- Add a centered workspace overlay with blurred stage backdrop.
- Reuse the existing conversation data and team-member data inside the overlay.
- Support `对话 / 团队成员` switching inside the overlay.
- Show the current conversation in a dedicated right pane with a bottom input area.
- Preserve last-opened conversation and current workspace tab between opens.
- Keep the current stage scene untouched as the default operating surface.

### Explicitly Out of Scope for V1

- Real message sending or persistence beyond current local mock/store behavior
- Auto-linking stage focus to matching conversations
- A new notification center
- Nested overlays or multi-window communication flows
- Reworking the underlying org or conversation data model

## User Experience

### Default State

- The CEO lands on the company stage immediately.
- The company wall occupies the main horizontal canvas.
- A small configuration button remains at bottom-left.
- A larger `工作区` floating button remains at bottom-right.
- If unread items exist, the workspace button shows a red dot or unread count.

### Opening the Workspace

- Clicking `工作区` opens a communication overlay.
- The stage behind it softly blurs and visually recedes.
- The configuration button hides while the overlay is open.
- The overlay appears as a centered, large, rounded panel with clear margins around it.
- The motion should feel like the communication layer rises in front of the stage, not like a utility drawer slides in.

### Workspace Structure

- Left column = navigation and switching
  - `对话 / 团队成员` segmented control
  - conversation list when on `对话`
  - department/agent list when on `团队成员`
- Right column = active communication context
  - clean conversation title only
  - message stream
  - bottom input area

### Closing the Workspace

- Close button in the panel header
- click on the backdrop
- `Esc`
- clicking the `工作区` floating button again

Closing returns the user to the same stage view and focus they had before opening.

## Interaction Model

The product now has two explicit modes:

1. Stage mode
   - inspect the company wall
   - switch organization focus
   - stay visually uninterrupted

2. Communication mode
   - talk to the general manager or departments
   - switch to team-members view
   - keep enough space for real conversation reading and writing

These modes are siblings, not nested inside each other. The stage does not become a tab inside the workspace, and the workspace does not permanently occupy the stage shell.

## Architecture

### Shell Responsibilities

`WorkbenchShell` becomes the top-level coordinator for:

- stage rendering
- floating controls
- workspace open/close state
- overlay composition

The shell should no longer be a fixed two-column layout in default state.

### Proposed Component Boundaries

- `WorkbenchShell`
  - owns overall mode composition
  - renders stage, floating controls, and overlay
- `WorkspaceFab`
  - bottom-right primary floating button
  - shows unread indicator
  - toggles workspace visibility
- `WorkspaceOverlay`
  - renders backdrop, panel, transitions, close affordances
- `WorkspaceSidebar`
  - left side of the overlay
  - handles `对话 / 团队成员` switch
  - renders either conversation list or team-member list
- `WorkspaceConversationPane`
  - right side of the overlay
  - renders title, messages, and input area
- `WorkspaceTeamList` or equivalent internal sidebar section
  - reused within sidebar when `团队成员` is active

The existing stage components remain responsible only for the stage.

## State Model

The following state is required in the store:

- `workspaceOpen: boolean`
- `workspaceView: 'conversations' | 'team'`
- `selectedThreadId: string | null`
- `lastWorkspaceThreadId: string | null`
- `workspaceUnreadCount: number`

The following existing state stays independent:

- `activeStageFocusId`
- `selectedStageCardIds`

### State Rules

- Opening the workspace restores `lastWorkspaceThreadId` if available.
- If no prior workspace thread exists, select the manager conversation.
- Switching between `对话` and `团队成员` must not clear `selectedThreadId`.
- Closing the workspace does not reset stage focus.
- Stage focus changes do not implicitly change workspace conversation.

## Data Reuse Strategy

V1 should reuse existing store-backed mock data:

- `conversationThreads`
- `chatMessages`
- `teamDepartments`

This avoids a risky rewrite and keeps the iteration focused on layout and hierarchy rather than data-model churn.

## Visual Design Direction

### Workspace Button

- Primary floating action at bottom-right
- More like a calm capsule than a small utility icon
- Visible in default state even without unread items
- Unread indicator should be obvious but restrained

### Overlay Panel

- Centered large panel
- Stronger rounding than the stage frame
- Warm paper-like surface consistent with the existing design system
- Enough margin around the panel to preserve the feeling of entering a distinct communication layer

### Backdrop

- Stage remains visible only as blurred atmospheric context
- Backdrop should not go dark-black modal
- Use a soft warm-gray veil so communication feels elevated, not blocked by a harsh system modal

### Conversation Header

- Show the conversation title
- Optionally allow a very light subtitle such as participant context if needed later
- No status pills in this area

## Accessibility and Behavior Details

- `Esc` closes the workspace
- backdrop click closes the workspace
- focus should move into the overlay when opened
- focus should return to the `工作区` trigger when closed
- the overlay should trap focus while open
- scroll should remain contained correctly inside the sidebar and message pane
- the background stage should not capture pointer events while the overlay is open

## Error Handling and Edge Cases

- If there is no selected conversation, fall back to the manager thread.
- If the selected thread no longer exists, fall back to the manager thread.
- If unread count is zero, the workspace button still appears without badge emphasis.
- If there are many team members or long message history, each pane scrolls independently without stretching the overlay off-screen.
- On smaller screens, the same overlay model should degrade to a narrower stacked layout, but mobile polish is secondary to desktop quality in V1.

## Testing Strategy

### Unit / Component Tests

- default shell renders stage without the old persistent left rail
- workspace floating button is visible in default state
- opening workspace shows overlay and hides configuration button
- closing via backdrop, close button, and repeated trigger works
- `Esc` closes the workspace
- overlay restores last-opened thread
- first-open fallback selects `CEO 和总经理的聊天`
- switching between `对话` and `团队成员` does not lose the selected conversation
- right conversation pane does not render status tags in the header
- stage focus remains unchanged when opening and closing workspace

### End-to-End Tests

- CEO lands on stage-first layout with floating workspace entry
- opening workspace reveals blurred stage backdrop and centered panel
- switching conversations updates the right pane
- switching to `团队成员` shows departments and agents in the left pane
- closing the overlay returns the user to the same stage view

## Acceptance Criteria

- The default page is visually dominated by the stage, not a persistent left rail.
- A bottom-right `工作区` control is always available.
- Opening the workspace gives materially more room for conversations than the old inline rail.
- The stage remains recognizable but visually subdued behind the overlay.
- The workspace feels like entering a communication room, not opening a utility drawer.
- The user can switch between conversations and team members from the left pane.
- The active conversation occupies the right pane with title, messages, and input only.
- No status pills appear in the conversation header.
- Closing the workspace cleanly returns the user to the original stage context.

## Implementation Notes

- Prefer reorganizing existing conversation UI pieces before redesigning their content model.
- Reuse current message bubble styling where possible.
- Keep the first pass structurally clean so later work can add approvals, richer conversation affordances, and deeper manager workflows without redoing the shell again.

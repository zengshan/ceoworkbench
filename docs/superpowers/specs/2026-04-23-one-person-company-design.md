# One-Person Company CEO Operating System Design

Date: 2026-04-23
Status: Approved in conversation, written for review

## 1. Product Positioning

This product is not a generic multi-agent chat tool. It is a CEO operating system for a one-person company.

The user acts as the CEO of one or more AI-native companies. Each company exists to pursue one concrete goal. The user does not primarily manage individual agents. Instead, the user manages the company through a general manager, intervenes at key moments, and oversees the company through a live operational workspace.

The target experience should follow the working logic shown in `demo.jpg`:
- a conversation area for executive communication
- a central company operation canvas showing work in motion
- a command input area for CEO instructions

The goal is to make the user feel like they are operating a company, not juggling disconnected agent sessions.

## 2. Core Operating Model

### 2.1 CEO role

The CEO mostly issues project-level tasks and high-level direction.

The CEO is responsible for:
- defining direction
- assigning broad project goals
- reviewing company state
- reading management summaries
- approving key decisions
- intervening directly when necessary

The CEO is not responsible for:
- manually breaking work into fine-grained execution tasks
- directly coordinating all agents by default
- reading raw execution logs unless they choose to drill in

### 2.2 General manager role

The default management entry point is a single general manager.

The CEO primarily interacts with the general manager. The general manager receives high-level project requests and translates them into company actions:
- defining project goals more concretely
- breaking projects into stages and tasks
- assigning work across departments
- creating and tracking deliverables
- deciding what can proceed autonomously
- escalating key issues back to the CEO

The general manager has medium autonomy:
- routine execution and coordination can proceed without approval
- major direction changes, important deliverable approvals, cross-department conflicts, and major risks must be escalated to the CEO

The general manager must not act as a relay only. For any escalation, it should provide:
- the current situation
- risk assessment
- recommended options
- the suggested decision
- the action that depends on CEO approval

### 2.3 Department access

The CEO can directly talk to departments such as design or engineering when needed.

However, this is an intervention path, not the default operating mode. When the CEO gives a direct instruction to a department, the system must keep the general manager informed and fold that intervention back into the main operating chain.

## 3. Day-to-Day CEO Workflow

When the CEO opens the system, they should not need to ask what is going on. The company state should already be visible.

The day-to-day workflow should support two common starting points:
- issue a new project-level task to the general manager
- inspect the state of an existing project, department, deliverable, or pending approval

A typical flow looks like this:
1. CEO gives a project-level instruction.
2. The general manager interprets the request and structures it into project objects.
3. The general manager dispatches work to design, engineering, or other departments.
4. Departments create deliverables and status updates.
5. The general manager reports progress in management-readable form.
6. Key decisions are escalated to the CEO.
7. The CEO approves, redirects, pauses, or intervenes.
8. The company continues operating based on that decision.

The CEO experience should center on:
- issuing project directives
- seeing the live operating state
- reading the general manager's summaries
- approving key decisions
- drilling into details only when needed

## 4. Main Interface Shape

The main interface should follow the working pattern of `demo.jpg`, not a conventional dashboard.

### 4.1 Left side: conversation rail

The left side contains executive and departmental conversations. It should include:
- the main `CEO <-> General Manager` conversation
- department-level conversations such as design and engineering
- threads for unusual situations, escalations, or project-specific topics
- visible states like active, paused, waiting for approval, or complete

This area is for communication, but those conversations should be linked to real company objects rather than being isolated message streams.

### 4.2 Center: company operation canvas

The center of the screen is the core operational surface. It should show the company in motion.

This canvas should represent:
- project cards
- task cards
- deliverable cards
- approval cards
- report or status cards
- their relationships and movement across departments or roles

The canvas should be organized spatially by role or department, such as:
- CEO area
- General Manager area
- Design area
- Engineering area

The purpose of the canvas is to let the CEO understand at a glance:
- what is in progress
- where the ball is
- what is blocked
- what requires executive attention

### 4.3 Bottom: CEO command bar

The bottom input area is a CEO command bar.

The default usage is not "create agent". The default usage is "give the company a project-level instruction".

A single message from the CEO should trigger company actions through the general manager and update the operating state on the canvas.

## 5. Operational Objects on the Canvas

The canvas must display formal operating objects, not loose notes.

The minimum object set for V1 is:
- Project
- Task
- Deliverable
- Approval
- Report

Each object should carry minimum management semantics, including at least:
- origin or source
- current owner
- department or role
- current state
- linked deliverables
- upstream and downstream dependencies
- latest executive decision or conclusion

Relationships between objects matter as much as the objects themselves. The system should show:
- who handed work to whom
- which deliverable came from which task
- which approval changed the next step
- which block is holding up which chain

A representative flow should look like:
- CEO issues a project instruction
- General manager creates project and task structure
- work moves to design
- design creates deliverables
- general manager creates a report or approval request
- CEO responds
- work moves to engineering or the next phase

## 6. Conversation and Canvas Integration

Conversations and the canvas must operate on the same underlying objects.

Chat is the language interface to drive work and explain state. The canvas is the visual operating layer that shows the state of the company.

Typical mappings include:
- CEO gives a task -> create or update a project object
- general manager submits a summary -> create or update a report object
- a department submits work -> attach or update a deliverable object
- CEO approves or redirects -> update an approval object and change downstream flow

The product should avoid forcing the CEO to read raw agent logs by default. The default view should surface management-level summaries, with deeper execution detail available only on demand.

## 7. Org Structure and Agent Model

This system should model a company, not a flat swarm of agents.

The core operating hierarchy is:
- CEO
- management layer
- execution layer

For V1, the minimum viable structure is:
- one CEO
- one general manager
- a design function
- an engineering function

Agents should not be treated as anonymous model sessions. Each agent should have organizational identity and role definition, including:
- department
- role and responsibility
- task types they are suited for
- deliverable types they can produce
- reporting line
- conditions for autonomous action vs escalation

In the future, "recruiting an agent" should mean adding a new role or team capability into the company structure, not simply spawning another unnamed assistant.

## 8. Approval and Escalation Model

Approval must be tiered. The CEO should only spend attention on matters that cross a management boundary.

The system should support at least three approval object types:
- decision recommendation approvals
- deliverable approvals
- next-step action approvals

Approvals should be split into light and heavy categories.

Light approvals:
- small design or execution confirmations
- minor direction adjustments
- low-risk resource changes

Heavy approvals:
- major direction shifts
- large rework decisions
- launch or release decisions
- replacing a responsible agent or role
- major cross-department conflicts
- significant risk escalations

Every escalation sent to the CEO should answer:
- what happened
- why this now needs CEO attention
- what the available options are
- what the likely consequences are
- what the general manager recommends

The CEO should have richer actions than just approve or reject. Minimum executive responses should include:
- approve and continue
- reject and rework
- pause pending more information
- change direction and continue
- intervene personally

Once a CEO decision is made, it must immediately affect the operating state on the canvas and the next downstream work.

## 9. Company Creation and Infrastructure Model

The product must support multiple companies owned by one user.

The top-level structure is:
- one user account
- multiple companies under that account
- each company as an independent sandbox workspace
- each company oriented around one concrete goal

### 9.1 Authentication

GitHub should be the primary login method.

GitHub serves two roles:
- identity entry point
- default storage foundation

### 9.2 Company-to-storage mapping

For V1, the recommended storage model is:
- one company = one dedicated GitHub repository

This is preferred because it matches the company's sandbox boundary and keeps each company's knowledge and operating history isolated.

Each company repository becomes the default home for:
- company knowledge
- documents and deliverables
- agent or role rules
- approval history
- execution traces and summaries
- company-specific context

### 9.3 Company creation flow

The recommended creation flow is:
1. User logs in with GitHub.
2. User creates a company.
3. User fills in company name, goal, and optional description.
4. User chooses a default model runtime. `Codex` is the default.
5. The system creates a dedicated repository under the user's GitHub account.
6. The system initializes the company's sandbox runtime.
7. The system scaffolds the initial org structure: CEO, general manager, design, and engineering.
8. The user enters that company's CEO operating workspace.

### 9.4 Model configuration

The model choice is a company-level runtime default, not just a per-agent toggle.

In V1:
- `Codex` is the default runtime
- future versions can support multiple models per company or per role
- V1 should avoid overcomplicating model orchestration

### 9.5 Sandbox isolation

Each company is an independent sandboxed operating environment.

That means:
- company knowledge is isolated by default
- agents, approvals, tasks, and canvas state are isolated by default
- one company's context should not pollute another company's context unless explicitly enabled in the future

A company is therefore not just a tab. It is a full operating container.

## 10. V1 Scope and Non-Goals

V1 should focus on one outcome: making a one-person AI company feel real and governable.

V1 should solve these problems:
- the CEO can assign a project-level task to a general manager
- the general manager can break down work and coordinate design and engineering
- the CEO can see company state and management summaries in one workspace
- key issues can be escalated and approved clearly

V1 should stay intentionally narrow.

Recommended V1 scope:
- one CEO
- one general manager
- design and engineering as the first two departments
- one company per dedicated repo
- one central operation canvas
- one executive conversation rail
- tiered approvals

Non-goals for V1:
- full OKR or KPI systems
- finance, HR, CRM, and full enterprise back-office tooling
- many departments at launch
- unrestricted long-horizon agent autonomy
- highly granular enterprise permissions
- complex cross-company sharing or memory blending
- free-form agent social interactions that bypass org structure

## 11. Recommended Product Direction

Among the design options discussed, the recommended interaction model is a dual-center system:
- management summaries and decisions through the general manager conversation rail
- live situational awareness through the central company operation canvas

This is preferred over a chat-first system because the user explicitly needs to both:
- see the state of the company at a glance
- receive active reporting from the general manager

This is also preferred over a canvas-only system because the company still needs a strong management chain and a natural-language executive control surface.

So the recommended final direction is:
- conversation as the decision and instruction layer
- canvas as the operational state layer
- company objects as the shared source of truth

## 12. Success Criteria for V1

V1 is successful if the user can do the following with one real project:
- give the company a project-level task
- watch the general manager break it down
- see design and engineering work appear in a live operating view
- understand what is happening without manually chasing every agent
- approve or redirect key decisions with confidence
- feel that they are operating a company, not coordinating a pile of chats

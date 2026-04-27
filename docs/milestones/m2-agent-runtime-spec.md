# M2 Agent Runtime Spec

## Goal

Build a CLI-first TypeScript agent supervisor runtime that can run a one-person company for long-running goals. The runtime must support structured agent coordination, persistent memory, sandboxed execution, report generation, and low-frequency CEO intervention.

The existing Web workbench is treated as a future client. M2 focuses on the backend runtime and CLI experience.

## Product Shape

The system is a company operating runtime, not a chat app.

A CEO creates a company with a goal, configures agents, sends steer/follow-up messages, watches the company run, reads structured reports, and only intervenes for high-leverage decisions.

For a long-running task such as publishing a novel, the expected shape is:

- The CEO gives a high-level company goal.
- The manager agent breaks the goal into tasks and artifacts.
- Supervisor schedules short-lived agent runs over many hours or days.
- Agents produce artifacts, reports, reviews, and memory entries.
- Reporter turns raw events into CLI-visible management reports.
- CEO handles decision briefings only when needed.

The runtime should allow a company to run for hundreds of hours through many recoverable short runs. It should not rely on one long-running agent process.

## Core Principles

- CLI-first: runtime is controlled by commands, not by Web API request lifecycles.
- TypeScript-first: CLI, supervisor, scheduler, runtime, sandbox launcher, and reporter are written in TypeScript.
- Supervisor-centered: agents do not directly own scheduling or global state.
- Event-driven: all important runtime facts are appended as events.
- Postgres-backed: Postgres is the source of truth for messages, runs, tasks, artifacts, reports, and memory.
- Podman-sandboxed: agent execution happens in short-lived rootless Podman containers.
- Generic runtime first: CEO, manager, and departments are product semantics on top of generic agents.
- Reporter is first-class: watch/status/report are required for CEO oversight and long-running work.

## System Boundary

```text
packages/cli
  Command entry points and terminal rendering

packages/supervisor
  Scheduler, run queue, priority delivery, leases, retries, recovery

packages/runtime
  AgentAdapter, AgentRunEvent, context builder, model adapter boundary

packages/sandbox-podman
  Rootless Podman sandbox launcher and sandbox profiles

packages/storage
  Storage interface, Postgres adapter, schema, migrations

packages/reporter
  Watch/status/report projections and renderers

apps/web
  Future CEO workbench client, not the M2 runtime center
```

## Core Objects

### Company

Represents a goal-oriented company workspace.

Fields should include id, name, goal, status, workspace path, created/updated timestamps.

### Agent

Generic runtime actor.

The manager is not a special table. It is an agent with role `manager`, lifecycle `on_demand`, and capabilities such as `chat`, `plan`, `report`, and `memory.write`.

### Message

CEO or agent communication. Messages are not the only source of truth, but they are part of the user-visible feed.

Message types:

- `steer`: high-priority CEO direction, may interrupt or supersede current work.
- `follow_up`: lower-priority context, generally appended without interruption.

### Run

A short-lived agent execution unit.

Runs are queued, leased, executed in a sandbox, emit events, update state, and then exit.

Run states:

- `queued`
- `leasing`
- `running`
- `completed`
- `failed`
- `retrying`
- `blocked`
- `cancelled`

### RunEvent

Append-only runtime facts used for watch, recovery, audit, report generation, and future board projection.

Examples:

- `message_created`
- `run_queued`
- `run_leased`
- `run_started`
- `agent_event_emitted`
- `artifact_created`
- `task_created`
- `decision_required`
- `memory_updated`
- `report_created`
- `run_completed`
- `run_failed`

### Task

Structured unit of work. A task is not just a prompt.

Fields should include objective, expected output, assigned agent, dependencies, input artifacts, output artifacts, review requirements, status, priority, and timestamps.

### Artifact

Durable work product such as a plan, report, manuscript chapter, design brief, code file, or review document.

Artifacts must track producing run, producing agent, path, type, status, and review state.

### MemoryEntry

Persistent company memory. The system learns company goals, decisions, facts, lessons, and project summaries rather than CEO-pleasing preferences.

Memory should be created from stable reports, decisions, accepted artifacts, and completed phases.

### Report

Structured management report generated from events, tasks, artifacts, runs, and memory.

Report types:

- `status`
- `heartbeat`
- `progress`
- `decision_briefing`
- `failure`
- `phase`
- `completion`
- `agent_activity`
- `artifact_index`
- `execution_report`
- `review_report`
- `acceptance_report`
- `handoff_report`

## Scheduling Model

The scheduler is Postgres-backed and lease-based.

Rules:

- Same company allows at most one running manager run at a time.
- Different companies can run in parallel.
- `steer` messages have higher priority than follow-ups.
- CEO decisions have high priority.
- Recovery runs outrank normal continuations.
- Reflection/reporting runs are lower priority.
- Each run has a lease and timeout.
- Expired running runs can be recovered.
- A run has a maximum retry count.
- Agents cannot create unbounded continuations.

Priority order:

1. CEO steer
2. CEO decision
3. Recovery
4. Manager continuation
5. Reflection/reporting

## Agent Lifecycle

M2 uses `on_demand` lifecycle.

Each step:

1. Supervisor leases a queued run.
2. Context builder gathers relevant messages, tasks, artifacts, memory, and reports.
3. Podman sandbox starts a short-lived container.
4. Agent adapter executes one step.
5. Agent emits structured `AgentRunEvent` values.
6. Supervisor persists events, artifacts, tasks, reports, and memory.
7. Run completes, fails, blocks, retries, or creates a bounded continuation.

Future lifecycle `24_7` can be added later for autonomous monitoring, but not in M2.

## Sandbox Model

Execution uses rootless Podman.

Sandbox rules:

- No Docker daemon dependency.
- No access to Podman socket from agents.
- One short-lived container per run.
- Per-company workspace.
- Per-run HOME.
- No host-sensitive mounts.
- Default no network, or explicitly allowed network capability.
- Resource limits for CPU, memory, pids, output size, and run duration.
- Business state is never stored only in the container.

If an agent runs a destructive command, damage should be contained to the allowed sandbox view or company workspace. Memory and event history remain in Postgres.

## Reporter Model

Reporter is a projection layer, not log printing.

Inputs:

- messages
- runs
- run_events
- tasks
- artifacts
- memory_entries
- reports

Outputs:

- terminal rendering
- structured report record
- markdown/json artifact
- `report_created` event

CLI commands:

- `ceoworkbench status`
- `ceoworkbench watch`
- `ceoworkbench report`
- `ceoworkbench report --run latest`
- `ceoworkbench report --agent <agent>`
- `ceoworkbench report --artifacts`
- `ceoworkbench report --decisions`
- `ceoworkbench report --format markdown`
- `ceoworkbench decide <decision-id> --option <option>`

Report attention levels:

- `info`
- `notice`
- `requires_decision`
- `warning`
- `critical`
- `completed`

`watch` is chronological event stream. `report` is analyzed projection. `status` is a short company heartbeat.

## Decision Model

CEO intervention is structured through decision requests.

A decision request contains context, options, tradeoffs, recommended option, impact, and optional deadline.

CLI must allow:

```bash
ceoworkbench report --decisions
ceoworkbench decide <decision-id> --option B
ceoworkbench decide <decision-id> --custom "..."
```

Decision outcomes are persisted as messages, events, and memory entries, then trigger follow-up scheduling.

## M2 CLI MVP

Required commands:

```bash
ceoworkbench init
ceoworkbench company create <name>
ceoworkbench agent create <name>
ceoworkbench start
ceoworkbench send <agent> <message>
ceoworkbench watch
ceoworkbench status
ceoworkbench report
ceoworkbench decide <decision-id>
```

Target demo:

```bash
ceoworkbench init
ceoworkbench company create novel --goal "完成一部 12 万字科幻小说出版包"
ceoworkbench agent create manager --role manager
ceoworkbench start
ceoworkbench send manager "请拆解小说出版项目"
ceoworkbench watch
ceoworkbench report
```

The first implementation may use a fake agent adapter to prove the event, run, report, artifact, and memory loop before real model calls and Podman are enabled.

## Out Of Scope For M2

- Department agents
- GitHub integration
- Web UI rewrite
- WebSocket/SSE
- Python CrewAI integration
- Rust/Go supervisor
- Docker daemon
- 24/7 lifecycle
- External tool execution beyond the sandbox step
- Vector memory retrieval
- Full interactive TUI

## Success Criteria

- CLI can create a company and manager agent.
- CLI can send a steer message.
- Supervisor can enqueue, lease, run, and complete a manager run.
- Event stream is visible through `watch`.
- Reporter can produce status, run summary, artifact, and decision reports.
- Artifacts and memory entries can be persisted.
- A failed or expired run can be marked and recovered.
- Runtime remains generic; CEO semantics live above the core agent model.

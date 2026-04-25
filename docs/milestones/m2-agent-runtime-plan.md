# M2 Agent Runtime Implementation Plan

## Goal

Implement a CLI-first TypeScript supervisor runtime for long-running company agent work. The first working version must prove the generic runtime loop: company creation, agent registration, steer message, queued run, leased execution, event stream, artifacts, memory, reports, and CEO decisions.

## Implementation Strategy

Build in thin vertical slices.

Do not start with real LLM calls or Podman. First prove the runtime contract with a fake agent adapter and file-backed or in-memory development storage. Then add Postgres, reporter persistence, Podman, and real agent adapter behind stable interfaces.

## Phase 1: Runtime Package Scaffold

### Files

- Create `packages/core`
- Create `packages/cli`
- Create `packages/storage`
- Create `packages/supervisor`
- Create `packages/runtime`
- Create `packages/reporter`
- Create `packages/sandbox-podman`
- Modify root `package.json`
- Modify `tsconfig.json` if needed

### Work

- Add workspace/package structure without disturbing the existing Web app.
- Add TypeScript build/test scripts for packages.
- Add shared core types:
  - `Company`
  - `Agent`
  - `Message`
  - `Run`
  - `RunEvent`
  - `Task`
  - `Artifact`
  - `MemoryEntry`
  - `ReportDocument`
  - `DecisionRequest`
- Add unit tests for type guards and status transitions where useful.

### Verification

```bash
npm test
npm run lint
```

## Phase 2: Storage Interface And Development Adapter

### Files

- Create `packages/storage/src/storage.ts`
- Create `packages/storage/src/memory-storage.ts`
- Create `packages/storage/src/storage.test.ts`

### Work

Define a storage interface before binding to Postgres.

Required methods:

- `createCompany`
- `createAgent`
- `appendMessage`
- `appendRunEvent`
- `enqueueRun`
- `leaseNextRun`
- `completeRun`
- `failRun`
- `createTask`
- `updateTask`
- `createArtifact`
- `createMemoryEntry`
- `createReport`
- `listEvents`
- `listRuns`
- `listTasks`
- `listArtifacts`
- `listReports`

The development adapter can be in-memory. It exists only to prove behavior quickly and to support deterministic tests.

### Verification

Tests must prove:

- Highest-priority run leases first.
- A leased run is not leased twice.
- Expired leases can be recovered.
- Events remain ordered.
- Company isolation is preserved.

## Phase 3: CLI Skeleton

### Files

- Create `packages/cli/src/index.ts`
- Create `packages/cli/src/commands/*.ts`
- Create `packages/cli/src/render/*.ts`
- Add root bin script or package bin config

### Work

Implement CLI command parsing with minimal dependencies.

Commands:

- `ceoworkbench init`
- `ceoworkbench company create <name> --goal <goal>`
- `ceoworkbench agent create <name> --role <role>`
- `ceoworkbench send <agent> <message> [--type steer|follow-up]`
- `ceoworkbench watch`
- `ceoworkbench status`
- `ceoworkbench report`
- `ceoworkbench decide <decision-id> --option <option>`

At this phase, commands can use the development storage adapter.

### Verification

Add CLI tests for:

- Creating a company.
- Creating a manager agent.
- Sending a steer message.
- Rendering a status report with no active run.

## Phase 4: Supervisor And Scheduler Loop

### Files

- Create `packages/supervisor/src/supervisor.ts`
- Create `packages/supervisor/src/scheduler.ts`
- Create `packages/supervisor/src/run-lifecycle.ts`
- Create `packages/supervisor/src/supervisor.test.ts`

### Work

Implement the generic supervisor loop.

Responsibilities:

- Convert steer/follow-up message into queued run.
- Lease highest-priority run for a company.
- Enforce per-company single-flight for manager runs.
- Append run lifecycle events.
- Execute one agent step through `AgentAdapter`.
- Persist emitted agent events.
- Complete, block, fail, retry, or cancel run.

M2 initial hard rules:

- Same company manager single-flight.
- Max retries: 2.
- Run timeout configurable.
- Each run can create at most one continuation by default.
- `blocked` state prevents automatic continuation until CEO decision.

### Verification

Tests must prove:

- Steer message creates a high-priority run.
- Follow-up message creates lower priority input.
- Scheduler does not run two manager runs for one company.
- Failed runs retry up to limit.
- Blocked run produces a decision-required event.

## Phase 5: Fake Agent Adapter

### Files

- Create `packages/runtime/src/agent-adapter.ts`
- Create `packages/runtime/src/fake-manager-adapter.ts`
- Create `packages/runtime/src/context-builder.ts`
- Create `packages/runtime/src/fake-manager-adapter.test.ts`

### Work

Implement a fake manager adapter that emits deterministic events.

For a message like "拆解小说出版项目", it should emit:

- ack event
- task created event
- artifact created event
- progress event
- report candidate or summary event

This proves the runtime and reporting pipeline before real models.

### Verification

Tests must prove:

- Adapter emits structured `AgentRunEvent` values.
- Context builder includes latest messages, active tasks, relevant artifacts, memory, and reports.
- Adapter output can be persisted by supervisor.

## Phase 6: Reporter MVP

### Files

- Create `packages/reporter/src/report-document.ts`
- Create `packages/reporter/src/report-query.ts`
- Create `packages/reporter/src/report-analyzer.ts`
- Create `packages/reporter/src/report-composer.ts`
- Create `packages/reporter/src/render-terminal.ts`
- Create `packages/reporter/src/render-markdown.ts`
- Create `packages/reporter/src/reporter.test.ts`

### Work

Implement report generation from structured storage state.

Report types for M2:

- `status`
- `run_summary`
- `artifact_index`
- `decision_briefing`
- `progress`

Terminal style should follow the provided CLI references:

- Clear title line.
- Compact key metrics.
- Box tables for summaries and artifacts.
- File paths highlighted where terminal color is available.
- Plain text remains understandable without color.

### Verification

Tests must prove:

- Status report summarizes queued/running/completed/failed counts.
- Artifact report groups files by agent.
- Decision report lists options and recommendation.
- Markdown renderer writes deterministic content.

## Phase 7: Watch And Report CLI Integration

### Files

- Modify `packages/cli/src/commands/watch.ts`
- Modify `packages/cli/src/commands/status.ts`
- Modify `packages/cli/src/commands/report.ts`
- Modify `packages/cli/src/commands/decide.ts`

### Work

Connect CLI to reporter and event stream.

Commands:

- `watch` prints chronological events.
- `status` prints short company heartbeat.
- `report --run latest` prints latest run summary.
- `report --artifacts` prints artifact index.
- `report --decisions` prints pending decision briefings.
- `report --format markdown --save` creates a report artifact.
- `decide` writes a decision event and enqueues continuation.

### Verification

Add end-to-end CLI tests for:

- Send message.
- Run supervisor once.
- Watch shows emitted events.
- Report shows task/artifact output.
- Decision command unblocks a pending decision.

## Phase 8: Postgres Storage Adapter

### Files

- Create `packages/storage-postgres`
- Create SQL migrations or Drizzle schema files
- Create `packages/storage-postgres/src/postgres-storage.ts`
- Create integration tests gated by database availability

### Work

Implement Postgres as the real source of truth.

The CLI uses Postgres automatically when `CEOWORKBENCH_DATABASE_URL` or `DATABASE_URL` is set. Schema setup is available through:

```bash
npm run ceoworkbench -- db migrate
```

Integration tests are gated by `CEOWORKBENCH_TEST_DATABASE_URL`:

```bash
CEOWORKBENCH_TEST_DATABASE_URL=postgres://... npm test -- packages/storage-postgres
```

Required tables:

- `companies`
- `agents`
- `messages`
- `runs`
- `run_events`
- `tasks`
- `artifacts`
- `memory_entries`
- `reports`
- `decision_requests`

Important behavior:

- Transactional run leasing.
- Ordered event append.
- Company isolation.
- Efficient latest status queries.
- JSONB payloads for structured extensibility.

### Verification

Tests must prove:

- Concurrent lease attempts do not double-lease one run.
- Expired lease recovery works.
- Reports can be regenerated from stored events.

## Phase 9: Podman Sandbox Runtime

### Files

- Create `packages/sandbox-podman/src/podman-runtime.ts`
- Create `packages/sandbox-podman/src/sandbox-profile.ts`
- Create `packages/sandbox-podman/src/podman-runtime.test.ts`

### Work

Implement rootless Podman launcher behind a `SandboxRuntime` interface.

Sandbox profile should support:

- company workspace mount
- per-run HOME mount
- network mode
- read-only root filesystem flag
- CPU, memory, pid, duration limits
- environment allowlist

Do not expose Podman socket to agents.

### Verification

Initial tests can validate command construction without running Podman. Add optional local integration test when Podman is available.

## Phase 10: Real Manager Agent Adapter

### Files

- Create `packages/runtime/src/manager-agent-adapter.ts`
- Create `packages/runtime/src/model-client.ts`
- Create `packages/runtime/src/output-parser.ts`
- Add tests with mocked model client

### Work

Implement a real manager adapter behind the same `AgentAdapter` contract.

The adapter must emit structured events, not free-form text only.

Minimum event outputs:

- ack
- progress
- task_created
- artifact_created
- decision_required
- memory_entry_created
- summary

Model output must be validated before persistence.

### Verification

Tests must prove:

- Invalid model output is rejected.
- Valid output is converted into structured events.
- Adapter never directly writes storage; supervisor persists outputs.

## Phase 11: Recovery And Operational Commands

### Files

- Add `packages/supervisor/src/recovery.ts`
- Add CLI commands for `runs`, `recover`, and `doctor` if needed

### Work

Implement operational recovery:

- Detect expired leases.
- Mark orphaned runs failed or retrying.
- Requeue safe continuations.
- Emit recovery events.

Commands:

- `ceoworkbench runs`
- `ceoworkbench recover`
- `ceoworkbench doctor`

### Verification

Tests must prove:

- Expired running run can be recovered.
- Recovery emits auditable events.
- Recovered run appears in reports.

## Phase 12: M2 Demo Script

### Files

- Create `docs/milestones/m2-demo.md`
- Create demo fixtures if useful

### Demo

The M2 demo should run:

```bash
ceoworkbench init
ceoworkbench company create novel --goal "完成一部 12 万字科幻小说出版包"
ceoworkbench agent create manager --role manager
ceoworkbench send manager "请拆解小说出版项目"
ceoworkbench start --once
ceoworkbench watch
ceoworkbench status
ceoworkbench report --run latest
ceoworkbench report --artifacts
```

Expected result:

- Message is persisted.
- Run is queued and completed.
- Events are visible.
- Task and artifact records exist.
- Report renders in terminal.
- Markdown report can be saved as artifact.

## Commit Strategy

Suggested commits:

1. `docs: define m2 cli agent runtime`
2. `feat(runtime): add core types and storage contract`
3. `feat(cli): scaffold ceoworkbench commands`
4. `feat(supervisor): add run queue and scheduler`
5. `feat(runtime): add fake manager adapter`
6. `feat(reporter): add status and report rendering`
7. `feat(storage): add postgres adapter`
8. `feat(sandbox): add podman runtime launcher`
9. `feat(runtime): add real manager adapter`
10. `feat(supervisor): add recovery commands`

## M2 Completion Criteria

- A CLI user can create a company and manager agent.
- A steer message creates a prioritized run.
- Supervisor leases and executes one manager step.
- Watch displays event stream.
- Report displays management summary and artifact index.
- At least one report can be saved as Markdown artifact.
- Storage can be backed by Postgres.
- Podman sandbox launcher exists behind an interface.
- Real manager adapter exists behind the same interface as the fake adapter.
- Existing Web workbench still builds/tests, even if it is not the M2 focus.

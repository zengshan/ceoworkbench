# CEO Workbench

CEO Workbench is an experimental multi-agent runtime and workbench for coordinating company-like execution loops. It models a CEO steer as structured work: messages become runs, runs create tasks and artifacts, agents write memory, and reports summarize progress for the operator.

The current codebase includes a Next.js workbench UI, a TypeScript runtime, CLI tools, in-memory and Postgres storage adapters, a Podman sandbox runner, and an OpenAI Responses adapter for real agent execution.

The workbench experience references ideas from [wanman.ai](https://wanman.ai/) while exploring a broader agent-operated company workflow.

## Current Milestone

M2 establishes the first end-to-end agent runtime experience:

- Manager agents can decompose a steer into delegated worker tasks.
- Delegations can create or reuse worker agents and queue follow-up runs.
- Reviewers are created and queued automatically for reviewable artifacts.
- The OpenAI Responses runner supports structured output, streaming output, and narrative-output fallback.
- Sandbox mode can enable network access only for OpenAI runner mode and forwards a small environment allowlist.
- Timeline and briefing reports expose recent progress, artifacts, and review activity.

Novel planning has been used only as a test scenario for this workflow. It is not the product positioning.

## Quick Start

Install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Start the web workbench:

```bash
npm run dev
```

Run the CLI:

```bash
npm run ceoworkbench -- help
```

For a guided first run:

```bash
npm run ceoworkbench -- wizard
npm run ceoworkbench -- work --until-idle
npm run ceoworkbench -- timeline
```

## CLI Runtime

Create a company and manager:

```bash
npm run ceoworkbench -- company init acme --goal "Build an agent-operated business workflow"
```

Send a CEO steer:

```bash
npm run ceoworkbench -- ceo "Break this goal into the first execution plan"
```

Process queued work:

```bash
npm run ceoworkbench -- work --until-idle
```

Inspect progress:

```bash
npm run ceoworkbench -- status
npm run ceoworkbench -- timeline
npm run ceoworkbench -- briefing
npm run ceoworkbench -- artifact list
```

By default the CLI stores state in `.ceoworkbench/state.json`. Set `CEOWORKBENCH_DATABASE_URL` or `DATABASE_URL` to use Postgres storage.

## OpenAI Runner Mode

The CLI automatically reads `.ceoworkbench/local.env` before creating the runtime. Existing shell environment variables override values from that file.

For direct OpenAI Responses execution:

```bash
cat > .ceoworkbench/local.env <<'EOF'
export CEOWORKBENCH_AGENT_MODEL=gpt-5.4
export OPENAI_API_KEY="..."
# Optional when using a compatible gateway.
export OPENAI_BASE_URL="https://example.com/v1"
EOF

npm run ceoworkbench -- work --until-idle
```

For sandboxed JSON execution:

```bash
cat > .ceoworkbench/local.env <<'EOF'
export CEOWORKBENCH_AGENT_ADAPTER=sandbox-json
export CEOWORKBENCH_RUNNER_ADAPTER=openai-responses
export CEOWORKBENCH_AGENT_MODEL=gpt-5.4
export OPENAI_API_KEY="..."
# Optional when using a compatible gateway.
export OPENAI_BASE_URL="https://example.com/v1"
EOF

npm run ceoworkbench -- start --once
```

Without an LLM configuration, runtime commands fail fast instead of using the old fake manager fallback.

When `CEOWORKBENCH_RUNNER_ADAPTER=openai-responses` is set, the sandbox profile enables network access and forwards only:

- `CEOWORKBENCH_RUNNER_ADAPTER`
- `CEOWORKBENCH_AGENT_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`

For local Postgres plus sandbox setup, use:

```bash
./scripts/start-local-runtime.sh
source .ceoworkbench/local.env
npm run ceoworkbench -- wizard
npm run ceoworkbench -- work --until-idle
```

`start-local-runtime.sh` reuses values already present in `.ceoworkbench/local.env`, including `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `CEOWORKBENCH_AGENT_MODEL`. `clean-local-runtime.sh` removes local runtime state but preserves `.ceoworkbench/local.env`.

## Review Flow

Review is part of the runtime protocol, not an optional CLI mode. When a worker produces a reviewable artifact, the supervisor attaches it to the active task, creates a matching reviewer if needed, queues a review run, and marks the task as `in_review`.

Reviewer output is stored as a review report. Accepted reviews complete the task and mark the artifact accepted; revision, rejection, low confidence, or CEO-input requests keep the task from silently moving forward. Use `timeline`, `status`, and `artifact list` to inspect the review path.

## Core Concepts

- `Company`: the workspace and business objective being operated.
- `Agent`: a manager, worker, reviewer, or reporter that can receive runs.
- `Message`: CEO, system, or agent communication that can trigger work.
- `Run`: a leased execution unit for one agent.
- `Task`: structured work created by a manager or delegation.
- `Artifact`: a deliverable produced by an agent.
- `MemoryEntry`: durable project context, goals, facts, lessons, and summaries.
- `DecisionRequest`: a structured request for CEO input.
- `ReportDocument`: status, timeline, briefing, artifact, or decision summaries.

## Repository Layout

```text
src/app                         Next.js app shell
src/features/workbench          Workbench UI, store, geometry, and components
packages/core                   Shared domain types, run status, priority logic
packages/runtime                Agent context builders and adapter interfaces
packages/supervisor             Run leasing and execution orchestration
packages/storage                In-memory storage implementation
packages/storage-postgres       Postgres schema, migrations, storage adapter
packages/agent-openai           OpenAI Responses agent adapter
packages/agent-runner           Sandbox runner CLI and adapter factory
packages/sandbox-podman         Podman command/profile/runtime helpers
packages/reporter               Report builders and renderers
packages/cli                    CEO Workbench CLI commands
scripts                         Local runtime and sandbox helper scripts
docs                            Milestone specs, plans, and runtime notes
```

## Development Checks

Use these before opening or merging a PR:

```bash
npm test
npm run lint
```

The Postgres integration test is skipped unless the test environment is configured for it.

## Known Follow-Ups

- Bind delegated tasks more explicitly to the worker run context.
- Keep the OpenAI structured-output schema aligned with internal TypeScript types.
- Add structured artifact links to timeline reports.
- Continue hardening sandbox network approval and per-agent execution controls.

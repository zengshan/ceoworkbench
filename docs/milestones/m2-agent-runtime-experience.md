# M2 Agent Runtime Experience

This guide covers the current CLI-first runtime experience.

## Full local experience

Use these commands when you want persistent reports after a demo run:

```bash
./scripts/setup-agent-sandbox.sh
./scripts/start-local-runtime.sh
./scripts/run-sandbox-demo.sh
./scripts/watch-report.sh
```

Clean all local runtime state:

```bash
./scripts/clean-local-runtime.sh
```

## Default deterministic demo

The default mode does not require Podman or an API key. It uses the fake manager adapter and exercises the same storage, supervisor, event, artifact, and report flow.

```bash
npm run ceoworkbench -- demo
```

Expected result:

- A company named `novel` is created.
- A manager agent is created.
- A CEO steer message queues one run.
- The supervisor processes the run.
- `watch` shows the event stream.
- `report --artifacts` shows the generated project-plan artifact metadata.

## Direct agent runner smoke test

This runs the same runner entrypoint that the sandbox image uses, but directly on the host.

```bash
tmpdir=$(mktemp -d)
cat > "$tmpdir/context.json" <<'JSON'
{
  "run": {
    "id": "run-smoke",
    "companyId": "company-smoke",
    "agentId": "agent-smoke",
    "kind": "ceo_steer",
    "status": "running",
    "priority": 100,
    "attempt": 0,
    "maxAttempts": 3,
    "queuedAt": "2026-04-25T00:00:00.000Z"
  },
  "messages": [
    {
      "id": "message-smoke",
      "companyId": "company-smoke",
      "agentId": "agent-smoke",
      "author": "ceo",
      "kind": "steer",
      "content": "请拆解小说出版项目",
      "createdAt": "2026-04-25T00:00:00.000Z"
    }
  ],
  "recentEvents": [],
  "activeTasks": [],
  "artifacts": [],
  "memoryEntries": []
}
JSON

npm run agent-runner -- "$tmpdir/context.json" "$tmpdir/result.json"
cat "$tmpdir/result.json"
```

## Build the sandbox image

Podman is required for the full sandbox path.

```bash
./scripts/setup-agent-sandbox.sh
```

## Run through Podman sandbox

Use sandbox-json mode to force the CLI to execute the agent runner in Podman.

```bash
./scripts/run-sandbox-demo.sh
```

The per-run files are written under:

```text
.ceoworkbench/sandbox/<company-id>/runs/<run-id>/home/context.json
.ceoworkbench/sandbox/<company-id>/runs/<run-id>/home/result.json
```

## Run with OpenAI Responses inside the runner

The OpenAI mode is selected inside the sandbox runner.

```bash
export CEOWORKBENCH_AGENT_ADAPTER=sandbox-json
export CEOWORKBENCH_RUNNER_ADAPTER=openai-responses
export CEOWORKBENCH_AGENT_MODEL=gpt-5.2
export OPENAI_API_KEY="..."

npm run ceoworkbench -- start --once
```

Current caveat: the default sandbox profile uses `--network none`, so real OpenAI calls require an explicit network-enabled sandbox profile in a later hardening step. Keep fake-manager as the default until we add per-agent network approval.

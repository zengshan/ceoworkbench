#!/usr/bin/env bash
set -euo pipefail

export CEOWORKBENCH_AGENT_ADAPTER=sandbox-json
export CEOWORKBENCH_AGENT_IMAGE="${CEOWORKBENCH_AGENT_IMAGE:-ceoworkbench-agent:latest}"
export CEOWORKBENCH_SANDBOX_ROOT="${CEOWORKBENCH_SANDBOX_ROOT:-$PWD/.ceoworkbench/sandbox}"

npm run ceoworkbench -- demo

echo
echo "Sandbox run files:"
find "$CEOWORKBENCH_SANDBOX_ROOT" -name context.json -o -name result.json | sort

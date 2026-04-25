#!/usr/bin/env bash
set -euo pipefail

if [ -f .ceoworkbench/local.env ]; then
  source .ceoworkbench/local.env
fi

export CEOWORKBENCH_AGENT_ADAPTER=sandbox-json
export CEOWORKBENCH_AGENT_IMAGE="${CEOWORKBENCH_AGENT_IMAGE:-ceoworkbench-agent:latest}"
export CEOWORKBENCH_SANDBOX_ROOT="${CEOWORKBENCH_SANDBOX_ROOT:-$PWD/.ceoworkbench/sandbox}"

npm run ceoworkbench -- company init novel --goal "完成一部 12 万字科幻小说出版包"
npm run ceoworkbench -- ceo "请总经理拆解第一阶段工作"
npm run ceoworkbench -- work --until-idle
npm run ceoworkbench -- briefing
npm run ceoworkbench -- artifact show latest

echo
echo "Sandbox run files:"
find "$CEOWORKBENCH_SANDBOX_ROOT" -name context.json -o -name result.json | sort

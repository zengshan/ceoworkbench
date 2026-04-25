#!/usr/bin/env bash
set -euo pipefail

if [ -f .ceoworkbench/local.env ]; then
  source .ceoworkbench/local.env
fi

if [ -z "${CEOWORKBENCH_DATABASE_URL:-}" ]; then
  echo "No local runtime env found. Run: ./scripts/start-local-runtime.sh" >&2
  exit 1
fi

echo "CEO Briefing"
npm run ceoworkbench -- briefing

echo
echo "Timeline"
npm run ceoworkbench -- timeline

echo
echo "Team"
npm run ceoworkbench -- team

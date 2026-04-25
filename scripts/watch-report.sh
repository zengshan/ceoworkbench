#!/usr/bin/env bash
set -euo pipefail

if [ -f .ceoworkbench/local.env ]; then
  source .ceoworkbench/local.env
fi

if [ -z "${CEOWORKBENCH_DATABASE_URL:-}" ]; then
  echo "No local runtime env found. Run: ./scripts/start-local-runtime.sh" >&2
  exit 1
fi

echo "Event stream"
npm run ceoworkbench -- watch

echo
echo "Status"
npm run ceoworkbench -- status

echo
echo "Artifacts"
npm run ceoworkbench -- report --artifacts

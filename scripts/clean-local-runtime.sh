#!/usr/bin/env bash
set -euo pipefail

container_name="${CEOWORKBENCH_POSTGRES_CONTAINER:-ceoworkbench-postgres}"

podman rm -f "$container_name" >/dev/null 2>&1 || true
rm -rf .ceoworkbench

echo "Local CEO Workbench runtime cleaned."

#!/usr/bin/env bash
set -euo pipefail

container_name="${CEOWORKBENCH_POSTGRES_CONTAINER:-ceoworkbench-postgres}"
env_file=".ceoworkbench/local.env"
env_backup=""

if [ -f "$env_file" ]; then
  env_backup="$(mktemp)"
  cp "$env_file" "$env_backup"
fi

podman rm -f "$container_name" >/dev/null 2>&1 || true
rm -rf .ceoworkbench

if [ -n "$env_backup" ]; then
  mkdir -p .ceoworkbench
  cp "$env_backup" "$env_file"
  rm -f "$env_backup"
fi

echo "Local CEO Workbench runtime cleaned."

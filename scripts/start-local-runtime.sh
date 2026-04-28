#!/usr/bin/env bash
set -euo pipefail

container_name="${CEOWORKBENCH_POSTGRES_CONTAINER:-ceoworkbench-postgres}"
host_port="${CEOWORKBENCH_POSTGRES_PORT:-55432}"
database="${CEOWORKBENCH_POSTGRES_DB:-ceoworkbench}"
user="${CEOWORKBENCH_POSTGRES_USER:-ceoworkbench}"
password="${CEOWORKBENCH_POSTGRES_PASSWORD:-ceoworkbench}"
env_file=".ceoworkbench/local.env"

if ! command -v podman >/dev/null 2>&1; then
  echo "Podman is not installed. Run ./scripts/setup-agent-sandbox.sh after installing Podman." >&2
  exit 1
fi

mkdir -p .ceoworkbench

if [ -f "$env_file" ]; then
  source "$env_file"
fi

if ! podman container exists "$container_name"; then
  podman run -d \
    --name "$container_name" \
    -e POSTGRES_DB="$database" \
    -e POSTGRES_USER="$user" \
    -e POSTGRES_PASSWORD="$password" \
    -p "$host_port:5432" \
    docker.io/library/postgres:16-alpine >/dev/null
elif [ "$(podman inspect -f '{{.State.Running}}' "$container_name")" != "true" ]; then
  podman start "$container_name" >/dev/null
fi

sleep 2

for _ in $(seq 1 120); do
  if podman exec "$container_name" pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! podman exec "$container_name" pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
  echo "Postgres did not become ready in time." >&2
  podman logs --tail 80 "$container_name" >&2 || true
  exit 1
fi

cat > "$env_file" <<EOF
export CEOWORKBENCH_DATABASE_URL=postgres://$user:$password@127.0.0.1:$host_port/$database
export CEOWORKBENCH_AGENT_ADAPTER=sandbox-json
export CEOWORKBENCH_RUNNER_ADAPTER=openai-responses
export CEOWORKBENCH_AGENT_MODEL=${CEOWORKBENCH_AGENT_MODEL:-gpt-5.4}
export CEOWORKBENCH_AGENT_IMAGE=ceoworkbench-agent:latest
export CEOWORKBENCH_SANDBOX_ROOT=$PWD/.ceoworkbench/sandbox
${OPENAI_BASE_URL:+export OPENAI_BASE_URL="$OPENAI_BASE_URL"}
${OPENAI_API_KEY:+export OPENAI_API_KEY="$OPENAI_API_KEY"}
# Add OPENAI_API_KEY here if it is not already set above.
EOF

source "$env_file"
npm run ceoworkbench -- db migrate

echo "Local runtime is ready."
echo "Env file: $env_file"
echo "Database: $CEOWORKBENCH_DATABASE_URL"

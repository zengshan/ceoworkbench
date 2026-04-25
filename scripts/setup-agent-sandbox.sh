#!/usr/bin/env bash
set -euo pipefail

if ! command -v podman >/dev/null 2>&1; then
  echo "Podman is not installed. On Ubuntu, run: sudo apt-get update && sudo apt-get install -y podman uidmap slirp4netns fuse-overlayfs containernetworking-plugins" >&2
  exit 1
fi

podman build -f Containerfile.agent -t ceoworkbench-agent:latest .

echo "Agent sandbox image is ready: ceoworkbench-agent:latest"

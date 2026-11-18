#!/usr/bin/env bash
set -euo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$deploy_dir"

docker compose pull
docker compose up -d --remove-orphans
docker compose ps

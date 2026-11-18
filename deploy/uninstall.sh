#!/usr/bin/env bash
set -euo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$deploy_dir"

docker compose down --remove-orphans
printf 'SpectrumLink 容器已停止并删除，部署文件仍保留在 %s\n' "$deploy_dir"

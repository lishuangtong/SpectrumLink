#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
artifact="$project_root/dist/SpectrumLink.app"
if [[ ! -f "$artifact" ]]; then
  echo "SpectrumLink.app is missing; run npm run build:app first" >&2
  exit 1
fi
node "$project_root/scripts/verify-app.mjs" "$artifact"


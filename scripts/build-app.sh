#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
upstream="$project_root/.cache/f4hwn-v6.3.0"
source_app="$project_root/radio/spectrumlink"
protocol_header="$project_root/protocol/spectrumlink_protocol.h"
cached_app="$upstream/App/apps/spectrumlink"

"$project_root/scripts/fetch-f4hwn.sh"

if [[ ! -d "$source_app" ]] || [[ ! -f "$protocol_header" ]]; then
  echo "SpectrumLink radio source or protocol header is missing" >&2
  exit 1
fi

rm -rf "$cached_app"
mkdir -p "$cached_app"
cp -R "$source_app"/. "$cached_app"/
cp "$protocol_header" "$cached_app/spectrumlink_protocol.h"

(
  cd "$upstream"
  ./compile-app.sh spectrumlink
)

artifact="$(find "$upstream" -type f -name 'SpectrumLink.app' -print -quit)"
if [[ -z "$artifact" ]]; then
  echo "compile-app.sh did not produce SpectrumLink.app" >&2
  exit 1
fi
mkdir -p "$project_root/dist"
cp "$artifact" "$project_root/dist/SpectrumLink.app"
echo "Built $project_root/dist/SpectrumLink.app"


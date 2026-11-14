#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$project_root"
npm run serve &
server_pid=$!
cleanup() { kill "$server_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for _ in $(seq 1 50); do
  if curl --fail --silent http://127.0.0.1:8765/ >/dev/null; then break; fi
  sleep 0.1
done
url="http://127.0.0.1:8765"
if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" "$url"
elif [[ -d "/Applications/Microsoft Edge.app" ]]; then
  open -a "Microsoft Edge" "$url"
else
  open "$url"
fi
echo "SpectrumLink 正在运行：$url"
echo "按 Control-C 关闭。"
wait "$server_pid"


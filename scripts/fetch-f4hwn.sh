#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cache_parent="$project_root/.cache"
cache_dir="$cache_parent/f4hwn-v6.3.0"
marker="$cache_dir/.spectrumlink-source.sha256"
expected_sha="2ceed535522113e7d86307a9b80d0f112bc4e55aa9fb6c65caacac8423a011d9"
archive_url="https://codeload.github.com/armel/uv-k1-k5v3-firmware-custom/tar.gz/refs/tags/v6.3.0"

if [[ -f "$marker" ]] && [[ -f "$cache_dir/App/apps/app_api.h" ]] &&
   [[ "$(tr -d '[:space:]' < "$marker")" == "$expected_sha" ]]; then
  echo "F4HWN v6.3.0 already verified"
  exit 0
fi

mkdir -p "$cache_parent"
work_dir="$(mktemp -d "$cache_parent/f4hwn-fetch.XXXXXX")"
backup_dir=""
cleanup() {
  rm -rf "$work_dir"
  if [[ -n "$backup_dir" ]] && [[ -d "$backup_dir" ]]; then
    rm -rf "$backup_dir"
  fi
}
trap cleanup EXIT

curl --fail --location --silent --show-error "$archive_url" --output "$work_dir/source.tar.gz"
actual_sha="$(shasum -a 256 "$work_dir/source.tar.gz" | awk '{print $1}')"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "F4HWN archive checksum mismatch: expected $expected_sha, got $actual_sha" >&2
  exit 1
fi

mkdir "$work_dir/source"
tar -xzf "$work_dir/source.tar.gz" -C "$work_dir/source" --strip-components=1
if [[ ! -f "$work_dir/source/App/apps/app_api.h" ]]; then
  echo "F4HWN archive is missing App/apps/app_api.h" >&2
  exit 1
fi
printf '%s\n' "$expected_sha" > "$work_dir/source/.spectrumlink-source.sha256"

if [[ -e "$cache_dir" ]]; then
  backup_dir="$cache_parent/f4hwn-v6.3.0.previous.$$"
  mv "$cache_dir" "$backup_dir"
fi
mv "$work_dir/source" "$cache_dir"
echo "Installed verified F4HWN v6.3.0 source"


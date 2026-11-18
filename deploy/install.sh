#!/usr/bin/env bash
set -euo pipefail

repository="https://raw.githubusercontent.com/lishuangtong/SpectrumLink"
release_ref="${SPECTRUMLINK_REF:-v3.8.0}"
install_dir="${SPECTRUMLINK_INSTALL_DIR:-$HOME/spectrumlink}"

fail() {
  printf 'SpectrumLink 安装失败：%s\n' "$1" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "缺少 curl"
command -v docker >/dev/null 2>&1 || fail "请先在宝塔或 NAS 中安装 Docker"
docker compose version >/dev/null 2>&1 || fail "需要 Docker Compose v2"
docker info >/dev/null 2>&1 || fail "当前账号无法访问 Docker，请检查权限"

mkdir -p "$install_dir"
curl --fail --silent --show-error --location "$repository/$release_ref/compose.yaml" --output "$install_dir/compose.yaml"
curl --fail --silent --show-error --location "$repository/$release_ref/deploy/update.sh" --output "$install_dir/update.sh"
curl --fail --silent --show-error --location "$repository/$release_ref/deploy/uninstall.sh" --output "$install_dir/uninstall.sh"
if [[ ! -f "$install_dir/.env" ]]; then
  curl --fail --silent --show-error --location "$repository/$release_ref/deploy/.env.example" --output "$install_dir/.env"
fi
chmod 0755 "$install_dir/update.sh" "$install_dir/uninstall.sh"

cd "$install_dir"
docker compose pull
docker compose up -d --remove-orphans
docker compose ps

printf '\nSpectrumLink 已启动：http://127.0.0.1:%s\n' "${SPECTRUMLINK_PORT:-8765}"
printf '下一步：在宝塔中把 HTTPS 二级域名反向代理到该地址。\n'
printf '完整说明：https://github.com/lishuangtong/SpectrumLink/blob/main/docs/deploy-baota-nas.md\n'

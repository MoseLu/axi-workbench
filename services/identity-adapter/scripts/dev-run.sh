#!/usr/bin/env bash
# 本地 dev 启动 identity-adapter，env 来自仓库根的 .env（gitignored）。
# 用法：./services/identity-adapter/scripts/dev-run.sh
#
# 依赖：仓库根 .env 存在且包含 SMTP_* 一组；未显式配置数据库/Redis 时，
# 自动使用本仓库 Compose 的专用本地端口（参考 .env.example）。
# Go 程序用 os.Getenv 直读，不会自动 load .env。
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." &> /dev/null && pwd)"

ENV_FILE="${AXI_ENV_FILE:-${REPO_ROOT}/.env}"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少 ${ENV_FILE}，请先按 .env.example 建一份。" >&2
  exit 1
fi

# 静默 source：把 KEY=VALUE 全部导出到当前 shell，但不打日志（避免 SMTP_PASSWORD 落到 stdout）。
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# Do not silently fall back to in-memory identity state when the local
# Workbench infrastructure is available. Explicit .env values still win.
export IDENTITY_DATABASE_URL="${IDENTITY_DATABASE_URL:-postgresql://axi_identity_app:axi_identity_dev@127.0.0.1:15432/axi_identity?sslmode=disable}"
export IDENTITY_REDIS_URL="${IDENTITY_REDIS_URL:-redis://127.0.0.1:16379/1}"

cd "${REPO_ROOT}/services/identity-adapter"
exec go run ./cmd/identity-adapter

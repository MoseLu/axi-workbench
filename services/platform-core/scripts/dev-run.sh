#!/usr/bin/env bash
# 本地 dev 启动 Platform Core。未设置 PLATFORM_DATABASE_URL 时使用
# 应用内存储，适合个人开发；生产必须提供 PostgreSQL URL。
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." &> /dev/null && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export PLATFORM_CORE_PORT="${PLATFORM_CORE_PORT:-8082}"
export PLATFORM_INTERNAL_SERVICE_TOKEN="${PLATFORM_INTERNAL_SERVICE_TOKEN:-${GATEWAY_PLATFORM_INTERNAL_TOKEN:-axi-development-internal-token}}"

cd "${REPO_ROOT}/services/platform-core"
exec go run ./cmd/platform-core

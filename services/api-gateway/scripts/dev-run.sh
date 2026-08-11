#!/usr/bin/env bash
# 本地 dev 启动 API Gateway。脚本负责加载仓库根 .env，并补齐
# Workbench 邮箱登录与后端服务的本地默认值；生产部署不要使用此脚本。
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." &> /dev/null && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "缺少 ${ENV_FILE}，请先按 .env.example 建一份。" >&2
  exit 1
fi

# 静默导出本地配置，避免 SMTP_PASSWORD 等秘密进入 stdout。
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

export ENVIRONMENT="${ENVIRONMENT:-development}"
export GATEWAY_PORT="${GATEWAY_PORT:-8088}"
export IDENTITY_ADAPTER_URL="${IDENTITY_ADAPTER_URL:-http://127.0.0.1:8081}"
export PLATFORM_CORE_URL="${PLATFORM_CORE_URL:-http://127.0.0.1:8082}"
export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://127.0.0.1:8092}"
export GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN="${GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN:-${CONTROL_PLANE_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}}"

# The local persistence contract is intentionally explicit: an omitted Redis
# URL receives the loopback default, while an explicit blank URL aborts before
# the Gateway can fall back to an in-memory session store.
if [[ -n "${GATEWAY_REDIS_URL+x}" ]]; then
  if [[ -z "${GATEWAY_REDIS_URL//[[:space:]]/}" ]]; then
    echo "GATEWAY_REDIS_URL 已显式设为空；本地持久会话必须配置 Redis 地址。" >&2
    exit 1
  fi
else
  export GATEWAY_REDIS_URL="redis://127.0.0.1:6379/2"
fi
export GATEWAY_REQUIRE_DURABLE_SESSION_STORE=true

# Email OTP is deliberately owner-only for this personal Workbench. Keeping
# the fallback in the local launcher avoids silently broadening production
# identity configuration while making a copied .env usable immediately.
if [[ -z "${EMAIL_LOGIN_OWNER_EMAIL:-}" ]]; then
  export EMAIL_LOGIN_OWNER_EMAIL="${SMTP_USERNAME:-}"
fi
export EMAIL_LOGIN_SUBJECT="${EMAIL_LOGIN_SUBJECT:-audit-user}"

if [[ -z "${EMAIL_LOGIN_OWNER_EMAIL}" ]]; then
  echo "EMAIL_LOGIN_OWNER_EMAIL 或 SMTP_USERNAME 至少配置一个，才能使用邮箱登录。" >&2
  exit 1
fi

cd "${REPO_ROOT}/services/api-gateway"
exec go run ./cmd/gateway

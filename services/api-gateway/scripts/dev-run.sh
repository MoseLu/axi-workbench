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

# The Gateway is the only ingress for device-paired Mobile requests. Refuse a
# misleading local startup when its control plane is not listening yet: a 502
# after the phone has opened is much harder to diagnose than a clear launch
# failure here. Set AXI_GATEWAY_SKIP_CONTROL_PLANE_READY_CHECK=true only for
# isolated Gateway tests that deliberately stub this dependency.
if [[ "${AXI_GATEWAY_SKIP_CONTROL_PLANE_READY_CHECK:-false}" != "true" ]]; then
  if ! curl --silent --show-error --fail --max-time 1 "${CONTROL_PLANE_URL}/health" >/dev/null; then
    echo "移动控制面未就绪（${CONTROL_PLANE_URL}）。先启动 services/control-plane/scripts/dev-run.sh；现有本地配对状态会在开发环境自动恢复。" >&2
    exit 1
  fi
fi

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

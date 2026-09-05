#!/usr/bin/env bash
# 本地 dev 启动 Workbench control-plane。
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

export CONTROL_PLANE_PORT="${CONTROL_PLANE_PORT:-8092}"
export AXI_WORKSTATION_ROOT="${AXI_WORKSTATION_ROOT:-/Volumes/code/workspace}"
export GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN="${GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN:-${CONTROL_PLANE_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}}"
export AXI_GATEWAY_CONTROL_PLANE_TOKEN="${AXI_GATEWAY_CONTROL_PLANE_TOKEN:-${GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN}}"
export AXI_CONTROL_PLANE_ALLOWED_ORIGINS="${AXI_CONTROL_PLANE_ALLOWED_ORIGINS:-http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174}"

cd "${REPO_ROOT}/services/control-plane"
exec node src/server.mjs

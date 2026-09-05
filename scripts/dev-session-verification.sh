#!/usr/bin/env bash
# Start an isolated durable-Web-session verification stack.  It never binds the
# standard Mobile runtime ports (8081/8088/5174), so a browser test cannot
# interrupt a paired phone that is using the main Workbench development stack.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
ENV_FILE="${SESSION_VERIFY_ENV_FILE:-}"
IDENTITY_PORT="${SESSION_VERIFY_IDENTITY_PORT:-18081}"
GATEWAY_PORT="${SESSION_VERIFY_GATEWAY_PORT:-18088}"
WEB_PORT="${SESSION_VERIFY_WEB_PORT:-15173}"
PIDS=()

if [[ -z "${ENV_FILE}" || ! -f "${ENV_FILE}" ]]; then
  echo "请通过 SESSION_VERIFY_ENV_FILE 指向含 SMTP 与本地 Redis 配置的 .env 文件。" >&2
  exit 1
fi

port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

for port in "${IDENTITY_PORT}" "${GATEWAY_PORT}" "${WEB_PORT}"; do
  if ! port_is_free "${port}"; then
    echo "会话验证专用端口 ${port} 已被占用；拒绝接管其他运行时。" >&2
    exit 1
  fi
done

stop_children() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    kill -TERM "${pid}" 2>/dev/null || true
  done
}
trap stop_children EXIT INT TERM

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempt
  for attempt in $(seq 1 50); do
    if curl --silent --show-error --fail --max-time 1 "${url}" >/dev/null 2>&1; then return 0; fi
    sleep 0.2
  done
  echo "${label} 未在预期时间内启动。" >&2
  return 1
}

AXI_ENV_FILE="${ENV_FILE}" IDENTITY_ADAPTER_PORT="${IDENTITY_PORT}" \
  bash "${REPO_ROOT}/services/identity-adapter/scripts/dev-run.sh" &
PIDS+=("$!")
wait_for_http "http://127.0.0.1:${IDENTITY_PORT}/health" "Identity Adapter"

AXI_ENV_FILE="${ENV_FILE}" \
  GATEWAY_PORT="${GATEWAY_PORT}" \
  IDENTITY_ADAPTER_URL="http://127.0.0.1:${IDENTITY_PORT}" \
  CONTROL_PLANE_URL="http://127.0.0.1:8092" \
  AXI_GATEWAY_SKIP_CONTROL_PLANE_READY_CHECK=true \
  bash "${REPO_ROOT}/services/api-gateway/scripts/dev-run.sh" &
PIDS+=("$!")
wait_for_http "http://127.0.0.1:${GATEWAY_PORT}/health" "API Gateway"

echo "会话验证栈已就绪：http://127.0.0.1:${WEB_PORT}（网关 ${GATEWAY_PORT}）。按 Ctrl-C 会停止仅本脚本启动的进程。" >&2
(
  cd "${REPO_ROOT}/apps/workbench"
  VITE_API_PROXY_TARGET="http://127.0.0.1:${GATEWAY_PORT}" \
    pnpm exec vite --port "${WEB_PORT}" --host 127.0.0.1 --strictPort
)

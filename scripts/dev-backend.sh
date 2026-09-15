#!/usr/bin/env bash
# Start the complete local backend profile with production-shaped contracts.
# The process remains in the foreground; Ctrl-C stops every child service.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
ENV_FILE="${AXI_ENV_FILE:-${REPO_ROOT}/.env}"
RUN_DIR="${AXI_BACKEND_RUN_DIR:-${REPO_ROOT}/.cache/axi-workbench/dev-backend}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

export ENVIRONMENT="${ENVIRONMENT:-development}"
export GATEWAY_PORT="${GATEWAY_PORT:-8088}"
export IDENTITY_ADAPTER_PORT="${IDENTITY_ADAPTER_PORT:-8081}"
export PLATFORM_CORE_PORT="${PLATFORM_CORE_PORT:-8082}"
export WORKFLOW_SERVICE_PORT="${WORKFLOW_SERVICE_PORT:-8083}"
export NOTIFICATION_PORT="${NOTIFICATION_PORT:-8084}"
export FILE_SERVICE_PORT="${FILE_SERVICE_PORT:-8085}"
export CONTROL_PLANE_PORT="${CONTROL_PLANE_PORT:-8092}"

export GATEWAY_REDIS_URL="${GATEWAY_REDIS_URL:-redis://127.0.0.1:16379/0}"
export IDENTITY_DATABASE_URL="${IDENTITY_DATABASE_URL:-postgresql://axi_identity_app:axi_identity_dev@127.0.0.1:15432/axi_identity?sslmode=disable}"
export IDENTITY_REDIS_URL="${IDENTITY_REDIS_URL:-redis://127.0.0.1:16379/1}"
export PLATFORM_DATABASE_URL="${PLATFORM_DATABASE_URL:-postgresql://axi_platform_app:axi_platform_dev@127.0.0.1:15432/axi_platform?sslmode=disable}"
export PLATFORM_MIGRATION_DATABASE_URL="${PLATFORM_MIGRATION_DATABASE_URL:-postgresql://axi_platform_migrator:axi_platform_migrator_dev@127.0.0.1:15432/axi_platform?sslmode=disable}"
export WORKFLOW_DATABASE_URL="${WORKFLOW_DATABASE_URL:-postgresql://axi_workflow_app:axi_workflow_dev@127.0.0.1:15432/axi_workflow?sslmode=disable}"
export WORKFLOW_MIGRATION_DATABASE_URL="${WORKFLOW_MIGRATION_DATABASE_URL:-postgresql://axi_workflow_migrator:axi_workflow_migrator_dev@127.0.0.1:15432/axi_workflow?sslmode=disable}"
export NOTIFICATION_DATABASE_URL="${NOTIFICATION_DATABASE_URL:-postgresql://axi_notification_app:axi_notification_dev@127.0.0.1:15432/axi_notifications?sslmode=disable}"
export NOTIFICATION_MIGRATION_DATABASE_URL="${NOTIFICATION_MIGRATION_DATABASE_URL:-postgresql://axi_notification_migrator:axi_notification_migrator_dev@127.0.0.1:15432/axi_notifications?sslmode=disable}"
export FILE_DATABASE_URL="${FILE_DATABASE_URL:-postgresql://axi_file_app:axi_file_dev@127.0.0.1:15432/axi_files?sslmode=disable}"
export FILE_MIGRATION_DATABASE_URL="${FILE_MIGRATION_DATABASE_URL:-postgresql://axi_file_migrator:axi_file_migrator_dev@127.0.0.1:15432/axi_files?sslmode=disable}"
export FILE_STORAGE_BACKEND="${FILE_STORAGE_BACKEND:-local}"
export FILE_STORAGE_PATH="${FILE_STORAGE_PATH:-${REPO_ROOT}/.cache/axi-workbench/files}"

export IDENTITY_INTERNAL_SERVICE_TOKEN="${IDENTITY_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}"
export PLATFORM_INTERNAL_SERVICE_TOKEN="${PLATFORM_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}"
export FILE_INTERNAL_SERVICE_TOKEN="${FILE_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}"
export WORKFLOW_INTERNAL_SERVICE_TOKEN="${WORKFLOW_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}"
export NOTIFICATION_INTERNAL_SERVICE_TOKEN="${NOTIFICATION_INTERNAL_SERVICE_TOKEN:-axi-development-internal-token}"
export GATEWAY_IDENTITY_INTERNAL_TOKEN="${GATEWAY_IDENTITY_INTERNAL_TOKEN:-${IDENTITY_INTERNAL_SERVICE_TOKEN}}"
export GATEWAY_PLATFORM_INTERNAL_TOKEN="${GATEWAY_PLATFORM_INTERNAL_TOKEN:-${PLATFORM_INTERNAL_SERVICE_TOKEN}}"
export GATEWAY_FILE_INTERNAL_TOKEN="${GATEWAY_FILE_INTERNAL_TOKEN:-${FILE_INTERNAL_SERVICE_TOKEN}}"
export GATEWAY_WORKFLOW_INTERNAL_TOKEN="${GATEWAY_WORKFLOW_INTERNAL_TOKEN:-${WORKFLOW_INTERNAL_SERVICE_TOKEN}}"
export GATEWAY_NOTIFICATION_INTERNAL_TOKEN="${GATEWAY_NOTIFICATION_INTERNAL_TOKEN:-${NOTIFICATION_INTERNAL_SERVICE_TOKEN}}"
export GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN="${GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN:-axi-development-internal-token}"
export AXI_GATEWAY_CONTROL_PLANE_TOKEN="${AXI_GATEWAY_CONTROL_PLANE_TOKEN:-${GATEWAY_CONTROL_PLANE_INTERNAL_TOKEN}}"
export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://127.0.0.1:8092}"
export IDENTITY_ADAPTER_URL="${IDENTITY_ADAPTER_URL:-http://127.0.0.1:8081}"
export PLATFORM_CORE_URL="${PLATFORM_CORE_URL:-http://127.0.0.1:8082}"
export WORKFLOW_SERVICE_URL="${WORKFLOW_SERVICE_URL:-http://127.0.0.1:8083}"
export NOTIFICATION_SERVICE_URL="${NOTIFICATION_SERVICE_URL:-http://127.0.0.1:8084}"
export FILE_SERVICE_URL="${FILE_SERVICE_URL:-http://127.0.0.1:8085}"
export NOTIFICATION_KAFKA_BROKERS="${NOTIFICATION_KAFKA_BROKERS:-}"
export AXI_WORKSTATION_ROOT="${AXI_WORKSTATION_ROOT:-/Volumes/code/workspace}"

mkdir -p "${RUN_DIR}" "${FILE_STORAGE_PATH}"
PIDS=()
NAMES=()

cleanup() {
  set +e
  trap - INT TERM EXIT
  for pid in "${PIDS[@]}"; do kill "${pid}" 2>/dev/null || true; done
  sleep 1
  for pid in "${PIDS[@]}"; do pkill -P "${pid}" 2>/dev/null || true; done
}
trap cleanup INT TERM EXIT

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-30}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if curl --silent --show-error --fail --max-time 2 "${url}" >/dev/null 2>&1; then
      echo "[ready] ${name} ${url}"
      return 0
    fi
    sleep 1
  done
  echo "[error] ${name} did not become ready: ${url}" >&2
  return 1
}

run_service() {
  local name="$1"
  shift
  echo "[start] ${name}"
  (
    cd "${REPO_ROOT}"
    exec "$@"
  ) >"${RUN_DIR}/${name}.log" 2>&1 &
  PIDS+=("$!")
  NAMES+=("${name}")
}

echo "[infra] starting PostgreSQL, Redis and Mailpit"
docker compose -f "${REPO_ROOT}/docker-compose.yml" up -d postgres redis mailpit

for i in $(seq 1 30); do
  postgres_health="$(docker inspect -f '{{.State.Health.Status}}' epap-postgres 2>/dev/null || true)"
  redis_health="$(docker inspect -f '{{.State.Health.Status}}' epap-redis 2>/dev/null || true)"
  if [[ "${postgres_health}" == "healthy" && "${redis_health}" == "healthy" ]]; then break; fi
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' epap-postgres)" == "healthy" ]]
[[ "$(docker inspect -f '{{.State.Health.Status}}' epap-redis)" == "healthy" ]]

echo "[db] ensuring local databases and roles"
docker exec epap-postgres psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/init-db.sql >/dev/null

echo "[db] applying migrations"
(cd "${REPO_ROOT}/services/identity-adapter" && go run ./cmd/migrate)
(cd "${REPO_ROOT}/services/platform-core" && go run ./cmd/migrate)
(cd "${REPO_ROOT}/services/workflow-engine" && uv run --with-requirements requirements.txt python migrate.py)
(cd "${REPO_ROOT}/services/notification-service" && go run ./cmd/migrate)
(cd "${REPO_ROOT}/services/file-service" && uv run --with-requirements requirements.txt python migrate.py)

run_service control-plane bash "${REPO_ROOT}/services/control-plane/scripts/dev-run.sh"
wait_for_url control-plane "http://127.0.0.1:${CONTROL_PLANE_PORT}/health"
run_service identity-adapter bash "${REPO_ROOT}/services/identity-adapter/scripts/dev-run.sh"
wait_for_url identity-adapter "http://127.0.0.1:${IDENTITY_ADAPTER_PORT}/ready"
run_service platform-core bash "${REPO_ROOT}/services/platform-core/scripts/dev-run.sh"
wait_for_url platform-core "http://127.0.0.1:${PLATFORM_CORE_PORT}/ready"
run_service workflow-engine bash -c "cd '${REPO_ROOT}/services/workflow-engine' && exec uv run --with-requirements requirements.txt uvicorn main:app --host 127.0.0.1 --port '${WORKFLOW_SERVICE_PORT}'"
wait_for_url workflow-engine "http://127.0.0.1:${WORKFLOW_SERVICE_PORT}/ready"
run_service notification-service bash -c "cd '${REPO_ROOT}/services/notification-service' && exec go run ."
wait_for_url notification-service "http://127.0.0.1:${NOTIFICATION_PORT}/ready"
run_service file-service bash -c "cd '${REPO_ROOT}/services/file-service' && exec uv run --with-requirements requirements.txt uvicorn main:app --host 127.0.0.1 --port '${FILE_SERVICE_PORT}'"
wait_for_url file-service "http://127.0.0.1:${FILE_SERVICE_PORT}/files/ready"
run_service api-gateway bash "${REPO_ROOT}/services/api-gateway/scripts/dev-run.sh"
wait_for_url api-gateway "http://127.0.0.1:${GATEWAY_PORT}/ready"

echo "[ready] complete local backend profile"
echo "[ready] logs: ${RUN_DIR}"
while :; do
  for index in "${!PIDS[@]}"; do
    if ! kill -0 "${PIDS[$index]}" 2>/dev/null; then
      echo "[error] ${NAMES[$index]} exited; inspect ${RUN_DIR}/${NAMES[$index]}.log" >&2
      exit 1
    fi
  done
  sleep 2
done

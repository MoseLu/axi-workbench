#!/usr/bin/env bash
# Regression checks for the local Gateway launcher. Everything runs in an
# isolated repository-shaped temporary tree; curl/go are fakes, so no service
# or local credential is touched.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." &> /dev/null && pwd)"
LAUNCHER_SOURCE="${LAUNCHER_SOURCE:-${SCRIPT_DIR}/dev-run.sh}"
PACKAGE_SOURCE="${REPO_ROOT}/services/api-gateway/package.json"
MAKEFILE_SOURCE="${REPO_ROOT}/Makefile"
SENTINEL_SECRET="sentinel-smtp-password-must-not-leak"
UNSET_REDIS="__axi_unset_redis__"
EMPTY_REDIS_ERROR="GATEWAY_REDIS_URL 已显式设为空；本地持久会话必须配置 Redis 地址。"
REDIS_DB_ERROR="GATEWAY_REDIS_URL 必须使用本地 Gateway 专用 Redis DB 0（路径 /0）。"
REDIS_URL_FORMAT_ERROR="GATEWAY_REDIS_URL 不得包含 query 或 fragment，且必须使用本地 Gateway 专用 Redis DB 0（路径 /0）。"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/axi-gateway-dev-run-test.XXXXXX")"

cleanup() {
  rm -rf "${TEST_ROOT}"
}
trap cleanup EXIT HUP INT TERM

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

if [[ ! -f "${LAUNCHER_SOURCE}" || ! -f "${PACKAGE_SOURCE}" || ! -f "${MAKEFILE_SOURCE}" ]]; then
  fail "launcher, package, or Makefile source does not exist"
fi

mkdir -p "${TEST_ROOT}/bin" "${TEST_ROOT}/services/api-gateway/scripts"
cp "${LAUNCHER_SOURCE}" "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"
cp "${PACKAGE_SOURCE}" "${TEST_ROOT}/services/api-gateway/package.json"
cp "${MAKEFILE_SOURCE}" "${TEST_ROOT}/Makefile"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'exit "${FAKE_CURL_STATUS:-0}"' \
  > "${TEST_ROOT}/bin/curl"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -eu' \
  '{' \
  '  printf "GO_ARGS=%s\\n" "$*"' \
  '  printf "GATEWAY_REDIS_URL=%s\\n" "${GATEWAY_REDIS_URL-<unset>}"' \
  '  printf "GATEWAY_REQUIRE_DURABLE_SESSION_STORE=%s\\n" "${GATEWAY_REQUIRE_DURABLE_SESSION_STORE-<unset>}"' \
  '} > "${FAKE_GO_ENV_FILE}"' \
  > "${TEST_ROOT}/bin/go"
chmod +x "${TEST_ROOT}/bin/curl" "${TEST_ROOT}/bin/go"

OBSERVED_ENV="${TEST_ROOT}/observed.env"

write_env() {
  local redis_line="$1"
  {
    printf '%s\n' 'EMAIL_LOGIN_OWNER_EMAIL=owner@example.test'
    printf '%s\n' "SMTP_PASSWORD=${SENTINEL_SECRET}"
    if [[ -n "${redis_line}" ]]; then
      printf '%s\n' "${redis_line}"
    fi
  } > "${TEST_ROOT}/.env"
}

run_command() {
  local stdout_path="$1"
  local stderr_path="$2"
  local inherited_redis_url="$3"
  shift 3
  (
    if [[ "${inherited_redis_url}" == "${UNSET_REDIS}" ]]; then
      unset GATEWAY_REDIS_URL
    else
      export GATEWAY_REDIS_URL="${inherited_redis_url}"
    fi
    export PATH="${TEST_ROOT}/bin:${PATH}"
    export FAKE_GO_ENV_FILE="${OBSERVED_ENV}"
    "$@"
  ) > "${stdout_path}" 2> "${stderr_path}"
}

assert_observed_line() {
  local expected="$1"
  if ! grep -Fqx "${expected}" "${OBSERVED_ENV}"; then
    fail "fake go did not observe ${expected}"
  fi
}

assert_control_plane_rejected() {
  write_env ""
  rm -f "${OBSERVED_ENV}"
  local stdout_path="${TEST_ROOT}/control-plane.stdout"
  local stderr_path="${TEST_ROOT}/control-plane.stderr"
  if FAKE_CURL_STATUS=22 run_command "${stdout_path}" "${stderr_path}" "${UNSET_REDIS}" bash "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"; then
    fail "unavailable control plane unexpectedly started the Gateway"
  fi
  if ! grep -Fq '移动控制面未就绪' "${stderr_path}"; then
    fail "unavailable control plane did not produce the actionable startup error"
  fi
  if [[ -e "${OBSERVED_ENV}" ]]; then
    fail "Gateway started despite an unavailable control plane"
  fi
}

assert_redis_rejected() {
  local redis_line="$1"
  local inherited_redis_url="$2"
  local case_name="$3"
  local expected_error="$4"
  local stdout_path="${TEST_ROOT}/${case_name}.stdout"
  local stderr_path="${TEST_ROOT}/${case_name}.stderr"

  write_env "${redis_line}"
  if run_command "${stdout_path}" "${stderr_path}" "${inherited_redis_url}" bash "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"; then
    fail "${case_name} Redis URL unexpectedly started the Gateway"
  fi
  if ! grep -Fq "${expected_error}" "${stdout_path}" "${stderr_path}"; then
    fail "${case_name} Redis URL did not report the expected configuration error"
  fi
  if grep -Fq "${SENTINEL_SECRET}" "${stdout_path}" "${stderr_path}"; then
    fail "${case_name} Redis URL leaked the SMTP sentinel"
  fi
}

assert_started() {
  local case_name="$1"
  shift
  local stdout_path="${TEST_ROOT}/${case_name}.stdout"
  local stderr_path="${TEST_ROOT}/${case_name}.stderr"
  write_env ""
  if ! run_command "${stdout_path}" "${stderr_path}" "${UNSET_REDIS}" "$@"; then
    fail "${case_name} did not start through the durable launcher"
  fi
  assert_observed_line 'GO_ARGS=run ./cmd/gateway'
  assert_observed_line 'GATEWAY_REDIS_URL=redis://127.0.0.1:6379/0'
  assert_observed_line 'GATEWAY_REQUIRE_DURABLE_SESSION_STORE=true'
}

assert_control_plane_rejected
assert_started 'launcher' bash "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"
assert_redis_rejected 'GATEWAY_REDIS_URL=' "${UNSET_REDIS}" 'empty' "${EMPTY_REDIS_ERROR}"
assert_redis_rejected "GATEWAY_REDIS_URL='   '" "${UNSET_REDIS}" 'whitespace' "${EMPTY_REDIS_ERROR}"
assert_redis_rejected "GATEWAY_REDIS_URL='redis://127.0.0.1:6379/0?db=2'" "${UNSET_REDIS}" 'query-db2' "${REDIS_URL_FORMAT_ERROR}"
assert_redis_rejected "GATEWAY_REDIS_URL='redis://127.0.0.1:6379/0?db=0'" "${UNSET_REDIS}" 'query-db0' "${REDIS_URL_FORMAT_ERROR}"
assert_redis_rejected "GATEWAY_REDIS_URL='redis://127.0.0.1:6379/0#fragment'" "${UNSET_REDIS}" 'fragment' "${REDIS_URL_FORMAT_ERROR}"
assert_redis_rejected 'GATEWAY_REDIS_URL=redis://127.0.0.1:6379/1' "${UNSET_REDIS}" 'env-db1' "${REDIS_DB_ERROR}"
assert_redis_rejected 'GATEWAY_REDIS_URL=redis://127.0.0.1:6379/2' "${UNSET_REDIS}" 'env-db2' "${REDIS_DB_ERROR}"
assert_redis_rejected '' 'redis://127.0.0.1:6379/2' 'inherited-db2' "${REDIS_DB_ERROR}"
assert_started 'pnpm-dev' pnpm --dir "${TEST_ROOT}/services/api-gateway" run dev
assert_started 'make-dev-gateway' make -C "${TEST_ROOT}" dev-gateway

printf 'ok - dev-run control-plane and durable Redis contracts\n'

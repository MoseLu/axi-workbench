#!/usr/bin/env bash
# Exercises the launcher in an isolated repository-shaped temporary tree. The
# fake go binary records the environment instead of starting a real Gateway.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LAUNCHER_SOURCE="${LAUNCHER_SOURCE:-${SCRIPT_DIR}/dev-run.sh}"
SENTINEL_SECRET="sentinel-smtp-password-must-not-leak"
REDIS_ERROR="GATEWAY_REDIS_URL 已显式设为空；本地持久会话必须配置 Redis 地址。"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/axi-gateway-dev-run-test.XXXXXX")"

cleanup() {
  rm -rf "${TEST_ROOT}"
}
trap cleanup EXIT HUP INT TERM

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

if [[ ! -f "${LAUNCHER_SOURCE}" ]]; then
  fail "launcher source does not exist"
fi

mkdir -p "${TEST_ROOT}/bin" "${TEST_ROOT}/services/api-gateway/scripts"
cp "${LAUNCHER_SOURCE}" "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"
chmod +x "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"

OBSERVED_ENV="${TEST_ROOT}/observed.env"
cat > "${TEST_ROOT}/bin/go" <<'EOF'
#!/usr/bin/env bash
set -eu
{
  printf 'GATEWAY_REDIS_URL=%s\n' "${GATEWAY_REDIS_URL-<unset>}"
  printf 'GATEWAY_REQUIRE_DURABLE_SESSION_STORE=%s\n' "${GATEWAY_REQUIRE_DURABLE_SESSION_STORE-<unset>}"
} > "${FAKE_GO_ENV_FILE}"
EOF
chmod +x "${TEST_ROOT}/bin/go"

write_env() {
  local redis_line="$1"
  {
    printf '%s\n' "EMAIL_LOGIN_OWNER_EMAIL=owner@example.test"
    printf '%s\n' "SMTP_PASSWORD=${SENTINEL_SECRET}"
    if [[ -n "${redis_line}" ]]; then
      printf '%s\n' "${redis_line}"
    fi
  } > "${TEST_ROOT}/.env"
}

run_launcher() {
  local stdout_path="$1"
  local stderr_path="$2"
  (
    unset GATEWAY_REDIS_URL
    export PATH="${TEST_ROOT}/bin:${PATH}"
    export FAKE_GO_ENV_FILE="${OBSERVED_ENV}"
    "${TEST_ROOT}/services/api-gateway/scripts/dev-run.sh"
  ) > "${stdout_path}" 2> "${stderr_path}"
}

assert_observed_line() {
  local expected="$1"
  if ! grep -Fqx "${expected}" "${OBSERVED_ENV}"; then
    fail "fake go did not observe ${expected}"
  fi
}

assert_redis_rejected() {
  local redis_line="$1"
  local case_name="$2"
  local stdout_path="${TEST_ROOT}/${case_name}.stdout"
  local stderr_path="${TEST_ROOT}/${case_name}.stderr"

  write_env "${redis_line}"
  if run_launcher "${stdout_path}" "${stderr_path}"; then
    fail "${case_name} Redis URL unexpectedly started the launcher"
  fi
  if ! grep -Fq "${REDIS_ERROR}" "${stdout_path}" "${stderr_path}"; then
    fail "${case_name} Redis URL did not report the Chinese Redis configuration error"
  fi
  if grep -Fq "${SENTINEL_SECRET}" "${stdout_path}" "${stderr_path}"; then
    fail "${case_name} Redis URL leaked the SMTP sentinel"
  fi
}

write_env ""
if ! run_launcher "${TEST_ROOT}/default.stdout" "${TEST_ROOT}/default.stderr"; then
  fail "unset Redis URL did not start through the fake go binary"
fi
assert_observed_line "GATEWAY_REDIS_URL=redis://127.0.0.1:6379/0"
assert_observed_line "GATEWAY_REQUIRE_DURABLE_SESSION_STORE=true"

assert_redis_rejected "GATEWAY_REDIS_URL=" "empty"
assert_redis_rejected "GATEWAY_REDIS_URL='   '" "whitespace"

printf 'ok - dev-run durable Redis contract\n'

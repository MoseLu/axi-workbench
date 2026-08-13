#!/usr/bin/env bash
# Shell regression checks for the local Gateway launcher. These deliberately
# replace curl/go in PATH so no real service or credential is touched.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
SOURCE_LAUNCHER="${SCRIPT_DIR}/dev-run.sh"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/axi-gateway-dev-run.XXXXXX")"
trap 'rm -rf "${TEMP_ROOT}"' EXIT

setup_case() {
  local case_root="$1"
  mkdir -p "${case_root}/services/api-gateway/scripts" "${case_root}/bin"
  cp "${SOURCE_LAUNCHER}" "${case_root}/services/api-gateway/scripts/dev-run.sh"
  chmod +x "${case_root}/services/api-gateway/scripts/dev-run.sh"
  printf '%s\n' \
    'EMAIL_LOGIN_OWNER_EMAIL=owner@example.test' \
    > "${case_root}/.env"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'exit "${FAKE_CURL_STATUS:-0}"' \
    > "${case_root}/bin/curl"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'printf "%s\\n" "$*" > "${FAKE_GO_LOG:?}"' \
    > "${case_root}/bin/go"
  chmod +x "${case_root}/bin/curl" "${case_root}/bin/go"
}

case_unavailable="${TEMP_ROOT}/unavailable"
setup_case "${case_unavailable}"
if PATH="${case_unavailable}/bin:${PATH}" FAKE_CURL_STATUS=22 FAKE_GO_LOG="${case_unavailable}/go.log" \
  bash "${case_unavailable}/services/api-gateway/scripts/dev-run.sh" >"${case_unavailable}/stdout" 2>"${case_unavailable}/stderr"; then
  echo "expected launcher to reject an unavailable control plane" >&2
  exit 1
fi
if ! grep -q '移动控制面未就绪' "${case_unavailable}/stderr"; then
  echo "launcher did not explain the unavailable control plane" >&2
  exit 1
fi
if [[ -e "${case_unavailable}/go.log" ]]; then
  echo "launcher invoked Go despite an unavailable control plane" >&2
  exit 1
fi

case_ready="${TEMP_ROOT}/ready"
setup_case "${case_ready}"
PATH="${case_ready}/bin:${PATH}" FAKE_CURL_STATUS=0 FAKE_GO_LOG="${case_ready}/go.log" \
  bash "${case_ready}/services/api-gateway/scripts/dev-run.sh" >"${case_ready}/stdout" 2>"${case_ready}/stderr"
if ! grep -q '^run ./cmd/gateway$' "${case_ready}/go.log"; then
  echo "launcher did not invoke the Gateway after the control plane was ready" >&2
  exit 1
fi

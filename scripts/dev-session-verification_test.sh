#!/usr/bin/env bash
# Static guardrails for the isolated Web-session launcher. No service starts.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LAUNCHER="${SCRIPT_DIR}/dev-session-verification.sh"

bash -n "${LAUNCHER}"
grep -q 'SESSION_VERIFY_IDENTITY_PORT:-18081' "${LAUNCHER}"
grep -q 'SESSION_VERIFY_GATEWAY_PORT:-18088' "${LAUNCHER}"
grep -q 'SESSION_VERIFY_WEB_PORT:-15173' "${LAUNCHER}"
grep -q 'SESSION_VERIFY_ENV_FILE' "${LAUNCHER}"
grep -q 'VITE_API_PROXY_TARGET' "${LAUNCHER}"
grep -q 'pnpm exec vite --port' "${LAUNCHER}"
grep -q 'AXI_GATEWAY_SKIP_CONTROL_PLANE_READY_CHECK=true' "${LAUNCHER}"
if grep -Eq 'GATEWAY_PORT="\$\{SESSION_VERIFY_GATEWAY_PORT:-8088\}"|WEB_PORT="\$\{SESSION_VERIFY_WEB_PORT:-5174\}"' "${LAUNCHER}"; then
  echo "isolated session launcher must not bind a main Mobile runtime port" >&2
  exit 1
fi

#!/usr/bin/env bash
# scripts/gateway-ha/bundle-inspection.sh
#
# GHA-NEXT-031 — Bundle inspection (secret leak guard).
#
# Scans the gateway TypeScript build output (and any inline bundles)
# for any string that looks like a Bearer token, an API key, a
# cookie, or a configured secret. This is a release-time guard so
# a future bundle step (esbuild / rollup) cannot silently embed an
# `AXI_DOCS_TOKEN` value, a `GATEWAY_API_KEYS` value, or a raw
# `Authorization: Bearer` header into the public distribution.
#
# Usage:
#   bash scripts/gateway-ha/bundle-inspection.sh [paths...]
#   # defaults to apps/gateway/src + dist if present
#
# Exit codes:
#   0  no secret-shaped strings found
#   1  at least one candidate match (printed to stderr)
#   2  usage error
#
# The scan is intentionally narrow:
#   - Looks for raw `Bearer <space><value>` patterns (40+ chars of
#     base64-ish content). Real Axi tokens are 48+ chars; this
#     guard requires the same minimum so it does not false-flag
#     unrelated strings.
#   - Looks for "token=" / "secret=" / "apiKey=" / "password="
#     assignments in source (catches accidental env dumps).
#   - Skips node_modules / .git / .cache / dist-cache.
#
# This script does NOT modify any file; it only reads and grep.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

scan_paths=("$@")
if [[ ${#scan_paths[@]} -eq 0 ]]; then
  scan_paths=(
    "$REPO_ROOT/apps/gateway/src"
    "$REPO_ROOT/packages/gateway"
    "$REPO_ROOT/dist"
  )
fi

# Files / dirs we never want to scan.
exclude_args=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=.cache
  --exclude-dir=.worktrees
  --exclude=*.map
  --exclude=*.lock
  --exclude=pnpm-lock.yaml
  --exclude=bundle-inspection.sh
)

fail_count=0

scan() {
  local label="$1" pattern="$2"
  echo "[bundle-inspection] scanning ${label}..."
  local matches
  # -r recursive, -I skip binary, -n line numbers, -E extended regex
  matches=$(grep -rInE "${exclude_args[@]}" "$pattern" "${scan_paths[@]}" 2>/dev/null || true)
  if [[ -n "${matches}" ]]; then
    echo "[bundle-inspection] FAIL ${label}: potential secret-shaped string(s) found" >&2
    echo "${matches}" >&2
    fail_count=$((fail_count + 1))
  else
    echo "[bundle-inspection] ok ${label}"
  fi
}

# Pattern 1: Authorization: Bearer <long-token>  (the long-token
# component is at least 40 chars of base64-ish content; this matches
# real Axi docs tokens without false-flagging the literal "Bearer"
# word in comments / docs).
scan "bearer-tokens" 'Bearer\s+[A-Za-z0-9._\-+/=]{40,}'
# Pattern 2: token= / secret= / password= assignments.
scan "env-assignments" '(token|secret|password)\s*=\s*[A-Za-z0-9._\-+/=]{12,}'
# Pattern 3: apiKey / api_key literal assignment.
scan "api-key-assignments" 'api[_-]?key\s*[:=]\s*["'\''][A-Za-z0-9._\-+/=]{12,}["'\'']'

if [[ ${fail_count} -gt 0 ]]; then
  echo "[bundle-inspection] FAIL: ${fail_count} secret-shaped pattern(s) found" >&2
  exit 1
fi

echo "[bundle-inspection] PASS — no secret-shaped strings found in ${scan_paths[*]}"
exit 0
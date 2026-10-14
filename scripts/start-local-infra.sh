#!/usr/bin/env bash
# start-local-infra.sh — placeholder stub (recreated 2026-10-14, see workbench HANDOFF).
#
# Originally created as part of the local infra bring-up work but was missing
# from the working tree. This stub is intentionally inert: it does NOT start
# any service, daemon, or background process. It only prints a clear banner
# and exits 0 so that downstream callers / docs that reference this path
# remain valid. Replace with the real implementation when restored.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
start-local-infra.sh — placeholder local infra bring-up

Usage:
  bash scripts/start-local-infra.sh [--help]

This is a STUB. It does NOT start Postgres / Redis / gateway / etc. The real
implementation should source REPO_ROOT/.env, start the required daemons
(see scripts/dev-backend.sh for the production-shaped reference), and wait
for each port to be ready.
EOF
  exit 0
fi

echo "[stub] start-local-infra at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  repo_root: ${REPO_ROOT}"
echo "  no services started; this script is a placeholder"
exit 0
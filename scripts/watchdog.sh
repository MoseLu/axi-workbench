#!/usr/bin/env bash
# watchdog.sh — placeholder stub (recreated 2026-10-14, see workbench HANDOFF).
#
# Originally created as part of the local infra watchdog work but was missing
# from the working tree. This stub is intentionally inert: it does NOT
# probe any port, restart any service, or take any state-changing action.
# It only prints a banner line and exits 0 so that the companion
# scripts/watchdog-launchd.plist (LaunchAgent) has a valid --once handler path.
#
# IMPORTANT: the LaunchAgent is NOT installed (the orphan launchd entry was
# unloaded by fix-orphan-launchd-watchdog). Owner must review this stub
# AND the plist AND manually install via launchctl when ready.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

mode="loop"
if [[ "${1:-}" == "--once" ]]; then
  mode="once"
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
watchdog.sh — placeholder port / process watchdog

Usage:
  bash scripts/watchdog.sh [--once | --help]

This is a STUB. It does NOT probe ports, restart processes, or modify state.
The --once mode is for the LaunchAgent (scripts/watchdog-launchd.plist).
The LaunchAgent is NOT installed; install manually after review.
EOF
  exit 0
fi

echo "[stub] watchdog (${mode}) at $(date -u +%Y-%m-%dT%H:%M:%SZ) repo_root=${REPO_ROOT}"
exit 0
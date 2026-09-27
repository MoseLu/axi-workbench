#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${BLINKO_SYNC_ENV_FILE:-/etc/blinko-sync.env}"
APP_ENV_FILE="${APP_ENV_FILE:-/root/.hermes/apps/axi-docs/app/.env.server}"
LOCK_FILE="${LOCK_FILE:-/var/lock/blinko-nutstore-sync.lock}"

if [[ -f "$APP_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$APP_ENV_FILE"
  set +a
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

require_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "[fatal] missing required env: $name" >&2
    exit 1
  fi
}

APP_DIR="${APP_DIR:-/root/.hermes/apps/axi-docs/app}"
BLINKO_SYNC_DIR="${BLINKO_SYNC_DIR:-/srv/sync/blinko-notes}"
BLINKO_API_URL="${BLINKO_API_URL:-http://127.0.0.1:1111/api/v1}"
BLINKO_RCLONE_REMOTE_NAME="${BLINKO_RCLONE_REMOTE_NAME:-nutstore}"
BLINKO_RCLONE_VENDOR="${BLINKO_RCLONE_VENDOR:-other}"
BLINKO_RCLONE_REMOTE_PATH="${BLINKO_RCLONE_REMOTE_PATH:-axi-docs/blinko-notes}"
RCLONE_TRANSFERS="${RCLONE_TRANSFERS:-4}"

require_var BLINKO_TOKEN
require_var BLINKO_RCLONE_URL
require_var BLINKO_RCLONE_USER
require_var BLINKO_RCLONE_PASSWORD

ensure_remote_path() {
  local remote_name="$1"
  local relative_path="$2"
  local current=""

  IFS='/' read -r -a segments <<< "$relative_path"
  for segment in "${segments[@]}"; do
    [[ -z "$segment" ]] && continue
    if [[ -z "$current" ]]; then
      current="$segment"
    else
      current="$current/$segment"
    fi
    rclone mkdir "${remote_name}:${current}"
  done
}

if ! command -v rclone >/dev/null 2>&1; then
  echo "[fatal] rclone is not installed" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[info] sync job already running, skip"
  exit 0
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

OBSCURED_PASS="$(rclone obscure "$BLINKO_RCLONE_PASSWORD")"
cat > "$TMP_DIR/rclone.conf" <<EOF
[${BLINKO_RCLONE_REMOTE_NAME}]
type = webdav
url = ${BLINKO_RCLONE_URL}
vendor = ${BLINKO_RCLONE_VENDOR}
user = ${BLINKO_RCLONE_USER}
pass = ${OBSCURED_PASS}
EOF

export RCLONE_CONFIG="$TMP_DIR/rclone.conf"
REMOTE_PATH="${BLINKO_RCLONE_REMOTE_NAME}:${BLINKO_RCLONE_REMOTE_PATH}"

mkdir -p "$BLINKO_SYNC_DIR"
ensure_remote_path "$BLINKO_RCLONE_REMOTE_NAME" "$BLINKO_RCLONE_REMOTE_PATH"

echo "[step] pull markdown mirror from webdav"
rclone copy "$REMOTE_PATH" "$BLINKO_SYNC_DIR" \
  --create-empty-src-dirs \
  --fast-list \
  --transfers "$RCLONE_TRANSFERS" \
  --checkers "$RCLONE_TRANSFERS" \
  --exclude ".sync.lock"

echo "[step] reconcile mirror with cloud blinko"
cd "$APP_DIR"
export BLINKO_API_URL
export BLINKO_SYNC_DIR
node ./scripts/blinko-sync-cycle.mjs

echo "[step] push markdown mirror back to webdav"
rclone copy "$BLINKO_SYNC_DIR" "$REMOTE_PATH" \
  --create-empty-src-dirs \
  --fast-list \
  --transfers "$RCLONE_TRANSFERS" \
  --checkers "$RCLONE_TRANSFERS" \
  --exclude ".sync.lock"

echo "[done] blinko mirror sync completed"

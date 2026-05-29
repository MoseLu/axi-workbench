#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$("$ROOT_DIR/scripts/build_app.sh")"
DEST_PATH="/Applications/$(basename "$APP_PATH")"

rm -rf "$DEST_PATH"
cp -R "$APP_PATH" "$DEST_PATH"
xattr -dr com.apple.quarantine "$DEST_PATH" >/dev/null 2>&1 || true
codesign --force --deep --sign - "$DEST_PATH" >/dev/null 2>&1 || true

echo "$DEST_PATH"

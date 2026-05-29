#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$("$ROOT_DIR/scripts/install_app.sh")"

APP_BIN_PATH="$APP_PATH/Contents/MacOS/OllamaMenuAssistant"
pkill -f "$APP_BIN_PATH" >/dev/null 2>&1 || true
open -n "$APP_PATH"

#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="OllamaMenuAssistant"
APP_BUNDLE_NAME="Ollama Menu Assistant"
BUILD_DIR="$ROOT_DIR/.build/apple/Build/Products/Release"
APP_DIR="$ROOT_DIR/dist/$APP_BUNDLE_NAME.app"

cd "$ROOT_DIR"

"$ROOT_DIR/scripts/make_icns.sh" >/dev/null

xcodebuild \
  -scheme "$APP_NAME" \
  -configuration Release \
  -destination "platform=macOS" \
  -derivedDataPath "$ROOT_DIR/.build/apple" \
  CODE_SIGNING_ALLOWED=NO \
  build >/dev/null

PET_APP_PATH="$("$ROOT_DIR/scripts/build_pet_runner_app.sh")"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources" "$APP_DIR/Contents/Library/Helpers"

cp "$ROOT_DIR/Resources/Info.plist" "$APP_DIR/Contents/Info.plist"
cp "$BUILD_DIR/$APP_NAME" "$APP_DIR/Contents/MacOS/$APP_NAME"
if [[ -d "$PET_APP_PATH" ]]; then
  ditto "$PET_APP_PATH" "$APP_DIR/Contents/Library/Helpers/$(basename "$PET_APP_PATH")"
fi
if [[ -f "$ROOT_DIR/Resources/AppIcon.icns" ]]; then
  cp "$ROOT_DIR/Resources/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
fi
if [[ -d "$ROOT_DIR/Resources/Skills" ]]; then
  ditto "$ROOT_DIR/Resources/Skills" "$APP_DIR/Contents/Resources/Skills"
fi

chmod +x "$APP_DIR/Contents/MacOS/$APP_NAME"
codesign --force --deep --sign - "$APP_DIR" >/dev/null 2>&1 || true

echo "$APP_DIR"

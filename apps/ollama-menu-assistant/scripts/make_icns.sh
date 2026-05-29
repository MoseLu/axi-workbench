#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ICON_PNG="$ROOT_DIR/Resources/AppIcon.png"
ICONSET_DIR="$ROOT_DIR/Resources/AppIcon.iconset"
ICNS_PATH="$ROOT_DIR/Resources/AppIcon.icns"

swift "$ROOT_DIR/scripts/generate_icon.swift" "$ICON_PNG" >/dev/null

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

cp "$ICON_PNG" "$ICONSET_DIR/icon_512x512@2x.png"
sips -z 16 16 "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$ICON_PNG" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_PATH"
echo "$ICNS_PATH"

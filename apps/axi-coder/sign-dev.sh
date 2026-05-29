#!/bin/zsh
# Post-build signing script for Axi Coder dev binary
# This prevents macOS from repeatedly asking for system permissions
# when the binary changes due to recompilation.

BINARY="src-tauri/target/debug/axi-coder"
ENTITLEMENTS="src-tauri/entitlements.plist"
IDENTITY="DesktopNewFile Local Code Signing"

if [ ! -f "$BINARY" ]; then
  echo "[sign] Binary not found yet: $BINARY"
  exit 0
fi

echo "[sign] Signing dev binary with entitlements..."
codesign --force --sign "$IDENTITY" \
  --entitlements "$ENTITLEMENTS" \
  --options runtime \
  "$BINARY" 2>&1 && echo "[sign] ✓ Signed successfully" || echo "[sign] ✗ Sign failed (ignored)"

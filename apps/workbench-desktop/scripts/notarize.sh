#!/usr/bin/env bash
# Apple notarize 占位脚本。
# 真正接通需要：
#   1. Apple Developer ID（付费账号）；
#   2. App-specific password（https://appleid.apple.com → App-Specific Passwords）；
#   3. 在 Keychain 中保存：`xcrun notarytool store-credentials "workbench-desktop-notary" \
#                                       --apple-id "$APPLE_ID" \
#                                       --team-id  "$APPLE_TEAM_ID" \
#                                       --password  "$APPLE_APP_SPECIFIC_PASSWORD"`
# 默认仅做 dry-run 检查，避免误把未签名的 .app 推到公网。

set -euo pipefail

BUNDLE_PATH="${1:-apps/workbench-desktop/src-tauri/target/release/bundle/macos/Workbench.app}"
DMG_PATH="${2:-apps/workbench-desktop/src-tauri/target/release/bundle/dmg/Workbench_0.1.0_aarch64.dmg}"

echo "[notarize] bundle: $BUNDLE_PATH"
echo "[notarize] dmg:    $DMG_PATH"

if [[ ! -d "$BUNDLE_PATH" ]]; then
  echo "[notarize] FAIL: $BUNDLE_PATH 不存在。先跑 \`pnpm build:desktop\`。"
  # Tauri 2 默认 build 时会把 .app 嵌入 .dmg 后删除本地 .app；尝试从 .dmg 抽出
  if [[ -f "$DMG_PATH" ]]; then
    echo "[notarize] 尝试从 .dmg 抽出 .app..."
    MNT=$(hdiutil attach -nobrowse -readonly "$DMG_PATH" 2>/dev/null | awk '/\/Volumes\// {print $NF}' | head -n1)
    if [[ -n "$MNT" && -d "$MNT/Workbench.app" ]]; then
      mkdir -p "$(dirname "$BUNDLE_PATH")"
      cp -R "$MNT/Workbench.app" "$BUNDLE_PATH"
      hdiutil detach "$MNT" >/dev/null 2>&1 || true
      echo "[notarize] 已从 .dmg 抽出 .app 到 $BUNDLE_PATH"
    else
      echo "[notarize] FAIL: 无法从 .dmg 抽出 .app，abort。"
      exit 1
    fi
  else
    exit 1
  fi
fi

if [[ ! -f "$DMG_PATH" ]]; then
  echo "[notarize] FAIL: $DMG_PATH 不存在。"
  exit 1
fi

echo "[notarize] 校验 .app 签名..."
codesign --verify --deep --strict --verbose=2 "$BUNDLE_PATH"
echo "[notarize] 校验 .dmg 签名..."
codesign --verify --verbose=2 "$DMG_PATH"

if [[ -z "${APPLE_ID:-}" || -z "${APPLE_TEAM_ID:-}" || -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  echo "[notarize] DRY-RUN: 未提供 APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD，跳过实际公证。"
  echo "[notarize] DRY-RUN: 准备好后执行："
  echo "            APPLE_ID=you@example.com APPLE_TEAM_ID=ABCDE12345 \\"
  echo "            APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop \\"
  echo "            ./scripts/notarize.sh"
  exit 0
fi

KEYCHAIN_PROFILE="${KEYCHAIN_PROFILE:-workbench-desktop-notary}"

echo "[notarize] 用 notarytool 提交 .dmg 进行公证…"
xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "$KEYCHAIN_PROFILE" \
  --wait \
  --timeout 10m

echo "[notarize] 给 .app 打 staple ticket…"
xcrun stapler staple "$BUNDLE_PATH"
echo "[notarize] 给 .dmg 打 staple ticket…"
xcrun stapler staple "$DMG_PATH"

echo "[notarize] 验证公证结果："
xcrun stapler validate "$BUNDLE_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type execute --verbose=2 "$BUNDLE_PATH"
spctl --assess --type open --verbose=2 "$DMG_PATH"

echo "[notarize] DONE"

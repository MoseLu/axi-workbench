#!/usr/bin/env bash
# dev-workspace.sh —— axiom-docs 的零配置启动脚本
#
# 自动探测 /Volumes/code/workspace 当前布局，把真实存在的路径 export 为
# AXI_*_PATH env vars，再切到 app/ 子目录启动 vite dev server。
#
# 用法：
#   bash scripts/dev-workspace.sh          # 正常启动
#   bash scripts/dev-workspace.sh --dry-run # 只打印探测结果，不启动
#
# 通过 WORKSPACE_ROOT 环境变量可覆盖工作区根路径，便于在其他机器/容器里跑。

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      echo "Usage: dev-workspace.sh [--dry-run]"
      echo ""
      echo "  --dry-run   仅打印探测到的 AXI_*_PATH env vars，不启动 dev server"
      echo "  -h, --help  显示本帮助"
      exit 0
      ;;
    *)
      echo "[dev-workspace] unknown arg: $arg (use --dry-run or --help)" >&2
      exit 2
      ;;
  esac
done

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/Volumes/code/workspace}"
APPS_DIR="$WORKSPACE_ROOT/workbench/axi-workbench/apps/axi-docs"

# 允许通过同名 env var 直接覆盖探测结果（ADR-008 后默认路径变更）
AXI_SKILLS_PATH="${AXI_SKILLS_PATH:-$WORKSPACE_ROOT/foundation/axi-skills}"
AXI_RULES_PATH="${AXI_RULES_PATH:-$WORKSPACE_ROOT/foundation/axi-rules}"

if [ ! -d "$APPS_DIR" ]; then
  echo "[dev-workspace] FAIL: app dir not found: $APPS_DIR" >&2
  echo "[dev-workspace] hint: set WORKSPACE_ROOT to your workspace mount" >&2
  exit 1
fi

# emit_export <key> <path> — 仅在路径真实存在时 export
emit_export() {
  local key="$1"
  local value="$2"
  if [ -d "$value" ]; then
    export "$key=$value"
    echo "[dev-workspace] $key=$value"
  else
    echo "[dev-workspace] SKIP $key (not found: $value)"
  fi
}

echo "[dev-workspace] WORKSPACE_ROOT=$WORKSPACE_ROOT"

emit_export "AXI_DOCS_CONTENT_PATH"        "$APPS_DIR/docs/content"
emit_export "AXI_RULES_PATH"               "$WORKSPACE_ROOT/foundation/axi-rules"
emit_export "AXI_WORKSPACE_GOVERNANCE_PATH" "$WORKSPACE_ROOT/foundation/workspace-governance"

# 探测 axi-skills（按优先级尝试若干候选）
SKILLS_FOUND=0
for cand in \
  "$WORKSPACE_ROOT/foundation/axi-skills" \
  "$HOME/.claude/skills/axi-skills" \
  "$WORKSPACE_ROOT/foundation/axi-skills"; do
  if [ -d "$cand" ]; then
    export AXI_SKILLS_PATH="$cand"
    echo "[dev-workspace] AXI_SKILLS_PATH=$cand"
    SKILLS_FOUND=1
    break
  fi
done
if [ "$SKILLS_FOUND" -eq 0 ]; then
  echo "[dev-workspace] SKIP AXI_SKILLS_PATH (no candidate found)"
fi

# 关闭未启用的 source，避免 dev server 启动时反复扫描
export AXI_SKILLS_ZH_ENABLED=${AXI_SKILLS_ZH_ENABLED:-false}
export SKILL_REGISTRY_ENABLED=${SKILL_REGISTRY_ENABLED:-false}
export DBSKILL_CONTENT_ASSETS_ENABLED=${DBSKILL_CONTENT_ASSETS_ENABLED:-false}

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dev-workspace] DRY-RUN: would exec: cd '$APPS_DIR/app' && pnpm dev"
  exit 0
fi

cd "$APPS_DIR/app"
exec pnpm dev

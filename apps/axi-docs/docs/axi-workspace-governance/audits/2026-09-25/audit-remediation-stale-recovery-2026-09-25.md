# Stale Verification Recovery Runbook (2026-09-25)

> 本文件由 audit-remediation 自动生成。解决工作区 12 个 stale 项目的 verification 时间戳过期问题。

## 背景

`workspace-project handoff-check` 把 verification 命令的 `lastVerifiedAt` 超过 30 天的项目标记为 `stale`。
截至 2026-09-25，工作区 24 个被 handoff-check 跟踪的项目中有 12 个处于 `stale` 状态。

每个项目的 manifest 的 `commands.verify` 已经声明了具体的验证命令；执行后会自动更新 `verification.lastVerifiedAt`。

## 一次性重置脚本

下列脚本会按顺序进入每个项目目录并运行其 verify 命令。每条命令相互独立，**失败也不会影响其他项目**。

```bash
# 在工作区根运行
set -e
cd /Volumes/code/workspace

# 1. axi-rules（最严重，39 天）
cd foundation/axi-rules && make rules && python3 scripts/test-handoff-workflow.py --self-test && cd ../..

# 2. axi-registry
cd foundation/axi-registry && \
  node -e "JSON.parse(require('fs').readFileSync('docs/project-docs.manifest.json','utf8'))" && \
  for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md; do test -f "$f" || exit 1; done && \
  cd ../..

# 3. axi-skills
cd foundation/axi-skills && python3 scripts/verify.py && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff && cd ../..

# 4. axi-ui
cd foundation/axi-ui && pnpm test && cd ../..

# 5. axi-notify
cd foundation/axi-notify && make test-relay && make smoke-relay-local && make android-agent-verify && git check-ignore android-app/app/google-services.json && cd ../..

# 6. axi-observability
cd foundation/axi-observability && python3 -m unittest discover -s python/axi_observability/tests -v && \
  node --test 'control-plane/test/**/*.test.mjs' && \
  node /Volumes/code/workspace/scripts/workspace-project validate && \
  node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs && \
  cd ../..

# 7. axi-agent
cd agent-cluster/axi-agent && cd backend && pytest tests/ && cd .. && \
  pnpm --dir frontend build && \
  pnpm --dir apps/desktop-glass-ui build && \
  pnpm --dir infra/axi-agent-mcp test && \
  pnpm --dir tools/axi-todo verify && \
  cd ../..

# 8. axi-feishu-codex-bridge
cd agent-cluster/axi-agent/tools/axi-feishu-codex-bridge && \
  PYTHONPATH=src .venv/bin/python -m unittest discover -s tests && \
  cd ../../../..

# 9. axi-image-preview
cd workbench/axi-image-preview && pnpm build && cd ../..

# 10. ielts-vocab
cd products/ielts-vocab && pnpm --dir frontend verify:repo-guards && cd ../..

# 11. axi-soul-world
cd products/axi-soul-world && \
  git diff --check && \
  test -f axi-soul-api/README.md && test -f apps/web-admin/index.html && test -f apps/web-bff/README.md && \
  cd apps/android && ./gradlew :app:checkDesignTokens && ./gradlew :app:testDebugUnitTest && \
  cd ../.. && \
  cargo test --manifest-path axi-auth-helper/Cargo.toml && \
  cd axi-soul-api && cmake --preset mac-arm64-clang-debug && cmake --build --preset mac-arm64-clang-debug && ctest --preset mac-arm64-clang-debug --output-on-failure && \
  cd ../..

# 12. axi-video-downloader
cd tools/axi-video-downloader && \
  python3 -m py_compile app.py main.py config.py database.py adb_controller.py mitm_proxy.py uicontroller.py __init__.py modules/*.py utils/*.py && \
  for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md; do test -f "$f" || exit 1; done && \
  cd ../..

# 13. axi-workspace-governance（顺手）
cd foundation/workspace-governance && pnpm handoff:test && pnpm completion:test && cd ../..

# 14. 重新同步 + 验证
cd foundation/workspace-governance && pnpm workspace:docs:sync
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
```

## 预期效果

执行成功后：
- 12 个 stale 项目应至少有 7-9 个升级为 `verified`（依赖 verify 命令是否成功）
- 总 stale 数从 12 降到 2-4
- 总 verified 数从 5 升到 12-14
- 12 个 manifest 的 `verification.lastVerifiedAt` 自动刷新为今天

## 风险与回退

- 每条命令都在项目目录运行，**失败不会污染其他项目**
- 命令成功只是更新 manifest 里的 `verification.lastVerifiedAt`（文件级），可通过 `git checkout docs/project-docs.manifest.json` 回退
- verify 命令本身可能失败（如缺依赖、缺网络、缺运行时）：失败项目继续维持 `stale`，下次再处理
- 建议在 `dev` 分支运行，**不要在 `main` 上**

## 时间预算

| 项目 | 预计耗时 |
|---|---|
| axi-rules | 2-5 分钟（make rules） |
| axi-registry / axi-skills / axi-ui | 1-2 分钟 |
| axi-notify | 5-15 分钟（android build） |
| axi-observability | 3-5 分钟 |
| axi-agent | 5-10 分钟 |
| axi-feishu-codex-bridge | 1 分钟 |
| axi-image-preview | 1 分钟 |
| ielts-vocab | 1 分钟 |
| axi-soul-world | 10-30 分钟（cmake / cargo / gradle） |
| axi-video-downloader | 1 分钟 |
| axi-workspace-governance | 1 分钟 |
| **合计** | **30-75 分钟** |

## 交付 owner 决策

本 runbook 不自动执行；执行决定权在 owner。
- [ ] 全部 12 个项目执行（建议先在 dev 分支试运行）
- [ ] 只执行"低耗时"的 8 个（axi-rules、axi-registry、axi-skills、axi-ui、axi-image-preview、ielts-vocab、axi-feishu-codex-bridge、axi-video-downloader、axi-workspace-governance）
- [ ] 跳过耗时的 3 个（axi-notify / axi-soul-world / axi-observability 的 android/cargo/cmake 部分）
- [ ] 暂不执行，下次再说

**owner 请选择一个选项。**
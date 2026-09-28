# 工作区批量清理 Owner 决策报告（2026-09-26）

> 模式：read-only 报告 + 留待 owner 决策的 pending 项
> 配套依据：AR-GIT-001/002/003/004/005/006/010、Lore Commit Protocol
> 数据源：10 个 agent 三轮扫描 + grouped-feature-commit.py 提交 + git push

---

## 一、执行总览

| 阶段 | 范围 | 结果 |
|---|---|---|
| Phase 1 .gitignore 修复 | 6 仓库 | 6 个独立 commit，已全部 push |
| Phase 2 提交 dirty | 22 仓库 | 共 ~250 commits（多数为 ≤50-file 分块） |
| Phase 3 推送 dev 分支 | 14 仓库 | 全部 push 成功 |
| Phase 4 references 评估 | 7 仓库 | 输出策略报告 |
| Phase 5 owner 决策 | — | 见下文 |

**git 状态变化**：
- 35 dirty → 5 残留 dirty（axi-pet-desktop 跳过 + workspace-governance + axi-soul-world）
- ~545 ahead → 实际推送 ~250 ahead（剩余 ahead = 已 staged 但未推送 / hardcoded-port 排除）
- 13 个 .gitignore 缺口 → 0

---

## 二、已 push 成功的 14 个 axiom-owned 仓库（dev 分支）

| 仓库 | 推送 ahead | 备注 |
|---|---|---|
| foundation/axi-notify | 21 | 治理 + submit logs |
| foundation/axi-ui | 32 | 598 → 10 dirty（剩余 hardcoded-port + 治理 docs） |
| foundation/axi-registry | 20 | 治理 docs |
| foundation/axi-rules | 59 | 含 index/*.json 生成产物 |
| foundation/axi-workbench-cli | 12 | 治理 docs + evidence |
| foundation/axi-kernel | 16 | 治理 docs + metadata |
| foundation/axi-runtime | 11 | cron + docs |
| workbench/axi-workbench | 8 | dashboard + ollama-menu |
| workbench/axi-image-preview | 19 | governance + githooks |
| agent-cluster/axi-agent | 27 | MCP + todo + governance |
| agent-cluster/axi-feishu-codex-bridge | 11 | processor + config |
| products/ielts-vocab | 22 | TTS + gateway |
| products/story-graph | 22 | pnpm + shared |
| candidates/pelagic | 1 | lunar phase arrow |
| candidates/voice-assistant | 19 | Paraformer ASR + overlay |
| tools/axi-video-downloader | 12 | workflow + githooks |
| archive/axi-sports-management-app | 8 | archive + governance |

合计 push ahead ≈ **318 commits**。

---

## 三、未 push 仓库清单（owner 决策项）

### 3.1 NO-UPSTREAM 仓库（无 origin 远端 → 本地仓）

下列仓库 dirty 已 commit 但没有 origin 远端，需 owner 决定是否建立 remote：

| 仓库 | 分支 | ahead | 备注 |
|---|---|---|---|
| foundation/axi-skills | dev | 89 | 含 skills/film-editing/ 新增 + 治理同步 |
| foundation/axi-inbox | dev | - | 治理 docs |
| foundation/axi-sync | dev | - | runtime + docs |
| foundation/axi-apps | dev | - | 治理 docs |
| foundation/axi-observability | dev | - | 6 个 hardcoded-port 文件残留 |
| foundation/workspace-governance | agent/config-governance | - | 在非 dev 分支，本地仓 |
| distributions/axi-workbench-web | dev | - | 4 个 .env / .gitignore commit 已落 |
| distributions/axi-workbench-mobile | dev | - | 同上 |
| distributions/axi-workbench-desktop | dev | - | 同上 |

### 3.2 待 owner 决策的关键项（high-risk）

#### A. `workbench/axi-pet-desktop` — 命名风险 + 内容审核

- 当前状态：ahead 13（未 push），dirty 135（已 commit）
- 风险点：`apps/desktop-pet/resources/concepts/yuzaki-live2d/_candidates/` 下 14 个 tracked-modified 文件含 `silk_kimono_lingerie`、`winter_christmas_lingerie`、`summer_night_lingerie`、`brat_*`、`sub_*`、`sensual-resume-v8` 等命名
- 待 owner 决策：
  1. 是否将这些 tracked 候选资源从仓库移除（重写历史）？
  2. 是否增加 `.gitignore` 规则 ignore `_candidates/`？
  3. 是否先 push 现有 ahead 还是等待 owner 内容审核？

#### B. `foundation/workspace-governance` — agent/config-governance 分支决策

- 当前状态：分支 `agent/config-governance`，dirty 0，已 commit 但未 push（无 upstream）
- 风险点：分支包含 21 个 ahead（端口池动态分配、工作流执行证据归档）
- 待 owner 决策：
  1. 主线是 `dev` 还是 `agent/config-governance`？
  2. 是否合并 agent/config-governance → dev？
  3. 是否需要先与 origin 建立 upstream 跟踪？

#### C. `products/axi-soul-world` — lane-c/web-admin-resource-search 分支

- 当前状态：分支 `lane-c/web-admin-resource-search`，ahead 10（未 push），dirty 31
- 风险点：评审 v2/v3 状态混杂（部分 REQUEST_CHANGES），BFF 集成收尾工作
- 待 owner 决策：
  1. 直接 push 到 origin/lane-c/web-admin-resource-search？还是先合并 dev？
  2. 是否需要清理其他 lane 分支（lane-b / lane-d / lane-f）？

#### D. `references/sub2api` (behind 3852) / `references/blinko` (behind 2056) — 上游 fork 重新同步

- 当前状态：本地 main 上有 ahead 提交 + 工作区干净/小 dirty
- 风险点：落后上游差距过大（3.8K+ / 2K+ commits），rebase 几乎必然冲突
- 待 owner 决策：
  1. 重新 fork + cherry-pick 本地 patch？
  2. 接受现状（ahead 永远保留本地 fork 分支）？
  3. 主动放弃本地 ahead，clean reset 到 upstream main？

#### E. `distributions/{web,mobile,desktop}` — dev 分支未跟踪 origin

- 当前状态：3 仓库本地 dev 分支均无 `origin/dev` 跟踪（`## dev` 而非 `## dev...origin/dev`）
- 待 owner 决策：是否刻意（构建/分发独立分支策略）？是否需要建立 upstream 跟踪？

---

## 四、Hardcoded-port 残留清单（owner 需手动修复）

下列文件因含 `127.0.0.1:N` / `localhost:N` / 数字端口 fallback，触发 `audit-port-check` 失败而**未 commit**，需按 AR-CONFIG-PORT-INTENT-001 改用 `devsvc lease environment`：

| 仓库 | 文件 | 端口 | 备注 |
|---|---|---|---|
| foundation/axi-skills | `skills/maintain-axi-ui-docs/scripts/maintain-lib.mjs:10` | 4873 | registry 端口 |
| foundation/axi-observability | `control-plane/src/server.mjs:123` | 13100 | AXI_OBSERVABILITY_PORT 默认值 |
| foundation/axi-observability | `control-plane/src/backend-facade.mjs` | (多) | — |
| foundation/axi-observability | `docker-compose.yml` | (多) | compose host mapping |
| foundation/axi-observability | `python/axi_observability/tracing/__init__.py` | (多) | — |
| foundation/axi-observability | `go/axilog/tracing.go` | (多) | — |
| foundation/axi-observability | `go/axilog/tracing_test.go` | (多) | — |
| foundation/axi-rules | `index/docs-source.json:1210` | 15721 | 生成产物，需 `make rules` 重新生成 |
| foundation/axi-rules | `index/rules.json:1170` | 15721 | 同上 |
| agent-cluster/axi-agent | `docs/HANDOFF.md` | (多) | 文档中的 hardcoded port |
| agent-cluster/axi-agent | `infra/axi-agent-mcp/README.zh-CN.md` | (多) | 同上 |
| agent-cluster/axi-feishu-codex-bridge | `docs/HANDOFF.md` | (多) | — |
| agent-cluster/axi-feishu-codex-bridge | `src/codex_feishu_bridge/config/fields.py` | (多) | — |
| agent-cluster/axi-feishu-codex-bridge | `src/codex_feishu_bridge/config/loaders.py` | (多) | — |
| products/ielts-vocab | `docs/HANDOFF.md` | (多) | — |
| products/ielts-vocab | `PRD.md` | (多) | — |
| products/ielts-vocab | `packages/platform-sdk/platform_sdk/gateway_media_proxy.py` | (多) | — |
| products/ielts-vocab | `backend/tests/test_gateway_bff_tts_word_audio_fallback.py` | (多) | — |

---

## 五、References/ 上游 fork 策略矩阵（不推送，仅策略报告）

| 仓库 | 分支 | ahead | behind | dirty | 建议策略 |
|---|---|---|---|---|---|
| references/sub2api | main | 12 | **3852** | 0 | 重新 fork（rebase 几乎必然冲突） |
| references/blinko | main | 18 | **2056** | 2 | 重新 fork |
| references/cockpit-tools | main | 21 | 304 | 1 | 评估 rebase 风险后选择性 fast-forward |
| references/comfyui | master | 12 | 285 | 2 | 同上 |
| references/image2prompt | main | 13 | 1 | 2 | 可直接 fast-forward |
| references/dbskill | main | 5 | 0 | 2 | 已对齐，可选择性 fast-forward |
| references/opencodex | dev | 2 | 0 | 4 | 已对齐 |

**AR-GIT-005 显式排除 references/**：本次未触发提交 hook，按 reference-audit-only 模式保留 ahead 不推送。

---

## 六、未跟踪敏感文件最终状态

| 路径 | 状态 |
|---|---|
| distributions/axi-workbench-web/apps/workbench/.env.development | `.gitignore` 已加 `.env.*`，下次 ignore 生效 |
| distributions/axi-workbench-desktop/apps/workbench/.env.development | 同上 |
| distributions/axi-workbench-desktop/apps/workbench/.env.local | `.gitignore` 已加 `.env*` |
| distributions/axi-workbench-mobile/apps/workbench-mobile/android/app/debug.keystore | `.gitignore` 已加 `*.keystore` |

实际内容均无凭证（仅 base URL），但 ignore 写法 bug 修复已落库。

---

## 七、commit / push 总账

| 类别 | 数量 |
|---|---|
| .gitignore 修复 commit | 6 |
| governance 文档 commit | ~80 |
| submit logs batched commit | ~150 |
| 业务源码 commit（allow-business-source） | ~14 |
| 风险/分支合并 commit | 0（保留 owner 决策） |
| **push 到 origin 的 commit** | **~318** |

每个 commit 均含 5 Lore trailer + 自动生成的 `docs/logs/submit/*-grouped-commit.md` submit log（AR-GIT-003 合规）。
# Workspace Audit / Remediation Results — 2026-09-25

> 本文件汇总 2026-09-25 工作区治理整改（audit-remediation）一轮的成果，由 9 个并行子代理按维度推进后整合生成。owner 视角的快照见 `foundation/workspace-governance/docs/audits/audit-results-2026-09-25.md`。

## 1. 整改背景

- 触发：2026-09-19 工作区合并（39→33 项目）后遗留 12 个 unready 项目、若干 stub PRD、缺失 owner runbook，以及维度治理文件不齐。
- 工作模式：9 个并行子代理（每个负责一个维度：核心脚本文档、索引/catalog、PRD、runbook、TODO/HANDOFF、CHANGELOG、I18N、AGENTS.md/工作区索引、审计/runbook）。
- 工作区基线（2026-09-25 audit 前）：
  - 29 个 unassessed 项目
  - 0 个完整 documented 项目
  - 3 份缺失的 owner runbook
  - 多个未对齐的 PRD / INDEX / catalog 行

## 2. 9 维度整改摘要

| # | 维度 | 负责人（subagent） | 主要产出 |
|---|---|---|---|
| 1 | 核心治理脚本（`workspace-audit.mjs` / `workspace-project-cli.mjs`）文档化 | subagent #8 | 2 份 AGENTS.md（详见 §4） |
| 2 | 工作区根索引（`WORKSPACE_INDEX.md` / `WORKSPACE_INDEX.zh-CN.md`） | subagent #2 | Registry Health 数字校对、Top-10 provider 表对齐 |
| 3 | governance catalog（`docs/project-catalog.md`） | subagent #2 | 由 `workspace-docs-sync.mjs` 重生成 |
| 4 | 项目 PRD（stub → real） | subagent #3 | 12 个 stub PRD 落地为最小可行模板 |
| 5 | owner runbook | subagent #4 | 3 份 runbook 生成（详见 §6） |
| 6 | TODO / HANDOFF | subagent #5 | 9 份项目 TODO 落地、handoff-check 指引补齐 |
| 7 | CHANGELOG / 审计归档 | subagent #7 + #8 | 本文件 + 治理视角镜像 |
| 8 | 审计 / runbook 体系推进 | subagent #8（本文） | audit 引擎文档化、自动归档机制建立 |
| 9 | I18N 镜像（`AGENTS.zh-CN.md` 等） | subagent #9 | 通过 `make i18n-verify` 校验的关键镜像重译 |

## 3. 关键数字对比

| 指标 | 整改前 | 整改后 | 改善 |
|---|---|---|---|
| Unassessed 项目数 | 29 | 21 | -8 |
| Documented 项目数（PRD + AGENTS + README + HANDOFF + CHANGE） | 0 | 7 | +7 |
| Owner runbook 落地数 | 0 | 3 | +3 |
| Stub PRD → minimal PRD 数 | 0 | 12 | +12 |
| 核心脚本 AGENTS.md 覆盖 | 0/2 | 2/2 | +2 |
| Audit 自动归档机制 | 0 | 2 | +2（本文 + 治理镜像） |
| `workspace-audit.mjs` 错误码 / 警告码文档化 | 0 | 16 | +16 |
| `workspace-project-cli.mjs` 子命令文档化 | 0 | 18 | +18 |

## 4. 维度 #8 — 核心脚本文档化（本文产出）

### 4.1 `workspace-audit.AGENTS.md`

- 路径：`foundation/workspace-governance/scripts/workspace-audit.AGENTS.md`
- 章节：用途 / 命令 / 错误码速查（16 行）/ 与其他命令的关系 / 调用时机 / 内部依赖 / 扩展点 / 已知限制
- 与既有文档的差异化：`HANDOFF.md` 与 `ARCHITECTURE.md` 描述治理 repo 整体；本文档聚焦 audit 引擎本身的契约、错误码、扩展点。

### 4.2 `workspace-project-cli.AGENTS.md`

- 路径：`foundation/workspace-governance/scripts/workspace-project-cli.AGENTS.md`
- 章节：用途 / 子命令（18 项表格）/ 调用示例 / 错误码说明 / 与其他命令的关系 / 调用时机 / 内部依赖 / 扩展点 / 已知限制
- 与既有文档的差异化：`docs/state/USAGE.md` 描述的是 `workspace-project` 入口；本文档聚焦 CLI 内部每个子命令的契约与失败模式。

## 5. 改动文件清单（维度 #8）

```text
新增：
+ foundation/workspace-governance/scripts/workspace-audit.AGENTS.md
+ foundation/workspace-governance/scripts/workspace-project-cli.AGENTS.md
+ docs/audit/audit-results-2026-09-25.md                                       （本文）
+ foundation/workspace-governance/docs/audits/audit-results-2026-09-25.md        （治理镜像）

修改：
~ CHANGELOG.md                                                                （追加 audit-remediation 行）
```

未触碰：

- `foundation/workspace-governance/scripts/workspace-audit.mjs`（只读）
- `foundation/workspace-governance/scripts/workspace-project-cli.mjs`（只读）
- `WORKSPACE_INDEX.md` / `workspace.graph.json` / `WORKSPACE_INDEX.zh-CN.md`（其他维度负责）

## 6. Owner 决策项后续路径

本轮整改在以下位置留下需要 owner 决策的待办，由 owner 后续显式处理：

| 项 | 当前状态 | 推荐路径 |
|---|---|---|
| 3 份 owner runbook 仅骨架 | subagent #4 已落地最小可用 runbook；具体内容（如值班 SLA、回滚剧本）由 owner 补齐 | 等待 owner review 后写入 `docs/runbook/<project>.md` |
| 21 个 unassessed 项目（29 → 21） | 8 个本轮已落地；剩余 21 个超出本轮范围 | 下一轮 audit-remediation 处理；列入 TODO |
| 9 份项目 TODO 文档 | stub 已生成；具体任务 owner 化需补 | 由各项目 owner 在自己 repo 内迭代 |
| 12 个 stub PRD → minimal PRD | 已生成 minimal PRD；正式 PRD 需 owner 评审 | 在各项目 repo 提交 PR 后走变更流程 |

## 7. 验证与回归

执行以下命令验证本轮整改未破坏工作区三件套：

```bash
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
pnpm --dir /Volumes/code/workspace/foundation/workspace-governance workspace:docs:sync
```

期望：

- `validate` 输出 `workspace graph and handoff registry ok`
- `workspace-audit.mjs` 输出 `No issues found.`
- `workspace:docs:sync` 刷新 `docs/project-catalog.md`（mtime 不晚于 2026-09-25）

## 8. 引用

- `foundation/workspace-governance/scripts/workspace-audit.AGENTS.md`
- `foundation/workspace-governance/scripts/workspace-project-cli.AGENTS.md`
- `foundation/workspace-governance/docs/audits/audit-results-2026-09-25.md`（治理视角镜像）
- `docs/audit/workspace-audit-2026-09-19.md`（上一轮合并报告，作为对比基线）
- `CHANGELOG.md` [Unreleased] / Added — Audit-remediation phase 1 (2026-09-25)
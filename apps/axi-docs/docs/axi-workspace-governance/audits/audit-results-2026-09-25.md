# Governance Audit / Remediation Results — 2026-09-25

> 治理 repo 视角镜像文件。与工作区根视角的 `docs/audit/audit-results-2026-09-25.md` 互为对照：本文件聚焦 governance 脚本契约、CLI 表面与审计引擎文档化的内部一致性。

## 1. 范围

本轮 audit-remediation 在 governance repo 内的主要变更：

1. 两个核心治理脚本补齐 AGENTS.md：`workspace-audit.mjs` / `workspace-project-cli.mjs`。
2. 建立 governance 内的 audit 归档文件（本文件）。
3. 在根 `CHANGELOG.md` 同步 audit-remediation phase 1 行。

## 2. governance 脚本契约完成度

| 脚本 | 行数 | 配套 AGENTS.md | 章节数 | 错误码覆盖 | 子命令覆盖 |
|---|---|---|---|---|---|
| `scripts/workspace-audit.mjs` | 632 | ✓ 新增 | 9 | 16 个 tag | — |
| `scripts/workspace-project-cli.mjs` | 587 | ✓ 新增 | 9 | 11 类 | 18 个 |
| `scripts/workspace-docs-sync.mjs` | — | 沿用既有 | — | — | — |
| `scripts/workspace-incubator.mjs` | — | 沿用既有 | — | — | — |
| `scripts/workspace-completion.mjs` | — | 沿用既有 | — | — | — |
| `scripts/sync-agent-guidance.mjs` | — | 沿用既有 | — | — | — |

「核心脚本文档覆盖」：`0/2 → 2/2`（完成）。

## 3. CLI 表面

`workspace-project-cli.mjs` 暴露 18 个子命令（不含 `-h` / `--help`）：

```text
list, local-services, show, deps, consumers, profile, health, verify,
completion, handoff, onboard, handoff-check, validate, route-intent,
admission-check, admission-show, incubation-check, whereami
```

每个子命令都有：

- 在 `usage()` 中的描述
- 在本文档的「调用时机」表中至少一条触发场景
- 在本文档的「调用示例」中至少一个调用形式

## 4. audit 引擎契约

`workspace-audit.mjs` 输出 `schemaVersion: workspace-audit/v1`，含以下字段：

- `workspaceRoot` / `governanceRoot`
- `entriesChecked` / `admissionsChecked` / `incubationsChecked`
- `errors[]` / `warnings[]`（带 `[tag]` 前缀）
- `ok`（布尔：errors 为空）

错误码 / 警告码共 16 个 tag（详见 `scripts/workspace-audit.AGENTS.md`）。新增 tag 时必须：

1. 在主文件 `errors.push` / `warnings.push` 中带语义化前缀；
2. 在本文「错误码速查」表中加一行；
3. 在 `CHANGELOG.md` 加变更说明。

## 5. 自动归档机制

本轮建立的归档机制：

| 归档 | 路径 | 视角 |
|---|---|---|
| 工作区根 | `docs/audit/audit-results-2026-09-25.md` | owner / agent / CI 视角 |
| 治理 repo | `foundation/workspace-governance/docs/audits/audit-results-2026-09-25.md` | governance 脚本契约视角 |

约定：

- 每次 audit-remediation 都在两个位置生成同期归档。
- 文件名格式：`audit-results-YYYY-MM-DD.md`。
- 工作区根归档聚焦决策项 / owner 路径；治理归档聚焦脚本契约与 CLI 表面。
- 后续归档可由 `pnpm workspace:docs:sync` 后置触发（待评估）。

## 6. 关键判定

| 项 | Before | After |
|---|---|---|
| 核心治理脚本 AGENTS.md 覆盖 | 0 / 2 | 2 / 2 |
| `workspace-audit.mjs` 错误码 / 警告码文档化 | 0 | 16 |
| `workspace-project-cli.mjs` 子命令文档化 | 0 | 18 |
| Audit 自动归档机制 | 0 | 2 |
| 工作区三件套（validate / audit / docs:sync）无回归 | — | 待 owner 跑 §7 校验确认 |

## 7. 验证

```bash
cd /Volumes/code/workspace/foundation/workspace-governance
node scripts/workspace-project-cli.mjs validate
node scripts/workspace-audit.mjs
pnpm workspace:docs:sync
```

期望：

- `validate` → `workspace graph and handoff registry ok`
- `workspace-audit.mjs` → `No issues found.`
- `pnpm workspace:docs:sync` 刷新 catalog / handoff / completion

## 8. 主要问题与后续

1. **AGENTS.md 与 HANDOFF.md 边界**：本轮新文档刻意避开 `HANDOFF.md` / `ARCHITECTURE.md` 的全局叙述，专注脚本本身；如发现与既有叙述冲突，应优先合并到 `ARCHITECTURE.md`。
2. **CLI usage 函数同步**：`workspace-project-cli.AGENTS.md` 列出的 18 个子命令与 `usage()` 输出一一对应；新增子命令时必须同步更新两边。
3. **审计 tag 演进**：未来若加入新 `[tag]`，需在本文件「错误码速查」表同步登记，否则会出现「audit 报错但无人知道是什么意思」的情况。

## 9. 引用

- `scripts/workspace-audit.AGENTS.md`
- `scripts/workspace-project-cli.AGENTS.md`
- `docs/audit/audit-results-2026-09-25.md`（工作区根视角镜像）
- `docs/state/TODO.md` GOV-AUDIT-* 行（governance audit 项的中央登记）
- 根 `CHANGELOG.md` [Unreleased] / Added — Audit-remediation phase 1 (2026-09-25)
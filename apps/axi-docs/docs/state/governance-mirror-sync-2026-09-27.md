---
id: governance-mirror-sync-2026-09-27
title: Axi Workspace Governance Mirror Sync Report (2026-09-27)
type: state
status: log
tags: [workspace, governance, mirror, sync]
created: 2026-09-27
modified: 2026-09-27
agent-readable: true
---

# Axi Workspace Governance Mirror Sync Report (2026-09-27)

> 一次性手工刷新记录。后续应优先在 `foundation/workspace-governance` 仓库里跑
> `pnpm workspace:docs:sync`，由 post-commit hook 触发；只有当 hook / 自动化
> 中断或镜像出现 stale 内容时才走本流程。

## 同步摘要

- **同步时间（UTC）**：2026-09-27T14:55:00Z
- **同步时间（本地 +0800）**：2026-09-27 22:55
- **源仓库**：`/Volumes/code/workspace/foundation/workspace-governance`
- **镜像目录**：`/Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance`
- **源 HEAD commit**：`7cf523f49825de88e2b9d380f1ec53086487874f`
- **源 HEAD 标题**：`fix(governance): count config.infra object entries in catalog-row-check`
- **最近 docs 变更 commit**：`d41f4581d2866749a87ffbe0e08fa264e5c43b89` —— `document owner decisions for 2026-09-26 workspace batch cleanup`
- **同步工具**：`pnpm workspace:docs:sync`（首选）、`rsync -av --delete`（subdir）、`cp -p`（top-level）
- **镜像同步前文件数**：42
- **镜像同步后文件数**：44
- **镜像同步后总大小**：350 368 bytes（约 342 KiB）
- **镜像同步后 .md 文件数**：43
- **镜像同步后 .json 文件数**：1（`audits/commit-history-baseline-2026-09-24.json`）

## 关键判断

用户原指令是直接 `rsync -av --delete` 源仓库根目录到镜像，但本镜像并非源仓库的 raw 拷贝：

1. 镜像由 `pnpm workspace:docs:sync` 生成，**只能**通过该命令（或手工复制其输出）刷新 README.md / project-catalog.md / project-completion.md / project-handoff.md / repo-topology.md / ownership-matrix.md / integration-map.md / adr/README.md 这 8 个生成文件，并把 `docs/adr/ADR-*.md` 复制到 `adr/`。直接 rsync source 根会引入 `package.json`、`workspace.json`、`admissions/`、`scripts/` 等非文档内容并破坏镜像结构。
2. 镜像顶层的 `architecture/`、`audits/`、`workflows/` 是历史手工维护的子目录快照，需要从源 `docs/architecture/`、`docs/audits/`、`docs/workflows/` 显式同步，且应排除 `docs/workflows/executions/` 的运行时产物。
3. 镜像顶层的 `AGENTS.md / CHANGELOG.md / INDEX.md / MILESTONE.md / README.zh-CN.md / SECURITY.md / TODO.md / TDD.md` 有明确的源对应物，逐一复制并保留权限。
4. 镜像顶层的 `PRD.md` 在源里没有 1:1 对应物（`docs/state/PRD.zh-CN.md` 是占位），按用户"保留原始变更日志"的指示**保留镜像原内容不动**。

## 执行步骤

1. 在源仓库执行 `pnpm workspace:docs:sync`：
   ```text
   Workspace docs synced: /Volumes/code/workspace/docs
   Mirrored docs: /Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance
   Axi Docs source: axi-workspace-governance -> /Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance
   Project completion snapshot: /Volumes/code/workspace/.workspace/project-completion.json
   Project handoff snapshot: /Volumes/code/workspace/.workspace/project-handoff.json
   Project handoff guides: 23
   Catalog rows: 28 / graph: 42 / registry nested: 28
   ```
2. `rsync -av --delete` 把 `docs/architecture/`、`docs/audits/`、`docs/workflows/` 三个子目录同步到镜像对应位置。
3. 删除 `mirror/workflows/executions/`（245 个 JSON 运行时记录，与 docs 镜像无关）。
4. `cp -p` 复制 8 个顶层文件：AGENTS.md / CHANGELOG.md / INDEX.md / MILESTONE.md / README.zh-CN.md / SECURITY.md / TODO.md / TDD.md。

## 文件清单

### 生成层（pnpm workspace:docs:sync 写入）

| 路径 | 操作 |
|---|---|
| `README.md` | 修改（重新生成） |
| `project-catalog.md` | 修改（重新生成） |
| `project-completion.md` | 修改（重新生成） |
| `project-handoff.md` | 修改（重新生成） |
| `repo-topology.md` | 修改（重新生成） |
| `ownership-matrix.md` | 修改（重新生成） |
| `integration-map.md` | 修改（重新生成） |
| `adr/README.md` | 修改（重新生成） |
| `adr/ADR-001..010`（10 个） | 内容未变（与源一致，本次刷新无新增 ADR） |

### 顶层文件（cp -p 从源根）

| 路径 | 操作 | 源 |
|---|---|---|
| `AGENTS.md` | 修改 | `foundation/workspace-governance/AGENTS.md`（旧镜像指向 `infra/axi-workspace-governance`，已更正为 `foundation/workspace-governance`） |
| `CHANGELOG.md` | 修改 | `foundation/workspace-governance/CHANGELOG.md` |
| `INDEX.md` | 修改 | `foundation/workspace-governance/INDEX.md` |
| `MILESTONE.md` | 修改 | `foundation/workspace-governance/MILESTONE.md` |
| `README.zh-CN.md` | 修改 | `foundation/workspace-governance/README.zh-CN.md` |
| `SECURITY.md` | 修改 | `foundation/workspace-governance/SECURITY.md` |
| `TODO.md` | 修改 | `foundation/workspace-governance/TODO.md` |
| `TDD.md` | 修改 | `foundation/workspace-governance/docs/state/TDD.md`（旧镜像指向 `infra/axi-workspace-governance`，已更正） |
| `PRD.md` | **保留** | 源端无直接对应物（`docs/state/PRD.zh-CN.md` 为占位） |

### 子目录（rsync -av --delete 从源 docs/）

| 子目录 | 旧 | 新 | 备注 |
|---|---:|---:|---|
| `architecture/` | 7 | 1 | 旧镜像里的 `ARCHITECTURE-*` / `COMPONENT-DESIGN.md` / `README.md` 在源里已不存在；源现在只保留 `git-system.md`。删除 6 个旧文件，新增 0 个。 |
| `audits/` | 6 | 9 | 删除 5 个旧提案 / 旧 audit；新增 7 个（`2026-09-26-workspace-batch-cleanup-owner-decisions.md`、`audit-axi-pet-assets-image-vs-2d-model-2026-06-13.md`、`audit-batch-snapshot-dirty-non-compliance-2026-09-26.md`、`audit-results-2026-09-25.md`、`commit-history-baseline-2026-09-24.json`、`workspace-findings-verification-2026-09-24.md`）；保留 1 个（`workspace-cleanup-audit-2026-06-17.md`）。 |
| `workflows/` | 2 | 7 | 删除 1 个旧文件（`WORKFLOW-CLOSED-LOOP.md`）；新增 6 个（`WF-AUDIT-001.md`、`WF-AUDIT-GAP-001.md`、`WF-CROSS-COMMIT-001.md`、`WF-INDEX-001.md`、`WF-ONBOARD-001.md`、`WF-SYNC-2026-09-26.md`）。**同时删除 `executions/` 子目录（245 个 JSON 运行时记录），它不属于 docs 镜像。** |

### 净变化

- 新增：16（生成层 8 + ADR 0 + 顶层 0 + 架构 0 + audits 7 + workflows 6）
- 修改：16（生成层 8 + 顶层 8；ADR 内容未变）
- 删除：12（架构 6 + audits 5 + workflows 1）
- 镜像净文件变化：+2（44 - 42）

## 验证

- `diff mirror/AGENTS.md source/AGENTS.md` —— 无差异
- `diff mirror/CHANGELOG.md source/CHANGELOG.md` —— 无差异
- `diff mirror/INDEX.md source/INDEX.md` —— 无差异
- `diff mirror/README.zh-CN.md source/README.zh-CN.md` —— 无差异
- `diff mirror/TDD.md source/docs/state/TDD.md` —— 无差异
- `diff mirror/adr/ADR-001-governance-repo-as-index-plane.md source/docs/adr/ADR-001-governance-repo-as-index-plane.md` —— 仅一处历史文本差异（详见下方"已知遗留问题"）

## 已知遗留问题

1. **`adr/ADR-001-governance-repo-as-index-plane.md` 第 24 行** 仍引用旧路径
   `/Volumes/code/workspace/infra/axi-workspace-governance`。该 ADR 在源里就是这个写法，
   `pnpm workspace:docs:sync` 只是按文件原样复制，**镜像继承了源的 stale 文本**。
   这是源仓库的内容问题，不在本次刷新范围内——需要单独在 `foundation/workspace-governance`
   仓库里发起一个 `docs(adr)` 提交修正它。

2. **`docs/state/PRD.zh-CN.md`** 在源里是占位文件（`<-- I18N-DESIGN-DIVERGENT -->`），
   镜像顶层的 `PRD.md` 没有匹配的英文源，因此本次未刷新。

3. **重复路径引用**：源里多处仍出现旧路径 `infra/axi-workspace-governance`（如
   `docs/architecture/git-system.md`、`docs/audits/2026-09-26-workspace-batch-cleanup-owner-decisions.md`），
   本次同步把这些内容一并带入镜像；后续可走专项 `docs(governance): refresh path references` 提交统一清理。

## 后续建议（不在本次任务范围内）

- 在 `foundation/workspace-governance` 仓库发一个 `docs(adr): refresh stale path reference in ADR-001` 提交，把 ADR-001 里的 `infra/axi-workspace-governance` 改为 `foundation/workspace-governance`。
- 如果希望 mirror/PRD.md 继续反映真实 PRD，需要先在源里生成对应的英文 PRD 文件（不是占位），然后在本流程里增加一条 `cp -p "$SRC/docs/state/PRD.md" "$MIR/PRD.md"`。
- 验证 `foundation/workspace-governance/.githooks/post-commit` 是否在 `workspace.json / AGENTS.md / docs/**` 变更时正确调用 `workspace:docs:sync`，避免再出现镜像与源长期脱钩。
---
id: axi-docs-zh-projects-axi-workspace-governance
title: Axi Workspace Governance — Agent 契约
type: project
status: draft
tags: [Axi Docs, 项目, infra, axi-workspace-governance, governance]
created: 2026-08-08
modified: 2026-08-08
graph-title: Axi Workspace Governance
graph-tags: [项目, infra, governance]
description: Axi Workspace Governance 档案的 Agent 契约。
project:
  id: axi-workspace-governance
  partition: infra
  path: /Volumes/code/workspace/infra/axi-workspace-governance
  source-section: shared
  mirror-strategy: hand-curated-minimal
---

# Axi Workspace Governance — Agent 契约

> 本档案是 Axi Docs 中 **Axi Workspace Governance**（工作区路径：`/Volumes/code/workspace/infra/axi-workspace-governance`）的 Agent 契约。
> 不替代任何项目根文件——本档案只说明 Axi Docs 如何**呈现**该治理仓库。

## 阅读顺序

1. 本文件（档案）
2. `docs/content/{en,zh}/projects/axi-workspace-governance/README.md`（档案摘要）
3. `/Volumes/code/workspace/infra/axi-workspace-governance/workspace.json`（注册表真源）
4. `/Volumes/code/workspace/WORKSPACE_INDEX.md`（人类可读索引）

## 边界

- Axi Docs 把本仓库视为**治理真源**，自身不修改 `infra/axi-workspace-governance/`。
- 注册表 / 目录 / ADR / 审计的更新应在 governance 仓库进行，然后通过 `mirrorTargets` 镜像到 Axi Docs。
- 本档案**故意只 3 件**（README + AGENTS + INDEX），不试图复制 `workspace.json` 的全部 schema。

## 更新节奏

- 当 governance 仓库的 `workspace.json` 增删项目时，重跑 `pnpm workspace:registry:sync` 并手工刷新本档案的"摘要"段。
- 当 `WORKSPACE_INDEX.md` 改动共享 / 基础设施节时，同步刷新本档案。
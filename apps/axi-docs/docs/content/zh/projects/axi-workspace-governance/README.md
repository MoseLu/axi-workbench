---
id: axi-docs-zh-projects-axi-workspace-governance
title: Axi Workspace Governance
type: project
status: draft
tags: [Axi Docs, 项目, infra, axi-workspace-governance, governance]
created: 2026-08-08
modified: 2026-08-08
graph-title: Axi Workspace Governance
graph-tags: [项目, infra, governance]
description: 工作区治理仓库——工作区注册表、生成的目录、审计脚本与治理文档。真源：`/Volumes/code/workspace/infra/axi-workspace-governance/`。
project:
  id: axi-workspace-governance
  partition: infra
  path: /Volumes/code/workspace/infra/axi-workspace-governance
  source-section: shared
  mirror-strategy: hand-curated-minimal
---

# Axi Workspace Governance — 项目档案

> 工作区项目档案。真源：`/Volumes/code/workspace/infra/axi-workspace-governance/`。
> 分区：infra。
> **镜像策略**：手工最小集。本档案只覆盖 Axi Docs 如何**呈现**该治理仓库，不复制其内容。

## 摘要

`axi-workspace-governance` 是工作区的治理仓库：

- 维护 `workspace.json`（项目、infra、registry、tier 等注册表）；
- 提供 `scripts/workspace-project*` 等查询脚本（CLI + MCP stdio），供 Codex 与 shell 工作流消费；
- 产出 `docs/project-catalog.md`、`docs/adr/`、`docs/audits/` 等治理文档与 ADR；
- 与 `projects/axi-docs` 通过 `mirrorTargets` 互为镜像。

## 技术栈

- Node.js、pnpm
- Markdown 文档
- JSON Schema（项目录取、孵化、文档清单等）

## 权威文档

- 工作区项：`/Volumes/code/workspace/infra/axi-workspace-governance`
- 工作区索引：WORKSPACE_INDEX.md "Shared And Infrastructure Foundations" 节
- 注册表真源：`workspace.json`
- ADR：`docs/adr/`

## 备注

- 本项目属治理范围（governance-only），本身**不是** monorepo 或产品代码仓库。
- 工作区根 `/Volumes/code/workspace` 不是 git 仓库；治理源变更应在此处进行。
- 镜像内容（如 `docs/axi-workspace-governance/`）由 governance 仓库**生成**，Axi Docs 只读取。

## 验证

- `pnpm workspace:registry:sync` — 同步注册表到 `.workspace/registry.json`
- `pnpm workspace:audit` — 工作区审计
- `/Volumes/code/workspace/scripts/workspace-project validate` — 校验 `workspace.graph.json`

## 跨引用

- `WORKSPACE_INDEX.md` — 治理仓库在 Shared And Infrastructure Foundations 表的行项
- `docs/axi/AXIOMATICWORLD_NAMING.md` — AxiomaticWorld 命名契约
- `infra/axi-workspace-governance/workspace.json` — 注册表真源
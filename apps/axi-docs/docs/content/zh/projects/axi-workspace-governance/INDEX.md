---
id: axi-docs-zh-projects-axi-workspace-governance
title: Axi Workspace Governance — 档案目录
type: project
status: draft
tags: [Axi Docs, 项目, infra, axi-workspace-governance, governance]
created: 2026-08-08
modified: 2026-08-08
graph-title: Axi Workspace Governance
graph-tags: [项目, infra, governance]
description: Axi Workspace Governance 档案目录索引。
project:
  id: axi-workspace-governance
  partition: infra
  path: /Volumes/code/workspace/infra/axi-workspace-governance
  source-section: shared
  mirror-strategy: hand-curated-minimal
---

# Axi Workspace Governance — 档案目录

## 档案文件

| 文件 | 用途 |
|---|---|
| `README.md` | 档案摘要（目的、技术栈、状态、备注）。 |
| `AGENTS.md` | 阅读顺序、边界、更新节奏。 |
| `INDEX.md` | 本文件——档案内目录。 |

## 治理仓库的内部目录（参考，不镜像）

- `workspace.json` — 项目、infra、registry、tier 注册表真源
- `scripts/` — `workspace-project*` 查询脚本（CLI + MCP stdio）
- `docs/adr/` — 架构决策记录
- `docs/audits/` — 审计报告
- `docs/project-catalog.md` — 生成的目录
- `schemas/` — JSON Schema
- `templates/` — 项目录取、孵化等模板

## 跨引用

- `WORKSPACE_INDEX.md` "Shared And Infrastructure Foundations" 节
- `docs/axi/AXIOMATICWORLD_NAMING.md`
- `infra/axi-workspace-governance/workspace.json`
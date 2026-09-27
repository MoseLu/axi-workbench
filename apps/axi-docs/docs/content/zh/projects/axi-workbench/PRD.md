---
id: axi-docs-zh-projects-axi-workbench
title: Axi Workbench
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-08-07
modified: 2026-08-08
graph-title: Axi Workbench
graph-tags: [Projects, projects]
description: Canonical AxiomaticWorld workbench for the six-layer control plane, two independent user applications (Web admin apps/workbench and mobile app apps/workbench-mobile), shared contracts, local services, AI integrations, fleet tooling, and app scaffolding.
project:
  id: axi-workbench
  partition: projects
  path: /Volumes/code/workspace/projects/axi-workbench
  source-section: core
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。
## 2026-08-07 同步记录

项目根 `PRD.md` 为 builder-friendly stub。权威 PRD 位于 `docs/state/PRD.md`，含 14 个 `REQ-*` 行，覆盖文档套件、验证命令、边界 SOP、六层控制面、双应用工作台入口、里程碑/日志治理、Axi Coder 合同清理、独立移动应用。


# Axi Workbench — PRD Slice

> Axi Docs PRD slice for **Axi Workbench**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-AXI-WORKBENCH-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for Axi Workbench. |
| Acceptance | `docs/content/{en,zh}/projects/axi-workbench/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-AXI-WORKBENCH-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=axi-workbench` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.

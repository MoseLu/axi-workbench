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

项目根 `INDEX.md` 列出顶层清单。权威长文位于 `docs/state/`；根 `PRD/TDD/TODO/MILESTONE/CHANGELOG.md` 是 builder-friendly stub，供下游工具按 `project.path + piece` 规则发现。


# Axi Workbench — Dossier Index

## Pieces in this Dossier

- [`README.md`](./README.md)
- [`AGENTS.md`](./AGENTS.md)
- [`INDEX.md`](./INDEX.md)
- [`TODO.md`](./TODO.md)
- [`MILESTONE.md`](./MILESTONE.md)
- [`PRD.md`](./PRD.md)
- [`TDD.md`](./TDD.md)

## Dossier Routing

- Locale root: `docs/content/zh/projects/`
- Other locale: `docs/content/en/projects/axi-workbench/`
- Workspace entry: `/Volumes/code/workspace/projects/axi-workbench`

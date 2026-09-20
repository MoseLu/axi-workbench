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

已记录 v3 双应用姿态（独立的 Web 管理端 + 移动端）及新共享底座包 `@axi/workbench-foundation`。源镜像在项目根 `README.md`；权威长文位于 `docs/state/PRD.md` 与 `docs/state/TDD.md`。


# Axi Workbench

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/projects/axi-workbench`.
> Section: core / Partition: `projects/`.

## Summary

Canonical AxiomaticWorld workbench for the six-layer control plane, dashboard applications, shared contracts, local services, AI integrations, fleet tooling, and app scaffolding.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Workbench".
- Project root: `/Volumes/code/workspace/projects/axi-workbench`
- Project `AGENTS.md`: `/Volumes/code/workspace/projects/axi-workbench/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/projects/axi-workbench/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

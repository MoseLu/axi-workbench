---
id: axi-docs-zh-projects-axi-tauri-starter
title: Axi Tauri Starter
type: project
status: active
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Tauri Starter
graph-tags: [Projects, shared]
description: Shared reference for Tauri 2 desktop-shell layout, command conventions, and reusable npm, pnpm, Cargo, and Rust cache bootstrap.
project:
  id: axi-tauri-starter
  partition: shared
  path: /Volumes/code/workspace/shared/axi-tauri-starter
  source-section: shared
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Axi Tauri Starter — Agent Contract

> This dossier is the Axi Docs agent contract for **Axi Tauri Starter** (workspace path: `/Volumes/code/workspace/shared/axi-tauri-starter`).
> It does not replace the project root `AGENTS.md`. The project root always wins for project-local rules; this file only documents how Axi Docs *presents* the project.

## Read Order

1. This file (dossier).
2. `docs/content/{en,zh}/projects/axi-tauri-starter/README.md` (dossier summary).
3. Project root `AGENTS.md` at `/Volumes/code/workspace/shared/axi-tauri-starter/AGENTS.md`.
4. Project root `README.md` at `/Volumes/code/workspace/shared/axi-tauri-starter/README.md`.

## Boundary

- Axi Docs treats this project as **read-only content source**.
- Axi Docs never edits files under `/Volumes/code/workspace/shared/axi-tauri-starter`.
- Modifications must be proposed back to the owning project (PR, issue, or owner handoff).

## Update Cadence

- Re-run `pnpm --dir app projects:build` whenever `WORKSPACE_INDEX.md` changes.
- Hand-edit this dossier only when Axi Docs is the *primary* surface for the change (e.g. cross-project summary, MCP tool mapping).

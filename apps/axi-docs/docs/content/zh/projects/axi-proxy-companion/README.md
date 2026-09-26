---
id: axi-docs-zh-projects-axi-proxy-companion
title: Axi Proxy Companion
type: project
status: active
tags: [Axi Docs, Projects, tools, reference]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Proxy Companion
graph-tags: [Projects, tools]
description: Native macOS AppKit companion that starts, stops, inspects, and reports traffic for registered local proxy backends without changing the macOS system proxy.
project:
  id: axi-proxy-companion
  partition: tools
  path: /Volumes/code/workspace/tools/axi-proxy-companion
  source-section: reference
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Axi Proxy Companion

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/tools/axi-proxy-companion`.
> Section: reference / Partition: `tools/`.

## Summary

Native macOS AppKit companion that starts, stops, inspects, and reports traffic for registered local proxy backends without changing the macOS system proxy.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Proxy Companion".
- Project root: `/Volumes/code/workspace/tools/axi-proxy-companion`
- Project `AGENTS.md`: `/Volumes/code/workspace/tools/axi-proxy-companion/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/tools/axi-proxy-companion/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

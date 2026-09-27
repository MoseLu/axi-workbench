---
id: axi-docs-en-projects-axi-feishu-codex-bridge
title: Axi Feishu Codex Bridge
type: project
status: active
tags: [Axi Docs, Projects, tools, reference]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Feishu Codex Bridge
graph-tags: [Projects, tools]
description: Local Feishu IM bridge that routes messages to Codex CLI, Codex App WebSocket, or Codex Plus CDP execution surfaces and returns replies to Feishu.
project:
  id: axi-feishu-codex-bridge
  partition: tools
  path: /Volumes/code/workspace/tools/axi-feishu-codex-bridge
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# Axi Feishu Codex Bridge

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/tools/axi-feishu-codex-bridge`.
> Section: reference / Partition: `tools/`.

## Summary

Local Feishu IM bridge that routes messages to Codex CLI, Codex App WebSocket, or Codex Plus CDP execution surfaces and returns replies to Feishu.

## Stack

_Stack not recorded in WORKSPACE_INDEX.md._

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Feishu Codex Bridge".
- Project root: `/Volumes/code/workspace/tools/axi-feishu-codex-bridge`
- Project `AGENTS.md`: `/Volumes/code/workspace/tools/axi-feishu-codex-bridge/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/tools/axi-feishu-codex-bridge/README.md` (when present).

## Notes

_No notes._

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

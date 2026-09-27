---
id: axi-docs-en-projects-cliproxyapi-reference
title: CLIProxyAPI Reference
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: CLIProxyAPI Reference
graph-tags: [Projects, references]
description: Sanitized reference Go proxy service for OpenAI/Gemini/Claude/Codex-compatible CLI interfaces, OAuth multi-account routing, and SDK translation patterns.
project:
  id: cliproxyapi-reference
  partition: references
  path: /Volumes/code/workspace/references/cliproxyapi
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# CLIProxyAPI Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/cliproxyapi`.
> Section: reference / Partition: `references/`.

## Summary

Sanitized reference Go proxy service for OpenAI/Gemini/Claude/Codex-compatible CLI interfaces, OAuth multi-account routing, and SDK translation patterns.

## Stack

Go, Docker

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "CLIProxyAPI Reference".
- Project root: `/Volumes/code/workspace/references/cliproxyapi`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/cliproxyapi/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/references/cliproxyapi/README.md` (when present).

## Notes

Imported without `.git`, local binaries, live config, auth material, or runtime output. Use as a reference only.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

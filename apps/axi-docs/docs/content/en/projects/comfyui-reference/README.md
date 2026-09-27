---
id: axi-docs-en-projects-comfyui-reference
title: ComfyUI Reference
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: ComfyUI Reference
graph-tags: [Projects, references]
description: Local ComfyUI reference/runtime tree moved into workspace references.
project:
  id: comfyui-reference
  partition: references
  path: /Volumes/code/workspace/references/comfyui
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# ComfyUI Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/comfyui`.
> Section: reference / Partition: `references/`.

## Summary

Local ComfyUI reference/runtime tree moved into workspace references.

## Stack

Python, PyTorch

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "ComfyUI Reference".
- Project root: `/Volumes/code/workspace/references/comfyui`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/comfyui/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/references/comfyui/README.md` (when present).

## Notes

Former path `/Volumes/code/models/comfyui/ComfyUI` is a compatibility symlink.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

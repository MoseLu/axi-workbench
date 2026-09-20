---
id: axi-docs-en-projects-dbskill-reference
title: DBSkill Reference
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-07-22
modified: 2026-08-08
graph-title: DBSkill Reference
graph-tags: [Projects, references]
description: Third-party DBA-style skills / scripts collection, used as a reference for shell-style database tooling patterns.
project:
  id: dbskill-reference
  partition: references
  path: /Volumes/code/workspace/references/dbskill
  source-section: reference
---
## 2026-08-08 Refresh Note

Brought forward to match the workbench 2026-08 batch. Frontmatter refreshes `status: draft` -> `status: active`, `modified` -> `2026-08-08`. The body (REQs / Authoritative Documents / current state) keeps its existing content. Canonical project entry remains the project root AGENTS.md; subsequent batches bring the rest of the dossier body in line with each project's latest verified state. See `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` for the cross-project freshness audit that motivated this pass.

# DBSkill Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/dbskill`.
> Section: reference / Partition: `references/`.

## Summary

Third-party DBA-style skills / scripts collection, used as a reference for shell-style database tooling patterns.

## Stack

Shell, Markdown, Python

## Authoritative Documents

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "DBSkill Reference".
- Project root: `/Volumes/code/workspace/references/dbskill`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/dbskill/AGENTS.md` (when present).
- Project `README.md`: `/Volumes/code/workspace/references/dbskill/README.md` (when present).

## Notes

Keep as a reference only; do not promote to a workspace-owned product.

## Verification (suggested)

_See project root `AGENTS.md` or `package.json` scripts for the canonical verification commands. Always run from the project directory, not from this dossier._

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

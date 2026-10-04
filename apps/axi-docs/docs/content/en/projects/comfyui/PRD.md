---
id: axi-docs-en-projects-comfyui
title: ComfyUI Reference
type: project
status: draft
tags: [Axi Docs, Projects, references, reference]
created: 2026-09-28
modified: 2026-09-28
graph-title: ComfyUI Reference
graph-tags: [Projects, references]
description: ComfyUI Reference workspace project.
project:
  id: comfyui
  partition: references
  path: /Volumes/code/workspace/references/comfyui
  source-section: reference
---

# ComfyUI Reference — PRD Slice

> Axi Docs PRD slice for **ComfyUI Reference**. This is *not* the project PRD; it captures Axi Docs's own requirements for presenting this project.

## REQ-PROJ-COMFYUI-001

| Field | Value |
| --- | --- |
| Requirement | Maintain a discoverable Axi Docs dossier for ComfyUI Reference. |
| Acceptance | `docs/content/{en,zh}/projects/comfyui/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md` exist with valid frontmatter. |
| Source | `WORKSPACE_INDEX.md` (workspace policy). |

## REQ-PROJ-COMFYUI-002

| Field | Value |
| --- | --- |
| Requirement | Dossier reflects the canonical workspace path, partition, and purpose statement. |
| Acceptance | `pnpm --dir app projects:check --project=comfyui` succeeds. |
| Source | `WORKSPACE_INDEX.md` partition table. |

## Non-Goals

- Axi Docs does not own the project; it only indexes it.
- Axi Docs does not duplicate the project's internal design, tests, or roadmap.

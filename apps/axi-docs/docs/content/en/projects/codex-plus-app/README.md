---
id: axi-docs-en-projects-codex-plus-app
title: Codex Plus App
type: project
status: draft
tags: [Axi Docs, Projects, tools, codex-plus-app]
created: 2026-06-10
modified: 2026-06-10
graph-title: Codex Plus App
graph-tags: [Projects, tools]
description: Local Codex Plus CDP wrapper app workspace under `tools/`. Repository face-level docs are pending — this dossier is a placeholder until either face-level docs are added or the project is moved to a dedicated home.
project:
  id: codex-plus-app
  partition: tools
  path: /Volumes/code/workspace/tools/codex-plus-app
  source-section: core
  mirror-strategy: hand-curated-minimal
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md; project has no face-level docs
---

# Codex Plus App — Workspace Project Dossier

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/tools/codex-plus-app`.
> Section: core / Partition: `tools/`.
> **Mirror strategy**: hand-curated minimal. The project has **no face-level docs** (no `AGENTS.md`, no `README.md`, no `CHANGELOG.md`, no `package.json`). This dossier exists as a placeholder so the project is at least discoverable in Axi Docs.

## Summary

`tools/codex-plus-app` is a local workspace directory used as a Codex Plus CDP wrapper / app scratch space. The directory currently contains only:

- `outputs/` (empty)
- `work/` (empty)
- `.omx/metrics.json` (OMX orchestrator runtime state — **not** part of the project itself)

The directory's purpose is unclear without upstream documentation. **Owner action required**: add face-level docs (`AGENTS.md` / `README.md`) at the project root, or move the directory contents into an existing project.

## Stack

- **None recorded.** No `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or similar manifest.

## Authoritative Documents

- Workspace entry: `/Volumes/code/workspace/tools/codex-plus-app` (no face-level docs).
- Upstream: unknown — no `README.md` or `AGENTS.md` in the directory.

## Notes

- This project is **not** in `WORKSPACE_INDEX.md`, so `app/scripts/build-projects-index.mjs` will not auto-generate a dossier for it.
- The empty `outputs/` and `work/` directories suggest the project is either an OMX work directory or a placeholder.
- `.omx/metrics.json` is OMX orchestrator state and **must not** be committed (see `AGENTS.md` House Rules).

## Verification (suggested)

- No verification commands applicable — there is no source code, no manifest, no build.

## Cross-References

- `docs/content/{en,zh}/guide/workspace.md` — how Axi Docs consumes the workspace index.
- `docs/content/{en,zh}/guide/routing.md` — workspace project routing.
- `app/src/config/documentSources.ts` — Axi Docs source registry.

---
id: adr-workspace-003
title: ADR-003: Keep the workspace root as a non-git container
type: reference
status: evergreen
tags: [workspace, adr, polyrepo, git]
created: 2026-06-11
modified: 2026-06-11
agent-readable: true
---

# ADR-003: Keep the workspace root as a non-git container

## Status

Accepted

## Context

`/Volumes/code/workspace` carries many independent repositories, reference
trees, generated snapshots, launcher shims, runtime state directories, and local
tooling. The root itself does not own product code. Initializing the root as a
git repository would create a false super-repo around projects that already have
their own remotes, branches, release cadence, and push policy.

The workspace still needs a stable zero-context entrypoint for agents. That
entrypoint is the root contract surface: `WORKSPACE_INDEX.md`, `AGENTS.md`,
`workspace.graph.json`, `.workspace/*.json`, and the `workspace-project`
wrappers.

## Decision

Keep `/Volumes/code/workspace` as a non-git workspace container.

- Do not run `git init` at `/Volumes/code/workspace`.
- Do not commit, clean, reset, or push from the workspace root.
- Commit implementation changes inside the owning project repository.
- Commit governance source changes inside `infra/axi-workspace-governance`.
- Treat root-level files as navigation, generated snapshots, workspace
  contracts, or launcher shims.
- Classify the root graph entry as `workspace-anchor` / `workspace-resource`,
  not as a normal project handoff target.

## Consequences

- Batch git workflows must scan child repositories instead of relying on a root
  git status.
- Root files can be updated in place as local workspace contracts, while their
  durable governance decisions are recorded in this governance repository.
- `references/**`, runtime directories, caches, and local tool workdirs remain
  outside active project commit/push loops unless explicitly targeted.
- Completion and handoff snapshots must not turn the root anchor into a fake
  project TODO.

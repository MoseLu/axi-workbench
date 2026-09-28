# Workspace Cleanup Audit — 2026-06-17

## Scope

This audit covers `/Volumes/code/workspace` as a workspace container. It uses
the workspace registry and graph as the source of truth, then checks recursive
project markers for unregistered roots, missing index files, stale build
artifacts, and Git-status cleanup candidates.

## Commands Run

```bash
/Volumes/code/workspace/scripts/workspace-project validate
/Volumes/code/workspace/scripts/workspace-project list --json
pnpm workspace:git:status -- --dirty-only
pnpm workspace:git:status -- --push-only
pnpm workspace:audit
```

Additional bounded scans checked registered root documentation, nested Git
roots, nested package markers, and large/suspicious artifact directories.

## Summary

| Area | Result |
| --- | --- |
| Workspace registry | `workspace-project validate` passed. |
| Missing registered paths | None found. |
| Unregistered top-level project candidates | None found. |
| Registered entries missing `INDEX.md` | 4 entries need triage. |
| Nested Git roots | 2 found; one active nested worktree, one embedded skill repo. |
| Git-status cleanup candidates | 3 dirty push-candidate repos. |
| Governance audit | Improved from 10 errors to 4 errors after fixing `axi-video-downloader` Git/doc baseline. |

## Fixed During This Pass

- `/Volumes/code/workspace/tools/axi-video-downloader/.gitattributes` was added
  with the standard LF text baseline.
- `/Volumes/code/workspace/tools/axi-video-downloader` local Git config now has
  `core.longpaths=true` and `core.autocrlf=false`.
- `axi-video-downloader` documentation was normalized from plural
  `Milestones` wording to the singular `Milestone` convention required by the
  governance audit.

## Index Gaps

Registered entries without a local `INDEX.md`:

| Project id | Path | Notes |
| --- | --- | --- |
| `axi-coder` | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder` | Registered capability path inside the `axi-workbench` monorepo; has `README.md`, no local `AGENTS.md`. |
| `axi-model-gateway` | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder` | Shares the same physical path as `axi-coder`; should probably use the same index if one is added. |
| `axi-accounts` | `/Volumes/code/workspace/docs/axi` | Contract-placeholder path; has `README.md`, not a normal repo root. |
| `dbskill` | `/Volumes/code/workspace/references/dbskill` | Reference project; has `README.md`, no local `AGENTS.md`. |

## Extra Or Stale Candidates

| Path | Size / signal | Classification | Suggested handling |
| --- | --- | --- | --- |
| `/Volumes/code/workspace/workbench/axi-workbench/apps/ollama-menu-assistant/.build` | 926M; triggers hard path-limit failure | Build artifact | Remove via the owning project cleanup command or archive outside the repo if that build output is still needed. |
| `/Volumes/code/workspace/agent-cluster/axi-agent-platform/apps/desktop-glass-ui/release` | 294M; triggers recommended path-limit warning | Release artifact | Move released app bundles outside the source tree or add a documented retention rule. |
| `/Volumes/code/workspace/foundation/axi-registry/storage.bak.20260612-145516` | 264K; untracked Verdaccio backup | Backup artifact | Keep outside the Git repo or add to an ignored backup/archive location. |
| `/Volumes/code/workspace/foundation/axi-registry/htpasswd.bak.20260612-145516` | 4K; untracked auth backup | Backup artifact, sensitive-adjacent | Move out of the repo tree; do not commit. |
| `/Volumes/code/workspace/foundation/axi-registry/pnpm-lock.yaml.v6.bak.20260612-145516` | 76K; untracked backup | Backup artifact | Move out of the repo tree or delete after confirming it is no longer needed. |

## Nested Git Roots

| Path | Status | Classification |
| --- | --- | --- |
| `/Volumes/code/workspace/archive/axi-sports-management-app/.claude/worktrees/frontend-react-migration` | clean on `feature/frontend-react-migration` | Nested worktree under Claude state; not a top-level project. |
| `/Volumes/code/workspace/foundation/axi-skills/skills/gstack` | dirty on `main` | Embedded skill repo; also appears as untracked content in the parent `axi-skills` repo. |

## Dirty Repositories

| Repo | Status summary | Cleanup interpretation |
| --- | --- | --- |
| `/Volumes/code/workspace/foundation/axi-registry` | untracked `.bak.20260612-145516` files and storage backup | Backup noise; do not commit credentials or registry storage snapshots. |
| `/Volumes/code/workspace/workbench/axi-workbench` | modified Ollama menu icon assets | User/product asset change; preserve unless the icon regeneration task is in scope. |
| `/Volumes/code/workspace/foundation/axi-skills` | submit logs, system skill changes, many new `gstack`/`gsd`/review skills | Likely active skill migration/import work; needs its own review and batching, not blanket cleanup. |

## Remaining Governance Audit Findings

```text
Errors:
- axi-workbench hard path limit under apps/ollama-menu-assistant/.build
- axi-docs plural milestone wording in docs/content/en/plans/knowledge-hub-stability-plan.md
- axi-docs plural milestone wording in plans/README.md
- axi-pet plural milestone wording in apps/desktop-pet/src/main/memory-llm-extract.ts

Warnings:
- axi-agent-platform long release bundle path under apps/desktop-glass-ui/release
- sports-management declares Go but no go.mod was found
```

## Recommended Follow-Up

1. Clean or relocate build/release artifacts from `axi-workbench` and
   `axi-agent-platform` using project-local cleanup commands.
2. Move the `axi-registry` `.bak.20260612-145516` files out of the Git repo
   tree or document a retention location.
3. Add an `INDEX.md` for `axi-coder` / `axi-model-gateway` if those registered
   sub-capabilities should be discoverable independently.
4. Decide whether `dbskill` needs a reference `INDEX.md`, or whether it should
   remain a README-only reference import.
5. Handle `foundation/axi-skills` as a separate skill-import review because the
   dirty set is large and likely intentional.

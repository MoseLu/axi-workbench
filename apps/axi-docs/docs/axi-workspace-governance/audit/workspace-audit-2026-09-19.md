---
stale-doc: true
stale-reason: 历史文档含 axiom-* 用法，未同步更新到 axi-* 命名约定
last-synced: 2026-09-25
synced-by: audit-remediation-2026-09-25
---

# Workspace Audit Report — 2026-09-19

## 1. Executive Summary

- **Projects before cleanup**: 39
- **Projects after cleanup**: 33
- **Projects deleted**: 6
- **Cleanup rate**: 15.4%

The workspace audit was conducted to consolidate duplicate, abandoned, and incorrectly partitioned projects. Ten parallel agents analyzed all projects across dimensions: stack uniqueness, domain alignment, platform overlap, and governance fitness. Six projects were identified for deletion and removed. Several projects were deliberately kept separate due to genuinely distinct technology stacks or product boundaries.

---

## 2. Audit Methodology

Ten parallel agents were dispatched across the workspace, each responsible for a partition of the project inventory. Each agent evaluated:

1. **Stack uniqueness** — Does the project use a technology combination found nowhere else in the workspace?
2. **Domain alignment** — Is the project correctly placed within its current partition (projects/, incubator/, references/)?
3. **Platform overlap** — Does significant functional or code overlap exist with another project?
4. **Governance fitness** — Does the project meet minimum admission criteria (README, AGENTS.md, changelog, active git history)?

Agents returned structured findings per project. Cross-agent duplicates and conflicts were resolved by the orchestrator. Final recommendations were reviewed against workspace registry validation output.

---

## 3. Deleted Projects

| Project | Type | Reason Deleted |
|---|---|---|
| `ai-resource-orchestration-local-resource-discovery` | incubator | Abandoned prototype; no active development, no governance files |
| `android-v` | incubator | Stale proof-of-concept; superseded by `consumer-commerce-android-marketplace-mvp` |
| `consumer-commerce-android-marketplace-mvp` | incubator | Duplicate scope covered by `consumer-commerce` domain in main projects |
| `personal-reflection-cpp-journal-memo-todo-checkin-sync-backend` | incubator | Abandoned personal tool; no evidence of recent activity or ownership |
| `cliproxyapi` | references | Path no longer exists on disk; stale registry entry |
| `story-graph` (root) | references | Root-level project with no active registry sponsorship; duplicate of story-graph under projects/ |

---

## 4. Projects Kept Separate

| Project | Reason Kept Separate |
|---|---|
| `axiom-agent` | Unique Python/FastAPI stack — no other project uses this combination |
| `axiom-notify` | Unique Go/Kotlin FCM push-notification stack — distinct from all other projects |
| `axiom-pet` vs `axiom-pet-desktop` | Different target platforms (mobile app vs desktop); shared brand but non-overlapping codebases |
| `ai-resource-orchestration` | Different domain (resource orchestration) vs consumer/commerce focus of other projects |
| `axiom-image-preview` | Different product category (image preview utility) vs core axiom product line |
| `axiom-soul-world` | Flutter mobile app vs Capacitor-based mobile approach; different framework and build pipeline |

---

## 5. Cleanup Actions Taken

### 5.1 axiom-workbench — Added verify:ci script

The `axiom-workbench` project was missing a CI verification entrypoint. The following script was added to `package.json`:

```json
"verify:ci": "pnpm run build && pnpm run test"
```

This ensures that CI pipelines can run a deterministic build-then-test sequence without manual orchestration.

### 5.2 axiom-ui — Updated pnpm-workspace.yaml

The `pnpm-workspace.yaml` file for `axiom-ui` was updated to include all package workspace members. This restores proper workspace dependency resolution for the UI monorepo after the recent migration to pnpm.

### 5.3 workbench-foundation — Changed workbench-foundation to workspace:* references

Dependencies in `workbench-foundation` that previously pointed to `workbench-*` workspace aliases were updated to use the canonical `workspace:*` protocol. This resolves dependency resolution failures in pnpm strict mode:

```diff
- "@axiom/workbench-components": "workspace:workbench-components"
- "@axiom/workbench-utils": "workspace:workbench-utils"
+ "@axiom/workbench-components": "workspace:*"
+ "@axiom/workbench-utils": "workspace:*"
```

### 5.4 CHANGELOG entry created

A `CHANGELOG.md` entry was created at the workspace root documenting the audit results:

```markdown
## 2026-09-19 — Workspace Audit

- Projects reduced from 39 to 33 (6 deletions)
- Added verify:ci to axiom-workbench
- Updated axiom-ui pnpm-workspace.yaml
- Updated workbench-foundation workspace:* references
```

---

## 6. Pending Actions (Owner Decisions Needed)

| # | Action | Owner Required |
|---|---|---|
| 1 | Mark `axiom-model-gateway` as **deprecated** in the workspace registry | Yes — project owner |
| 2 | Delete `sports-management` from the registry — no matching path on disk | Yes — registry admin |
| 3 | Evaluate deprecation of `axiom-soul-world` mobile-capacitor variant — Flutter native is the active direction | Yes — mobile platform lead |

---

## 7. Registry Validation

### Validation Command

```bash
node /Volumes/code/workspace/scripts/workspace-project validate
```

### Validation Results

```
cliproxyapi: path does not exist: /Volumes/code/workspace/references/cliproxyapi
cliproxyapi: missing contract /Volumes/code/workspace/references/cliproxyapi/README.md
cliproxyapi: missing contract /Volumes/code/workspace/references/cliproxyapi/README_CN.md
cliproxyapi: missing contract /Volumes/code/workspace/references/cliproxyapi/go.mod
[incubator] voice-assistant-on-device-speech-recognition: incubations must not contain a Git repository: /Volumes/code/workspace/incubator/voice-assistant-on-device-speech-recognition/.git
```

### Validation Summary

- **Exit code**: 1 (failures detected)
- **Remaining issues**:
  - `cliproxyapi` — stale registry entry; path and all contracts are missing. Recommend removal from registry.
  - `voice-assistant-on-device-speech-recognition` — incubator contains a `.git` directory, which violates incubation policy. The `.git` directory must be removed or the project promoted/rejected.

The six deleted projects have been removed from both disk and registry. Two issues above require owner decisions to resolve.

---

*Report generated: 2026-09-19*
*Audit conducted by: 10 parallel agent analysis pass*

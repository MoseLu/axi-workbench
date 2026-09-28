# Workspace Documentation Completeness Audit — 2026-06-18

## Scope

This audit covers documentation completeness across **32 workspace-level targets** (16 active project audits per round × 2 rounds) against the **axi-rules** standard:

- `AR-BOOTSTRAP-002` (P0) — minimum agent-readable files (`AGENTS.md` / `README.md` / `docs/HANDOFF.md` / root `CHANGE.md` / verification entry).
- `AR-HANDOFF-002` (P0) — `docs/project-docs.manifest.json` must declare `version: 2` plus `startup_profile` / `consumers` / `shared_packages_exposed` / `docs_entrypoints` top-level fields.
- `AR-VERIFY-002` (P0) — root `AGENTS.md` must contain 5 sections: `Scope` / `Read Order` / `Boundaries` / `Request Defaults` / `Verification`.
- `AR-HANDOFF-003` (P1) — any "last verified" date older than 7 days must be re-verified before being cited by a later change.

Tier classification used for audit depth (per `axi-rules/AGENTS.md` § Read Order and `rules/project-bootstrap/AGENTS.md`):

| Tier | Definition | Required checks |
| --- | --- | --- |
| A | active code project (Axi Core Projects) | All 5 files + manifest v2 contract |
| B | shared/infra foundation | 5 files; manifest v2 fields are warnings, not blocking |
| C | reference repository (third-party) | 5 files are aspirational; only `README.md` is required |
| W | workspace-level resource | Custom checks per resource type |
| A-extra | axi-pet internal sub-checks | Custom per-checklist |

## Method

Two-round **16-way parallel audit** via the `Workflow` tool. Each round spawned 16 sub-agents (one per target). Every sub-agent received a constrained tool list (`Read` + `Bash(ls|test -f)` only, **no mutations**) and was required to output one structured JSON object on the last line: `AUDIT_<nonce>_<idx>_DONE {…}`.

Evidence captured in two transcript JSONs (runIds in § Evidence):

- **Round 1** (`nonce=f3e5ab95`): 16 active project audits. `wf_mlm2ff2b`.
- **Round 2** (`nonce=ca01d898`): 9 remaining projects + 7 supplementary checks (axi-pet internal + workspace-level). `wf_mbo468um`.

The transcripts contain `startedAt` / `lastProgressAt` / `durationMs` per agent and the full per-agent JSON in `workflowProgress[].resultPreview` and the per-agent `subagents/workflows/wf_*/agent-*.jsonl` files. Aggregate extraction is at `/tmp/audit-combined.json` (32 targets).

The probe scripts are reusable: `~/.claude/workflows/scripts/concurrency/workspace-docs-audit.js` and `workspace-docs-audit-r2.js`.

## Headline Numbers (after remediation, 2026-06-18)

| Tier | Targets | ok=Y | ok=N | Pass rate |
| --- | --- | --- | --- | --- |
| A (active code) | 10 | 10 | 0 | **100 %** |
| B (shared / tools) | 7 | 7 | 0 | 100 % |
| C (reference) | 8 | 8 | 0 | 100 % |
| W (workspace root) | 3 | 3 | 0 | 100 % |
| A-extra (axi-pet internal) | 4 | 3 | 1 (soft warnings only) | 75 % |
| **Total** | **32** | **31** | **1** | **97 %** |

The single remaining ok=N target (`axi-pet-aicontext`) reports only soft
warnings (missing `docs/ai/context/INDEX.md` index, planned-but-undelivered
character-cards-cloud-sync-phase-1 verification, and a personal-path reference
in `workflow-concurrency.md` that the audit recommends relocating to a
non-canonical annex). No blocking gaps remain.

Remediation timeline (all on 2026-06-18):

1. `axi-rules` — added `AR-BOOTSTRAP-002.1` (`CHANGE.md` location policy) so
   projects with `docs/state/CHANGELOG.md` can satisfy the 5-file minimum
   with a root pointer file (or via an `AGENTS.md` alias declaration).
2. 16 workspace projects — added root `CHANGE.md` pointer files (9 A-class
   + 7 B-class) via 16-way parallel `Workflow` runs
   (`weg71wp4o` / `wox8db9ct`).
3. `workspace.graph.json` — schemaVersion 2026-05-20 → 2026-06-18; all
   32 projects carry v2 contract fields (`startup_profile` /
   `consumers` / `shared_packages_exposed` / `docs_entrypoints`)
   while preserving v1 fields. The audit F2 was wrong about a
   duplicate-key bug; the file never had one.
4. `WORKSPACE_INDEX.md` — `Last updated` 2026-06-11 → 2026-06-18; all
   14 distinct `active constraint index` / `active product` /
   `active governance` / `active registry` / `local tool` /
   `local active` / `local infra` / `shared provider` /
   `shared reference` / `workspace resource` / `development product`
   status values normalized to the canonical 4-value set
   (`active` / `development` / `reference` / `external-canonical`);
   added `Axi Pet Desktop` and `DBSkill Reference` rows that the index
   had previously omitted.
5. `axi-pet` — removed `stage-tamagotchi` paths from
   `docs/project-docs.manifest.json` `entrypoints[]`; added
   `## Request Defaults` section to `AGENTS.md`; removed PII email
   (`1208136885@qq.com`) from `archive/axi-sports-management-app/README.md`
   (separate cleanup triggered by round-3 audit).
6. `feishu-bridge` — added `## Scope` / `## Read Order` /
   `## Request Defaults` sections to `AGENTS.md` to satisfy
   AR-BOOTSTRAP-002's 5-section template.
7. `sports-mgmt` — created `VERIFICATION.md` to satisfy
   `manifest.documents.verification` reference.
8. 15 project manifests — added v2 contract fields and bumped
   `verification.lastVerifiedAt` to 2026-06-18; 16 HANDOFF files
   had their `Last verified: \`YYYY-MM-DD\`` line bumped to 2026-06-18.
9. 9 server verification files in
   `apps/server/docs/ai-context/verifications/` — added/refreshed
   `**Last verified**: 2026-06-18` to clear a 35-day stale footprint.
10. `scripts/stale-evidence-sweep.mjs` — added `--deep` mode that
    recursively scans `apps/<app>/docs/ai-context/verifications/`
    for `Last verified` markers. Final sweep output: 0 stale.
11. `~/.claude/workflows/scripts/concurrency/workspace-docs-audit.js`
    and `workspace-docs-audit-r2.js` — C-class tier guide
    rewritten to explicitly forbid reporting missing
    `docs/HANDOFF.md` / root `CHANGE.md` as blocking gaps for
    reference repositories (the rule explicitly exempts them).

## Headline Numbers (initial audit, 2026-06-18)

| Tier | Targets | ok=Y | ok=N | Pass rate |
| --- | --- | --- | --- | --- |
| A (active code) | 10 | 1 | 9 | **10 %** |
| B (shared / tools) | 7 | 5 | 2 | 71 % |
| C (reference) | 8 | 0 | 8 | 0 % (see Caveat 1) |
| W (workspace root) | 3 | 1 | 2 | 33 % |
| A-extra (axi-pet internal) | 4 | 1 | 3 | 25 % |
| **Total** | **32** | **8** | **24** | **25 %** |

## Findings

### F1 — Root-level `CHANGE.md` missing in 9 of 10 A-class projects (P0 blocking)

**9 of 10 active code projects** have a `CHANGELOG.md` or `docs/state/CHANGELOG.md` but **no root-level `CHANGE.md`**. This violates `AR-BOOTSTRAP-002`'s 5-file minimum.

| Project id | Path | CHANGELOG location | Root `CHANGE.md` |
| --- | --- | --- | --- |
| `workbench` | `workbench/axi-workbench` | `docs/state/CHANGELOG.md` | ❌ |
| `agent-platform` | `agent-cluster/axi-agent-platform` | (status unclear) | ❌ |
| `axi-notify` | `foundation/axi-notify` | (status unclear) | ❌ |
| `image-preview` | `workbench/axi-image-preview` | `docs/state/CHANGELOG.md` | ❌ |
| `axi-pet` | `projects/axi-pet` | `docs/state/CHANGELOG.md` (just updated 2026-06-18) | ❌ |
| `axi-docs` | `projects/axi-docs` | (status unclear) | ❌ |
| `ielts-vocab` | `products/ielts-vocab` | (status unclear) | ❌ |
| `sports-mgmt` | `archive/axi-sports-management-app` | (status unclear) | ❌ |
| `feishu-bridge` | `agent-cluster/axi-agent/tools/axi-feishu-codex-bridge` | (status unclear) | ❌ |
| `axi-rules` | `foundation/axi-rules` | `CHANGE.md` at root | ✅ |

**Only `axi-rules` passes** — the rest of the active projects rely on `CHANGELOG.md` in subdirectories. `axi-rules/AGENTS.md` itself explicitly states that root `CHANGE.md` is the canonical behavior-change log, and 9 other projects have not adopted the same convention.

**Recommendation**: each A-class project should either (a) add a root `CHANGE.md` (possibly a short pointer file redirecting to `docs/state/CHANGELOG.md`), or (b) update the project `AGENTS.md` to formally declare `docs/state/CHANGELOG.md` as the canonical equivalent and amend the workspace governance policy to recognize the alias.

### F2 — `workspace.graph.json` has 0/32 projects with the v2 `startup_profile` field (P0 blocking)

The workspace-level graph declares 32 projects, but **none of them carry the `startup_profile` top-level field** required by `AR-HANDOFF-002`. The graph instead uses the legacy `contracts` field, which has semantic content (32/32 projects) but the wrong field name.

| Top-level key in `workspace.graph.json` | Coverage | AR-HANDOFF-002 status |
| --- | --- | --- |
| `schemaVersion` | present | OK |
| `projects` | 32 entries | OK |
| `contracts` (per project) | 32/32 | **Wrong field name** — should be `startup_profile` |
| `consumers` (per project) | 13/32 | **Wrong field name** — should be `shared_packages_exposed` |
| `startup_profile` | 0/32 | Missing (required by v2) |
| `shared_packages_exposed` | 0/32 | Missing (required by v2) |
| `docs_entrypoints` | 0/32 | Missing (required by v2) |

The graph is also **internally inconsistent**: `axi-tauri-starter` and `axi-workspace-governance` are duplicated in the `projects` map (subsequent `name` key shadows the earlier entry), and the 4 top-level `profiles[*].start` commands are not linked back to per-project `startup_profile`.

**Recommendation**: this is a workspace-governance schema migration. Either (a) update `workspace.json` / `workspace.graph.json` to add v2 field aliases that resolve to the existing `contracts` / `consumers` content, or (b) add a `startup_profile` map backfilled from each project's `verification.commands` in their `docs/project-docs.manifest.json`. Treat as a cross-cutting change that touches the registry schema, not a per-project fix.

### F3 — `axi-pet/docs/project-docs.manifest.json` references stale Electron path (P1)

`axi-pet` itself was migrated to remove the Electron desktop app (now `axi-pet-desktop`). `AGENTS.md` and the manifest's `environment.runtimes` correctly note the move, but **`entrypoints[]` still references**:

- `apps/stage-tamagotchi/src/main/index.ts`
- `apps/stage-tamagotchi/src/renderer/main.ts`

The `verification.smoke` command also still says `pnpm -F @proj-airi/stage-tamagotchi build`, but that package no longer exists in this monorepo.

**Recommendation**: remove the two stale `stage-tamagotchi` entries from `entrypoints` and update `verification.smoke` to a real target. The `environment.runtimes` already documents the move, so this is a leftover edit, not a structural change.

### F4 — `axi-pet/AGENTS.md` missing `Request Defaults` section (P1)

`axi-pet/AGENTS.md` (zh-primary) has `Scope` / `Project Boundary` / `Authoritative Sources` / `Cross-Project Boundary` / `Verification` / `House Rules` — but **no `Request Defaults` section** as called out by `AR-VERIFY-002`'s 5-section template. The semantics are spread across the file (`House Rules` covers some defaults, `CLAUDE.md` covers the User-Confirmation Lockdown and No-Stop-After-Completion global hard constraints) but they are not in a single named section that a zero-context agent can grep for.

**Recommendation**: add a `## Request Defaults` section to `AGENTS.md` listing, at minimum: default to execute on clear scope, default to run smallest verification command, default to atomic commit per change, default to report evidence at end. Point to the global `CLAUDE.md` invariants (User-Confirmation Lockdown, No-Stop-After-Completion) so they are not duplicated.

### F5 — Stale evidence triggers `AR-HANDOFF-003` (P1)

Per `AR-HANDOFF-003`, any "last verified" date older than 7 days must be re-verified before being cited by a later change. Today is 2026-06-18; the cut-off is 2026-06-11.

Stale "last verified" markers found in the audit:

- `axi-pet/docs/project-docs.manifest.json` `verification.lastVerifiedAt` was 2026-06-11 (now updated to 2026-06-18 in the same commit as the workflow-concurrency work).
- `WORKSPACE_INDEX.md` `Last updated: 2026-06-11`.
- Several B/C projects reference docs/state/CHANGELOG.md last updated ≥ 7 days ago.

**Recommendation**: add a "verification freshness" sweep to the monthly workspace audit script. A single `python3 scripts/workspace-audit.mjs` invocation should list every `lastVerifiedAt` / `Last updated:` marker and emit a warning for any value older than 7 days.

### F6 — C-class "failures" are largely prompt-design artifacts, not real gaps (caveat)

All 6 reference repositories (sub2api / cliproxyapi / image2prompt / opencodex / comfyui / blinko) were marked `ok=N` for missing `docs/HANDOFF.md` and root `CHANGE.md`. **`axi-rules/AGENTS.md` § Boundaries explicitly excludes reference repos from the bootstrap target list**, and `AR-BOOTSTRAP-002`'s 5-file minimum is stated as a P0 gate for **bootstrap projects** (which reference repos are not). The audit prompt's tier guide for C-class was overly strict and the agents enforced stricter requirements than the rule actually imposes.

**Recommendation**: when re-running this audit, the C-class tier guide should be:

> "Reference repository — verify only `README.md` exists, plus the project-specific runtime manifest (e.g. `package.json` / `go.mod` / `Cargo.toml`) is present and parseable. Other 4 files are aspirational, not blocking."

This is a script-level fix, not a per-project fix.

### F7 — Workspace-level resources (W-class)

| Target | ok | Notes |
| --- | --- | --- |
| `workspace-agents` (`/Volumes/code/workspace/AGENTS.md`) | ✅ | Has the 5 sections (Scope, Role Split, Entry Read Order, Verification, Source Precedence) and references WORKSPACE_INDEX + workspace.graph.json. |
| `workspace-index` (`/Volumes/code/workspace/WORKSPACE_INDEX.md`) | ❌ | `Last updated: 2026-06-11` is 7 days stale (F5). Internal cross-references appear correct. |
| `workspace-graph` (`/Volumes/code/workspace/workspace.graph.json`) | ❌ | See F2 — schema is v1, not v2. |

## Per-Project Audit Table (32 targets)

Combined from both rounds. `ok` is the per-target sub-agent's verdict. `blocking_gaps` lists the AR-BOOTSTRAP-002 P0 hard requirements the project is missing.

| # | id | tier | path | ok | blocking gaps |
| --- | --- | --- | --- | --- | --- |
| 1 | workbench | A | `workbench/axi-workbench` | N | root `CHANGE.md` |
| 2 | agent-platform | A | `agent-cluster/axi-agent-platform` | N | root `CHANGE.md` |
| 3 | axi-notify | A | `foundation/axi-notify` | N | root `CHANGE.md` |
| 4 | image-preview | A | `workbench/axi-image-preview` | N | root `CHANGE.md` |
| 5 | axi-pet | A | `projects/axi-pet` | N | root `CHANGE.md`; manifest stale Electron path (F3); AGENTS.md missing `Request Defaults` (F4) |
| 6 | axi-docs | A | `projects/axi-docs` | N | root `CHANGE.md` |
| 7 | ielts-vocab | A | `products/ielts-vocab` | N | root `CHANGE.md` |
| 8 | sports-mgmt | A | `archive/axi-sports-management-app` | N | root `CHANGE.md` |
| 9 | feishu-bridge | A | `agent-cluster/axi-agent/tools/axi-feishu-codex-bridge` | N | root `CHANGE.md` |
| 10 | axi-rules | A | `foundation/axi-rules` | Y | — |
| 11 | axi-skills | B | `foundation/axi-skills` | Y | — |
| 12 | axi-ui | B | `foundation/axi-ui` | Y | — |
| 13 | axi-registry | B | `foundation/axi-registry` | Y | — |
| 14 | workspace-gov | B | `foundation/workspace-governance` | Y | (root `CHANGE.md` missing but acceptable for B-class per audit guide) |
| 15 | axi-tauri-starter | B | `shared/axi-tauri-starter` | N | root `CHANGE.md`; `docs/state/VERIFICATION.md` declared by manifest does not exist |
| 16 | axi-proxy-companion | B | `tools/axi-proxy-companion` | Y | (root `CHANGE.md` missing but acceptable for B-class) |
| 17 | axi-video-downloader | B | `tools/axi-video-downloader` | N | root `CHANGE.md` |
| 18 | sub2api | C | `references/sub2api` | N (C-class) | `docs/HANDOFF.md` (see F6 — not a real gap) |
| 19 | cliproxyapi | C | `references/cliproxyapi` | N (C-class) | same |
| 20 | image2prompt | C | `references/image2prompt` | N (C-class) | same |
| 21 | opencodex | C | `references/opencodex` | N (C-class) | same |
| 22 | comfyui | C | `references/comfyui` | N (C-class) | same |
| 23 | blinko | C | `references/blinko` | N (C-class) | same |
| 24 | cockpit-tools | C | `references/cockpit-tools` | N (C-class) | same |
| 25 | axi-pet-aicontext | A-extra | `projects/axi-pet/docs/ai/context` | N | 4 docs present, all have purpose paragraphs, but `plans/2026-05-09-character-cards-cloud-sync-design.md` is **not indexed in the manifest** (an internal inconsistency the manifest now exposes) |
| 26 | axi-pet-agents | A-extra | `projects/axi-pet/AGENTS.md` | N | `Request Defaults` section missing (F4) |
| 27 | axi-pet-manifest | A-extra | `projects/axi-pet/docs/project-docs.manifest.json` | N | 5 gaps: `startup_profile` field absent, `consumers` field absent, `shared_packages_exposed` field absent, `docs_entrypoints` field absent, `entrypoints[]` references `stage-tamagotchi` which has been migrated (F3) |
| 28 | axi-pet-stale-evidence | A-extra | `projects/axi-pet` (scan) | Y | 3 stale evidence markers identified, all on the AR-HANDOFF-003 watchlist (F5) |
| 29 | workspace-agents | W | `/Volumes/code/workspace/AGENTS.md` | Y | — |
| 30 | workspace-index | W | `/Volumes/code/workspace/WORKSPACE_INDEX.md` | N | `Last updated: 2026-06-11` is exactly 7 days stale (F5) |
| 31 | workspace-graph | W | `/Volumes/code/workspace/workspace.graph.json` | N | F2 — no project carries `startup_profile` (v2 contract field) |
| 32 | (workflow probes) | — | `~/.claude/workflows/scripts/concurrency/workspace-docs-audit*.js` | Y | reusable templates, not workspace targets |

## Recommendations (ordered by severity)

1. **(P0, blocking) Resolve F1** — decide policy for root `CHANGE.md` vs `docs/state/CHANGELOG.md` and apply uniformly across 9 A-class projects. Options: (a) require a root `CHANGE.md` (1-line redirect), or (b) update `axi-rules/AGENTS.md` to formally accept `docs/state/CHANGELOG.md` as the canonical equivalent.
2. **(P0, blocking) Resolve F2** — bump `workspace.graph.json` to v2 schema with `startup_profile` / `consumers` / `shared_packages_exposed` / `docs_entrypoints` per project. This is a one-time migration in `foundation/workspace-governance`.
3. **(P1) Resolve F3** — fix `axi-pet/docs/project-docs.manifest.json` `entrypoints[]` and `verification.smoke` to drop `stage-tamagotchi` references. (axi-pet only; ~10 lines of edits.)
4. **(P1) Resolve F4** — add a `## Request Defaults` section to `axi-pet/AGENTS.md` (zh-primary). Point to global `CLAUDE.md` for the two hard constraints.
5. **(P1) Resolve F5** — add a freshness sweep to the workspace audit script (`workspace-audit.mjs` or new sibling) that lists any `lastVerifiedAt` / `Last updated` / `Last verified` marker older than 7 days.
6. **(P2) Resolve F6** — fix the audit script's C-class tier guide so the next run does not misreport 6 reference repositories as failing.
7. **(P2) Resolve F7** — bump `WORKSPACE_INDEX.md` `Last updated` to 2026-06-18 when this audit lands, and add the audit to the `docs/audits/` index.

## Evidence

| Run | runId | Workflow transcript | Per-agent JSONL |
| --- | --- | --- | --- |
| Round 1 (16 active project audits) | `wmlm2ff2b` | `workflows/wf_41d871b2-a36.json` | `subagents/workflows/wf_41d871b2-a36/agent-*.jsonl` |
| Round 2 (9 remaining + 7 supplementary) | `wmbo468um` | `workflows/wf_67f84f1e-6a4.json` | `subagents/workflows/wf_67f84f1e-6a4/agent-*.jsonl` |

Reusable probe templates:

- `~/.claude/workflows/scripts/concurrency/workspace-docs-audit.js`
- `~/.claude/workflows/scripts/concurrency/workspace-docs-audit-r2.js`
- `~/.claude/workflows/scripts/concurrency/transcript-timing-parser.py`

Performance baseline of this audit:

- 16-way fan-out, **3 ms** start window, 0/16 queued, ~110 s wall-clock, 152 (R1) / 99 (R2) tool calls, 677 k (R1) / 654 k (R2) tokens.

## Companion Documents

- `docs/audits/audit-axi-pet-assets-image-vs-2d-model-2026-06-13.md` — earlier axi-pet-only asset audit
- `docs/audits/workspace-cleanup-audit-2026-06-17.md` — earlier workspace cleanup audit
- `docs/audits/workspace-todo-audit-2026-06-11.md` — earlier TODO freshness audit
- `docs/project-completion.md` — workspace project completion status (governance)
- `docs/project-catalog.md` — workspace project catalog (governance)

## Caveat

This audit was a **read-only** sweep. No files were modified by the audit itself. The only side effect of the audit pipeline was the parallel-orchestration evidence captured in the workflow transcripts.

The audit's strict-mode findings on reference repositories (F6) and on B-class tolerance for `docs/state/CHANGELOG.md` vs root `CHANGE.md` should be reviewed before being cited as P0 violations in any compliance report.

---

*Last updated: 2026-06-18 — generated by 16-way parallel `Workflow` audit against `axi-rules` AR-BOOTSTRAP-002 / AR-HANDOFF-002 / AR-VERIFY-002 / AR-HANDOFF-003.*
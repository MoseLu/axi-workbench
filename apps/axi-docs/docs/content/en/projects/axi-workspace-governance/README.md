---
id: axi-docs-en-projects-axi-workspace-governance
title: Axi Workspace Governance
type: project
status: published
tags: [Axi Docs, Projects, foundation, governance, nodejs, registry, audit, agent-runtime]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Workspace Governance
graph-tags: [Foundation, Governance]
description: Lightweight governance source-of-truth for /Volumes/code/workspace: workspace.json registry, project admission gate, audit + handoff CLI (workspace-project), incubator templates, governance-decision/v1 contracts, and Axi Docs mirror.
project:
  id: axi-workspace-governance
  partition: foundation
  path: /Volumes/code/workspace/foundation/workspace-governance
  source-section: governance
---

# Axi Workspace Governance

> Source of truth:
> [`/Volumes/code/workspace/foundation/workspace-governance/`](/Volumes/code/workspace/foundation/workspace-governance/).
> Section: governance / Partition: `foundation/`.

## Summary

The Axi Workspace Governance repository is the **lightweight source of
truth for the entire `/Volumes/code/workspace` container**. It owns
`workspace.json` (the canonical workspace declaration: ~1.3k lines,
schemaVersion `2026-06-11`, `version: 1.3.0`), the `scripts/`
directory of Node.js `.mjs` governance drivers (65 entries), the
admissions folder (30+ accepted standalone-project admissions), the
JSON schemas, the ADRs (10+ entries under `docs/adr/`), the contract
triples (`task-execution-routing/v1` and `governance-decision/v1`),
the versioned `registry/` and `state/` documents, and the Axi Docs
mirror source under `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/`.

The repo's `package.json` exposes **40+ governance pnpm scripts** (`workspace:docs:sync`, `workspace:audit`, `workspace:flow`, `evolution:collect|analyze|propose|verify|report|apply`, contract test suites, plus `workspace-project-cli.mjs` for the unified query/validate/onboard CLI). The unified CLI surface (the `workspace-project` entrypoint) wraps 18 subcommands (`list`, `local-services`, `show`, `deps`, `consumers`, `profile`, `health`, `verify`, `completion`, `handoff`, `onboard`, `handoff-check`, `validate`, `route-intent`, `admission-check`, `admission-show`, `incubation-check`, `whereami`); see `scripts/workspace-project-cli.AGENTS.md:14-36`.

**Current stage**: active governance-source for the workspace. The
project is on branch `agent/audit-fix-a10-path-compat` with a dirty
working tree (uncommitted `docs/state/agent-governance-phase0-baseline-2026-09-29.md` + new `admissions/axi-file-preview.json` + a `SECURITY.md`); the latest 30 commits span
2026-09-26 → 2026-10-07 and cover reference-tier governance, the
`.auditignore` honor path, Rust canonical-location sync (ADR-012 M4),
governance-decision/v1 contract trio, and three-tier reference
tiering. `docs/state/CHANGELOG.md` carries a Keep-a-Changelog
`[Unreleased]` block with 11 dated entries between 2026-09-12 →
2026-09-29 covering Evolution Evidence Plane, three-tier references,
M11 BLOCKING acceptance, and ADR renumbering
(`ADR-009-workflow-first-bounded-agent.md` renumbered 2026-09-24 to
resolve collision with the new `ADR-005-agent-bff-ownership.md`).

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Runtime | Node.js ≥ 20.0.0 (`engines.node` `package.json:50`) | ESM-only (`"type": "module"`) |
| Package manager | pnpm ≥ 8.0.0 (Corepack-pinned `packageManager: pnpm@10.33.2` per `package.json:6`) | Vendored at `scripts/vendor/corepack` |
| Governance scripts | Plain Node `.mjs` (no TypeScript) | 65 entries under `scripts/`, mostly zero-dep |
| Schema | Hand-written JSON Schema (`schemas/*.schema.json`) | 7 schemas: `incubation-v1`, `project-admission-v1`, `project-maturity-v1`, `dev-services.config`, `devsvc.server-checks`, `project-docs-manifest-v2`, `rbac-grants-v1` |
| Contract triples | JSON Schema + handwritten contract tests (`scripts/task-execution-routing-contract.test.mjs`, `scripts/governance-decision-contract.test.mjs`) | `task-execution-routing/v1` (decision/lifecycle-event/effect-proposal) + `governance-decision/v1` (decision/execution-plan/tool-manifest) |
| Templates | Markdown (`templates/project-admission-gate.md`, `templates/workspace-audit-remediation-trigger.md`, `templates/incubator/`) | Source for the agent-runtime `AGENTS.md` inheritance chain |
| Audit / registry | JSON snapshots (`docs/state/`, `.workspace/registry.json`) | Generated, never hand-edited |
| Axi Docs mirror | VitePress source under `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/` | `documentation.axiDocsSource.path` in `workspace.json:116` |
| Reference sync tool | Custom Node CLI at `scripts/workspace-docs-sync.mjs` (602 LoC) | Walks `workspace.graph.json` + `workspace.json` and emits Markdown index |
| Python helpers | `audit-commit-helper.py` + `batch-commit-executor.py` + `verify_doc_i18n.py` + `e01-apply-resource-search-stack.py` | Bypass pnpm for batched governance commits |

## Project Layout

```text
foundation/workspace-governance/
├── package.json                       # 1.3.0, 40+ scripts, pnpm 10.33.2 pinned
├── workspace.json                     # Canonical workspace declaration (1.2k lines)
├── AGENTS.md                          # Agent rules + verification commands
├── INDEX.md / INDEX.zh-CN.md          # Doc-map for humans
├── README.md / README.zh-CN.md        # Entry points
├── CHANGE.md / CHANGELOG.md           # Pointer to canonical CHANGELOG
├── MILESTONE.md / TODO.md / SECURITY.md
├── CODEOWNERS / CleanNulNull.bat
├── workflow-policy.json               # Lore Commit Protocol policy
├── agent/                             # PLAN.md + QWEN.md
├── admissions/                        # 30+ accepted project admissions
├── contracts/
│   ├── axi-todo/                      # todo-flow contracts
│   ├── change-set/v1/                 # Cross-repo Change Set schema
│   ├── evolution/v1/                  # Evolution evidence plane contracts
│   ├── governance-decision/v1/        # decision + execution-plan + tool-manifest
│   ├── local-services/v1/             # Local services discovery
│   ├── project-display.v1.schema.json
│   ├── rbac-grants/v1/
│   ├── release-evidence/v1/
│   ├── task-execution-routing/v1/     # decision + effect-proposal + lifecycle-event
│   ├── todo-flow/
│   └── workspace-flow/
├── docs/
│   ├── ARCHITECTURE.md / HANDOFF.md / RELEASING.md
│   ├── adr/                           # ADR-001..010 + ADR-016 + README
│   ├── architecture/git-system.md
│   ├── audits/                        # 8 dated audit reports (2026-06-11 → 2026-09-26)
│   ├── corepack.md
│   ├── evolution/                     # Evolution Evidence Plane docs
│   ├── governance/SECURITY.md
│   ├── logs/                          # Audit logs
│   ├── policies/                      # Lifecycle + release policy
│   ├── project-docs.manifest.json
│   ├── proposals/
│   ├── specs/                         # 4 dated design specs (admission, incubator, etc.)
│   ├── standards/
│   ├── state/                         # CHANGELOG.md / TODO.md / MILESTONE.md / TDD.md / PRD.md
│   └── workflows/
├── projects/                          # Active business mirrors (legacy; 2026-04-01 converged)
├── references/                        # Short-term third-party refs (Blinko / Cockpit / ComfyUI / DBSkill / Image2Prompt / OpenCodex / Sub2API / Tidewater)
├── schemas/                           # 7 JSON Schemas
├── scripts/                           # 65 governance scripts (see "Key Modules/Files")
├── shared/                            # Shared capability mirrors (legacy)
├── src-rs/                            # Empty (Rust workspace migrated to axiom-workspace-rs)
├── templates/                         # project-admission-gate.md, workspace-audit-remediation-trigger.md, incubator/
├── tools/                             # Local tool mirrors
└── workbench/                         # Axi Workbench mirror
```

The Axi Docs mirror lives outside this repo at
`workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/`
(declared in `workspace.json:116` as `documentation.axiDocsSource.path`)
and is regenerated by `pnpm workspace:docs:sync`.

## Build & Install

```bash
# Bootstrap governance repo (Node 20+, pnpm 10.33.2 via Corepack)
npm --prefix scripts/vendor/corepack install
/Volumes/code/workspace/scripts/runtime/corepack pnpm install

# Generate registry from workspace.json
pnpm workspace:registry:sync

# Generate human-readable docs index
pnpm workspace:docs:sync

# Run audit
pnpm workspace:audit

# Incubator + agent guidance sync
pnpm workspace:incubator:sync
pnpm agent-guidance:sync
```

There is no `build` step — this repo is governance + docs only. All
output files (`docs/state/*.md`, `.workspace/registry.json`, the Axi
Docs mirror) are **generated artifacts** and must never be hand-edited
(see `AGENTS.md:21-22`).

## Verification

From `AGENTS.md:25-31`:

```bash
pnpm install
pnpm test
pnpm build
```

Real verification surface per the workspace CLI:

```bash
node scripts/workspace-project-cli.mjs validate                  # graph + registry + index consistency
node scripts/workspace-project-cli.mjs onboard <project-id>      # two-minute takeover brief
node scripts/workspace-project-cli.mjs handoff-check <project-id># zero-context handoff gate
node scripts/workspace-audit.mjs                                  # structure + drift audit
node scripts/workspace-flow.mjs                                   # cross-repo Change Set + maturity
node scripts/sync-agent-guidance.mjs --check                      # verifies root AGENTS.md matches generated
```

Test entry points per `package.json:25-48`:

- `pnpm workspace:flow:test` — node --test on `scripts/workspace-flow.test.mjs`
- `pnpm workspace:contracts:test` — aggregate of `workspace-flow.test.mjs` + `workspace-git-hooks.test.mjs` + `task-execution-routing-contract.test.mjs` + `governance-decision-contract.test.mjs`
- `pnpm admission:test` — admission + incubator + sync-agent-guidance suites
- `pnpm contracts:axi-todo:test`, `contracts:task-execution-routing:test`, `contracts:governance-decision:test` — per-contract
- `pnpm completion:test`, `verification:test`, `git-hooks:test`, `handoff:test`, `evolution:test`

## Architecture Highlights

**Three-piece registry / graph / index.** The canonical workspace
declaration is `workspace.json` (1.2k lines, partitioned by category:
`agent` / `distributions` / `infra` / `products` / `projects` /
`shared` / `tools` / `candidates` / `references`, plus `settings.*`,
`schemaVersion`, `version`). The machine-readable complement is
`workspace.graph.json` at the workspace root (`schemaVersion:
2026-06-18`), and the human-readable complement is
`WORKSPACE_INDEX.md` at the workspace root. The three-piece check is
the load-bearing barrier: an admission is not complete until `validate`
prints "ok", `audit` returns 0 errors, and `workspace:docs:sync` has
rebuilt the index. `AGENTS.md:34-45` documents this.

**`workspace-project-cli.mjs` as the unified CLI surface.** The 586-LoC
CLI (`scripts/workspace-project-cli.mjs:28-123`) dispatches 18
subcommands to four supporting libraries: `project-handoff.mjs` (the
largest at ~620 LoC; onboard / handoff / handoff-check / completion),
`project-admission.mjs` (route-intent / admission-check /
admission-show / validate), `workspace-incubator.mjs` (incubation
validation), and `workspace-lib.mjs` (path resolution). It is
documented at `scripts/workspace-project-cli.AGENTS.md` which mirrors
the workspace-level `AGENTS.md` and defines the `excluded` lifecycle
shortcut (`workspace-project-cli.AGENTS.md:119`).

**Project admission gate.** A machine-enforced lifecycle: every
project must (a) be either inside a `tier.values` enum
(`axi-core-product` / `axi-spun-out-product` / `axi-shared-foundation`
/ `axi-shared-infra` / `axi-shared-reference` / `axi-local-tool` /
`external-infra` / `third-party-reference` / `axi-candidate` /
`axi-archive` per `workspace.json:905-920`), and (b) carry an
`admissions/<project-id>.json` accepted admission record validated
against `schemas/project-admission-v1.schema.json`. Pre-creation, the
`workspace-project route-intent --intent <i> --domain <d>
[--capability] [--boundary] --json` step is mandatory; it returns
`reuse-existing` / `shared-provider` / `new-project-candidate` /
`incubate` / `rejected` decisions and the matching `requiredReads`
list (see `workspace-project-cli.mjs:160-176`).

**Incubator as a non-project partition.** Per
`docs/policies/project-lifecycle-and-release.md`, ideas / demos /
prototypes that don't yet qualify as projects go into
`/Volumes/code/workspace/incubator/<slug>/` with an `incubation.json`
+ `IDEA.md` / `DESIGN.md` / `TASK.md` envelope validated by
`workspace-incubator-sync.mjs` against
`schemas/incubation-v1.schema.json`. Promotions must rerun
`route-intent` and migrate to the returned host/provider/project;
in-place conversion is forbidden.

**Contracts layer.** Two versioned contract triples govern agent
runtime. `task-execution-routing/v1` (decision + effect-proposal +
lifecycle-event) is the routing vocabulary referenced by
ADR-005 / `ADR-009-workflow-first-bounded-agent.md`. The newer
`governance-decision/v1` (decision + execution-plan + tool-manifest)
adds a `transformedPlan` field and a 4-way guard verdict
(`allow` / `deny` / `transform` / `pause`); it references routing
decisions via `routingDecisions[]` per
`docs/state/CHANGELOG.md:20-24`. A cross-contract test
(`scripts/governance-decision-contract.test.mjs`) verifies
`steps[].tool ⊆ allowedTools[]` — a constraint JSON Schema can't
express.

**Evolution Evidence Plane.** A separate read-only loop
(`scripts/evolution-{collect,analyze,propose,verify,report,apply}.mjs`)
collects redacted observations, clusters repeated findings, generates
approval-gated proposals, runs static or explicitly requested
validation, and reports adoption metrics. Output is gated on
`docs/evolution/README.md` and the `evolution:apply` step requires
owner ack. Discovered 2026-09-12 (`docs/state/CHANGELOG.md:28`).

## Key Modules/Files

| Module / file | Responsibility | Path |
| --- | --- | --- |
| Workspace declaration | Canonical 1.2k-line declaration with category/tier/schemaVersion | `workspace.json` |
| Unified CLI dispatch | 18 subcommands over 4 libraries | `scripts/workspace-project-cli.mjs` (586 LoC) |
| CLI AGENTS doc | Per-subcommand table + error table + extension points | `scripts/workspace-project-cli.AGENTS.md` |
| Handoff library | onboard / handoff / handoff-check / completion / validateProjectManifest / findGraphProjectByPath | `scripts/project-handoff.mjs` |
| Admission library | route-intent / admission-check / admission-show / validateRegistryAdmissions / validateAdmissionProposal | `scripts/project-admission.mjs` |
| Incubator library | incubator root + per-directory validation | `scripts/workspace-incubator.mjs` (311 LoC) |
| Audit driver | Path / naming / drift / registry checks | `scripts/workspace-audit.mjs` (825 LoC) |
| Docs sync driver | Graph → markdown index + Axi Docs mirror | `scripts/workspace-docs-sync.mjs` (602 LoC) |
| Registry sync | `workspace.json` → `.workspace/registry.json` (generated) | `scripts/workspace-registry-sync.mjs` (94 LoC) |
| Git status aggregator | Per-repo clean / ahead / push policy across registered projects | `scripts/workspace-git-status.mjs` (220 LoC) |
| Incubator sync | Push root contract + starter templates from `templates/incubator/` | `scripts/workspace-incubator-sync.mjs` |
| Agent guidance sync | Distill `templates/project-admission-gate.md` into root `AGENTS.md` for each CLI | `scripts/sync-agent-guidance.mjs` |
| Flow driver | Change Set / release evidence / maturity stage checks | `scripts/workspace-flow.mjs` (210 LoC) |
| Completion / verification | Snapshot completion JSON + verification.md evidence | `scripts/workspace-completion.mjs`, `scripts/workspace-verification.mjs` |
| Handoff eval | Zero-context handoff JSON build + eval | `scripts/zero-context-handoff-eval.mjs` |
| Change ledger | Cross-repo change-set artifact | `scripts/workspace-change-ledger.mjs` |
| Evolution loop | collect / analyze / propose / verify / report / apply | `scripts/evolution-{collect,analyze,propose,verify,report,apply}.mjs` |
| Decision contract test | 33-line cross-field invariant | `scripts/task-execution-routing-contract.test.mjs`, `scripts/governance-decision-contract.test.mjs` |
| ADRs | 11 decisions (governance repo as index plane → M11 Rust migration plan) | `docs/adr/ADR-001..010`, `ADR-016-workspace-governance-rust-migration.md` |
| Schemas | 7 machine-readable contracts | `schemas/{incubation-v1,project-admission-v1,project-maturity-v1,...}.schema.json` |
| Admission records | 30+ accepted standalone-project admissions | `admissions/*.json` |
| Templates | Canonical agent-runtime gate text | `templates/project-admission-gate.md`, `templates/workspace-audit-remediation-trigger.md`, `templates/incubator/` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Foundation | workspace.json v1.3.0 + 11 ADRs | Done |
| M10 docs phase | Three-tier reference governance + governance-decision/v1 trio + Evolution Evidence Plane + cross-doc sync | Done (2026-09-29, 11 changelog entries) |
| M11 BLOCKING owner decisions | 8 BLOCKING (D14/15/16/17/22/23/29/33) + D43 accepted; D44-D67 deferred to M12+ | Accepted 2026-10-03 (`docs/state/CHANGELOG.md:13-23`) |
| Rust migration | Phase 1 read-only subset at `axi-workspace-rs/crates/workspace-governance-rs` | Phase 1 done (M4 landed 2026-09-29); Phase 2-4 deferred to owner opt-in |
| Axi Docs mirror | `documentation.axiDocsSource` resolved at `workbench/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/` | Live; regenerated by `pnpm workspace:docs:sync` |
| D4 registry integration | `workspace.json` entry + admission record; graph node + WORKSPACE_INDEX.md row + admission pointer in workspace.json still missing | Half-done; locked behind D4 owner opt-in (see `HANDOFF.md:589-602` of axi-workspace-rs) |

Recent commit trajectory (`git log --since="6 months ago"`, last 10):

```
5e50402 fix(governance): apply reference rename + stack fixes that prior waves intended
8e3e06a fix(governance): findGraphProjectByPath handles absolute and relative paths
106add6 feat(governance): workspace-audit honors .auditignore
8d15ddc fix(governance): record reference rename events in change log
956607f fix(governance): correct workspaceRoot alias in zero-context-handoff-eval
317e22e chore(workspace-governance): sync Rust canonical location for axi-workbench-cli (ADR-012 M4)
f1a1a87 chore(workspace-governance): record Rust canonical path for axi-workbench-cli (ADR-012 M4)
72d30d9 fix(governance): restore scripts/workspace-change-ledger.mjs + .test.mjs from 395f171
3ec54f3 feat(workspace-governance): add per-project git-hook verification to axi-workspace-rs admission
14b29de chore(workspace): point registry at private governance remote
```

Working tree status: branch `agent/audit-fix-a10-path-compat`, ahead
of origin; untracked `SECURITY.md`, `admissions/axi-file-preview.json`,
`docs/state/agent-governance-phase0-baseline-2026-09-29.md`.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/workspace-governance/AGENTS.md) — agent rules + verification
- [`README.md`](/Volumes/code/workspace/foundation/workspace-governance/README.md) — Chinese-language entrypoint + governance commands
- [`INDEX.md`](/Volumes/code/workspace/foundation/workspace-governance/INDEX.md) — document map
- [`workspace.json`](/Volumes/code/workspace/foundation/workspace-governance/workspace.json) — canonical declaration (1.2k lines)
- [`docs/state/CHANGELOG.md`](/Volumes/code/workspace/foundation/workspace-governance/docs/state/CHANGELOG.md) — canonical change log (Unreleased + 0.1.0)
- [`docs/CHANGELOG.md`](/Volumes/code/workspace/foundation/workspace-governance/docs/CHANGELOG.md) — secondary change log (stub)
- [`docs/adr/ADR-001..010 + ADR-016`](/Volumes/code/workspace/foundation/workspace-governance/docs/adr/) — 11 architectural decisions
- [`docs/audits/`](/Volumes/code/workspace/foundation/workspace-governance/docs/audits/) — 8 dated audit reports
- [`docs/specs/2026-07-09-project-admission/`](/Volumes/code/workspace/foundation/workspace-governance/docs/specs/) — admission gate design
- [`docs/specs/2026-07-28-workspace-incubator/`](/Volumes/code/workspace/foundation/workspace-governance/docs/specs/) — incubator design
- [`docs/specs/2026-09-24-workspace-entrance-spatial-graph/`](/Volumes/code/workspace/foundation/workspace-governance/docs/specs/) — ADR-008 remediation
- [`docs/policies/project-lifecycle-and-release.md`](/Volumes/code/workspace/foundation/workspace-governance/docs/policies/) — maturity + promotion policy
- [`scripts/workspace-project-cli.AGENTS.md`](/Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.AGENTS.md) — CLI dispatch reference
- [`templates/project-admission-gate.md`](/Volumes/code/workspace/foundation/workspace-governance/templates/) — agent-runtime gate source
- [`templates/workspace-audit-remediation-trigger.md`](/Volumes/code/workspace/foundation/workspace-governance/templates/) — audit routing hook source
- [`contracts/task-execution-routing/v1/`](/Volumes/code/workspace/foundation/workspace-governance/contracts/) — routing contract triple
- [`contracts/governance-decision/v1/`](/Volumes/code/workspace/foundation/workspace-governance/contracts/) — decision + plan + tool-manifest triple

## Cross-References

This repo **provides** (per `workspace.json` governance tier):

- `workspace-registry` (build phase) — `axi-agent`, `axi-rules`, `axi-workspace-rs`, all `axi-*-cli` projects
- `governance-rules` (build phase) — consumed by every registered project for `pnpm workspace:docs:sync` and `pnpm workspace:audit`
- `project-admission` (build phase) — enforced pre-creation
- `workspace-audit` (runtime phase) — runs at every post-commit hook in every registered project

This repo **consumes** (declared in `workspace.json`):

- `axi-rules` (`foundation/axi-rules`) for rule router + memory precedence
- `axi-skills` (`foundation/axi-skills`) for APM zero-context package layer (ADR-004)
- `axi-agent` (`agent-cluster/axi-agent`) for Agent runtime + MCP transport
- `axi-workbench` (`workbench/axi-workbench`) for the Axi Docs mirror hosting

Sister Rust port at `foundation/axi-workspace-rs/crates/workspace-governance-rs/`
holds Phase 1 (read-only) Rust implementations of the six subcommands
(`list`, `whereami`, `health`, `onboard`, `handoff-check`,
`validate`); the remaining 21 subcommands stay on Node pending
Phases 2-4 per ADR-016. Per-crate contract harness at
`tools/ctxt/contracts/workspace-governance-rs-parity/` is the byte-stable
parity check.

## Notes

- `workspace.json`, `.workspace/registry.json`, `docs/state/*.md` and the Axi Docs mirror are **generated artifacts**; never hand-edit.
- Working tree is dirty on `agent/audit-fix-a10-path-compat` (2026-10-07 snapshot).
- Reference-tier governance: ADR renumbering on 2026-09-24; three-tier references live under `references/`.
---
id: axi-docs-en-projects-axi-apps
title: Axi Applications
type: project
status: published
tags: [Axi Docs, Projects, foundation, axi-core-product]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Applications
graph-tags: [Projects, foundation, applications-cli]
description: PRD-06 Applications CLI. Three pure-reader sub-CLIs (Share / Aggregate / Mobile) + FastAPI mobile_server on the live Kernel + downstream CLIs (workbench / inbox / sync / runtime). Share writes 1 audit Change row; Aggregate fuses 4 partitions + sync L0-L3 + runtime rule/skill/agent counts; Mobile is size-bound for phone-class clients.
project:
  id: axi-apps
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-apps
  source-section: shared
---

# Axi Applications

> Mirror of the project root `README.md` + `PRD.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-apps/README.md`](/Volumes/code/workspace/foundation/axi-apps/README.md)
> and [`/Volumes/code/workspace/foundation/axi-apps/PRD.md`](/Volumes/code/workspace/foundation/axi-apps/PRD.md).
> Partition: `foundation/`. Domain: `applications`. Lifecycle:
> `active-promoted-incubation` (promoted 2026-09-23 from
> `incubator/applications/`).

## Summary

`axi-apps` is the **PRD-06 Applications CLI** of the AXI Personal OS. It
ships **three sub-CLIs in one process** plus an optional FastAPI HTTP
wrapper: **Share / Aggregate / Mobile**. All three share a single
`argparse` entry, the same Kernel handle, and the same Kernel bridge
design. The runtime is **pure reader** — the only write surface is Share,
which records a `Change` row (`summary: "shared: <name>"` /
`"unshared: <name>"`) and never mutates the source `ResourceObject`. The
Resource remains inbox's authoritative source.

**Share** (`share.py`) maintains a per-resource share-state by appending
`shared:` / `unshared:` Change rows; `current_state(reg, resource_id)`
returns `"shared"` / `"unshared"` / `"unknown"`; `share()` and `unshare()`
are idempotent — re-running when already in the desired state does **not**
emit a duplicate Change row. `list_shared(reg)` walks every Change row,
filters by summary prefix, picks the latest event per `subject_id`,
returns the current set with `shared_at` + `share_event_id` provenance.

**Aggregate** (`aggregate.py`) fuses four partition views into one JSON
payload: `projects.by_partition` (counts of `ProjectObject` per
workspace partition), `inbox.by_status` (counts of `ResourceObject` by
`inbox_status`), `sync.by_level` (Change-row counts by inferred L0 / L1 /
L2 / L3 keyword heuristic), `runtime` (rule / skill / agent counts read
from `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json`).
`dashboard(...)` adds the last `limit` Change rows. Subprocess-based calls
to downstream CLIs (`axi-workbench`, `axi-inbox`, `axi-sync`,
`axi-runtime`) are **degraded** when the subprocess fails (status returns
`{partition: "kernel_unreachable"}`) rather than raising — the aggregate
CLI must not crash when a downstream isn't running.

**Mobile** (`mobile.py`) emits a **size-bound JSON subset** for
phone-class clients. `status()` returns per-project minimal records
(id / name / stage / status) truncated to `limit` projects; `inbox()`
returns Resources with the requested `status`; `sync()` returns Change
rows whose summary matches the requested level. The truncation helper
`_truncate` enforces a **< 50 KB** cap; PRD §6 FR-3 sets the canonical
limit at **< 256 KB default**, adjustable via `--max-size <KB>`. The
FastAPI wrapper (`mobile_server.py`) exposes the same three payloads via
`/status`, `/inbox?status=...`, `/sync?level=...` plus `/healthz` on
`127.0.0.1:8765`; auth is **intentionally absent** (single-tenant
loopback) — operators who expose it on a network must put it behind a
reverse proxy with mTLS.

The CLI inherits the same Kernel bridge pattern as
`axi-runtime` (`kernel_bridge.py` resolves `foundation/axi-kernel` via
`AXI_KERNEL_PATH` env override or default path, injects into `sys.path`,
calls `axi_kernel.registry.open_default`). No mocks, no schema v7; all
data is read straight from Kernel v6.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Language | Python 3.11+ | `pyproject.toml` `requires-python = ">=3.11"` |
| Package | `axi_apps/` | One CLI package; entrypoint `__main__.py` |
| Kernel | `foundation/axi-kernel` | Read via `kernel_bridge.py` `sys.path` injection (env override `AXI_KERNEL_PATH`) |
| Downstream CLIs | `axi-workbench`, `axi-inbox`, `axi-sync`, `axi-runtime` | Aggregate calls them via subprocess (degrades on failure) |
| HTTP server | FastAPI ≥ 0.115 + uvicorn ≥ 0.30 | `mobile_server.py`; `pyproject.toml` deps pinned |
| Audit log side-store | JSON file | `incubator/governance-runtime/data/governance.json` (read by `_runtime_counts`) |
| Test | `unittest` | `tests/test_apps.py` (share / aggregate / mobile / kernel_bridge); `tests/test_mobile_server.py` (6 cases) |
| Output schemas | `ApplicationsAggregateV1` (5 partitions); `ApplicationsMobileV1` (≤ 256 KB default); `mobile.status / mobile.inbox / mobile.sync` JSON payloads | Frozen in source top-of-file |

## Project Layout

```text
foundation/axi-apps/
├── axi_apps/                      # CLI package (~600 LOC across 6 modules)
│   ├── __init__.py                # package marker
│   ├── __main__.py                # argparse: share list/add/remove, aggregate status/dashboard, mobile status/inbox/sync/serve (149 LOC)
│   ├── share.py                   # L1 shareable → Change row + list shared (117 LOC)
│   ├── aggregate.py               # L2 fused JSON payload (128 LOC)
│   ├── mobile.py                  # L2 size-bound subset (< 50 KB cap) (101 LOC)
│   ├── mobile_server.py           # FastAPI HTTP wrapper (status/inbox/sync/healthz) (82 LOC)
│   └── kernel_bridge.py           # Resolves `foundation/axi-kernel` via env or default
├── tests/
│   ├── test_apps.py               # share / aggregate / mobile / kernel_bridge regression
│   └── test_mobile_server.py      # /healthz, /status, /inbox 400, /sync 400, defaults
├── docs/
│   ├── HANDOFF.md                 # 90-second read + commands + contracts + freshness (readiness=unready, last verified 2026-09-25)
│   ├── VERIFICATION.md            # Verification matrix
│   ├── project-docs.manifest.json # Manifest v2 contract
│   ├── logs/                      # Auto-generated log files
│   └── workflows/                 # AP-SHARE / AP-AGG / AP-MOBILE workflow files
├── evidence/
│   └── mobile-server-20260923T160000Z.log
├── AGENTS.md
├── README.md / README.zh-CN.md
├── PRD.md                         # L2 PRD v1.1, 221 lines; FR-1…FR-7 + AC-1…AC-7
├── CHANGELOG.md                   # Keep a Changelog; 2026-09-23 mobile FastAPI + promotion entries
├── MILESTONE.md                   # M1 active / M2 pending / M3 pending (stage=shared)
├── TODO.md                        # TODO-T-001 (axi dashboard app-shell contract) + TODO-T-002 (component discovery)
└── pyproject.toml                 # name=axi-apps, deps: fastapi>=0.115, uvicorn>=0.30
```

## Build & Install

```bash
# From the apps directory
cd /Volumes/code/workspace/foundation/axi-apps
export PYTHONPATH=../axi-kernel
python3 -m unittest discover -s tests -v

# Show CLI help
python3 -m axi_apps --help

# Share
python3 -m axi_apps share list
python3 -m axi_apps share add <resource-id>
python3 -m axi_apps share remove <resource-id>

# Aggregate
python3 -m axi_apps aggregate status
python3 -m axi_apps aggregate dashboard --limit 5

# Mobile
python3 -m axi_apps mobile status --limit 100
python3 -m axi_apps mobile inbox --status unread --limit 20
python3 -m axi_apps mobile sync --level L3 --limit 10

# Mobile FastAPI server (PRD-06 §9.3 Phase 5 gap A2)
python3 -m axi_apps mobile serve --host 127.0.0.1 --port 8765
```

No `pip install -e`; the CLI is consumed by setting
`PYTHONPATH=../axi-kernel` and importing from the checkout. The mobile
FastAPI wrapper needs `fastapi>=0.115` and `uvicorn>=0.30` (declared in
`pyproject.toml [project.dependencies]`). Workspace governance path is
`/Volumes/code/workspace/foundation/axi-apps`.

## Verification

```bash
PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests -v
PYTHONPATH=../axi-kernel python3 -m axi_apps --help
PYTHONPATH=../axi-kernel python3 -m axi_apps share
PYTHONPATH=../axi-kernel python3 -m axi_apps aggregate
PYTHONPATH=../axi-kernel python3 -m axi_apps mobile
PYTHONPATH=../axi-kernel python3 -m axi_apps mobile --max-size 128   # if supported
node /Volumes/code/workspace/scripts/workspace-project consumers axi-apps
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project whereami /Volumes/code/workspace/foundation/axi-apps
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
```

PRD §10 AC-1 … AC-7 are the canonical check list; `FR-7` is the
end-to-end closure FR (`share → aggregate → mobile` in real Kernel + real
4 CLI subprocesses ≤ 12 s; mobile < 256 KB; share writes 1 Change).

## Architecture Highlights

**Layered design (PRD §2).** Four layers, single-direction dependency
**L3 → L2 → L1 → L0**. L0 data convergence (`kernel_bridge.py` +
`__main__.py` `open_shared_registry`) injects Kernel via `sys.path` and
subprocess-calls downstream CLIs (workbench / inbox / sync / runtime);
failures degrade upper projections to `{partition: "kernel_unreachable"}`
rather than exit non-zero. L1 Share projection (`share.py`) writes one
`Change` row per state transition (idempotent — no duplicate Change row
when state is unchanged). L2 Aggregate + Mobile projections (`aggregate.py`
+ `mobile.py`) consume the L0 RawProjection dict, fuse partition views,
and apply size-bound truncation. L3 interface (`__main__.py` argparse
+ `mobile serve` FastAPI) handles user argument dispatch; no shared
global state across the three sub-CLIs.

**Share is the only writer; pure readers everywhere else.** `share.py`
filters every `Change` row by summary prefix (`"shared: "` /
`"unshared: "`) to compute current state per `subject_id`. The
`list_by_type(CHANGE)` registry order is preserved because Kernel
timestamps have second precision; latest-event semantics depend on
order, not just timestamp. Resource objects are **never** written by
this CLI — inbox remains the single authoritative source for
`ResourceObject`. `share()` and `unshare()` are idempotent (re-running
when already shared does **not** emit a duplicate Change row).

**Aggregate fuses 4 sources + 1 side-store.** `_by_partition(reg)`
counts `ProjectObject` per workspace partition by resolving
`project.location` against `/Volumes/code/workspace` (handles
`deactivated` status by skipping). `_by_inbox_status(reg)` counts
`ResourceObject` by `inbox_status.value` (skips `kind` falsy). `_by_sync_level(reg)`
infers L0/L1/L2/L3 from Change-row summary keywords (the same heuristic
Change Sync V0.1 uses for `sync.log` evidence: migration / schema_version
/ v1->v2 → L3; transformed / linked / archived / corrected → L2;
confirmed / registered / collected → L1; else → L0). `_runtime_counts(base_dir)`
reads the governance-runtime side-store at
`/Volumes/code/workspace/incubator/governance-runtime/data/governance.json`
and returns `{rules, skills, agents}`; missing file → all zeros
(aggregate must not crash when the runtime hasn't seeded). `dashboard(...)`
adds the last `limit` Change rows sorted by `created_at` descending.

**Mobile is size-bound for phone-class clients.** `_truncate(payload,
*, limit)` enforces **< 50 KB** (`if len(json.dumps(...)) <= 50_000
return payload else return {"truncated": True, "limit": limit, "items":
payload.get("items", [])[:limit]}`). The PRD's canonical threshold is
**< 256 KB default**, adjustable via `--max-size <KB>` (the CLI
implementation uses 50 KB; PRD documents 256 KB). `mobile status` returns
`{kind: "mobile.status", project_count, items}` truncated to `limit`
projects; `mobile inbox` filters Resources by `inbox_status` and
returns `{kind: "mobile.inbox", status, items}`; `mobile sync` filters
Change rows by level-keyword and returns `{kind: "mobile.sync", level,
items}`. All payloads are pure readers — no Kernel writes.

**FastAPI HTTP wrapper.** `mobile_server.py` exposes
`GET /healthz` (liveness + `kernel_alive: true`),
`GET /status?limit=...`,
`GET /inbox?status=unread|reading|done|archived&limit=...`,
`GET /sync?level=L0|L1|L2|L3&limit=...`. The registry is captured at
`build_app(registry)` time for a stable Kernel reference for the
server's lifetime. `serve(reg, host=127.0.0.1, port=8765)` runs uvicorn
in the foreground. Auth is intentionally absent — operators must put it
behind a reverse proxy with mTLS if exposed on a network. `serve` is
**not auto-installed**; the operator invokes
`python3 -m axi_apps mobile serve` directly.

**Kernel bridge.** Identical pattern to `axi-runtime`:
`kernel_bridge.py` resolves the Kernel path via env `AXI_KERNEL_PATH`
or default `/Volumes/code/workspace/foundation/axi-kernel`,
injects into `sys.path`, and `open_shared_registry()` opens the live
`Registry` via `axi_kernel.registry.open_default`. Both projects import
the same `axi_kernel.schema.ObjectType` enum for `CHANGE`, `PROJECT`,
`RESOURCE`, `RULE`, `SKILL`, `AGENT`, `INVOCATION` discriminators.

**Capability surface.** The CLI exposes four capabilities (per FR-6):
`axi-apps-cli` (the unified process), `applications-aggregate-v1`
(JSON payload schema), `share-inbox-bridge-v1` (audit row + list), and
`applications-mobile-v1` (size-bound subset). Downstream consumers (per
PRD §8): Axi Mobile, axi-workbench 治理 GUI, cc-connect workflow, Axi
Coder, Axi Workbench remote task receipts. Changing the aggregate /
mobile output schema = changing every consumer schema; the contract
must be coordinated via `workspace-project consumers axi-apps`.

## Key Modules/Files

| File | Purpose |
| --- | --- |
| `axi_apps/__main__.py` | argparse CLI; `--runtime-base` override; subcommands `share list/add/remove`, `aggregate status/dashboard`, `mobile status/inbox/sync/serve` (149 LOC) |
| `axi_apps/share.py` | `_filter_changes`, `current_state(reg, resource_id)` ("shared"/"unshared"/"unknown"), `share(reg, resource_id)`, `unshare(reg, resource_id)`, `_name(reg, resource_id)`, `list_shared(reg)` — Change-row audit trail, idempotent (117 LOC) |
| `axi_apps/aggregate.py` | `_by_partition(reg)`, `_by_inbox_status(reg)`, `_by_sync_level(reg)`, `_runtime_counts(base_dir)`, `status(reg, *, runtime_base)`, `dashboard(reg, *, runtime_base, limit)` (128 LOC) |
| `axi_apps/mobile.py` | `_truncate(payload, *, limit)` (50 KB cap), `status(reg, *, limit)`, `inbox(reg, *, status_filter, limit)`, `sync(reg, *, level, limit)` (101 LOC) |
| `axi_apps/mobile_server.py` | `build_app(registry)` FastAPI app; `GET /healthz`, `/status?limit`, `/inbox?status&limit` (400 on invalid status), `/sync?level&limit` (400 on invalid level); `serve(reg, *, host, port)` (82 LOC) |
| `axi_apps/kernel_bridge.py` | Resolves `foundation/axi-kernel` via `AXI_KERNEL_PATH` or default path; injects into `sys.path`; `open_shared_registry()` opens live `Registry` |
| `tests/test_apps.py` | Share + Aggregate + Mobile + Kernel bridge regression |
| `tests/test_mobile_server.py` | 6 cases: /healthz, /status, /inbox 400 validation, /sync 400 validation, /sync default level, /inbox default status |
| `docs/workflows/` | AP-SHARE / AP-AGG / AP-MOBILE workflow definitions |
| `docs/HANDOFF.md` | 90-second read + commands + contracts + freshness (readiness=unready, last verified 2026-09-25) |
| `pyproject.toml` | `name=axi-apps`, `version=0.1.0`, `requires-python>=3.11`; deps `fastapi>=0.115`, `uvicorn>=0.30`; pytest `testpaths=["tests"]` |

## Milestone Status

`MILESTONE.md` (audit-remediation 2026-09-25 scaffold, owner-maintained).
Current stage: `shared`. Three milestones:

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | Handoff-check closed loop (documented / verified) | active |
| M2 | PRD enters real content phase (replace stub, ≥ 1 observable AC) | pending |
| M3 | Next lifecycle stage advancement per `project-lifecycle-and-release.md` | pending |

**Recent shipped work** (per `CHANGELOG.md`):
- 2026-09-23 — **Mobile FastAPI wrapper** (`mobile_server.py`): `GET /healthz` + `/status?limit=...` + `/inbox?status=...&limit=...` + `/sync?level=...&limit=...`; new CLI subcommand `mobile serve [--host 127.0.0.1] [--port 8765]`; no auth (single-tenant loopback); new `pyproject.toml` deps `fastapi>=0.115`, `uvicorn>=0.30`; 6-case `tests/test_mobile_server.py`; evidence `evidence/mobile-server-20260923T160000Z.log`.
- 2026-09-23 — **Promoted from `/Volumes/code/workspace/incubator/applications`**: 11 tests pass; 3 evidence logs (`share.log` + `aggregate.log` + `mobile.log`); `share.add` idempotent, `aggregate` fuses 4 sources, `mobile` under 50 KB for 120 projects; registered in `workspace.json` (tier=`axi-core-product`, domain=`applications`, lifecycle=`active-promoted-incubation`) + `workspace.graph.json` (kind=`applications-cli`); governance admission record `foundation/workspace-governance/admissions/axi-apps.json`.
- 2026-09-22 — Promoted to `projects/` (later bucket-corrected to `foundation/axi-apps` per ADR-008).

**Branch state** (per `git status -sb`): on `dev`, ahead of `origin/dev`
by 8 commits. Latest commit `bf98e11 docs: snapshot auto-generated
submit logs (audit-remediation tail)` (2026-09-29). Other recent:
`9be6939 chore(apps): consolidate PRD refresh and audit-remediation
submit logs`; `7b25c6b sync axi-apps docs + manifest (other: config +
source + workflows, chunk 1)`; `6fa2038 sync axi-apps docs + manifest
(governance docs)`; `792d707 fix(hooks): record workspace changes and
surface failures`; `b456536 chore(githooks): remove || true from
post-commit so failures surface`; `34292a0 docs(workflows): link to
workspace-level workflow index in governance repo`; `9fed7b2
docs(workflows): add AP-SHARE/AGG/MOBILE for axi-apps`; `08b99c5
fix(gitignore): cover *.db / *.sqlite3 / chroma and remove tracked
logs`; `0b84f4d chore(workspace): establish governed repository
boundary`. 1 untracked `docs/logs/submit/20260928-045157-grouped-commit.md`.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-apps/AGENTS.md) — project boundary and 90-second read order; default language 中文; `PYTHONPATH=../axi-kernel` requirement; sub-CLIs are pure readers (Share is the only writer).
- [`README.md`](/Volumes/code/workspace/foundation/axi-apps/README.md) — purpose, quick start, layout.
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-apps/PRD.md) — L2 PRD v1.1, 221 lines; FR-1…FR-7 with quantitative anchors; AC-1…AC-7.
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-apps/CHANGELOG.md) — Keep a Changelog format; mobile FastAPI wrapper + promotion entries.
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-apps/MILESTONE.md) — M1 active / M2 pending / M3 pending (stage=shared).
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-apps/TODO.md) — TODO-T-001 (axi dashboard app-shell loading contract v1), TODO-T-002 (axi-apps ↔ axi-workbench component discovery protocol).
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-apps/docs/HANDOFF.md) — 90-second read order + contracts (readiness=unready, last verified 2026-09-25).
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-apps/docs/VERIFICATION.md) — verification matrix.
- [`evidence/mobile-server-20260923T160000Z.log`](/Volumes/code/workspace/foundation/axi-apps/evidence/mobile-server-20260923T160000Z.log) — Mobile FastAPI wrapper evidence log.

## Cross-References

- `/Volumes/code/workspace/foundation/axi-kernel` — Kernel v6 `Registry`, `JsonStore`, `ObjectType.{CHANGE,PROJECT,RESOURCE,...}`; `register_change` consumed by Share; `list_by_type` consumed by Aggregate + Mobile.
- `/Volumes/code/workspace/foundation/axi-runtime` — sibling; `axi-apps aggregate runtime` reads `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json` (the **incubator path**, not the promoted path) — note this contract drift to be reconciled.
- `/Volumes/code/workspace/foundation/axi-inbox` — provides `ResourceObject.inbox_status` consumed by Aggregate and Mobile.
- `/Volumes/code/workspace/foundation/axi-sync` — provides L0/L1/L2/L3 keyword heuristic mirrored in `_by_sync_level` + `mobile.sync`.
- `/Volumes/code/workspace/foundation/axi-workbench-cli` — Aggregate consumes `workbench-cli` summary output (subprocess); downstream of `axi-apps` for the governance GUI consumer.
- `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-008-personal-os-repository-topology.md` — bucket-corrected `axi-apps` from `projects/axi-apps` to `foundation/axi-apps`.
- `/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md` — sibling ADR; ADR-012 (`axi-apps-rs` migration) is referenced as a sibling effort, pending ADR.
- `/Volumes/code/workspace/foundation/axi-rules/rules/agent-routing/AGENTS.md` — AR-ROUTING-003 shared-consumer rule and AR-ROUTING-004 high-risk fan-out enumeration apply when modifying the aggregate / mobile output schema (≥ 4 downstream consumers: Axi Mobile, Axi Workbench 治理 GUI, cc-connect, Axi Coder).
- `/Volumes/code/workspace/foundation/axi-rules/rules/verification/` — `tests/test_*.py` evidence; behavior-first frontend testing audit does **not** apply to this Python CLI.
- `/Volumes/code/workspace/products/axi-soul-world` — peer product that may consume `axi-apps` mobile JSON via Web BFF.

## Notes

`axi-apps` is the **PRD-06 Applications CLI** of the AXI Personal OS at `foundation/axi-apps`, promoted from `incubator/applications/` on 2026-09-23. Three pure-reader sub-CLIs (Share / Aggregate / Mobile) share a single process plus an optional FastAPI `mobile_server.py`. Share is the only writer: records `summary: "shared: <name>"` / `"unshared: <name>"` `Change` rows and reads the latest state via summary-prefix; `share()` / `unshare()` are idempotent. Aggregate fuses `projects.by_partition` + `inbox.by_status` + `sync.by_level` + `_runtime_counts` (reads `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json`) + `dashboard(limit)`; subprocess failures degrade to `{partition: "kernel_unreachable"}`. Mobile emits size-bound JSON (CLI 50 KB cap, PRD < 256 KB default, `--max-size <KB>` tunable). `mobile_server.py` exposes `GET /healthz`, `/status?limit`, `/inbox?status&limit`, `/sync?level&limit` (listens on `127.0.0.1:8765`, no auth, single-tenant loopback). Deps `fastapi>=0.115`, `uvicorn>=0.30`. `kernel_bridge.py` shares the `AXI_KERNEL_PATH` env + `sys.path` injection + `axi_kernel.registry.open_default` pattern with `axi-runtime`; all data is Kernel v6. FR-7 is the end-to-end closure (`share → aggregate → mobile` in real Kernel + 4 CLI subprocesses ≤ 12 s, mobile < 256 KB).
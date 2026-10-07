---
id: axi-docs-en-projects-axi-inbox
title: Axi Inbox
type: project
status: published
tags: [Axi Docs, Projects, foundation, core, resource-inbox]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Inbox
graph-tags: [Projects, foundation, resource-inbox]
description: AXI Personal OS Inbox CLI (PRD-03, Phase 2) — collects 5 input classes (URL / image / file / idea / project-ref), auto-detects kind via URI heuristics, transitions through a 6-state machine (collected → unread → reviewed → linked → transformed → archived), and transforms inbox items into Kernel Resource / Document objects with 5 target kinds.
project:
  id: axi-inbox
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-inbox
  source-section: core
---

# Axi Inbox

> Mirror of the project root `README.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-inbox/README.md`](/Volumes/code/workspace/foundation/axi-inbox/README.md).
> Section: core / Partition: `foundation/`.

## Summary

Axi Inbox is the canonical **unified inbox CLI** for the AXI Personal OS. It accepts five input classes — `url`, `image`, `file`, `idea`, `project-ref` — and persists them as `Kernel.ResourceObject` rows whose lifecycle is carried on `inbox_status` (the kernel-level `Status` field stays `active` / `stale` / `deactivated`, separate from the inbox lifecycle). The inbox CLI is built as a thin layer over the Kernel: it uses `Registry.register_resource`, `Registry.register_change`, and `Registry.update` for all writes, so the Kernel remains the schema authority and the inbox is a pure behaviour layer. URI heuristic detection lives in `axi_inbox/inferrer.py::infer_kind`; the 6-state inbox machine (`collected → unread → reviewed → linked → transformed → archived`) is enforced by the Kernel `ResourceStatus` enum plus explicit `_transition()` calls in `inbox.py`. `archived` is a terminal state.

The transform pipeline (L3 in the PRD's 4-layer model) supports 5 targets: `--to document` (creates `Kernel.DocumentObject` with `BELONGS_TO → project_id` and `DERIVED_FROM → source_resource_id`), `--to project-resource` (no Kernel write, just a `linked_project` field), `--to inspiration` (writes a fresh `Resource(kind="inspiration")` with `DERIVED_FROM` relation), `--to task` (writes `Resource(kind="task")` with `original_content = "action: <name>\ncontext: <body>"`), and `--to shareable` (writes `Resource(kind="shareable")` with `DERIVED_FROM`). Each transform registers a `Change` row in the Kernel so downstream Change Sync can replay the provenance chain. Inbox is owned by `libu`, registered in `workspace.json` as `tier=axi-core-product`, `domain=resource-inbox`, `lifecycle=active-promoted-incubation`, with `provides=[axi-inbox-cli, resource-inbox]`. The current branch is `dev`, 12 commits ahead of `origin/dev`; the most recent change is `c2ff035` which removed the fallback Rust scaffold (now lives at `foundation/axi-workspace-rs/crates/axi-inbox-rs`).

Axi Inbox was promoted from `incubator/resource-inbox/` on 2026-09-22 (after `axi-kernel` promotion) and re-promoted on 2026-09-23. The current PRD (v1.1, 2026-09-27) introduces the L0/L1/L2/L3 layered model (collect / detect / state-machine / transform) and ties every FR to a quantitative anchor (5 input classes, 5 kinds, 6 states, 2×3 transform targets, ≥ 26 tests). A `kernel_bridge.py` module resolves the canonical Kernel path (default `/Volumes/code/workspace/foundation/axi-kernel`, override via `AXI_KERNEL_PATH`) and injects it onto `sys.path`; running without `PYTHONPATH=../axi-kernel` produces an explicit `axi-kernel not importable` + `PYTHONPATH=...` hint with `exit code ≥ 3` (AC-5 / FR-5). A v1 PRD also proposed a strict 6-state machine with `InvalidTransitionError` on skip-level jumps and `archived → *` rejections; the current inbox code uses the Kernel's `ResourceStatus` enum (which has 6 values: `collected / unread / reviewed / linked / transformed / archived`) without an explicit `InvalidTransitionError` class.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Python package | Python 3.11+, stdlib only (`urllib.parse`, `pathlib`, `argparse`, `json`, `tempfile`, `shutil`) | Zero third-party deps |
| Inbox engine | `axi_inbox/inbox.py` — `collect` / `list_inbox` / `correct` / `review` / `link` / `archive` / `transform` | All writes go through `Registry.register_*` and `Registry.update` |
| URI inference | `axi_inbox/inferrer.py::infer_kind` — `_IMAGE_EXTS`, `_PROJECT_PREFIXES`, scheme/extension/path/whitespace heuristics | Returns one of `url` / `image` / `file` / `idea` / `project-ref` |
| Kernel bridge | `axi_inbox/kernel_bridge.py` — `_resolve_kernel_path` resolves `AXI_KERNEL_PATH` then default path; `open_shared_registry` injects into `sys.path` | `_SIBLING_KERNEL` resolved at import time |
| CLI | `argparse` (`__main__.py::build_parser`) — `collect`, `list`, `review`, `correct`, `link`, `transform`, `archive`, `infer` | 8 subcommands |
| Kernel dependency | `axi_kernel.registry`, `axi_kernel.schema`, `axi_kernel.ids`, `axi_kernel.store` | Must be importable; `PYTHONPATH=../axi-kernel` |
| Tests | `unittest` (stdlib) — `tests/test_inbox.py` with `InferrerTests`, `CollectTests`, `ReviewTests`, `LinkTests`, `TransformTests`, `StateMachineTests`, `KernelMigrationTests` | 26 tests per CHANGELOG; `tests/__init__.py` present |
| Build/test config | `pyproject.toml` (name=`axi-inbox`, version=`0.1.0`, requires-python=`>=3.11`) | `[tool.pytest.ini_options] testpaths = ["tests"]` |
| Workspace governance | `foundation/workspace-governance` consumer; `workspace.json` + `workspace.graph.json` registered; ADR-015 (Rust migration, Proposed) | Rust scaffold removed in commit `c2ff035`; lives at `foundation/axi-workspace-rs/crates/axi-inbox-rs` |
| Evidence collection | `evidence/run_evidence.py` — reproducible CLI snapshot script + 37+ timestamped logs | `collect.log` and `_v2_store.json` snapshots |

## Project Layout

```text
axi-inbox/
├── AGENTS.md                  # Read order, PYTHONPATH requirement
├── README.md / README.zh-CN.md
├── PRD.md                     # v1.1 template, 14 sections, FR-1..FR-8
├── CHANGELOG.md               # Canonical audit trail
├── MILESTONE.md               # M1-M3 generated 2026-09-25
├── TODO.md                    # TODO-T-001 (axi-notify channel); TODO-T-002 (SDK types)
├── pyproject.toml             # name=axi-inbox, version=0.1.0
├── axi_inbox/                 # Python package source
│   ├── __init__.py            # Public re-exports + version="0.1.0-incubation"
│   ├── __main__.py            # CLI entry + 8 subcommand parsers
│   ├── inbox.py               # collect / list_inbox / correct / review / link / archive / transform
│   ├── inferrer.py            # infer_kind + normalise_name URI heuristics
│   └── kernel_bridge.py       # _resolve_kernel_path + open_shared_registry
├── tests/
│   ├── __init__.py
│   └── test_inbox.py          # 26-case regression suite
├── evidence/
│   ├── run_evidence.py        # Reproducible CLI snapshot script
│   ├── _v2_store.json         # Legacy v2 store snapshot
│   ├── _v2_store.json.lock    # fcntl sidecar
│   └── 37+ timestamped .log files (collect-*.log, report-*.log, etc.)
├── docs/
│   ├── HANDOFF.md             # Zero-context takeover brief, readiness=`unready`
│   ├── VERIFICATION.md
│   ├── adr/ADR-015-axi-inbox-rust-migration.md   # Proposed
│   ├── project-docs.manifest.json
│   └── logs/                  # audit-remediation submit logs
├── src-rs/                    # Empty (scaffold migrated)
└── .githooks/                 # post-commit surface-failures
```

## Build & Install

```bash
# No install step — pure-Python stdlib package. The Kernel must be on sys.path.
cd /Volumes/code/workspace/foundation/axi-inbox
export PYTHONPATH=../axi-kernel

# Test suite
python3 -m unittest discover -s tests -v

# CLI smoke
python3 -m axi_inbox --help

# Re-run evidence
bash evidence/run_evidence.sh
# (also: python3 evidence/run_evidence.py)
```

`pyproject.toml` declares `requires-python = ">=3.11"` and no `dependencies` array. The Kernel bridge resolves `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")`; the `AXI_KERNEL_PATH` env var overrides it. Without the Kernel on `sys.path`, `axi_inbox` raises `FileNotFoundError` at import time with the message `"could not locate the AXI Kernel at ...; set AXI_KERNEL_PATH or install the axi-kernel package on sys.path"`. The CLI's `--help` exits cleanly without Kernel access (argparse-only), but every subcommand fails fast with exit 3.

## Verification

Per `AGENTS.md §Verification` and `PRD.md §11`:

```bash
PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests -v
PYTHONPATH=../axi-kernel python3 -m axi_inbox --help
PYTHONPATH=../axi-kernel python3 -m axi_inbox add https://example.com
PYTHONPATH=../axi-kernel python3 -m axi_inbox mark <id> --state reviewed
PYTHONPATH=../axi-kernel python3 -m axi_inbox transform <id> --to resource --kind shareable

# State-machine strictness (AC-3)
PYTHONPATH=../axi-kernel python3 -m axi_inbox mark <id> --state linked
# ↑ should fail if previous state was not reviewed

# Capability exposure (AC-7)
node /Volumes/code/workspace/scripts/workspace-project consumers axi-inbox

# Workspace-level
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project whereami /Volumes/code/workspace/foundation/axi-inbox
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
```

## Architecture Highlights

The PRD's L0/L1/L2/L3 model (PRD.md §2) maps cleanly onto the four Python modules. L0 (`collect.py` / `axi_inbox.__main__:cmd_collect`) is the write surface: it accepts the URI / text input, calls `infer_kind` if `--kind` is omitted, builds a stable id via `axi_kernel.ids.make_id("Resource", "libu", name, uri_or_text)`, registers a `ResourceObject` with `inbox_status=ResourceStatus.COLLECTED`, and emits a `Change` row if `--note` was supplied. L1 (`inferrer.py::infer_kind`) is the URI heuristic: it parses `urllib.parse.urlparse` for `http/https` schemes → `url`, checks `_IMAGE_EXTS = {.png, .jpg, .jpeg, .gif, .webp}` → `image`, walks `_PROJECT_PREFIXES` (canonical partitions `foundation/`, `workbench/`, `agent-cluster/`, `products/`, `distributions/`, `tools/`, `archive/`, `incubator/`, `references/` plus legacy `projects/`, `shared/`, `infra/`) → `project-ref`, then falls through `file` (has `/` or `\`) or `idea` (whitespace / >80 chars / no dot). The detector is a pure function with no I/O; 7 `InferrerTests` cover all branches and lock regression on the full current partition list.

L2 is the state-machine layer. The inbox does not implement its own state machine — it delegates to the Kernel's `ResourceStatus` enum (six values: `COLLECTED`, `UNREAD`, `REVIEWED`, `LINKED`, `TRANSFORMED`, `ARCHIVED`). State transitions go through `inbox._transition()` which calls `Registry.update(extra_fields={"inbox_status": new_status.value, "last_action": ...})` and emits a `Change` row keyed by `subject_id = resource_id`. The `archive` and `review` helpers are thin wrappers around `_transition`; `link` adds a `Relation(kind=BELONGS_TO, target_id=project_id)` and sets `linked_project`. The PRD claims strict skip-level rejection (`InvalidTransitionError`), but the current code does not enforce that — the `Registry.update` call simply overwrites `inbox_status`. The `ResourceStatus.ARCHIVED` value is the terminal state in spirit (no inbox helper returns a non-`COLLECTED` from `ARCHIVED`), but a buggy caller could still call `update(... inbox_status=UNREAD ...)` directly on the Registry. The PRD's M3 acceptance criterion AC-3 (`InvalidTransitionError` on skip) is not yet enforced in `axi_inbox/inbox.py`.

L3 is the transform pipeline (`inbox.transform`). Five targets are supported, each a real `Registry.register_*` call (no mock): `--to document` (mandatory `--as <project-id>`) creates a `DocumentObject` with `BELONGS_TO → project_id` + `DERIVED_FROM → resource_id` and picks a filesystem path that survives Kernel `check` (URL/image/file/project-ref use the source URI; `idea` items fall back to `<project.location>/AGENTS.md`). `--to project-resource` is a no-op Kernel write — it just stamps `linked_project` on the source. `--to inspiration` / `--to task` / `--to shareable` each create a fresh `ResourceObject` with `kind="inspiration"` / `"task"` / `"shareable"`, a `DERIVED_FROM → resource_id` relation, an optional `BELONGS_TO → project_id` (if `--as` supplied), and a `Source(source_id="inbox")`. A `uuid.uuid4().hex[:8]` suffix is mixed into the id hash slot so two `--to shareable` runs on the same source produce distinct ids. After every successful transform the source resource is updated to `inbox_status=TRANSFORMED` with `last_action="transformed to <to>"`, and a final `Change` row records the transform summary. The transform helper also emits a second `Change` row when `--to shareable` is used (subject_id = the new shareable) so Phase 4's audit stream carries provenance both ways.

The Kernel dependency is wired through `kernel_bridge.py` (12 lines), which resolves `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")`, honors `AXI_KERNEL_PATH`, and injects the resolved path into `sys.path` at import time. `open_shared_registry()` is the only Kernel entry point the inbox uses. `Registry.register_many([obj])` is preferred over individual `register_*` calls inside the inbox because it batches multiple writes into a single atomic mutation (Kernel L2 wraps everything in `store.mutate(...)`). The inbox deliberately does **not** own v7 schema atoms — Kernel does not grant inbox permission to mint custom object types, so the inbox writes only `Resource` / `Document` / `Change` (PRD N3 / §1.1 boundary table).

## Key Modules/Files

| Module / File | Responsibility | Path |
| --- | --- | --- |
| `collect` | L0 write — `infer_kind` + `make_id` + `register_resource(COLLECTED)` + optional `register_change` for note | `axi_inbox/inbox.py` |
| `list_inbox` | L3 read — filters `ResourceObject` rows by `inbox_status`; sorted by `created_at` desc | `axi_inbox/inbox.py` |
| `correct` | Mutates `kind` field on an existing resource; emits no change row | `axi_inbox/inbox.py` |
| `_transition` | Generic inbox_status mutation + Change-row emit; shared by `review`, `link`, `archive` | `axi_inbox/inbox.py` |
| `review` | `_transition(..., REVIEWED, summary=f"reviewed {id}")` | `axi_inbox/inbox.py` |
| `link` | Adds `Relation(BELONGS_TO, project_id)` + sets `linked_project` + emits Change row | `axi_inbox/inbox.py` |
| `archive` | `_transition(..., ARCHIVED, summary=f"archived {id}: {note}")` | `axi_inbox/inbox.py` |
| `transform` | 5-target L3 dispatch — `document` / `project-resource` / `inspiration` / `task` / `shareable`; each writes to Kernel + emits Change row | `axi_inbox/inbox.py` |
| `infer_kind` | URI heuristic — returns `url` / `image` / `file` / `idea` / `project-ref` | `axi_inbox/inferrer.py` |
| `normalise_name` | Build short human label (basename without ext, or first 64 chars + ellipsis for `idea`) | `axi_inbox/inferrer.py` |
| `_IMAGE_EXTS` / `_PROJECT_PREFIXES` | Image-extension set + workspace partition prefix list (canonical + legacy) | `axi_inbox/inferrer.py` |
| `_resolve_kernel_path` / `open_shared_registry` | `AXI_KERNEL_PATH` env + default path resolution; injects into `sys.path` at import | `axi_inbox/kernel_bridge.py` |
| CLI `build_parser` + 8 subcommands | `collect <uri-or-text> [--kind K] [--note N]`, `list [--status S]`, `review <id>`, `correct <id> --kind K`, `link <id> --to <pid>`, `transform <id> --to <target> [--as <pid>]`, `archive <id> [--note N]`, `infer <uri-or-text>` | `axi_inbox/__main__.py` |
| ADR-015 (Proposed) | Rust migration plan — 6-state machine as Rust enum + transition table; 5 input adapters (`File`/`Url`/`Email`/`Clipboard`/`Manual`); 3-phase migration gated on ADR-011 (`axi-kernel-rs`) | `docs/adr/ADR-015-axi-inbox-rust-migration.md` |
| Test suite | 26 `unittest.TestCase` cases — `InferrerTests` (7) + `CollectTests` (5+) + state-machine + transform + Kernel v2→v3 migration | `tests/test_inbox.py` |
| `evidence/run_evidence.py` | Reproducible CLI snapshot script; emits `collect-*.log`, `report-*.log`, etc. | `evidence/run_evidence.py` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Phase 2 v1 | 5 input classes + 5-kind heuristic + 6-state machine + transform pipeline | Done (promoted 2026-09-22) |
| Step 1 (real landing) | `--to inspiration` / `--to task` patches write real `Resource` rows (not stubs) | Done (4 new tests, 26 inbox tests pass) |
| Schema v3 | `Resource.inbox_status` / `original_content` / `linked_project` / `last_action` | Done |
| Bridge simplification | All 5 downstream bridges resolve Kernel via `AXI_KERNEL_PATH` env fallback (default `foundation/axi-kernel`) | Done (2026-09-23) |
| v1.1 PRD template upgrade | Layered FR with quantitative anchors + FR-8 end-to-end smoke | Done (2026-09-27) |
| ADR-015 Rust migration | Dual-entry Python + Rust; Phase 1 scaffold at `src-rs/axi-inbox-rs/` (now removed, migrated to `axi-workspace-rs`) | Proposed (2026-09-29) |
| M1 handoff-check | `documented` / `verified` state | Pending (current `docs/HANDOFF.md` reports `unready`) |
| M2 PRD content化 | Stub → real PRD | Done (PRD v1.1, 15.4 KB) |
| M3 next-lifecycle | `stage=shared` → next phase per `project-maturity-v1` decision record | Pending |
| Open ADRs | 4 inbox ADRs (`URI heuristic not ML`, `6-state strict`, `no full-text index`, `ghost transform records`) | All `(待发)` |
| AC-3 enforcement | `InvalidTransitionError` on skip-level jumps + `archived → *` rejection | Not yet enforced in `inbox.py` (only in PRD) |

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-inbox/AGENTS.md) — read order, PYTHONPATH requirement, verification
- [`README.md`](/Volumes/code/workspace/foundation/axi-inbox/README.md) — purpose, quick start, layout
- [`README.zh-CN.md`](/Volumes/code/workspace/foundation/axi-inbox/README.zh-CN.md)
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-inbox/PRD.md) — v1.1 template, 14 sections, FR-1..FR-8
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-inbox/CHANGELOG.md) — canonical audit trail
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-inbox/MILESTONE.md) — M1-M3 generated 2026-09-25
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-inbox/TODO.md) — TODO-T-001/002
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-inbox/docs/HANDOFF.md) — zero-context takeover brief, readiness=`unready`
- [`docs/adr/ADR-015-axi-inbox-rust-migration.md`](/Volumes/code/workspace/foundation/axi-inbox/docs/adr/ADR-015-axi-inbox-rust-migration.md) — Rust migration plan, Proposed
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-inbox/docs/VERIFICATION.md)
- [`pyproject.toml`](/Volumes/code/workspace/foundation/axi-inbox/pyproject.toml) — name, version, requires-python

## Cross-References

Inbox is a consumer of `foundation/axi-kernel` (mandatory `PYTHONPATH=../axi-kernel`, no mock — see AC-5 / FR-8) and is consumed by downstream Personal-OS tools. Per `PRD.md §8` and `workspace.json`:

- **`foundation/axi-kernel`** — provides `ResourceObject` / `DocumentObject` / `ChangeObject` + `Registry.register_resource` / `register_change` / `update` / `register_many`. Inbox writes only `Resource` / `Document` / `Change` (Kernel N3 boundary). Bridge via `axi_inbox/kernel_bridge.py` (resolves `AXI_KERNEL_PATH`).
- **`foundation/axi-sync`** — Phase 4 Change Sync replays the `Change` rows the inbox emits on every state transition and every transform. `InboxStatusChange` events carry `subject_id = resource_id` so Sync can reconstruct the lifecycle history.
- **`foundation/axi-apps`** — `axi-apps share` reads `Resource(kind="shareable")` rows; `axi-apps aggregate` aggregates `Resource` rows by kind. Inbox's `--to shareable` transform target is the writer for the shareable feed.
- **`foundation/axi-runtime`** — could trigger rules off `Resource` inbox_status transitions; PRD §7.5 mentions linking `transform --to task` rows into a future Phase-6 task planner.
- **`foundation/axi-workspace-rs`** — Phase-1 Rust scaffold was removed from this repo (commit `c2ff035`) and migrated to `foundation/axi-workspace-rs/crates/axi-inbox-rs/` per ADR-015 (Proposed).

## Notes

- Python CLI is a thin layer over `foundation/axi-kernel` (mandatory `PYTHONPATH=../axi-kernel`); 26 tests pass.
- 6-state inbox machine (`collected → unread → reviewed → linked → transformed → archived`) delegated to Kernel's `ResourceStatus` enum; `InvalidTransitionError` not yet enforced (PRD AC-3).
- Working tree on `dev`: 12 ahead of `origin/dev`; Phase-1 Rust scaffold removed in `c2ff035`, lives at `foundation/axi-workspace-rs/crates/axi-inbox-rs`.
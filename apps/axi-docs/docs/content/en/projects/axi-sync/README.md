---
id: axi-docs-en-projects-axi-sync
title: Axi Change Sync
type: project
status: published
tags: [Axi Docs, Projects, foundation, core, change-sync]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Change Sync
graph-tags: [Projects, foundation, change-sync]
description: AXI Personal OS Change Sync CLI (PRD-04, Phase 2/3) — collects change rows from Kernel + git log, rates each L0-L3 via keyword heuristics + 0-100 impact score, maintains a 7-state side-store queue (detected → queued → analyzing → need-review → accepted / ignored / failed), and renders daily markdown + JSON reports. Includes fs-watcher, change split/merge ops, and L3-to-ADR auto-linker.
project:
  id: axi-sync
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-sync
  source-section: core
---

# Axi Change Sync

> Mirror of the project root `README.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-sync/README.md`](/Volumes/code/workspace/foundation/axi-sync/README.md).
> Section: core / Partition: `foundation/`.

## Summary

Axi Change Sync is the canonical **cross-repository change aggregator** for the AXI Personal OS. It pulls two data sources — every `Kernel.ChangeObject` row (`axi_sync.collector.collect`) and the `git log` of any registered repository (`axi_sync.collector.collect_git`, which writes synthetic `Change` rows plus `Commit` / `RawEvent` rows) — then rates each change on a four-band **L0–L3** ladder via keyword heuristics in `axi_sync/inferrer.py`. The score formula (Vision PRD §9.4) maps L0→10, L1→35, L2→65, L3→92 and applies subject-kind modifiers (`+8` for core atoms Project/Rule/Skill/Agent, `-5` for derived rows Change/RawEvent, `+5` for cross-project Repository/Commit/Branch), clamping the result to `[0, 100]`. Rated changes land in a side-store queue (`data/sync.json`) governed by a **7-state machine** (`detected → queued → analyzing → need-review → accepted / ignored / failed`) with `failed → queued` and `failed → analyzing` as the only backward transitions; terminal states `accepted` and `ignored` have empty forward transition sets.

The queue is the source of truth for daily reports: `report --format md` renders a markdown digest with L0/L1/L2/L3 counts, by-source counts, by-state counts, and a "L3 (need-review) items" list. The CLI also exposes `git-collect`, `fs-scan`, `fs-watch` (watchdog Observer, dependency declared in `pyproject.toml`), `change split`, `change merge`, `aggregate`, `adr-link`, and `sync` (the cursor-driven collector). `adr-link` is an L3 → Architecture Decision Record auto-linker: it picks every L3 / `need-review` queue item, renders an ADR file with YAML frontmatter (`change_id` / `subject_id` / `source` / `level`), and writes it under an operator-supplied target directory using `next_adr_number()` to pick a sequential `ADR-NNN-<slug>.md` filename; idempotent via frontmatter `change_id` lookup. The CLI is owned by `libu`, registered as `tier=axi-core-product`, `domain=change-sync`, `lifecycle=active-promoted-incubation`; current branch `dev` is 5 commits ahead of `origin/dev`. The most recent commits land a Phase-1 Rust migration scaffold under `src-rs/axi-sync-rs/` (ADR-014 Proposed, 2026-09-29) with `notify` v6 / `rusqlite` 0.31 / `clap` 4 deps; the Python package remains the production writer path until ADR-011 (`axi-kernel-rs`) lands.

The v1.1 PRD (2026-09-27, 13.3 KB) splits the system into L0 (collection — `scanner.py` + `collector.py` + `fs_watcher.py`) → L1 (scoring — `inferrer.py`) → L2 (queue state machine — `queue.py`) → L3 (reports — `report.py`), with strict one-way dependencies and 67 quantitative anchors. The CLI has 14 subcommands (`sync`, `git-collect`, `fs-scan`, `fs-watch`, `change {split,merge}`, `aggregate`, `list`, `accept`, `ignore`, `report`, `adr-link`); the registry reset on each CLI invocation via `kernel_bridge.py` (same `_resolve_kernel_path` pattern as inbox).

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Python package | Python 3.11+, stdlib + `watchdog>=6.0` (declared in `pyproject.toml`) | One external dep |
| Collection (L0) | `axi_sync/collector.py::collect` (Kernel `ChangeObject` reader) + `collect_git` (subprocess-based `git log` + `git show --name-only`, idempotent `Repository`/`Commit`/`RawEvent` registration) | Two data sources |
| FS watcher (L0) | `axi_sync/fs_watcher.py::scan_once` + `watch_live` (uses `watchdog.events.FileSystemEventHandler` + `watchdog.observers.Observer`) | Idempotent re-scan via `(path, mtime, size)`-derived ids |
| Scoring (L1) | `axi_sync/inferrer.py::rate` / `rate_many` / `score`; `RatedChange` dataclass carries `change_id` / `subject_id` / `summary` / `level` / `source` / `created_at` / `impact_score` (0–100) | Regex-based L3/L2 keyword detection; subject-kind modifiers |
| Queue state machine (L2) | `axi_sync/queue.py::Queue.load` / `save` / `ingest` / `set_state` / `filter`; `QueuedChange` dataclass with `state` ∈ `VALID_STATES` (7 values) | Append-only history; `data/sync.json` + `data/events.jsonl` |
| Event store | `axi_sync/event_store.py::EventStore` — append-only JSONL + cursor file | `dedupe_key` prevents re-appending |
| Aggregator | `axi_sync/aggregator.py::aggregate` — `ChangeCandidate` keyed by `(source_id, commit_type, commit_scope, top-level paths)` | Conventional-commit aware (`feat` / `fix` / `refactor`) |
| ADR linker (L3) | `axi_sync/adr_linker.py::link_l3_to_adrs` / `render_adr` / `slugify` / `next_adr_number` / `discover_l3` / `iter_l3_summary` | Idempotent via frontmatter `change_id`; sequential numbering |
| Change ops | `axi_sync/change_ops.py::split_change` + `merge_changes` — write child / merged `ChangeObject` rows with `Relation(DERIVED_FROM, parent)` | Never deletes; original rows preserved |
| Report (L3) | `axi_sync/report.py::render_markdown` + `render_summary_dict` | Markdown by level / source / state + L3 list |
| Repository adapter | `axi_sync/repository_adapter.py::GitRepositoryAdapter.collect` — pure-reader (no Kernel writes); `GitCommit` dataclass with `evidence` property | Used as a transport adapter, separate from `collector.collect_git` |
| Kernel bridge | `axi_sync/kernel_bridge.py` — `_resolve_kernel_path` + `open_shared_registry`; same pattern as `axi-inbox` | `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")` |
| CLI | `argparse` (`__main__.py::build_parser`) — 14 subcommands | `sync --since ISO`, `git-collect`, `fs-scan`, `fs-watch`, `change {split,merge}`, `aggregate`, `list`, `accept`, `ignore`, `report`, `adr-link` |
| Build/test config | `pyproject.toml` (name=`axi-sync`, version=`0.1.0`, requires-python=`>=3.11`, `dependencies=["watchdog>=6.0"]`) | `[tool.pytest.ini_options] testpaths = ["tests"]` |
| Workspace governance | `foundation/workspace-governance` consumer; ADR-014 (Rust migration, Proposed); Phase 1 scaffold at `src-rs/axi-sync-rs/` | `notify` 6 + `rusqlite` 0.31 + `clap` 4 deps |

## Project Layout

```text
axi-sync/
├── AGENTS.md                  # Read order, PYTHONPATH requirement
├── README.md / README.zh-CN.md
├── PRD.md                     # v1.1 template, 14 sections, FR-1..FR-8
├── CHANGELOG.md               # Canonical audit trail (7 entries)
├── MILESTONE.md               # M1-M3 generated 2026-09-25
├── TODO.md                    # TODO-T-001 (workspace-graph ↔ workspace.json reconcile); TODO-T-002 (VERIFICATION.md)
├── pyproject.toml             # name=axi-sync, version=0.1.0, watchdog>=6.0
├── axi_sync/                  # Python package source
│   ├── __init__.py            # Public surface + version="0.1.0-incubation"
│   ├── __main__.py            # CLI entry + 14 subcommand parsers
│   ├── collector.py           # L0 collect + collect_git (subprocess)
│   ├── fs_watcher.py          # L0 fs_scan + fs_watch (watchdog)
│   ├── inferrer.py            # L1 rate / rate_many / score + RatedChange
│   ├── queue.py               # L2 Queue + QueuedChange + 7-state machine
│   ├── report.py              # L3 render_markdown + render_summary_dict
│   ├── aggregator.py          # ChangeCandidate (conventional-commit aware)
│   ├── change_ops.py          # split_change + merge_changes
│   ├── event_store.py         # Append-only JSONL + cursor
│   ├── repository_adapter.py  # Pure-reader Git adapter (GitCommit)
│   ├── adr_linker.py          # L3 → ADR auto-linker (slugify, next_adr_number, render_adr, write_adr, link_l3_to_adrs)
│   └── kernel_bridge.py       # _resolve_kernel_path + open_shared_registry
├── tests/
│   ├── __init__.py
│   ├── test_sync.py           # Main regression suite
│   ├── test_adr_linker.py     # 19 ADR linker tests
│   ├── test_fs_change_ops.py  # 9 fs-scan + change-ops tests
│   └── test_fs_watcher.py     # FS watcher integration tests
├── data/
│   ├── sync.json              # Side-store queue (7 KB sample)
│   ├── events.jsonl           # Append-only event store (105 KB)
│   └── events.jsonl.cursor.json
├── evidence/
│   ├── run_evidence.sh        # Reproducible CLI snapshot script
│   └── 30+ timestamped logs (collect-*.log, report-*.log, accept-ignore-*.log, git-collect.log, adr-link-*.log, fs-scan-*.log, impact-score-*.log, adr_linker.py)
├── docs/
│   ├── HANDOFF.md             # Zero-context takeover brief, readiness=`unready`
│   ├── VERIFICATION.md
│   ├── adr/ADR-014-axi-sync-rust-migration.md   # Proposed
│   ├── project-docs.manifest.json
│   ├── logs/                  # audit-remediation submit logs
│   └── workflows/             # SY-DETECT/REVIEW/CHANGE 7-field docs
├── src-rs/
│   └── axi-sync-rs/           # Phase-1 Rust scaffold (notify 6, rusqlite 0.31, clap 4)
│       ├── Cargo.toml
│       ├── README.md
│       ├── .gitignore
│       └── src/               # watcher.rs, change_queue.rs, kernel_writer.rs, bin/axi-sync.rs
└── .githooks/                 # post-commit surface-failures
```

## Build & Install

```bash
# Python — pure-stdlib + watchdog
cd /Volumes/code/workspace/foundation/axi-sync
export PYTHONPATH=../axi-kernel
pip install watchdog>=6.0  # only external dep

# Tests
python3 -m unittest discover -s tests -v

# CLI smoke
PYTHONPATH=../axi-kernel python3 -m axi_sync --help

# Re-run evidence
bash evidence/run_evidence.sh

# Rust scaffold (Phase 1, gated on ADR-011)
cd src-rs/axi-sync-rs && cargo check
```

`pyproject.toml` declares `dependencies = ["watchdog>=6.0"]`. The Kernel bridge (`kernel_bridge.py`) is a 13-line module that resolves `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")` and honors `AXI_KERNEL_PATH`. Without Kernel on `sys.path` the import-time `FileNotFoundError` triggers before any subcommand runs.

## Verification

Per `AGENTS.md §Verification` and `PRD.md §11`:

```bash
# Unit tests (≥ 67 cases — 19 adr_linker + 9 fs_change_ops + main test_sync + fs_watcher)
PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests -v

# End-to-end smoke (FR-8 / AC-8)
PYTHONPATH=../axi-kernel python3 -m axi_sync --help
PYTHONPATH=../axi-kernel python3 -m axi_sync scan
PYTHONPATH=../axi-kernel python3 -m axi_sync list --state need-review

# Keyword-dictionary version consistency (AC-2)
test "$(jq -r '.version' data/keywords.json)" = "$(jq -r '.expected_version' docs/scoring-rules.md)"

# Workspace-level
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/foundation/axi-rules/scripts/handoff-workflow.py
```

## Architecture Highlights

L0 collection has three entry points. `collector.collect(registry, since_iso)` walks every `Kernel.ChangeObject` (filtered by `created_at > since_iso`), passes them through `rate_many()` to produce `RatedChange` rows, and returns them. `collector.collect_git(registry, repo_location, ...)` shells out to `git log --pretty=format:%H|%an|%aI|%s` and `git show --name-only --pretty=`, registers a `Repository` row (idempotent on location), then for each new commit (sha not in `existing_commit_ids`) registers a `Commit` row + a `RawEvent(source="git")` row + a synthetic `Change` row keyed `subject_id=_runtime:git:<sha12>`. The `_runtime:` prefix bypasses the Kernel's subject-existence check so the Change row is written even when no real `subject_id` exists. `event_store.append()` then writes a `RawEvent` JSONL row with `dedupe_key="git:<repo_id>:<sha>"`, and `advance_cursor()` updates the per-source cursor file. `fs_watcher.scan_once()` walks a directory and emits one `RawEvent(source="fs")` + one `Change` per file; `watch_live()` starts a `watchdog.observers.Observer` for real-time emission. The watcher deliberately skips `.json` / `.lock` / `.tmp` sidecars so a Kernel store living inside the watch root does not feed itself.

L1 scoring (`inferrer.py`) is a pure function — no I/O. `rate(change)` reads `summary` + `subject_id` + `created_at` from a Kernel `ChangeObject`, classifies the source via `_classify_source()` (provenance `source.source_id` wins, else subject-id prefix maps `project/document → workbench`, `resource → inbox`, `change → change`, `kernel → kernel`), detects the level via regex: `_L3_KEYWORDS = ("migration", "schema_version", "migrate", "v1->v2", "v2->v3", "v3->v4")` → L3; `_L2_KEYWORDS = ("transformed", "linked", "archived", "stale", "deleted", "corrected", "renamed", "deactivated")` → L2; subject_kind `document`/`resource` → L1; else → L0. `score(level, subject_kind)` maps the band to a base 0–100 (L0=10, L1=35, L2=65, L3=92), applies subject modifiers (`_HIGH_WEIGHT_SUBJECTS = {project, rule, skill, agent}` → +8; `_LOW_WEIGHT_SUBJECTS = {change, rawevent}` → -5; `repository`/`commit`/`branch` → +5), clamps to `[0, 100]`. The result lands on `RatedChange.impact_score` so `rate()` returns the score inline (no second call).

L2 state machine (`queue.py`) is a `Queue` dataclass with `path: Path`, `items: list[QueuedChange]`, `cursor: str | None`. `VALID_STATES` is the 7-tuple `("detected", "queued", "analyzing", "need-review", "accepted", "ignored", "failed")`. `_TRANSITIONS` is the transition table:

```text
detected   → {queued, failed}
queued     → {analyzing, accepted, ignored, failed}
analyzing  → {need-review, accepted, ignored, failed}
need-review→ {accepted, ignored, failed}
accepted   → {}  (terminal)
ignored    → {}  (terminal)
failed     → {queued, analyzing}  (retry loop)
```

`set_state()` raises `ValueError` on illegal transitions with the message `"invalid transition 'X' -> 'Y'"`. `ingest()` dedupes by `change_id`; for new rows it sets the initial state to `need-review` if `level == "L3"`, else `queued`. Cursor is the max `created_at` seen so `sync --since <iso>` picks up only the delta.

L3 reporting (`report.py`) renders a markdown digest with by-level / by-source / by-state histograms plus an "L3 (need-review) items" list. `render_summary_dict` returns the same shape as JSON for `report --format json`. The L3 → ADR auto-linker (`adr_linker.py`) reads the live queue, picks every L3 / `need-review` item that is not already linked (idempotence check via frontmatter `change_id`), renders an ADR with YAML frontmatter (`change_id` / `subject_id` / `source` / `level`), and writes it under the operator-supplied target directory. `slugify(summary)` produces a filesystem-safe slug (lowercase ASCII, hyphen-separated, max 60 chars; falls back to `"adr"` for empty slugs). `next_adr_number(target_dir)` scans the directory for `ADR-NNN-*` files and returns `max + 1` (or `1` if missing/empty) so multiple L3 items in one run get `ADR-001`, `ADR-002`, etc. The CLI exposes `adr-link --target DIR [--dry-run]`; L3 items in terminal states (`accepted` / `ignored` / `failed`) surface in the result rows as `skipped-terminal-state` (visible to the operator) but produce no new ADR file. The 19-case `test_adr_linker.py` covers slugify, next number, render, write, discover, and the full link driver including idempotent re-runs.

The change-ops helpers (`change_ops.py`) preserve the original `Change` rows (the kernel contract "we never delete" comes from `kernel_to_workspace`). `split_change(registry, change_id, into_prefix=None)` produces N child `ChangeObject` rows with `Relation(DERIVED_FROM, target_id=parent)`; split rule is one child per non-empty summary line. `merge_changes(registry, ids, into_summary=None)` folds N rows into one merged `Change` whose children point back at it via `DERIVED_FROM`. Both register the new rows via `Registry.register_many(...)` so multi-row writes are atomic.

## Key Modules/Files

| Module / File | Responsibility | Path |
| --- | --- | --- |
| `collect` | L0 — reads every `Kernel.ChangeObject`, filtered by `since_iso`; passes through `rate_many` | `axi_sync/collector.py` |
| `collect_git` | L0 — subprocess `git log` + `git show`; registers `Repository` / `Commit` / `RawEvent` / synthetic `Change`; appends to `EventStore` | `axi_sync/collector.py` |
| `_GIT_PRETTY_FORMAT = "%H|%an|%aI|%s"` | ASCII-only git log format to avoid locale issues | `axi_sync/collector.py` |
| `scan_once` / `watch_live` | L0 — one-shot dir scan + watchdog `Observer` live watcher; skips `.json` / `.lock` / `.tmp` sidecars | `axi_sync/fs_watcher.py` |
| `rate` / `rate_many` / `score` / `RatedChange` | L1 — L0–L3 level detection + 0–100 impact score with subject-kind modifiers | `axi_sync/inferrer.py` |
| `_L3_KEYWORDS` / `_L2_KEYWORDS` / `_HIGH_WEIGHT_SUBJECTS` / `_LOW_WEIGHT_SUBJECTS` | Keyword lists + subject modifier sets | `axi_sync/inferrer.py` |
| `Queue` / `QueuedChange` / `_TRANSITIONS` / `VALID_STATES` | L2 — 7-state machine; `set_state` raises `ValueError` on illegal transition | `axi_sync/queue.py` |
| `default_queue_path` | `<base>/data/sync.json` (side-store, never Kernel) | `axi_sync/queue.py` |
| `render_markdown` / `render_summary_dict` | L3 — markdown digest + JSON summary; by-level / by-source / by-state histograms + L3 list | `axi_sync/report.py` |
| `EventStore` / `RawEvent` / `make_id` | Append-only JSONL store with `dedupe_key` + per-source cursor file | `axi_sync/event_store.py` |
| `aggregate` / `ChangeCandidate` | Conventional-commit aware candidate builder | `axi_sync/aggregator.py` |
| `split_change` / `merge_changes` | Manual ops — produce child / merged `ChangeObject` rows with `Relation(DERIVED_FROM, parent)` | `axi_sync/change_ops.py` |
| `GitRepositoryAdapter` / `GitCommit` / `infer_change_type` | Pure-reader git adapter (no Kernel writes); infers `change_type` from conventional-commit prefix | `axi_sync/repository_adapter.py` |
| `link_l3_to_adrs` / `render_adr` / `slugify` / `next_adr_number` / `write_adr` / `discover_l3` / `iter_l3_summary` | L3 → ADR auto-linker; sequential numbering; idempotent via frontmatter `change_id` | `axi_sync/adr_linker.py` |
| CLI `build_parser` + 14 subcommands | `sync`, `git-collect`, `fs-scan`, `fs-watch`, `change {split,merge}`, `aggregate`, `list`, `accept`, `ignore`, `report`, `adr-link` | `axi_sync/__main__.py` |
| `_resolve_kernel_path` / `open_shared_registry` | `AXI_KERNEL_PATH` env + default path resolution; injects into `sys.path` at import | `axi_sync/kernel_bridge.py` |
| `AXI-TODO` `LegacyChange` / `_runtime:` subject-id prefix | Sentinel subject ids for synthetic Changes (skip existence check) | `axi_sync/collector.py` |
| ADR-014 (Proposed) | Rust migration plan — `notify` 6 + `rusqlite` 0.31 + `clap` 4; 3-phase migration gated on ADR-011 (`axi-kernel-rs`) | `docs/adr/ADR-014-axi-sync-rust-migration.md` |
| Rust scaffold | Phase 1 — `src-rs/axi-sync-rs/` with `watcher.rs` / `change_queue.rs` / `kernel_writer.rs` / `bin/axi-sync.rs` (clap 4 `watch / stats / replay`) | `src-rs/axi-sync-rs/` |
| Test suite | 67 cases — `test_sync.py` (InferrerTests, queue state machine, score, etc.) + `test_adr_linker.py` (19) + `test_fs_change_ops.py` (9) + `test_fs_watcher.py` | `tests/` |
| `evidence/run_evidence.sh` | Reproducible CLI snapshot script; emits 30+ timestamped logs | `evidence/` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Phase 2/3 v1 | `scan` + `git-collect` + L0–L3 scoring + 7-state queue + daily report | Done (promoted 2026-09-23) |
| Step 7.A1+A2 | `fs-scan` + `fs-watch` (watchdog) + `change split` + `change merge` | Done (2026-09-23, 9 fs_change_ops tests) |
| Step 7.A6 | L3 → ADR auto-linker (`adr_linker.py`) | Done (2026-09-23, 19 adr_linker tests) |
| Vision PRD §9.4 | 0–100 impact score (Vision PRD bands) with subject-kind modifiers | Done (2026-09-24, 5 new InferrerTests) |
| v1.1 PRD template upgrade | Layered FR with quantitative anchors + FR-8 end-to-end smoke | Done (2026-09-27) |
| ADR-014 Rust migration | Phase 1 scaffold landed at `src-rs/axi-sync-rs/`; Phase 3 (kernel writer) gated on ADR-011 (`axi-kernel-rs`) | Proposed (2026-09-29) |
| M1 handoff-check | `documented` / `verified` state | Pending (current `docs/HANDOFF.md` reports `unready`) |
| M2 PRD content化 | Stub → real PRD | Done (PRD v1.1, 13.3 KB) |
| M3 next-lifecycle | `stage=shared` → next phase per `project-maturity-v1` decision record | Pending |
| Open ADRs | 4 sync ADRs (`keyword heuristic`, `side-store not Kernel`, `no realtime`, `L0-L3 dict public`) | All `(待发)` |
| `data/keywords.json` published dictionary | Required for AC-2 version check (`jq -r '.version' == docs/scoring-rules.md expected_version`) | Not yet present in `data/` |

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-sync/AGENTS.md) — read order, PYTHONPATH requirement, verification
- [`README.md`](/Volumes/code/workspace/foundation/axi-sync/README.md) — purpose, quick start, layout
- [`README.zh-CN.md`](/Volumes/code/workspace/foundation/axi-sync/README.zh-CN.md)
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-sync/PRD.md) — v1.1 template, 14 sections, FR-1..FR-8
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-sync/CHANGELOG.md) — canonical audit trail (7 entries)
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-sync/MILESTONE.md) — M1-M3 generated 2026-09-25
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-sync/TODO.md) — TODO-T-001/002
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-sync/docs/HANDOFF.md) — zero-context takeover brief, readiness=`unready`
- [`docs/adr/ADR-014-axi-sync-rust-migration.md`](/Volumes/code/workspace/foundation/axi-sync/docs/adr/ADR-014-axi-sync-rust-migration.md) — Rust migration plan, Proposed
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-sync/docs/VERIFICATION.md)
- [`pyproject.toml`](/Volumes/code/workspace/foundation/axi-sync/pyproject.toml) — name, version, watchdog dep

## Cross-References

Sync is the primary **read-side consumer** of `foundation/axi-kernel` (mandatory `PYTHONPATH=../axi-kernel`, no mock — see AC-6 / FR-6) and the primary writer of the side-store queue (`data/sync.json`). Per `PRD.md §8` and `workspace.json`:

- **`foundation/axi-kernel`** — Sync reads `Kernel.ChangeObject` / `Commit` / `RawEvent` / `Repository` via `Registry.list_by_type` / `get`. Sync writes synthetic `Change` rows (`subject_id = _runtime:git:<sha12>`) via `Registry.register_change`; `collect_git` registers `Repository` / `Commit` / `RawEvent` via the public Registry API. The `axi-kernel.sync.status_diff` / `coverage` interface is also useful for Sync's drift detection.
- **`foundation/axi-inbox`** — every inbox state transition emits a `Change` row that Sync replays. The `subject_id = resource-<id>` link lets Sync attribute inbox-side events to the inbox source (`_classify_source` returns `inbox` for `resource-` subject-id prefix).
- **`foundation/axi-workbench-cli`** — emits `Change` rows for project confirmations; Sync's `source = workbench` mapping catches these via the `project-` subject-id prefix.
- **`foundation/axi-runtime`** — consumes L0–L3 scores via the queue's `_COVERAGE` projection. The PRD §7.5 mentions aligning `need-review` queue items with rule triggers so the runtime can dispatch on critical changes.
- **`foundation/axi-apps`** — `axi-apps aggregate` reads the queue (and the JSONL event store) for cross-app aggregation views.
- **`foundation/workspace-governance`** — ADR linker writes into `foundation/workspace-governance/docs/adr/` (or any operator-supplied `--target` dir) following the `ADR-NNN-<slug>.md` convention.
- **`foundation/axi-workspace-rs`** — Phase-1 Rust scaffold under `src-rs/axi-sync-rs/` with `notify` 6 / `rusqlite` 0.31 / `clap` 4; Python remains production writer path until ADR-011 (`axi-kernel-rs`) lands.

## Notes

- Python CLI uses stdlib + `watchdog>=6.0`; 67 tests passing; ADR-014 (Rust migration) is Proposed.
- 7-state machine (`detected → queued → analyzing → need-review → accepted / ignored / failed`) lives in side-store `data/sync.json`; Kernel never owns queue state.
- Working tree on `dev`: 5 ahead of `origin/dev`; Phase-1 Rust scaffold lives at `src-rs/axi-sync-rs/`; `data/keywords.json` not yet published (AC-2 dependency).
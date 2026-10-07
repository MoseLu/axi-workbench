---
id: axi-docs-en-projects-axi-kernel
title: Axi Kernel
type: project
status: published
tags: [Axi Docs, Projects, foundation, core, object-registry]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Kernel
graph-tags: [Projects, foundation, object-registry]
description: Canonical Python implementation of the AXI Personal OS Kernel (PRD-01) — JSON-on-disk object registry with 9 frozen-dataclass object types, atomic-write + cross-process lock store, append-only migration records, and a Python CLI named axi-kernel.
project:
  id: axi-kernel
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-kernel
  source-section: core
---

# Axi Kernel

> Mirror of the project root `README.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-kernel/README.md`](/Volumes/code/workspace/foundation/axi-kernel/README.md).
> Section: core / Partition: `foundation/`.

## Summary

Axi Kernel is the canonical **JSON-on-disk object registry** for the AXI Personal OS and the schema authority for every downstream AXI tool. It is a Phase 0 / Phase 2 implementation of PRD-01, written in zero-dependency Python 3.11+ (only the standard library), and exposes the CLI `python3 -m axi_kernel`. The repository currently carries `SCHEMA_VERSION = 7`; the on-disk store lives at `data/registry.json`, guarded by an `fcntl.flock`-based sidecar lock, with append-only migration records under `data/migrations/`. The schema is defined as `@dataclass(frozen=True)` Python types in `axi_kernel/schema.py`, with a factory table (`_OBJECT_FACTORIES`) keyed on `ObjectType` so new types are open-closed additions.

The kernel is the single shared write surface for 9 atomic object types (`Project`, `Document`, `Change`, `Resource`, `Repository`, `Branch`, `GitRemote`, `Commit`, `RawEvent`, `Rule`, `Skill`, `Agent`, `Invocation`, `Task`, `Artifact` — 15 total across v1→v7). Phase 5 added three operational affordances (`rebuild_registry`, `get_relations`, `sync.status_diff`) and Phase 6 added a one-way `register_invocation → register_change` chain so downstream Change Sync can replay governance-runtime calls without polling. The Repository Registry (v4) and Rule/Skill/Agent/Invocation (v6) additions came from PRD-05; Task + Artifact (v7) closes the AXI atomic set so the Workbench dashboard can manage every atom through the canonical API. A Kernel ↔ axi-todo bridge (`axi_kernel/bridge/axi_todo.py`) round-trips `TaskObject` rows with the operator's `~/.axi-todo/tasks.json` ledger using atomic `tasks.json.tmp → os.replace` writes and `legacyIds.kernelTaskId` anchoring.

The kernel is invoked by the `foundation/axi-workspace-cli`, `axi-inbox`, `axi-sync`, `axi-runtime`, and `axi-apps` projects — `workspace.json` records it as `tier=axi-core-product`, `domain=object-registry`, `provides=[object-registry, schema-migrations, change-stream-source]`. CHANGELOG records 122 passing tests, a Phase 5 sync surface, and a v1.1 PRD template upgrade (2026-09-27). The v1.1 PRD splits the system into L0 (storage) → L1 (schema) → L2 (registry ops) → L3 (CLI/public API) and ties every FR to a quantitative anchor. The repository is owned by `libu`; branch `dev` is 4 commits ahead of `origin/dev`, and the only remaining owner items are the 5 "(待发)" ADRs in `PRD.md §9`.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Python package | Python 3.11+, stdlib only (`dataclasses`, `enum`, `json`, `fcntl`, `tempfile`, `threading`, `hashlib`, `subprocess`) | Zero third-party deps; internal-only, not on PyPI |
| Object schema | `@dataclass(frozen=True)` + `enum.StrEnum` | 15 object types + enums (`Status`, `ProjectStage`, `DocumentKind`, `ChangeType`, `ChangeState`, `RelationKind`, `ResourceStatus`, `TaskStatus`, `TaskPriority`, `ArtifactKind`); factory `object_from_dict` dispatched by `ObjectType` |
| ID generator | `axi_kernel/ids.py` — SHA-1 of `(type, owner, location_or_uri)` truncated to 16 hex chars | Format `<type-prefix>-<owner>-<hash16>`; rename-safe |
| Storage | `axi_kernel/store.py::JsonStore` — atomic `tempfile.mkstemp` + `os.replace` + `fcntl.flock` + `threading.Lock` | Sidecar `.lock` file; corrupt file raises `StoreLockError` |
| CLI | `argparse` (`__main__.py::build_parser`) — `register`, `get`, `list`, `query`, `summary`, `relations`, `deactivate`, `check`, `show-schema`, `sync`, `rebuild`, `get-relations`, `documents-for-project` | 14 top-level subcommands + sync subparser |
| Sync bridge | `axi_kernel/sync.py` — `kernel_to_workspace`, `workspace_to_kernel`, `status`, `status_diff`, `coverage` | 5 `_COVERAGE` buckets: `projects` / `agent` / `registry` / `internal` |
| Kernel ↔ axi-todo bridge | `axi_kernel/bridge/axi_todo.py` — `KernelTask` dataclass + `sync_kernel_to_axi_todo` / `sync_axi_todo_to_kernel` / `sync_bidirectional` | Direct `tasks.json` read/write with atomic rename |
| Tests | `unittest` (stdlib) — `tests/test_registry.py`, `tests/test_sync.py`, `tests/test_rebuild.py`, `tests/test_axi_todo_bridge.py` | 122 cases (Phase 5 + 23 bridge cases) |
| Build/test config | `pyproject.toml` (name=`axi-kernel`, version=`0.2.0`, requires-python=`>=3.11`) | `[tool.pytest.ini_options] testpaths = ["tests"]` |
| Workspace governance | `foundation/workspace-governance` consumer; `workspace.json` registration; `workspace-audit.mjs` 0 errors | ADR-011 (rust migration) accepted; `src-rs/` placeholder exists but is empty (`a67055a` removed scaffold) |

## Project Layout

```text
axi-kernel/
├── AGENTS.md                 # Read order, verification commands
├── README.md / README.zh-CN.md
├── PRD.md                    # v1.1 template (2026-09-27), 14 sections
├── CHANGELOG.md              # Canonical audit trail; every code change appends
├── CHANGE.md                 # Promotion-day record (2026-09-21)
├── MILESTONE.md              # M1-M3 generated by audit-remediation 2026-09-25
├── TODO.md                   # TODO-T-001 (kernel ↔ axi-agent bridge); TODO-T-002
├── pyproject.toml            # name=axi-kernel, version=0.2.0
├── axi_kernel/               # Python package source
│   ├── __init__.py           # Public re-exports + version="0.3.0"
│   ├── __main__.py           # CLI entry + 14 subcommand parsers
│   ├── schema.py             # 15 dataclasses + SCHEMA_VERSION=7 + enums
│   ├── ids.py                # SHA-1 → AXI-<TYPE>-<owner>-<hash16>
│   ├── store.py              # JsonStore: atomic write + fcntl flock
│   ├── registry.py           # Registry class + register_*/query/summary/check/migrate
│   ├── sync.py               # Workspace ↔ Kernel 5-direction sync
│   └── bridge/
│       └── __init__.py       # 484-line axi-todo ↔ Kernel Task bridge
├── data/
│   ├── registry.json         # Runtime store (regenerated)
│   ├── registry.json.lock    # fcntl sidecar
│   └── migrations/           # Append-only (currently empty; written on schema bump)
├── tests/
│   ├── test_registry.py      # 122-case regression suite
│   ├── test_sync.py          # 7 sync tests
│   ├── test_rebuild.py       # 10 rebuild tests
│   └── test_axi_todo_bridge.py # 23 bridge tests
├── scripts/
│   ├── promote_incubation.py # Promotion tool
│   └── metadata/             # axi-{apps,inbox,runtime,sync}.json
├── docs/
│   ├── HANDOFF.md            # Zero-context takeover brief
│   ├── SCHEMA_RELEASES.md    # v3/v4/v5/v6/v7 release notes
│   ├── VERIFICATION.md
│   ├── adr/                  # ADR-011 (Rust migration, Accepted)
│   ├── workflows/            # WK-REGISTER/SYNC/CHECK 7-field docs
│   ├── logs/                 # Audit-remediation submit logs
│   └── project-docs.manifest.json
├── evidence/                 # CLI snapshots mapped to PRD-01 AC
├── src-rs/                   # Empty (scaffold migrated to foundation/axi-workspace-rs)
└── .githooks/                # post-commit surface-failures
```

## Build & Install

```bash
# No install step — pure-Python stdlib package. Use directly from checkout.
cd /Volumes/code/workspace/foundation/axi-kernel
python3 -m axi_kernel --help
```

`pyproject.toml` declares `requires-python = ">=3.11"` and no `dependencies` array; `internal-only: this package is owned by the Axi workspace and is not published to a public index`. A future Rust re-implementation lives at `foundation/axi-workspace-rs/crates/axi-kernel-rs` per ADR-011 (Accepted 2026-09-29, commit `79b0285`).

## Verification

Per `AGENTS.md §Verification` and `PRD.md §11`:

```bash
# Kernel test suite (122 cases; Phase 5 + bridge)
python3 -m unittest discover -s tests -v

# CLI smoke
python3 -m axi_kernel --help
python3 -m axi_kernel check
python3 -m axi_kernel migrate --dry-run --verify

# Workspace governance — promotion is held by these three commands
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project whereami /Volumes/code/workspace/foundation/axi-kernel
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
```

## Architecture Highlights

The kernel is deliberately layered L3 → L2 → L1 → L0 with single-direction dependencies (`PRD.md §2.1`). L3 is `__init__.py` (re-export) + `__main__.py` (CLI parser + 14 subcommand handlers); it never touches L0 paths directly. L2 is the `Registry` class in `registry.py`, a thin orchestration layer over the store that exposes `register_*`, `get`, `list_by_type`, `query`, `summary`, `relations_of`, `check`, `migrate`, `rebuild_registry`, and `get_relations`. L2 wraps every mutation in a `store.mutate(...)` call so multi-step registry operations cannot be split across two writers. L1 is the pure-data `schema.py`: frozen dataclasses inheriting from `BaseObject`, plus enums (`ObjectType`, `RelationKind`, `Status`, `ProjectStage`, `DocumentKind`, `ChangeType`, `ChangeState`, `ResourceStatus`, `TaskStatus`, `TaskPriority`, `ArtifactKind`) and the `_OBJECT_FACTORIES` dispatch table. L0 is `JsonStore` — `tempfile.mkstemp` + `os.replace` for atomic write, `fcntl.flock` on a `registry.json.lock` sidecar for cross-process mutual exclusion, `threading.Lock` for in-process RMW. Schema versioning is enforced by `SCHEMA_VERSION` (`7`); `Registry.migrate(from_v, to_v, mutator)` writes an append-only record under `data/migrations/` with filename `NNNN__NNNN__NNNN.json` so re-ordering is impossible to do silently.

The schema covers 15 object types across 7 versions. Phase 1/v1 introduced `Project`, `Document`, `Change`, `Relation`, `Source`. v3 added `Resource` so `axi-inbox` had a place to land collected URIs (`ResourceObject.inbox_status` carries the inbox lifecycle separately from `BaseObject.status`). v4 closed PRD-01 §4's "Repository Registry" deferred scope with `Repository`, `Branch`, `GitRemote`, `Commit`, `RawEvent` (note: schema.py lines 470-630 and lines 651-809 contain duplicate declarations of these five types — the second copy is the load-bearing one used by `_OBJECT_FACTORIES`). v6 added `RuleObject`, `SkillObject`, `AgentObject`, `InvocationObject` so the PRD-05 Governance Runtime can read everything through the public Registry API instead of a side-store (`Invocation` auto-emits a matching `Change` row so downstream Sync sees the event without polling). v7 added `TaskObject` (carries its own `task_status` / `priority` lifecycle, `blocked_by` forward-refs, optional `project_id`) and `ArtifactObject` (free-form `kind`, `produced_by`, optional `checksum`) so the Workbench can manage every AXI atomic through the canonical API.

`change-stream-source` is one of the kernel's published capabilities — every kernel `register_*` that mutates an object emits a `Change` row keyed by `subject_id`, timestamp + uuid8 suffix (`change-<owner>-<ts>-<hex8>`). `collect_git` (in `axi-sync`) registers a synthetic `_runtime:git:<sha12>` change per commit; `register_invocation` auto-emits a matching change so the governance runtime stays observable. `sync.py` provides 5 explicit directions: `kernel_to_workspace` (push Project rows into `foundation/workspace-governance/workspace.json`), `workspace_to_kernel` (reverse, idempotent on id/location), `status` (id-level diff), `status_diff` (field-level drift for owner/stack/description/location on shared projects), and `coverage` (the `_COVERAGE` matrix mapping `Project→projects`, `Rule/Skill/Agent/Invocation→agent`, `Repository/Branch/GitRemote/Commit/RawEvent→registry`, `Document/Resource/Change/Task/Artifact→internal`). The sync module never deletes; either side can lag and the operator resolves drift by hand.

The `bridge/axi_todo.py` module is a one-way mirror to the operator's live `~/.axi-todo/tasks.json` ledger. Default `tasks_path` is the operator's home directory; automation must pass an explicit path (typically a tmpdir) to avoid corrupting the live ledger. The bridge round-trips through the JSON file directly (not the `axi-todo add` CLI) because the CLI exposes only `--title/--prompt` and cannot set `status/priority/dueAt`. Atomic writes go through `tasks.json.tmp → os.replace`; the bridge anchors `legacyIds.kernelTaskId` on every Kernel-sourced row so reverse sync collapses idempotently. Tests are guarded with `@unittest.skipUnless` so the live read never executes in CI. Total: 23 bridge tests + 99 main tests = 122 cases.

## Key Modules/Files

| Module / File | Responsibility | Path |
| --- | --- | --- |
| `Registry` class | Business ops — 15 `register_*` methods + `get` / `list_by_type` / `query` / `summary` / `relations_of` / `check` / `migrate` / `rebuild_registry` / `get_relations` | `axi_kernel/registry.py` |
| `_DEFAULT_OWNER` + `_detect_stale` | Owner fallback (`libu`) + filesystem-path stale detection (`path-missing`) | `axi_kernel/registry.py` |
| `_iter_project_candidates` / `_iter_doc_anchors` | Light-weight scan for `rebuild_registry` (avoids workbench-cli dependency) | `axi_kernel/registry.py` |
| `SCHEMA_VERSION = 7` + 15 dataclasses + 10 enums | Schema authority; `_OBJECT_FACTORIES` keyed on `ObjectType` | `axi_kernel/schema.py` |
| `Relation` / `Source` | Frozen dataclasses for graph edges + provenance envelope | `axi_kernel/schema.py` |
| `make_id` / `is_valid_id` | Stable SHA-1-based id generator (rename-safe, collision-detected via `check`) | `axi_kernel/ids.py` |
| `JsonStore` + `StoreLockError` | Atomic-write + cross-process-lock storage layer | `axi_kernel/store.py` |
| `JsonStore._atomic_write` | `tempfile.mkstemp` + `os.replace` with rollback on exception | `axi_kernel/store.py` |
| `JsonStore._exclusive` | Context manager combining `threading.Lock` + `fcntl.flock(LOCK_EX)` | `axi_kernel/store.py` |
| `JsonStore.append_migration` | Append-only migration record under `data/migrations/NNNN__NNNN__NNNN.json` | `axi_kernel/store.py` |
| CLI `build_parser` + 14 subcommands | `register project/document/change/resource/repository/branch/remote/commit/raw-event/rule/skill/agent/invocation/task/artifact`, `get`, `list`, `documents-for-project`, `query`, `summary`, `relations`, `deactivate`, `check`, `show-schema`, `sync {status,status-diff,coverage,kernel-to-workspace,workspace-to-kernel}`, `rebuild`, `get-relations` | `axi_kernel/__main__.py` |
| `kernel_to_workspace` / `workspace_to_kernel` / `status` / `status_diff` / `coverage` | Workspace ↔ Kernel 5-direction sync; never deletes; `_COVERAGE` matrix | `axi_kernel/sync.py` |
| `_COVERAGE` matrix | ObjectType → bucket mapping (`projects`/`agent`/`registry`/`internal`) | `axi_kernel/sync.py` |
| `KernelTask` + 3 sync entry points | Kernel ↔ `~/.axi-todo/tasks.json` bidirectional bridge with `legacyIds.kernelTaskId` anchoring | `axi_kernel/bridge/__init__.py` |
| `KernelTask.from_axi_todo` / `to_axi_todo_payload` | Status mapping (`todo→pending`, `in_progress→running`, `done→completed`) + priority mapping (`medium→normal`) | `axi_kernel/bridge/__init__.py` |
| `_write_tasks_file` | Atomic `tasks.json.tmp → os.replace`; preserves non-Kernel rows | `axi_kernel/bridge/__init__.py` |
| ADR-011 rust migration plan | Phase 1 (this repo) → Phase 2 (Python+Rust dual-entry) → Phase 3 (Rust replaces Python); committed 2026-09-29 | `docs/adr/ADR-011-axi-kernel-rust-migration.md` |
| `docs/SCHEMA_RELEASES.md` | Versioning rules + compatibility matrix + per-release notes | `docs/SCHEMA_RELEASES.md` |
| WK-REGISTER / WK-SYNC / WK-CHECK workflows | 7-field workflow docs (`入口 / 事实源 / 执行阶段 / 失败处理 / 闭环验收 / 安全边界 / 验证命令`) | `docs/workflows/` |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| Phase 0 (v1–v3) | `Project` / `Document` / `Change` / `Resource` baseline | Done |
| Phase 2 v4 | Repository Registry (`Repository` / `Branch` / `GitRemote` / `Commit` / `RawEvent`) | Done |
| v5 | Documentation-only release (no data bump) — recorded `Resource.kind` string additions | Done |
| v6 | `Rule` / `Skill` / `Agent` / `Invocation` first-class atoms + Kernel ↔ Runtime refactor | Done |
| v7 | `Task` / `Artifact` atoms (completes AXI atomic set) | Done |
| Phase 5 | `sync.status_diff`, `rebuild_registry`, `get_relations` + 122-test regression | Done (2026-09-24) |
| Step 7.A7 | Kernel ↔ axi-todo bridge (Vision PRD §8) | Done (2026-09-24) |
| ADR-011 | Rust migration plan (Phase 1 scaffold landed) | Accepted (2026-09-29) |
| v1.1 PRD template upgrade | Layered FR with quantitative anchors + FR-8 end-to-end smoke | Done (2026-09-27) |
| M1 handoff-check | `documented` / `verified` state | Done (`docs/HANDOFF.md` says `verified`) |
| M2 PRD content化 | Stub → real PRD | Done (PRD v1.1, 16.5 KB) |
| M3 next-lifecycle | `stage=shared` → next phase per `project-maturity-v1` decision record | Pending |
| Open ADRs | 5 PRD-01 ADRs (`JSON-on-disk`, `v6 first-class`, `v7 atoms`, `append-only migrations`, `SQLite cache`) | All `(待发)` |

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-kernel/AGENTS.md) — read order, boundaries, verification
- [`README.md`](/Volumes/code/workspace/foundation/axi-kernel/README.md) — purpose, quick start, layout
- [`README.zh-CN.md`](/Volumes/code/workspace/foundation/axi-kernel/README.zh-CN.md)
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-kernel/PRD.md) — v1.1 template, 14 sections, FR-1..FR-8 with quantitative anchors
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-kernel/CHANGELOG.md) — canonical audit trail
- [`CHANGE.md`](/Volumes/code/workspace/foundation/axi-kernel/CHANGE.md) — promotion-day record
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-kernel/MILESTONE.md) — M1 done, M2 done, M3 pending
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-kernel/TODO.md) — TODO-T-001/002
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/HANDOFF.md) — zero-context takeover brief, readiness=`verified`
- [`docs/SCHEMA_RELEASES.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/SCHEMA_RELEASES.md) — versioning rules + compatibility matrix
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/VERIFICATION.md)
- [`docs/adr/ADR-011-axi-kernel-rust-migration.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/adr/ADR-011-axi-kernel-rust-migration.md) — Rust migration plan, Accepted
- [`docs/workflows/WK-REGISTER-001.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/workflows/WK-REGISTER-001.md)
- [`docs/workflows/WK-SYNC-001.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/workflows/WK-SYNC-001.md)
- [`docs/workflows/WK-CHECK-001.md`](/Volumes/code/workspace/foundation/axi-kernel/docs/workflows/WK-CHECK-001.md)
- [`pyproject.toml`](/Volumes/code/workspace/foundation/axi-kernel/pyproject.toml) — name, version, requires-python

## Cross-References

Kernel is the schema authority for every downstream Personal-OS tool. Workspace governance records the following consumers (per `workspace.json` and `PRD.md §8`):

- **`foundation/axi-workbench-cli`** — consumes `Project` / `Document` / `Change` for the Workbench dashboard; the `rebuild_registry` helpers in `registry.py` deliberately do **not** depend on `workbench-cli.scanner.candidate` to keep Kernel independent
- **`foundation/axi-inbox`** — reads/writes `Resource` rows through the inbox `data/inbox.json` sidecar; calls `Registry.register_resource`, `register_change`, `register_update`, `register_many`
- **`foundation/axi-sync`** — pulls the `Change` stream via `collect()` and emits synthetic `Change` rows per `git log` commit; `git_collect` registers `Repository` / `Commit` / `RawEvent` rows directly
- **`foundation/axi-runtime`** — reads `Rule` / `Skill` / `Agent` / `Invocation` through the Registry API instead of a side-store (post-Step 6/7 refactor)
- **`foundation/axi-apps`** — consumes `Resource` rows of `kind=shareable` (axi-inbox transform target) and `kind=inspiration` / `kind=task`
- **`foundation/workspace-governance`** — Kernel reads `workspace.json` paths via `axi_kernel/sync.py` for `workspace_to_kernel` / `kernel_to_workspace` / `status_diff`

Kernel also depends on the `axi-todo` runtime at `agent-cluster/axi-agent/tools/axi-todo` via the bridge module (`~/.axi/todo/tasks.json` round-trip). The `src-rs/` directory exists but is empty; the Rust migration crate lives at `foundation/axi-workspace-rs/crates/axi-kernel-rs` per ADR-011.

## Notes

- Python CLI owner-internal, stdlib-only; canonical binary path lives at `foundation/axi-workspace-rs/crates/axi-kernel-rs` per ADR-011.
- 122 tests passing; Phase 5 sync surface + v1.1 PRD template upgrade done 2026-09-27.
- Working tree on `dev`: 4 ahead of `origin/dev`; 5 `(待发)` ADRs in `PRD.md §9` remain as owner items.
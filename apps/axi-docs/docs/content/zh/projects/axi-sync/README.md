---
id: axi-docs-zh-projects-axi-sync
title: Axi 变更同步
type: project
status: published
tags: [Axi Docs, 项目, foundation, core, change-sync]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi 变更同步
graph-tags: [Projects, foundation, change-sync]
description: AXI Personal OS 变更同步 CLI（PRD-04, Phase 2/3）—— 从 Kernel + git log 采集变更行，通过关键字启发式 + 0-100 影响评分对每个 L0-L3 打分，维护一个 7 状态 side-store 队列（detected → queued → analyzing → need-review → accepted / ignored / failed），并渲染每日 Markdown + JSON 报告。包括 fs-watcher、变更 split/merge 操作以及 L3 → ADR 自动链接器。
project:
  id: axi-sync
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-sync
  source-section: core
---

# Axi 变更同步

> 项目根 `README.md` 的镜像。权威源：
> [`/Volumes/code/workspace/foundation/axi-sync/README.md`](/Volumes/code/workspace/foundation/axi-sync/README.md)。
> 章节：core / 分区：`foundation/`。

## Summary

Axi Change Sync 是 AXI Personal OS 的规范化**跨仓库变更聚合器**。它拉取两个数据源 —— 每个 `Kernel.ChangeObject` 行（`axi_sync.collector.collect`）以及任何注册仓库的 `git log`（`axi_sync.collector.collect_git`，它会写入合成 `Change` 行以及 `Commit` / `RawEvent` 行）—— 然后通过 `axi_sync/inferrer.py` 中的关键字启发式按四级 **L0–L3** 阶梯对每个变更打分。评分公式（Vision PRD §9.4）将 L0 映射为 10、L1 为 35、L2 为 65、L3 为 92，并应用主体种类修饰符（`+8` 表示核心原子 Project/Rule/Skill/Agent，`-5` 表示派生行 Change/RawEvent，`+5` 表示跨项目 Repository/Commit/Branch），结果被钳制到 `[0, 100]`。已评分的变更进入 side-store 队列（`data/sync.json`），由一个 **7 状态机**（`detected → queued → analyzing → need-review → accepted / ignored / failed`）管理；`failed → queued` 与 `failed → analyzing` 是仅有的反向转换；终止态 `accepted` 与 `ignored` 的前向转换集合为空。

队列是每日报告的权威源：`report --format md` 渲染一个 markdown 摘要，包含 L0/L1/L2/L3 计数、按源计数、按状态计数，以及一个 "L3（need-review）items" 项列表。CLI 还暴露 `git-collect`、`fs-scan`、`fs-watch`（watchdog Observer，依赖在 `pyproject.toml` 中声明）、`change split`、`change merge`、`aggregate`、`adr-link`，以及 `sync`（基于游标的采集器）。`adr-link` 是一个 L3 → Architecture Decision Record 自动链接器：它挑选每个 L3 / `need-review` 队列项，使用 YAML frontmatter（`change_id` / `subject_id` / `source` / `level`）渲染 ADR 文件，并通过 `next_adr_number()` 选择顺序的 `ADR-NNN-<slug>.md` 文件名，写入运维人员提供的目标目录；通过 frontmatter `change_id` 查找保证幂等。CLI 归 `libu` 所有，以 `tier=axi-core-product`、`domain=change-sync`、`lifecycle=active-promoted-incubation` 注册；当前分支 `dev` 领先 `origin/dev` 5 次提交。最近的提交在 `src-rs/axi-sync-rs/` 下落地了一个 Phase-1 Rust 迁移脚手架（ADR-014 Proposed，2026-09-29），依赖 `notify` v6 / `rusqlite` 0.31 / `clap` 4；在 ADR-011（`axi-kernel-rs`）落地之前，Python 包仍然是生产写入路径。

v1.1 PRD（2026-09-27，13.3 KB）将系统拆为 L0（采集 —— `scanner.py` + `collector.py` + `fs_watcher.py`）→ L1（评分 —— `inferrer.py`）→ L2（队列状态机 —— `queue.py`）→ L3（报告 —— `report.py`），依赖严格单向，并包含 67 个定量锚点。CLI 有 14 个子命令（`sync`、`git-collect`、`fs-scan`、`fs-watch`、`change {split,merge}`、`aggregate`、`list`、`accept`、`ignore`、`report`、`adr-link`）；通过 `kernel_bridge.py`（与 inbox 相同的 `_resolve_kernel_path` 模式）在每次 CLI 调用时重置注册表。

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

`pyproject.toml` 声明 `dependencies = ["watchdog>=6.0"]`。Kernel bridge（`kernel_bridge.py`）是一个 13 行的模块，解析 `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")`，并遵循 `AXI_KERNEL_PATH`。如果没有 Kernel 在 `sys.path` 上，导入时的 `FileNotFoundError` 会在任何子命令运行之前触发。

## Verification

据 `AGENTS.md §Verification` 与 `PRD.md §11`：

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

L0 采集有三个入口。`collector.collect(registry, since_iso)` 走查每个 `Kernel.ChangeObject`（按 `created_at > since_iso` 过滤），将它们通过 `rate_many()` 产生 `RatedChange` 行，再返回。`collector.collect_git(registry, repo_location, ...)` 通过子进程调用 `git log --pretty=format:%H|%an|%aI|%s` 与 `git show --name-only --pretty=`，注册 `Repository` 行（在 location 上幂等），然后对每个新提交（sha 不在 `existing_commit_ids` 中）注册 `Commit` 行 + `RawEvent(source="git")` 行 + 以 `subject_id=_runtime:git:<sha12>` 为键的合成 `Change` 行。`_runtime:` 前缀绕过 Kernel 的 subject-existence 检查，因此即使没有真实的 `subject_id` 也会写入 `Change` 行。`event_store.append()` 接着写入 `RawEvent` JSONL 行，使用 `dedupe_key="git:<repo_id>:<sha>"`，`advance_cursor()` 更新每源的游标文件。`fs_watcher.scan_once()` 走查目录，为每个文件发出 `RawEvent(source="fs")` + `Change`；`watch_live()` 启动 `watchdog.observers.Observer` 进行实时轮询。Watcher 刻意跳过 `.json` / `.lock` / `.tmp` sidecars，避免 watch 根目录下的 Kernel 存储自喂。

L1 评分（`inferrer.py`）是纯函数 —— 无 I/O。`rate(change)` 从 Kernel `ChangeObject` 读取 `summary` + `subject_id` + `created_at`，通过 `_classify_source()` 分类来源（provenance `source.source_id` 优先，否则 subject-id 前缀映射 `project/document → workbench`、`resource → inbox`、`change → change`、`kernel → kernel`），通过正则识别 level：`_L3_KEYWORDS = ("migration", "schema_version", "migrate", "v1->v2", "v2->v3", "v3->v4")` → L3；`_L2_KEYWORDS = ("transformed", "linked", "archived", "stale", "deleted", "corrected", "renamed", "deactivated")` → L2；subject_kind 为 `document`/`resource` → L1；否则 → L0。`score(level, subject_kind)` 将 band 映射为 0–100 的基础分（L0=10, L1=35, L2=65, L3=92），应用主体修饰符（`_HIGH_WEIGHT_SUBJECTS = {project, rule, skill, agent}` → +8；`_LOW_WEIGHT_SUBJECTS = {change, rawevent}` → -5；`repository`/`commit`/`branch` → +5），钳制到 `[0, 100]`。结果落到 `RatedChange.impact_score`，所以 `rate()` 立即返回分数（无第二次调用）。

L2 状态机（`queue.py`）是 `Queue` 数据类，包含 `path: Path`、`items: list[QueuedChange]`、`cursor: str | None`。`VALID_STATES` 是 7 元组 `("detected", "queued", "analyzing", "need-review", "accepted", "ignored", "failed")`。`_TRANSITIONS` 是转换表：

```text
detected   → {queued, failed}
queued     → {analyzing, accepted, ignored, failed}
analyzing  → {need-review, accepted, ignored, failed}
need-review→ {accepted, ignored, failed}
accepted   → {}  (terminal)
ignored    → {}  (terminal)
failed     → {queued, analyzing}  (retry loop)
```

`set_state()` 在非法转换上抛 `ValueError`，消息为 `"invalid transition 'X' -> 'Y'"`。`ingest()` 通过 `change_id` 去重；对新行，如果 `level == "L3"`，将初始状态设为 `need-review`，否则设为 `queued`。Cursor 是目前为止看到的最大 `created_at`，因此 `sync --since <iso>` 只取增量。

L3 报告（`report.py`）渲染 markdown 摘要，包含按 level / 按 source / 按 state 的直方图，外加 "L3（need-review）items" 项列表。`render_summary_dict` 为 `report --format json` 返回相同 shape 的 JSON。L3 → ADR 自动链接器（`adr_linker.py`）读取实时队列，挑选每个尚未链接的 L3 / `need-review` 项（通过 frontmatter `change_id` 做幂等检查），用 YAML frontmatter（`change_id` / `subject_id` / `source` / `level`）渲染 ADR，并写入运维人员提供的目标目录。`slugify(summary)` 产出文件系统安全的 slug（小写 ASCII、连字符分隔、最长 60 字符；空 slug 回退为 `"adr"`）。`next_adr_number(target_dir)` 扫描目录中的 `ADR-NNN-*` 文件并返回 `max + 1`（若缺失/为空则为 `1`），因此单次运行中多个 L3 项依次得到 `ADR-001`、`ADR-002` 等。CLI 暴露 `adr-link --target DIR [--dry-run]`；处于终止态（`accepted` / `ignored` / `failed`）的 L3 项在结果行中以 `skipped-terminal-state` 出现（运维人员可见），但不产生新的 ADR 文件。19 个用例的 `test_adr_linker.py` 覆盖 slugify、next number、render、write、discover，以及完整的 link driver（含幂等重跑）。

变更操作帮助函数（`change_ops.py`）保留原始 `Change` 行（Kernel 契约"永不删除"来自 `kernel_to_workspace`）。`split_change(registry, change_id, into_prefix=None)` 为每个非空 summary 行产生 N 个子 `ChangeObject` 行，带 `Relation(DERIVED_FROM, target_id=parent)`；`merge_changes(registry, ids, into_summary=None)` 把 N 行折叠成一个合并 `Change`，其子行通过 `DERIVED_FROM` 反指它。两者都通过 `Registry.register_many(...)` 注册新行，因此多行写入是原子的。

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

Sync 是 `foundation/axi-kernel` 的主要**读取**消费者（强制 `PYTHONPATH=../axi-kernel`，无 mock —— 见 AC-6 / FR-6），也是 side-store 队列（`data/sync.json`）的主要写入者。据 `PRD.md §8` 与 `workspace.json`：

- **`foundation/axi-kernel`** —— Sync 通过 `Registry.list_by_type` / `get` 读取 `Kernel.ChangeObject` / `Commit` / `RawEvent` / `Repository`。Sync 通过 `Registry.register_change` 写入合成 `Change` 行（`subject_id = _runtime:git:<sha12>`）；`collect_git` 通过公共 Registry API 注册 `Repository` / `Commit` / `RawEvent`。`axi-kernel.sync.status_diff` / `coverage` 接口也可用于 Sync 的 drift 检测。
- **`foundation/axi-inbox`** —— 每次 inbox 状态转换都会发出 Sync 重放的 `Change` 行。`subject_id = resource-<id>` 链接让 Sync 能将 inbox 侧事件归因到 inbox 来源（`_classify_source` 对 `resource-` subject-id 前缀返回 `inbox`）。
- **`foundation/axi-workbench-cli`** —— 为项目确认发出 `Change` 行；Sync 的 `source = workbench` 映射通过 `project-` subject-id 前缀捕获这些事件。
- **`foundation/axi-runtime`** —— 通过队列的 `_COVERAGE` 投影消费 L0–L3 分数。PRD §7.5 提到将 `need-review` 队列项与规则触发器对齐，让 runtime 在关键变更时派发。
- **`foundation/axi-apps`** —— `axi-apps aggregate` 读取队列（以及 JSONL 事件存储）用于跨应用聚合视图。
- **`foundation/workspace-governance`** —— ADR linker 写入 `foundation/workspace-governance/docs/adr/`（或任何运维人员提供的 `--target` 目录），遵循 `ADR-NNN-<slug>.md` 约定。
- **`foundation/axi-workspace-rs`** —— Phase-1 Rust 脚手架位于 `src-rs/axi-sync-rs/` 下，使用 `notify` 6 / `rusqlite` 0.31 / `clap` 4；在 ADR-011（`axi-kernel-rs`）落地之前，Python 仍然是生产写入路径。

## 说明

- Python CLI 使用 stdlib + `watchdog>=6.0`；67 个测试通过；ADR-014（Rust migration）状态为 Proposed。
- 7 状态机（`detected → queued → analyzing → need-review → accepted / ignored / failed`）位于 side-store `data/sync.json`；Kernel 从不持有队列状态。
- `dev` 上的工作树：领先 `origin/dev` 5 次提交；Phase-1 Rust 脚手架位于 `src-rs/axi-sync-rs/`；`data/keywords.json` 尚未发布（AC-2 依赖项）。
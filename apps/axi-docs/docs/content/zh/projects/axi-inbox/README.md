---
id: axi-docs-zh-projects-axi-inbox
title: Axi 收件箱
type: project
status: published
tags: [Axi Docs, 项目, foundation, core, resource-inbox]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi 收件箱
graph-tags: [Projects, foundation, resource-inbox]
description: AXI Personal OS 收件箱 CLI（PRD-03, Phase 2）—— 采集 5 个输入类别（URL / image / file / idea / project-ref），通过 URI 启发式自动识别类型，经过 6 状态机（collected → unread → reviewed → linked → transformed → archived），并通过 5 种目标类型将收件箱条目转换为 Kernel Resource / Document 对象。
project:
  id: axi-inbox
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-inbox
  source-section: core
---

# Axi 收件箱

> 项目根 `README.md` 的镜像。权威源：
> [`/Volumes/code/workspace/foundation/axi-inbox/README.md`](/Volumes/code/workspace/foundation/axi-inbox/README.md)。
> 章节：core / 分区：`foundation/`。

## Summary

Axi Inbox 是 AXI Personal OS 的规范化**统一收件箱 CLI**。它接受五个输入类别——`url`、`image`、`file`、`idea`、`project-ref`——并将它们持久化为 `Kernel.ResourceObject` 行，生命周期由 `inbox_status` 承载（Kernel 级 `Status` 字段保持 `active` / `stale` / `deactivated`，与收件箱生命周期分开）。收件箱 CLI 作为 Kernel 之上的薄封装构建：所有写入都使用 `Registry.register_resource`、`Registry.register_change` 和 `Registry.update`，从而 Kernel 保持 schema 权威源身份，收件箱是纯行为层。URI 启发式识别在 `axi_inbox/inferrer.py::infer_kind`；6 状态收件箱机（`collected → unread → reviewed → linked → transformed → archived`）由 Kernel 的 `ResourceStatus` 枚举加上 `inbox.py` 中显式的 `_transition()` 调用强制。`archived` 是终止态。

转换流水线（PRD 4 层模型中的 L3）支持 5 个目标：`--to document`（创建带 `BELONGS_TO → project_id` 和 `DERIVED_FROM → source_resource_id` 的 `Kernel.DocumentObject`）、`--to project-resource`（不写入 Kernel，只标记 `linked_project` 字段）、`--to inspiration`（写入带 `DERIVED_FROM` 关系的新 `Resource(kind="inspiration")`）、`--to task`（写入带 `original_content = "action: <name>\ncontext: <body>"` 的 `Resource(kind="task")`）以及 `--to shareable`（写入带 `DERIVED_FROM` 的 `Resource(kind="shareable")`）。每次转换都会在 Kernel 中注册一个 `Change` 行，让下游 Change Sync 重放 provenance 链。Inbox 归 `libu` 所有，以 `tier=axi-core-product`、`domain=resource-inbox`、`lifecycle=active-promoted-incubation` 在 `workspace.json` 中注册，`provides=[axi-inbox-cli, resource-inbox]`。当前分支是 `dev`，领先 `origin/dev` 12 次提交；最近的一次变更 `c2ff035` 移除了 fallback Rust 脚手架（现已位于 `foundation/axi-workspace-rs/crates/axi-inbox-rs`）。

Axi Inbox 于 2026-09-22（在 `axi-kernel` 晋升之后）从 `incubator/resource-inbox/` 晋升，并于 2026-09-23 再次晋升。当前 PRD（v1.1，2026-09-27）引入 L0/L1/L2/L3 分层模型（collect / detect / state-machine / transform），并将每个 FR 绑定到定量锚点（5 个输入类别、5 种 kind、6 个状态、2×3 转换目标、≥ 26 个测试）。`kernel_bridge.py` 模块解析规范化 Kernel 路径（默认 `/Volumes/code/workspace/foundation/axi-kernel`，通过 `AXI_KERNEL_PATH` 覆盖）并将其注入 `sys.path`；在没有 `PYTHONPATH=../axi-kernel` 的情况下运行会产生显式 `axi-kernel not importable` + `PYTHONPATH=...` 提示，`exit code ≥ 3`（AC-5 / FR-5）。v1 PRD 还提出严格 6 状态机，对跨级跳转抛 `InvalidTransitionError` 并拒绝 `archived → *`；当前收件箱代码使用 Kernel 的 `ResourceStatus` 枚举（6 个值：`collected / unread / reviewed / linked / transformed / archived`），没有显式的 `InvalidTransitionError` 类。

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

`pyproject.toml` 声明 `requires-python = ">=3.11"` 且没有 `dependencies` 数组。Kernel bridge 解析 `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")`；`AXI_KERNEL_PATH` 环境变量可以覆盖它。在 Kernel 不在 `sys.path` 上的情况下，`axi_inbox` 在导入时抛 `FileNotFoundError`，消息为 `"could not locate the AXI Kernel at ...; set AXI_KERNEL_PATH or install the axi-kernel package on sys.path"`。CLI 的 `--help` 在没有 Kernel 访问的情况下正常退出（仅 argparse），但每个子命令都会以 exit code 3 立即失败。

## Verification

据 `AGENTS.md §Verification` 与 `PRD.md §11`：

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

PRD 的 L0/L1/L2/L3 模型（PRD.md §2）清晰地映射到四个 Python 模块。L0（`collect.py` / `axi_inbox.__main__:cmd_collect`）是写入面：接受 URI / 文本输入，在省略 `--kind` 时调用 `infer_kind`，通过 `axi_kernel.ids.make_id("Resource", "libu", name, uri_or_text)` 构建稳定 id，注册 `ResourceObject`，`inbox_status=ResourceStatus.COLLECTED`，并在 `--note` 给出时发出 `Change` 行。L1（`inferrer.py::infer_kind`）是 URI 启发式：用 `urllib.parse.urlparse` 解析 `http/https` scheme → `url`，检查 `_IMAGE_EXTS = {.png, .jpg, .jpeg, .gif, .webp}` → `image`，遍历 `_PROJECT_PREFIXES`（规范化分区 `foundation/`、`workbench/`、`agent-cluster/`、`products/`、`distributions/`、`tools/`、`archive/`、`incubator/`、`references/`，以及遗留 `projects/`、`shared/`、`infra/`）→ `project-ref`，再回落到 `file`（含 `/` 或 `\`）或 `idea`（空白 / >80 字符 / 没有点）。检测器是纯函数，没有 I/O；7 个 `InferrerTests` 覆盖所有分支，并在完整当前分区列表上锁定回归。

L2 是状态机层。Inbox 不实现自己的状态机 —— 它委托给 Kernel 的 `ResourceStatus` 枚举（六个值：`COLLECTED`、`UNREAD`、`REVIEWED`、`LINKED`、`TRANSFORMED`、`ARCHIVED`）。状态转换通过 `inbox._transition()` 流转，调用 `Registry.update(extra_fields={"inbox_status": new_status.value, "last_action": ...})`，并发出以 `subject_id = resource_id` 为键的 `Change` 行。`archive` 与 `review` 帮助函数是 `_transition` 的薄包装；`link` 增加 `Relation(kind=BELONGS_TO, target_id=project_id)` 并设置 `linked_project`。PRD 声明严格跨级拒绝（`InvalidTransitionError`），但当前代码并不强制 —— `Registry.update` 调用只是简单地覆盖 `inbox_status`。`ResourceStatus.ARCHIVED` 实际上是终止态（没有 inbox 帮助函数从 `ARCHIVED` 返回非 `COLLECTED`），但有缺陷的调用方仍可以直接对 Registry 调用 `update(... inbox_status=UNREAD ...)`。PRD 的 M3 验收标准 AC-3（`InvalidTransitionError` on skip）尚未在 `axi_inbox/inbox.py` 中强制。

L3 是转换流水线（`inbox.transform`）。支持五个目标，每个都是真正的 `Registry.register_*` 调用（无 mock）：`--to document`（必填 `--as <project-id>`）创建带 `BELONGS_TO → project_id` + `DERIVED_FROM → resource_id` 的 `DocumentObject`，并挑选一个能通过 Kernel `check` 的文件系统路径（URL/image/file/project-ref 使用源 URI；`idea` 条目回落到 `<project.location>/AGENTS.md`）。`--to project-resource` 是 no-op Kernel 写入 —— 它只是在源上盖章 `linked_project`。`--to inspiration` / `--to task` / `--to shareable` 各创建一个带 `kind="inspiration"` / `"task"` / `"shareable"`、`DERIVED_FROM → resource_id` 关系、（如果传入 `--as` 则）可选 `BELONGS_TO → project_id` 和 `Source(source_id="inbox")` 的全新 `ResourceObject`。`uuid.uuid4().hex[:8]` 后缀混入 id 哈希槽，使对同一源的两次 `--to shareable` 产生不同的 id。每次成功转换之后，源资源被更新为 `inbox_status=TRANSFORMED`、`last_action="transformed to <to>"`，最终一条 `Change` 行记录转换摘要。转换帮助函数在使用 `--to shareable` 时还会发出第二条 `Change` 行（subject_id = 新的 shareable），让 Phase 4 的审计流双向携带 provenance。

Kernel 依赖通过 `kernel_bridge.py`（12 行）连接，它解析 `_KERNEL_DEFAULT = Path("/Volumes/code/workspace/foundation/axi-kernel")`，遵循 `AXI_KERNEL_PATH`，并在导入时将解析后的路径注入 `sys.path`。`open_shared_registry()` 是 inbox 使用的唯一 Kernel 入口。收件箱内优先选用 `Registry.register_many([obj])` 而不是单个 `register_*` 调用，因为它将多次写入批处理为单次原子变更（Kernel L2 把所有内容包裹在 `store.mutate(...)` 中）。Inbox 刻意**不**拥有 v7 schema 原子 —— Kernel 不授予 inbox 自定义对象类型的权限，因此 inbox 只写入 `Resource` / `Document` / `Change`（PRD N3 / §1.1 边界表）。

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

Inbox 是 `foundation/axi-kernel` 的消费者（强制 `PYTHONPATH=../axi-kernel`，无 mock —— 见 AC-5 / FR-8），并被下游 Personal-OS 工具消费。据 `PRD.md §8` 与 `workspace.json`：

- **`foundation/axi-kernel`** —— 提供 `ResourceObject` / `DocumentObject` / `ChangeObject` + `Registry.register_resource` / `register_change` / `update` / `register_many`。Inbox 只写入 `Resource` / `Document` / `Change`（Kernel N3 边界）。通过 `axi_inbox/kernel_bridge.py` 桥接（解析 `AXI_KERNEL_PATH`）。
- **`foundation/axi-sync`** —— Phase 4 Change Sync 重放在每次状态转换和每次转换时发送的 `Change` 行。`InboxStatusChange` 事件携带 `subject_id = resource_id`，让 Sync 可以重建生命周期历史。
- **`foundation/axi-apps`** —— `axi-apps share` 读取 `Resource(kind="shareable")` 行；`axi-apps aggregate` 按 kind 聚合 `Resource` 行。Inbox 的 `--to shareable` 转换目标是 shareable 流的写入者。
- **`foundation/axi-runtime`** —— 可以基于 `Resource` inbox_status 转换触发规则；PRD §7.5 提到把 `transform --to task` 行链接到未来的 Phase-6 任务规划器。
- **`foundation/axi-workspace-rs`** —— Phase-1 Rust 脚手架已从本仓库移除（commit `c2ff035`），并迁移到 `foundation/axi-workspace-rs/crates/axi-inbox-rs/`，按 ADR-015（Proposed）。

## 说明

- Python CLI 是 `foundation/axi-kernel` 之上的薄层（强制 `PYTHONPATH=../axi-kernel`）；26 个测试通过。
- 6 状态收件箱机（`collected → unread → reviewed → linked → transformed → archived`）委托给 Kernel 的 `ResourceStatus` 枚举；`InvalidTransitionError` 尚未强制（PRD AC-3）。
- `dev` 上的工作树：领先 `origin/dev` 12 次提交；Phase-1 Rust 脚手架已在 `c2ff035` 中移除，现位于 `foundation/axi-workspace-rs/crates/axi-inbox-rs`。
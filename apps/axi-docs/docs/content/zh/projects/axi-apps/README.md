---
id: axi-docs-zh-projects-axi-apps
title: Axi Applications
type: project
status: published
tags: [Axi Docs, 项目, foundation, axi-core-product]
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

> 项目根 `README.md` + `PRD.md` 镜像。事实源：
> [`/Volumes/code/workspace/foundation/axi-apps/README.md`](/Volumes/code/workspace/foundation/axi-apps/README.md)
> 和 [`/Volumes/code/workspace/foundation/axi-apps/PRD.md`](/Volumes/code/workspace/foundation/axi-apps/PRD.md)。
> 分区：`foundation/`。领域：`applications`。生命周期：
> `active-promoted-incubation`（2026-09-23 从 `incubator/applications/` 晋升）。

## Summary

`axi-apps` 是 AXI Personal OS 的 **PRD-06 Applications CLI**。它在一个进程内提供 **三个子 CLI**，并附带可选的 FastAPI HTTP wrapper：**Share / Aggregate / Mobile**。三者共享单个 `argparse` 入口、同一个 Kernel 句柄以及同一套 Kernel bridge 设计。运行时 **pure reader** —— 唯一的写入面是 Share，它记录一行 `Change` 记录（`summary: "shared: <name>"` / `"unshared: <name>"`），绝不修改源 `ResourceObject`。Resource 仍由 inbox 权威拥有。

**Share**（`share.py`）通过追加 `shared:` / `unshared:` Change 行来维护每个资源的 share-state；`current_state(reg, resource_id)` 返回 `"shared"` / `"unshared"` / `"unknown"`；`share()` 与 `unshare()` 是幂等的 —— 在已经达到目标状态时再运行 **不会** 重复发出 Change 行。`list_shared(reg)` 遍历每条 Change 行，按 summary 前缀过滤，按 `subject_id` 取最近的事件，返回包含 `shared_at` + `share_event_id` 来源信息的当前集合。

**Aggregate**（`aggregate.py`）把四个分区视图融合为一个 JSON payload：`projects.by_partition`（按工作区分区统计 `ProjectObject`）、`inbox.by_status`（按 `inbox_status` 统计 `ResourceObject`）、`sync.by_level`（按 L0 / L1 / L2 / L3 关键词启发式推断的 Change 行计数）、`runtime`（从 `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json` 读取的 rule / skill / agent 计数）。`dashboard(...)` 追加最近 `limit` 条 Change 行。对下游 CLI（`axi-workbench`、`axi-inbox`、`axi-sync`、`axi-runtime`）的 subprocess 调用在失败时 **降级**（status 返回 `{partition: "kernel_unreachable"}`）而非抛错 —— aggregate CLI 在下游未运行时也不得崩溃。

**Mobile**（`mobile.py`）输出面向手机端客户端的 **size-bound JSON subset**。`status()` 返回每个项目的最小记录（id / name / stage / status），截断到 `limit` 个项目；`inbox()` 返回指定 `status` 的 Resources；`sync()` 返回 summary 与指定 level 匹配的 Change 行。`_truncate` 助手强制 **< 50 KB** 上限；PRD §6 FR-3 将 canonical limit 设定为 **< 256 KB default**，可通过 `--max-size <KB>` 调整。FastAPI wrapper（`mobile_server.py`）在 `/status`、`/inbox?status=...`、`/sync?level=...` 之外暴露 `/healthz`，监听 `127.0.0.1:8765`；**故意不提供** auth（single-tenant loopback）—— 需要对外暴露的 operator 必须把它放在带 mTLS 的反向代理之后。

CLI 继承与 `axi-runtime` 相同的 Kernel bridge 模式（`kernel_bridge.py` 通过 `AXI_KERNEL_PATH` env 覆盖或默认路径解析 `foundation/axi-kernel`，注入 `sys.path`，调用 `axi_kernel.registry.open_default`）。无 mock，无 schema v7；所有数据直接从 Kernel v6 读取。

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

无 `pip install -e`；CLI 的消费方式是设置 `PYTHONPATH=../axi-kernel` 并直接从 checkout 导入包。Mobile FastAPI wrapper 需要 `fastapi>=0.115` 和 `uvicorn>=0.30`（在 `pyproject.toml [project.dependencies]` 中声明）。工作区治理路径为 `/Volumes/code/workspace/foundation/axi-apps`。

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

PRD §10 AC-1 … AC-7 是规范的检查清单；`FR-7` 是端到端闭环 FR（在真实 Kernel + 真实 4 个 CLI subprocess 中 `share → aggregate → mobile` ≤ 12 s；mobile < 256 KB；share 写 1 条 Change）。

## Architecture Highlights

**分层设计（PRD §2）**。四层，单向依赖 **L3 → L2 → L1 → L0**。L0 数据汇聚（`kernel_bridge.py` + `__main__.py` 的 `open_shared_registry`）通过 `sys.path` 注入 Kernel，并对下游 CLI（workbench / inbox / sync / runtime）做 subprocess 调用；失败时把上层 projection 降级为 `{partition: "kernel_unreachable"}` 而非非零退出。L1 Share projection（`share.py`）每个 state transition 写一行 `Change`（幂等 —— 状态不变时不会重复 Change 行）。L2 Aggregate + Mobile projections（`aggregate.py` + `mobile.py`）消费 L0 的 RawProjection dict，融合分区视图，并施加 size-bound 截断。L3 接口（`__main__.py` argparse + `mobile serve` FastAPI）处理用户参数分发；三个子 CLI 之间不共享全局状态。

**Share 是唯一写入者；其他都是 pure reader**。`share.py` 通过 summary 前缀（`"shared: "` / `"unshared: "`）过滤每条 `Change` 行，计算每个 `subject_id` 的当前状态。`list_by_type(CHANGE)` 的 registry 顺序被保留，因为 Kernel 时间戳只精确到秒；latest-event 语义依赖顺序，而不仅是时间戳。该 CLI **绝不** 写入 Resource 对象 —— inbox 仍是 `ResourceObject` 的唯一权威源。`share()` 和 `unshare()` 是幂等的（在已 share 状态下再运行 **不会** 发出重复 Change 行）。

**Aggregate 融合 4 sources + 1 side-store**。`_by_partition(reg)` 通过相对 `/Volumes/code/workspace` 解析 `project.location` 按工作区分区统计 `ProjectObject`（遇到 `deactivated` 状态跳过）。`_by_inbox_status(reg)` 按 `inbox_status.value` 统计 `ResourceObject`（`kind` 假值时跳过）。`_by_sync_level(reg)` 从 Change 行的 summary 关键词推断 L0/L1/L2/L3（与 Change Sync V0.1 用于 `sync.log` 证据的启发式相同：migration / schema_version / v1->v2 → L3；transformed / linked / archived / corrected → L2；confirmed / registered / collected → L1；其它 → L0）。`_runtime_counts(base_dir)` 从 `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json` 读取 governance-runtime side-store 并返回 `{rules, skills, agents}`；文件缺失 → 全 0（runtime 未 seed 时 aggregate 不得崩溃）。`dashboard(...)` 追加按 `created_at` 倒序的最近 `limit` 条 Change 行。

**Mobile 针对手机客户端做 size-bound**。`_truncate(payload, *, limit)` 强制 **< 50 KB**（`if len(json.dumps(...)) <= 50_000 return payload else return {"truncated": True, "limit": limit, "items": payload.get("items", [])[:limit]}`）。PRD 的 canonical threshold 为 **< 256 KB default**，可通过 `--max-size <KB>` 调整（CLI 实现使用 50 KB；PRD 文档为 256 KB）。`mobile status` 返回 `{kind: "mobile.status", project_count, items}`，按 `limit` 截断项目；`mobile inbox` 按 `inbox_status` 过滤 Resource 并返回 `{kind: "mobile.inbox", status, items}`；`mobile sync` 按 level 关键词过滤 Change 行并返回 `{kind: "mobile.sync", level, items}`。所有 payload 都是 pure reader —— 不写 Kernel。

**FastAPI HTTP wrapper**。`mobile_server.py` 暴露 `GET /healthz`（存活 + `kernel_alive: true`）、`GET /status?limit=...`、`GET /inbox?status=unread|reading|done|archived&limit=...`、`GET /sync?level=L0|L1|L2|L3&limit=...`。Registry 在 `build_app(registry)` 时被捕获，作为 server 生命期内的稳定 Kernel。`serve(reg, host=127.0.0.1, port=8765)` 在前台运行 uvicorn。Auth 被故意省略 —— 若对外暴露，operator 必须放在带 mTLS 的反向代理之后。`serve` **不会自动安装**；operator 直接调用 `python3 -m axi_apps mobile serve`。

**Kernel bridge**。与 `axi-runtime` 相同的模式：`kernel_bridge.py` 通过 env `AXI_KERNEL_PATH` 或默认 `/Volumes/code/workspace/foundation/axi-kernel` 解析 Kernel 路径，注入 `sys.path`，`open_shared_registry()` 通过 `axi_kernel.registry.open_default` 打开 live `Registry`。两个项目共用 `axi_kernel.schema.ObjectType` 枚举的 `CHANGE`、`PROJECT`、`RESOURCE`、`RULE`、`SKILL`、`AGENT`、`INVOCATION` 鉴别器。

**Capability surface**。CLI 暴露四个 capability（按 FR-6）：`axi-apps-cli`（统一进程）、`applications-aggregate-v1`（JSON payload schema）、`share-inbox-bridge-v1`（审计行 + list）、`applications-mobile-v1`（size-bound subset）。下游消费者（按 PRD §8）：Axi Mobile、axi-workbench 治理 GUI、cc-connect workflow、Axi Coder、Axi Workbench remote task receipts。修改 aggregate / mobile 输出 schema = 修改每个 consumer 的 schema；合约必须通过 `workspace-project consumers axi-apps` 协调。

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

`MILESTONE.md`（audit-remediation 2026-09-25 脚手架，owner 维护）。当前阶段：`shared`。三个里程碑：

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | Handoff-check closed loop (documented / verified) | active |
| M2 | PRD enters real content phase (replace stub, ≥ 1 observable AC) | pending |
| M3 | Next lifecycle stage advancement per `project-lifecycle-and-release.md` | pending |

**近期已完成工作**（来自 `CHANGELOG.md`）：
- 2026-09-23 — **Mobile FastAPI wrapper**（`mobile_server.py`）：`GET /healthz` + `/status?limit=...` + `/inbox?status=...&limit=...` + `/sync?level=...&limit=...`；新 CLI 子命令 `mobile serve [--host 127.0.0.1] [--port 8765]`；无 auth（single-tenant loopback）；新 `pyproject.toml` 依赖 `fastapi>=0.115`、`uvicorn>=0.30`；6 用例 `tests/test_mobile_server.py`；证据 `evidence/mobile-server-20260923T160000Z.log`。
- 2026-09-23 — **从 `/Volumes/code/workspace/incubator/applications` 晋升**：11 测试通过；3 份证据日志（`share.log` + `aggregate.log` + `mobile.log`）；`share.add` 幂等，`aggregate` 融合 4 sources，`mobile` 在 120 项目下低于 50 KB；注册到 `workspace.json`（tier=`axi-core-product`，domain=`applications`，lifecycle=`active-promoted-incubation`） + `workspace.graph.json`（kind=`applications-cli`）；治理 admission 记录 `foundation/workspace-governance/admissions/axi-apps.json`。
- 2026-09-22 — 晋升到 `projects/`（后按 ADR-008 bucket-correct 到 `foundation/axi-apps`）。

**分支状态**（来自 `git status -sb`）：在 `dev` 上，领先 `origin/dev` 8 commits。最新 commit `bf98e11 docs: snapshot auto-generated submit logs (audit-remediation tail)`（2026-09-29）。其它近期：`9be6939 chore(apps): consolidate PRD refresh and audit-remediation submit logs`；`7b25c6b sync axi-apps docs + manifest (other: config + source + workflows, chunk 1)`；`6fa2038 sync axi-apps docs + manifest (governance docs)`；`792d707 fix(hooks): record workspace changes and surface failures`；`b456536 chore(githooks): remove || true from post-commit so failures surface`；`34292a0 docs(workflows): link to workspace-level workflow index in governance repo`；`9fed7b2 docs(workflows): add AP-SHARE/AGG/MOBILE for axi-apps`；`08b99c5 fix(gitignore): cover *.db / *.sqlite3 / chroma and remove tracked logs`；`0b84f4d chore(workspace): establish governed repository boundary`。1 个未跟踪的 `docs/logs/submit/20260928-045157-grouped-commit.md`。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-apps/AGENTS.md) — project boundary and 90-second read order；默认语言 中文；`PYTHONPATH=../axi-kernel` requirement；sub-CLIs are pure readers (Share is the only writer)。
- [`README.md`](/Volumes/code/workspace/foundation/axi-apps/README.md) — purpose、quick start、layout。
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-apps/PRD.md) — L2 PRD v1.1, 221 lines；FR-1…FR-7 with quantitative anchors；AC-1…AC-7。
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-apps/CHANGELOG.md) — Keep a Changelog format；mobile FastAPI wrapper + promotion entries。
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-apps/MILESTONE.md) — M1 active / M2 pending / M3 pending (stage=shared)。
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-apps/TODO.md) — TODO-T-001（axi dashboard app-shell loading contract v1）、TODO-T-002（axi-apps ↔ axi-workbench component discovery protocol）。
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-apps/docs/HANDOFF.md) — 90-second read order + contracts（readiness=unready，last verified 2026-09-25）。
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/foundation/axi-apps/docs/VERIFICATION.md) — verification matrix。
- [`evidence/mobile-server-20260923T160000Z.log`](/Volumes/code/workspace/foundation/axi-apps/evidence/mobile-server-20260923T160000Z.log) — Mobile FastAPI wrapper 证据日志。

## Cross-References

- `/Volumes/code/workspace/foundation/axi-kernel` — Kernel v6 `Registry`、`JsonStore`、`ObjectType.{CHANGE,PROJECT,RESOURCE,...}`；`register_change` 被 Share 消费；`list_by_type` 被 Aggregate + Mobile 消费。
- `/Volumes/code/workspace/foundation/axi-runtime` — sibling；`axi-apps aggregate runtime` reads `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json`（**incubator path**，而非晋升后路径）—— 记录该 contract drift 等待协调。
- `/Volumes/code/workspace/foundation/axi-inbox` — provides `ResourceObject.inbox_status` consumed by Aggregate and Mobile。
- `/Volumes/code/workspace/foundation/axi-sync` — provides L0/L1/L2/L3 keyword heuristic mirrored in `_by_sync_level` + `mobile.sync`。
- `/Volumes/code/workspace/foundation/axi-workbench-cli` — Aggregate consumes `workbench-cli` summary output (subprocess)；downstream of `axi-apps` for the governance GUI consumer。
- `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-008-personal-os-repository-topology.md` — bucket-corrected `axi-apps` from `projects/axi-apps` to `foundation/axi-apps`。
- `/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md` — sibling ADR；ADR-012（`axi-apps-rs` migration）is referenced as a sibling effort, pending ADR。
- `/Volumes/code/workspace/foundation/axi-rules/rules/agent-routing/AGENTS.md` — AR-ROUTING-003 shared-consumer rule and AR-ROUTING-004 high-risk fan-out enumeration apply when modifying the aggregate / mobile output schema（≥ 4 downstream consumers：Axi Mobile、Axi Workbench 治理 GUI、cc-connect、Axi Coder）。
- `/Volumes/code/workspace/foundation/axi-rules/rules/verification/` — `tests/test_*.py` evidence；behavior-first frontend testing audit does **not** apply to this Python CLI。
- `/Volumes/code/workspace/products/axi-soul-world` — peer product that may consume `axi-apps` mobile JSON via Web BFF。

## 说明

`axi-apps` 是 AXI Personal OS 的 **PRD-06 Applications CLI**，对应路径 `/Volumes/code/workspace/foundation/axi-apps`，由 `incubator/applications/` 于 2026-09-23 晋升。一个进程内提供三个 pure-reader 子 CLI（**Share / Aggregate / Mobile**）外加可选的 FastAPI `mobile_server.py`。Share 是唯一写入者：记录 `summary: "shared: <name>"` / `"unshared: <name>"` 的 `Change` 行，并通过 summary 前缀过滤读取最新状态；`share()` / `unshare()` 幂等。Aggregate 融合 `projects.by_partition` + `inbox.by_status` + `sync.by_level` + `_runtime_counts`（从 `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json` 读取）+ `dashboard(limit)`；subprocess 失败降级为 `{partition: "kernel_unreachable"}`。Mobile 输出 size-bound JSON（CLI 50 KB cap，PRD < 256 KB default，`--max-size <KB>` 可调）。`mobile_server.py` 暴露 `GET /healthz`、`/status?limit`、`/inbox?status&limit`、`/sync?level&limit`（监听 `127.0.0.1:8765`，无 auth，单租户 loopback）。依赖 `fastapi>=0.115`、`uvicorn>=0.30`。`kernel_bridge.py` 与 `axi-runtime` 共享 `AXI_KERNEL_PATH` env + `sys.path` 注入 + `axi_kernel.registry.open_default` 模式；所有数据为 Kernel v6。FR-7 是端到端闭环（`share → aggregate → mobile`，真实 Kernel + 4 CLI subprocess ≤ 12 s，mobile < 256 KB）。
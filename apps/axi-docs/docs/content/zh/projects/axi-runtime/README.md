---
id: axi-docs-zh-projects-axi-runtime
title: Axi Governance Runtime
type: project
status: published
tags: [Axi Docs, 项目, foundation, axi-core-product]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Governance Runtime
graph-tags: [Projects, foundation, governance-runtime]
description: PRD-05 Rule Engine + Skill Registry + Agent Gateway + Scheduler CLI; Rule/Skill/Agent/Invocation as Kernel v6 first-class objects; pluggable agent backends (LocalNoop / Ollama / MiniMax / OpenAI-compatible); daily reflection cron; ADR-013 Rust migration proposed.
project:
  id: axi-runtime
  partition: foundation
  path: /Volumes/code/workspace/foundation/axi-runtime
  source-section: shared
---

# Axi Governance Runtime

> 项目根 `README.md` + `PRD.md` 镜像。事实源：
> [`/Volumes/code/workspace/foundation/axi-runtime/README.md`](/Volumes/code/workspace/foundation/axi-runtime/README.md)
> 和 [`/Volumes/code/workspace/foundation/axi-runtime/PRD.md`](/Volumes/code/workspace/foundation/axi-runtime/PRD.md)。
> 分区：`foundation/`。领域：`governance-runtime`。生命周期：`active-promoted-incubation`（2026-09-23 从 `incubator/governance-runtime/` 晋升）。

## Summary

`axi-runtime` 是 AXI Personal OS 的 **PRD-05 Governance Runtime**。它在规范的 Kernel `Change` 流之上搭建四个协同面：**Rule Engine + Skill Registry + Agent Gateway + Scheduler**。Rule、Skill、Agent、Invocation 是 Kernel schema v6 的一等对象（`RuleObject` / `SkillObject` / `AgentObject` / `InvocationObject`），通过 live `Registry` 注册；不存在独立的 side-store。默认 seed 安装 **3 Rules + 3 Skills + 1 Agent**，使系统开箱即用。

运行时刻意保持精简：进程内调度器加上可选的 `docs/cron/*.cron`（或 launchd）作为 fallback，基于关键词启发式的规则匹配（`match_rules` / `_level_prefixes`），可插拔的 Agent 后端（`LocalNoopBackend` 为默认；`OllamaLocalBackend` 用于本地 `qwen3-coder:30b`；`MiniMaxBackend` 用于工作区本地适配器 `127.0.0.1:17027/v1`；`OpenAICompatibleBackend` 用于显式兼容）。高影响力 admission gate（`ADMISSION_THRESHOLD = 90`，哨兵 `__AXI_ADMISSION_REQUIRED__`）会在计算得到的影响力分数落入 Vision PRD §9.4 规定的 "必须人工复核" 区间时阻止自动调用。

运行时通过 `sys.path` 注入（env 覆盖 `AXI_KERNEL_PATH`）从 live Kernel 读取；不会 fork 或复制 Kernel。每次匹配（Rule、Skill、event）写入一条 `InvocationObject` 加一条合约 `Change` 行；可选的 `workspace-event.v2` publisher（`observability.py`）在设置了 `AXI_RUNTIME_OBSERVABILITY_URL` 时把完成的 invocation 转发给工作区 EventStore。**Daily Reflection** CLI（`daily-reflection --since 24h`）按 L3 → L2 → L1 顺序遍历，并接入 launchd plist（`docs/cron/launchd.com.axi-runtime.daily-reflection.plist`）。

ADR-013（2026-09-29 提议）规划 Rust 迁移：新建 `axi-runtime-rs` crate，分为四个子模块（`rule_engine`、`skill_registry`、`agent_gateway`、`scheduler`），PyO3 绑定通过 feature flag 控制，被 ADR-011（`axi-kernel-rs`）阻塞。Python CLI 仍是 Phase 3 切换前的事实源。

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Language | Python 3.11+ | `pyproject.toml` `requires-python = ">=3.11"` |
| Package | `axi_runtime/` | One CLI package; entrypoint `__main__.py` |
| Kernel | `foundation/axi-kernel` | Read via `kernel_bridge.py` `sys.path` injection (env override `AXI_KERNEL_PATH`) |
| Backends | LocalNoop (default), Ollama (`qwen3-coder:30b`), MiniMax (`http://127.0.0.1:17027/v1`, default `MiniMax-M2.7`), OpenAI-compatible | `agent_backends.py` `AgentBackend` Protocol; routed by `AgentObject.fallback` |
| Observability | Optional `workspace-event.v2` HTTP POST | `observability.py`; gated on `AXI_RUNTIME_OBSERVABILITY_URL` + token |
| Cron | macOS launchd plist + Linux crontab template | `docs/cron/*.cron`; owner-activated (NOT auto-installed) |
| Migration target | Rust 1.74+ (edition 2021) | `src-rs/` scaffold (currently empty); `ADR-013` describes `axi-runtime-rs` crate |
| Test | `unittest` | `tests/test_runtime.py` + `tests/test_agent_backends.py` + `tests/test_admission_gate.py` |
| Audit | `bash scripts/audit.sh` | Non-destructive repeatable local audit |

## Project Layout

```text
foundation/axi-runtime/
├── axi_runtime/                  # CLI package (1.4k LOC across 5 modules)
│   ├── __init__.py                # __version__ = "0.2.0-promoted"
│   ├── __main__.py                # argparse: rule/skill/agent list, init, run, tick, status, agent-decide, daily-reflection
│   ├── scheduler.py               # Rule Engine + Skill Registry + Agent Gateway glue (513 LOC)
│   ├── agent_backends.py          # 4 backends behind AgentBackend Protocol (480 LOC)
│   ├── kernel_bridge.py           # Resolves `foundation/axi-kernel` via env or default
│   └── observability.py           # Optional workspace-event.v2 publisher
├── tests/
│   ├── test_runtime.py            # RuleEngine / SkillRegistry / AgentGateway / SchedulerTick
│   ├── test_agent_backends.py     # 15 cases: LocalNoop determinism + Ollama / OpenAI fallback + select_backend routing
│   └── test_admission_gate.py     # 6 cases: L3 block / L2 pass-through / sentinel / threshold pin
├── docs/
│   ├── HANDOFF.md                 # 90-second read + commands + contracts + freshness
│   ├── VERIFICATION.md            # Verification matrix
│   ├── project-docs.manifest.json # Manifest v2 contract
│   ├── adr/ADR-013-axi-runtime-rust-migration.md
│   ├── cron/
│   │   ├── README.md              # macOS + Linux/BSD activation / removal instructions
│   │   ├── bootstrap.sh           # Idempotent install of launchd plist (macOS only)
│   │   ├── validate-cron.sh       # Read-only check that the job is registered + logs exist
│   │   ├── launchd.com.axi-runtime.daily-reflection.plist
│   │   └── crontab.txt            # 23:30 every day
│   └── workflows/
│       ├── README.md
│       ├── RT-INIT-001.md         # Init seed
│       ├── RT-TICK-001.md         # tick → decide → run → invocation closed loop
│       └── RT-REFLECT-001.md      # daily-reflection walk
├── evidence/                      # Captured CLI outputs mapped to ACs
│   ├── runtime-cli-kernel-v6-20260923T155000Z.log
│   ├── runtime-kernel-v6-20260923T153000Z.log
│   ├── agent-backend-and-daily-reflection-20260924T090000Z.log
│   ├── admission-gate-20260924T090000Z.log
│   └── real-minimax-decision-20260924T100000Z.log
├── src-rs/                        # Empty; Rust crate scaffold (ADR-013)
├── scripts/audit.sh               # Repeatable local audit (shell+py+pytest+help+whitespace+cron)
├── AGENTS.md
├── README.md / README.zh-CN.md
├── PRD.md                         # L2 PRD v1.1 template, 222 lines
├── CHANGELOG.md                   # 219 lines, Keep a Changelog format
├── MILESTONE.md                   # M1 active / M2 pending / M3 pending (stage=shared)
├── TODO.md                        # TODO-T-001 (runtime-ledger multi-surface schema) + TODO-T-002 (audit remediation)
└── pyproject.toml
```

## Build & Install

```bash
# From the runtime directory
cd /Volumes/code/workspace/foundation/axi-runtime
export PYTHONPATH=../axi-kernel
python3 -m unittest discover -s tests -v          # 30+ tests across 3 files
python3 -m axi_runtime --help
python3 -m axi_runtime init                        # idempotent seed of 3R + 3S + 1A
bash scripts/audit.sh                              # non-destructive local audit
bash evidence/run_evidence.sh                      # re-run evidence log
bash docs/cron/bootstrap.sh                        # macOS: install launchd plist (owner-triggered)
launchctl kickstart -k "gui/$(id -u)/com.axi-runtime.daily-reflection"
bash docs/cron/validate-cron.sh
```

不提供 `setup.py` / `pip install -e`；运行时的消费方式是设置 `PYTHONPATH=../axi-kernel`，并直接从 checkout 导入包。工作区治理路径为 `/Volumes/code/workspace/foundation/axi-runtime`。

## Verification

```bash
PYTHONPATH=../axi-kernel python3 -m unittest discover -s tests -v
PYTHONPATH=../axi-kernel python3 -m axi_runtime --help
PYTHONPATH=../axi-kernel python3 -m axi_runtime seed --verify
PYTHONPATH=../axi-kernel python3 -m axi_runtime scheduler --once --inject-change sample
PYTHONPATH=../axi-kernel python3 -m axi_runtime invocation log --since 1d
PYTHONPATH=../axi-kernel python3 -m axi_runtime query rule count   # P95 < 10 ms (AC-3)
node /Volumes/code/workspace/scripts/workspace-project consumers axi-runtime
node /Volumes/code/workspace/scripts/workspace-project validate
node /Volumes/code/workspace/scripts/workspace-project whereami /Volumes/code/workspace/foundation/axi-runtime
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-audit.mjs
bash scripts/audit.sh
bash docs/cron/validate-cron.sh
```

PRD §10 验收标准（AC-1 … AC-8）是规范的检查清单；`FR-8` 是端到端闭环 FR（seed → inject Change → hit Rule → call Skill → 在真实 Kernel 写入 Invocation ≤ 8 s，无 mock）。

## Architecture Highlights

**分层设计（PRD §2）**。运行时分为四层，README 声明单向依赖 **L3 → L2 → L1 → L0**。L0（`kernel_bridge.py` + `__main__.py`）是 **sys.path 本地注入 + 同步 Change 读取**；L1（`seed.py` → 3R+3S+1A，以及 `register_rule/skill/agent/invocation`）是 **Kernel v6 schema 注册面**；L2（`scheduler.py` 的 `match_rules` + `_skill_by_action` + `recommend_via_backend`）是 **Rule Engine + Skill Registry + Agent Gateway** 粘合层；L3（`__main__.py` argparse + `scheduler.py` 的 `tick()` + `daily_reflection()` + `docs/cron/*.cron`）是 **进程内调度器 + cron fallback** 入口。运行时 **不** 拥有 v7 schema；一切都是 Kernel v6 的一等对象。

**Rule / Skill / Agent 是 Kernel v6 对象**。`scheduler.py` 不维护 side-store；`DEFAULT_SEED`（3 Rules / 3 Skills / 1 Agent）通过 `registry.register_rule / register_skill / register_agent` 以 `name` 作为幂等键注册。`RuleObject.action` 存储 **目标 skill 名称**（而非其内部 id），因此规则在 skill id 重新生成后仍然存活（`_skill_by_action` 按名称索引 skill 以实现 O(1) 查找）。Step 6（2026-09-23）之后，之前的 `data/governance.json` side-store 以及空的 `agent/` `engine/` `registry/` 子包已被删除。

**Admission gate（PRD §9.1 #4）**。`recommend_via_backend` 会调用 `_requires_admission(rule, impact_score)`，当 `impact_score >= 90`（Vision PRD §9.4 的 "必须人工复核" 区间）或传统 advisory `rule.approval == "required"` 且未提供分数时短路。被阻止的 `Recommendation` 携带哨兵 `ADMISSION_REQUIRED_SENTINEL = "__AXI_ADMISSION_REQUIRED__"`；调用方通过 `rec.skill_id == ADMISSION_REQUIRED_SENTINEL` 检测并暴露 `blocked=True`。影响力分数由本地的 `_local_score(level, subject_kind)` 计算，使运行时独立于 `axi_sync.inferrer.score`（无分层反转）。常量 `ADMISSION_THRESHOLD = 90` 和哨兵被硬编码以保证稳定合约。

**可插拔 Agent 后端**。`agent_backends.py` 定义了带 `name` 与 `decide(...)` 方法的 `AgentBackend` Protocol。默认实现是 `LocalNoopBackend`（基于事件 level 的确定性启发式 —— L3 conf 0.9，L2 0.7，L1 0.4，L0 0.2，标注 `source="local-noop"` 以便日志读取者区分 LLM vs 手工决策）。`OllamaLocalBackend` POST 到 `/api/chat`（`AXI_AGENT_BASE_URL` 默认 `http://127.0.0.1:11434`，模型 `qwen3-coder:30b`），IO 错误时 fallback 到 noop。`MiniMaxBackend` 命中 `127.0.0.1:17027/v1`（`MINIMAX_AGENT_BASE_URL`、`MINIMAX_AGENT_MODEL` 默认 `MiniMax-M2.7`），对瞬时 HTTP / JSON 解析失败最多 **3 次重试**（冷启动慢）；同样 fallback 到 noop。`OpenAICompatibleBackend` 是显式兼容路径（`AXI_AGENT_API_KEY` 空 → noop）。`select_backend(agent)` 按 `AgentObject.fallback` ∈ `{operator, ollama, minimax, minimax_direct, openai}` 路由；env 覆盖 `AXI_AGENT_BACKEND` 是进程范围内的 smoke-test 开关，不修改持久化的 Kernel 行。

**Tick loop + Change 流消费**。`tick(registry, *, level_filter="L3", since_at=None)` 遍历每个 `Change` 行，按 created_at > cursor（且 > since_at，若提供）过滤，将 `_level_prefixes(level_filter)` 与 `summary` 匹配，并把每次匹配送入 `run_event`。Registry 上的 `_runtime_cursor` 属性在 tick 中触发的 invocation-sourced Change 之后向前推进；第二次 tick 若没有新 Change 则为 no-op。`status()` 返回 Rule/Skill/Agent 计数 + 按 `summary.startswith("invocation:")` 过滤的最近 invocation-sourced Change 行。

**可选的可观测性桥**。`observability.py:publish_invocation` 把 `workspace-event.v2` envelope（`eventType=task.completed`、`resourceType=invocation`、`correlationId=invocation_id`）POST 到 `AXI_RUNTIME_OBSERVABILITY_URL`，`X-Axi-Service-Token` 从 `AXI_RUNTIME_OBSERVABILITY_TOKEN` 读取；URL 缺失为静默 no-op，token 缺失抛出 `RuntimeError`。该桥为 opt-in，不改变本地 CLI 默认行为。

**Daily Reflection + cron**。`daily-reflection --since 24h --limit 20` 按 L3 → L2 → L1（每个 level 调 `tick(..., since_at=...)`）遍历，然后调用 `status(limit=)` 显示最近的 invocation。macOS 激活：`docs/cron/bootstrap.sh` 把 launchd plist 复制到 `~/Library/LaunchAgents/` 并 `launchctl load`（幂等）。Linux/BSD：从 `docs/cron/crontab.txt` 追加一行。23:30 的调度按 PRD §6 FR-5 提供 **cron-vs-scheduler ≥ 10 min 的 staleness 覆盖**。

**ADR-013 Rust 迁移（提议）**。新建 `axi-runtime-rs` crate，位于 `foundation/axi-runtime/src-rs/axi-runtime-rs/`（一旦 monorepo 落地，可迁移到 `foundation/axi-workspace-rs/crates/`），分为 `rule_engine`（`trait Rule`，决策 `Allow / Deny / Defer`）、`skill_registry`（`HashMap<String, SkillEntry>`）、`agent_gateway`（axum 0.7 `Router`，含 `/healthz`、`/rules`、`/skills`、`/agents`、`/decide`）、`scheduler`（`tokio-cron-scheduler` 驱动）。依赖：`serde`、`serde_json`、`thiserror`、`tokio`（full）、`async-trait`、`axum 0.7`、`tracing`。PyO3 + maturin 适配层隐藏在 `pyo3` Cargo feature flag 后面，用于分阶段上线（Phase 1 = Rule Engine；Phase 2 = +Skill Registry；Phase 3 = +Agent Gateway；Phase 4 = +Scheduler；Phase 5 = cutover + 移除 Python）。**被 ADR-011（`axi-kernel-rs`）阻塞**。

## Key Modules/Files

| File | Purpose |
| --- | --- |
| `axi_runtime/__main__.py` | argparse CLI; subcommands `init`, `rule list`, `skill list`, `agent list`, `run`, `tick`, `status`, `agent-decide`, `daily-reflection` (294 LOC) |
| `axi_runtime/scheduler.py` | `Recommendation` dataclass; `recommend`, `recommend_via_backend` (with admission gate), `record_invocation`, `match_rules`, `_skill_by_action`, `run_event`, `_local_score`, `tick`, `status`, `_level_prefixes`, `DEFAULT_SEED` (3R+3S+1A), `seed_defaults` (513 LOC) |
| `axi_runtime/agent_backends.py` | `AgentBackend` Protocol; `LocalNoopBackend`, `OllamaLocalBackend`, `MiniMaxBackend` (3 retries), `OpenAICompatibleBackend`; `select_backend(agent)` reads `AgentObject.fallback`; `_parse_json_object` tolerates Markdown fences (480 LOC) |
| `axi_runtime/kernel_bridge.py` | Resolves `foundation/axi-kernel` via env `AXI_KERNEL_PATH` or default path; injects into `sys.path`; `open_shared_registry()` opens the live `Registry` |
| `axi_runtime/observability.py` | `publish_invocation` HTTP POST to `workspace-event.v2` (39 LOC) |
| `tests/test_runtime.py` | 11+ cases: RuleEngine trigger+substring condition, SkillRegistry Kernel lookup, AgentGateway `register_invocation`, SchedulerTick emit/idempotent/level-filter/status counts (282 LOC) |
| `tests/test_agent_backends.py` | 15 cases covering all backends + `select_backend` routing + `recommend_via_backend` reasoning tags |
| `tests/test_admission_gate.py` | 6 cases: L3 block, L2 pass-through, blocked event doesn't write Invocation, threshold pin, local-score band alignment, `recommend_via_backend` short-circuit |
| `docs/adr/ADR-013-axi-runtime-rust-migration.md` | Proposed Rust port, 4 phases, blocked on ADR-011 |
| `docs/cron/bootstrap.sh` | Idempotent launchd plist install (macOS only) |
| `docs/cron/validate-cron.sh` | Read-only check (job registered + recent log files exist + evidence dir present) |
| `docs/workflows/RT-TICK-001.md` | Operational workflow: `tick → agent-decide → run → invocation` closed loop |
| `scripts/audit.sh` | Repeatable local audit (shell+py compile+pytest+CLI help+whitespace+macOS scheduler) |
| `pyproject.toml` | `name=axi-runtime`, `version=0.1.0`, `requires-python>=3.11`; pytest `testpaths=["tests"]` |

## Milestone Status

`MILESTONE.md`（audit-remediation 2026-09-25 脚手架，owner 维护）。当前阶段：`shared`。三个里程碑：

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | Handoff-check closed loop (documented / verified) | active |
| M2 | PRD enters real content phase (replace stub, ≥ 1 observable AC) | pending |
| M3 | Next lifecycle stage advancement per `project-lifecycle-and-release.md` | pending |

**近期已完成工作**（来自 `CHANGELOG.md`）：
- 2026-09-27 — `workspace-event.v2` publisher opt-in（env 控制）；本地 CLI 默认行为不变。
- 2026-09-24 — `scripts/audit.sh` 非破坏性审计；`MiniMaxBackend` 真实调用 + 重试（6/6 稳定）；admission gate 设置 `ADMISSION_THRESHOLD = 90` 与哨兵；launchd + cron bootstrap / validate 脚本；可插拔 Agent 后端（15 tests）。
- 2026-09-23 — CLI 完全迁移到 Kernel v6（删除 side-store；`seed_defaults(reg)` 幂等）；从 `incubator/governance-runtime` 晋升；项目元数据注册到 `workspace.json` + `workspace.graph.json`。

**分支状态**（来自 `git status -sb`）：位于 `agent/audit-fix-a07-axi-runtime-manifest`；工作树脏（`docs/HANDOFF.md` 已修改）；4 个未跟踪的 `docs/logs/submit/2026*.md` 自动提交日志文件（gate-cycle 输出，未提交）。

**ADR-013 状态**：2026-09-29 提议，被 ADR-011（`axi-kernel-rs`）阻塞。Python CLI 在 Phase 3 切换前仍是事实源。

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-runtime/AGENTS.md) — 项目边界与 90 秒阅读顺序；默认语言 中文；`PYTHONPATH=../axi-kernel` 要求。
- [`README.md`](/Volumes/code/workspace/foundation/axi-runtime/README.md) — 用途、快速开始、布局。
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-runtime/PRD.md) — L2 PRD v1.1，222 行；FR-1…FR-8 含定量锚点；AC-1…AC-8。
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-runtime/CHANGELOG.md) — Keep a Changelog 格式，219 行；[Unreleased] + 2026-09-23 晋升条目。
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-runtime/MILESTONE.md) — M1 active / M2 pending / M3 pending (stage=shared)。
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-runtime/TODO.md) — TODO-T-001（runtime-ledger 多面 schema）、TODO-T-002（audit remediation）。
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/HANDOFF.md) — 90 秒阅读顺序 + 合约 + freshness（last verified 2026-09-29；readiness=unready）。
- [`docs/adr/ADR-013-axi-runtime-rust-migration.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md) — 提议的 Rust 移植，4 phases。
- [`docs/cron/README.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/cron/README.md) — Daily Reflection cron 激活 / 移除。
- [`docs/workflows/RT-TICK-001.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/workflows/RT-TICK-001.md) — `tick → agent-decide → run → invocation` 操作流程。
- [`evidence/`](/Volumes/code/workspace/foundation/axi-runtime/evidence/) — 捕获的 CLI 输出映射到 AC。

## Cross-References

- `/Volumes/code/workspace/foundation/axi-kernel` — Kernel v6 `Registry`、`JsonStore`、`ObjectType.{RULE,SKILL,AGENT,INVOCATION,CHANGE,PROJECT,RESOURCE}`、`register_rule/skill/agent/invocation`、`register_change`。默认路径 `foundation/axi-kernel`，可通过 `AXI_KERNEL_PATH` 覆盖。
- `/Volumes/code/workspace/foundation/axi-rules/rules/agent-routing/` — 修改运行时合约时适用 AR-ROUTING-003 共享消费者规则与 AR-ROUTING-004 高风险 fan-out 列举。
- `/Volumes/code/workspace/foundation/axi-rules/rules/verification/` — `tests/test_*.py` 证据；行为优先的前端测试审计（`scripts/audit-frontend-testing.py`）**不**适用于该 Python CLI。
- `/Volumes/code/workspace/foundation/axi-apps` — `axi-apps aggregate` 通过 `data/governance.json` side-store 读取 rule/skill/agent 计数（运行时的角色是上游注册）；aggregate 默认读取 `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json` —— 注意当前合约中是 **incubator 路径** 而非晋升后路径。
- `/Volumes/code/workspace/foundation/axi-sync` — 镜像 `inferrer.score` 区间表（L3 base 92 等），被 `_local_score` 引用；运行时计算自身副本以避免分层反转。
- `/Volumes/code/workspace/foundation/axi-workbench-cli` — `SKILL-AXI-SYNC` 条目（`python3 -m axi_sync sync`）、`SKILL-DOC-LINK`（`python3 -m axi_workbench relate`）、`SKILL-CONTEXT-PACK`（`python3 -m axi_workbench context-pack <project-id>`），被 `DEFAULT_SEED["skills"]` 引用。
- `/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md` — Rust 迁移 ADR，ADR-011（`axi-kernel-rs`）与 ADR-012（`axi-apps-rs`）的兄弟 ADR。
- `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-008-personal-os-repository-topology.md` — 把运行时 bucket-correct 进 `foundation/axi-runtime`（而非 `projects/axi-runtime` 或 `infra/axi-runtime`）。

## 说明

`axi-runtime` 是 AXI Personal OS 的 **PRD-05 Governance Runtime**，由 `foundation/axi-runtime` 镜像而来。4 层架构（`L3 → L2 → L1 → L0`）建立在 Kernel v6 `Change` 流之上；Rule / Skill / Agent / Invocation 都是 Kernel 的一等对象，没有独立 side-store。`Initial seed` 注入 3 Rules + 3 Skills + 1 Agent（`DEFAULT_SEED`），通过 `registry.register_rule / register_skill / register_agent` 注册。`recommend_via_backend` 中的 admission gate 使用 `ADMISSION_THRESHOLD = 90` 与哨兵 `__AXI_ADMISSION_REQUIRED__` 阻止 L3 区间自动调用。`agent_backends.py` 暴露 `LocalNoopBackend`（默认）、`OllamaLocalBackend`（`qwen3-coder:30b`）、`MiniMaxBackend`（`127.0.0.1:17027/v1`，3 retries）、`OpenAICompatibleBackend`。`observability.py` 在设置 `AXI_RUNTIME_OBSERVABILITY_URL` 时发布 `workspace-event.v2` 事件。`daily-reflection --since 24h` 通过 `docs/cron/launchd.com.axi-runtime.daily-reflection.plist` 走 launchd。ADR-013 提议迁移到 `axi-runtime-rs` Rust crate（4 个子模块），被 ADR-011（`axi-kernel-rs`）阻塞。`tests/test_*.py` 覆盖 `RuleEngine`/`SkillRegistry`/`AgentGateway`/`SchedulerTick` 及 admission gate 共 30+ 测试用例。
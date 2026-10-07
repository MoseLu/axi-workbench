---
id: axi-docs-en-projects-axi-runtime
title: Axi Governance Runtime
type: project
status: published
tags: [Axi Docs, Projects, foundation, axi-core-product]
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

> Mirror of the project root `README.md` + `PRD.md`. Source of truth:
> [`/Volumes/code/workspace/foundation/axi-runtime/README.md`](/Volumes/code/workspace/foundation/axi-runtime/README.md)
> and [`/Volumes/code/workspace/foundation/axi-runtime/PRD.md`](/Volumes/code/workspace/foundation/axi-runtime/PRD.md).
> Partition: `foundation/`. Domain: `governance-runtime`. Lifecycle: `active-promoted-incubation` (promoted 2026-09-23 from `incubator/governance-runtime/`).

## Summary

`axi-runtime` is the **PRD-05 Governance Runtime** of the AXI Personal OS. It
stands up four cooperating surfaces on top of the canonical Kernel `Change`
stream: **Rule Engine + Skill Registry + Agent Gateway + Scheduler**. Rule,
Skill, Agent, and Invocation are first-class Kernel schema v6 objects
(`RuleObject` / `SkillObject` / `AgentObject` / `InvocationObject`) registered
through the live `Registry`; there is no separate side-store. The default seed
installs **3 Rules + 3 Skills + 1 Agent** so the system is functional
out-of-the-box.

The runtime is intentionally minimal: in-process scheduler plus optional
`docs/cron/*.cron` (or launchd) for fallback, keyword-heuristic rule matching
(`match_rules` / `_level_prefixes`), pluggable Agent backends
(`LocalNoopBackend` default, `OllamaLocalBackend` for local `qwen3-coder:30b`,
`MiniMaxBackend` for the workspace's local adapter at
`127.0.0.1:17027/v1`, `OpenAICompatibleBackend` for explicit
compatibility). A high-impact admission gate (`ADMISSION_THRESHOLD = 90`,
sentinel `__AXI_ADMISSION_REQUIRED__`) blocks auto-invocation when the
computed impact score sits in the "must-have human review" band per Vision
PRD §9.4.

The runtime reads from the live Kernel via `sys.path` injection (env override
`AXI_KERNEL_PATH`); it never forking or copying the Kernel. Each matched
(Rule, Skill, event) writes one `InvocationObject` plus one contract
`Change` row, and an optional `workspace-event.v2` publisher
(`observability.py`) forwards completed invocations to a workspace EventStore
when `AXI_RUNTIME_OBSERVABILITY_URL` is set. A **Daily Reflection** CLI
(`daily-reflection --since 24h`) walks L3 → L2 → L1 in order and is wired to a
launchd plist (`docs/cron/launchd.com.axi-runtime.daily-reflection.plist`).

ADR-013 (proposed 2026-09-29) plans a Rust migration: a new
`axi-runtime-rs` crate split into four submodules (`rule_engine`,
`skill_registry`, `agent_gateway`, `scheduler`) with PyO3 bindings behind a
feature flag, blocked on ADR-011 (`axi-kernel-rs`). The Python CLI remains
the source of truth through Phase 3.

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

No `setup.py` / `pip install -e`; the runtime is consumed by setting
`PYTHONPATH=../axi-kernel` and importing the package directly from the
checkout. Workspace governance path is
`/Volumes/code/workspace/foundation/axi-runtime`.

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

PRD §10 acceptance criteria (AC-1 … AC-8) are the canonical check list;
`FR-8` is the end-to-end closure FR (seed → inject Change → hit Rule →
call Skill → write Invocation in real Kernel ≤ 8 s, no mocks).

## Architecture Highlights

**Layered design (PRD §2).** The runtime is split into four layers and the
README declares single-direction dependency **L3 → L2 → L1 → L0**. L0
(`kernel_bridge.py` + `__main__.py`) is the **sys.path local injection +
synchronous Change read**; L1 (`seed.py` → 3R+3S+1A, plus `register_rule/
skill/agent/invocation`) is the **Kernel v6 schema registration face**; L2
(`scheduler.py`'s `match_rules` + `_skill_by_action` + `recommend_via_backend`)
is the **Rule Engine + Skill Registry + Agent Gateway** glue; L3
(`__main__.py` argparse + `scheduler.py` `tick()` + `daily_reflection()` +
`docs/cron/*.cron`) is the **in-process scheduler + cron fallback** entry.
The runtime does **not** own a v7 schema; everything is a Kernel v6 first-class
object.

**Rule / Skill / Agent as Kernel v6 objects.** `scheduler.py` does not own a
side-store; `DEFAULT_SEED` (3 Rules / 3 Skills / 1 Agent) is registered via
`registry.register_rule / register_skill / register_agent` with `name` as the
idempotency key. `RuleObject.action` stores the **target skill name** (not
its internal id), so a rule survives skill id regeneration
(`_skill_by_action` indexes skills by name for O(1) lookup). After Step 6
(2026-09-23), the previous `data/governance.json` side-store and the empty
`agent/` `engine/` `registry/` subpackages were deleted.

**Admission gate (PRD §9.1 #4).** `recommend_via_backend` consults
`_requires_admission(rule, impact_score)` and short-circuits when
`impact_score >= 90` (Vision PRD §9.4 "must-have human review" band) or
when the legacy advisory `rule.approval == "required"` and no score is
supplied. The blocked `Recommendation` carries the sentinel
`ADMISSION_REQUIRED_SENTINEL = "__AXI_ADMISSION_REQUIRED__"`; callers detect
it via `rec.skill_id == ADMISSION_REQUIRED_SENTINEL` and surface
`blocked=True`. Impact score is computed locally by `_local_score(level,
subject_kind)` so the runtime stays independent of `axi_sync.inferrer.score`
(no layering inversion). Constants `ADMISSION_THRESHOLD = 90` and the
sentinel are hard-coded for stable contract.

**Pluggable Agent backend.** `agent_backends.py` defines a single
`AgentBackend` Protocol with a `name` and `decide(...)` method. The default
is `LocalNoopBackend` (deterministic heuristic keyed by event level — L3
conf 0.9, L2 0.7, L1 0.4, L0 0.2 — marked `source="local-noop"` so log
readers can grep for LLM vs. hand-rolled decisions). `OllamaLocalBackend`
POSTs to `/api/chat` (`AXI_AGENT_BASE_URL` default `http://127.0.0.1:11434`,
model `qwen3-coder:30b`), falls back to noop on IO error. `MiniMaxBackend`
hits `127.0.0.1:17027/v1` (`MINIMAX_AGENT_BASE_URL`,
`MINIMAX_AGENT_MODEL` default `MiniMax-M2.7`) with up to **3 retries** on
transient HTTP / JSON-parse failures (cold-start slowness); also falls back
to noop. `OpenAICompatibleBackend` is the explicit compatibility path
(`AXI_AGENT_API_KEY` empty → noop). `select_backend(agent)` routes on
`AgentObject.fallback` ∈ `{operator, ollama, minimax, minimax_direct,
openai}`; the env override `AXI_AGENT_BACKEND` is a process-scoped smoke-test
switch that does not mutate the persisted Kernel row.

**Tick loop + cursor + Change stream consumption.** `tick(registry, *,
level_filter="L3", since_at=None)` walks every `Change` row, filters by
created_at > cursor (and > since_at when supplied), matches
`_level_prefixes(level_filter)` against `summary`, and feeds each match
through `run_event`. The `_runtime_cursor` attribute on the Registry advances
past any invocation-sourced Changes emitted during the tick; a second tick
with no new Changes is a no-op. `status()` returns Rule/Skill/Agent counts +
the most recent invocation-sourced Change rows filtered by
`summary.startswith("invocation:")`.

**Optional observability bridge.** `observability.py:publish_invocation`
posts a `workspace-event.v2` envelope (`eventType=task.completed`,
`resourceType=invocation`, `correlationId=invocation_id`) to
`AXI_RUNTIME_OBSERVABILITY_URL` with `X-Axi-Service-Token` set from
`AXI_RUNTIME_OBSERVABILITY_TOKEN`; URL absence is a silent no-op, token
absence raises `RuntimeError`. The bridge is opt-in and does not change the
local CLI default.

**Daily Reflection + cron.** `daily-reflection --since 24h --limit 20` walks
L3 → L2 → L1 (`tick(..., since_at=...)` for each level), then `status(limit=)`
to surface the recent invocations. macOS activation: `docs/cron/bootstrap.sh`
copies the launchd plist into `~/Library/LaunchAgents/` and `launchctl load`s
it (idempotent). Linux/BSD: append the line from `docs/cron/crontab.txt`. The
23:30 schedule provides cron-vs-scheduler **staleness coverage ≥ 10 min** per
PRD §6 FR-5.

**ADR-013 Rust migration (proposed).** New `axi-runtime-rs` crate at
`foundation/axi-runtime/src-rs/axi-runtime-rs/` (or migrated to
`foundation/axi-workspace-rs/crates/` once the monorepo lands), split into
`rule_engine` (`trait Rule` with `Allow / Deny / Defer` decision),
`skill_registry` (`HashMap<String, SkillEntry>`),
`agent_gateway` (axum 0.7 `Router` with `/healthz`, `/rules`, `/skills`,
`/agents`, `/decide`), `scheduler` (`tokio-cron-scheduler` driver).
Dependencies `serde`, `serde_json`, `thiserror`, `tokio` (full),
`async-trait`, `axum 0.7`, `tracing`. PyO3 + maturin adapter kept behind a
`pyo3` Cargo feature flag for staged rollout (Phase 1 = Rule Engine; Phase 2
= +Skill Registry; Phase 3 = +Agent Gateway; Phase 4 = +Scheduler; Phase 5
= cutover + Python removal). **Blocked on ADR-011** (`axi-kernel-rs`).

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

`MILESTONE.md` (audit-remediation 2026-09-25 scaffold, owner-maintained).
Current stage: `shared`. Three milestones:

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | Handoff-check closed loop (documented / verified) | active |
| M2 | PRD enters real content phase (replace stub, ≥ 1 observable AC) | pending |
| M3 | Next lifecycle stage advancement per `project-lifecycle-and-release.md` | pending |

**Recent shipped work** (per `CHANGELOG.md`):
- 2026-09-27 — `workspace-event.v2` publisher opt-in (env-gated); default local CLI unchanged.
- 2026-09-24 — `scripts/audit.sh` non-destructive audit; `MiniMaxBackend` real call + retry (6/6 stability); admission gate with `ADMISSION_THRESHOLD = 90` and sentinel; launchd + cron bootstrap / validate scripts; pluggable Agent backends (15 tests).
- 2026-09-23 — CLI fully migrated to Kernel v6 (side-store deleted; `seed_defaults(reg)` idempotent); promoted from `incubator/governance-runtime`; project metadata registered in `workspace.json` + `workspace.graph.json`.

**Branch state** (per `git status -sb`): on
`agent/audit-fix-a07-axi-runtime-manifest`; working-tree dirty
(`docs/HANDOFF.md` modified); 4 untracked `docs/logs/submit/2026*.md`
auto-submit log files (gate-cycle output, not committed).

**Open ADR-013 status**: Proposed 2026-09-29, blocked on ADR-011
(`axi-kernel-rs`). Python CLI remains the source of truth through Phase 3
cutover.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/foundation/axi-runtime/AGENTS.md) — project boundary and 90-second read order; default language 中文; `PYTHONPATH=../axi-kernel` requirement.
- [`README.md`](/Volumes/code/workspace/foundation/axi-runtime/README.md) — purpose, quick start, layout.
- [`PRD.md`](/Volumes/code/workspace/foundation/axi-runtime/PRD.md) — L2 PRD v1.1, 222 lines; FR-1…FR-8 with quantitative anchors; AC-1…AC-8.
- [`CHANGELOG.md`](/Volumes/code/workspace/foundation/axi-runtime/CHANGELOG.md) — Keep a Changelog format, 219 lines; [Unreleased] + 2026-09-23 promotion entry.
- [`MILESTONE.md`](/Volumes/code/workspace/foundation/axi-runtime/MILESTONE.md) — M1 active / M2 pending / M3 pending (stage=shared).
- [`TODO.md`](/Volumes/code/workspace/foundation/axi-runtime/TODO.md) — TODO-T-001 (runtime-ledger multi-surface schema), TODO-T-002 (audit remediation).
- [`docs/HANDOFF.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/HANDOFF.md) — 90-second read order + contracts + freshness (last verified 2026-09-29; readiness=unready).
- [`docs/adr/ADR-013-axi-runtime-rust-migration.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md) — Proposed Rust port, 4 phases.
- [`docs/cron/README.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/cron/README.md) — Daily Reflection cron activation / removal.
- [`docs/workflows/RT-TICK-001.md`](/Volumes/code/workspace/foundation/axi-runtime/docs/workflows/RT-TICK-001.md) — Operational workflow for `tick → agent-decide → run → invocation`.
- [`evidence/`](/Volumes/code/workspace/foundation/axi-runtime/evidence/) — Captured CLI outputs mapped to ACs.

## Cross-References

- `/Volumes/code/workspace/foundation/axi-kernel` — Kernel v6 `Registry`, `JsonStore`, `ObjectType.{RULE,SKILL,AGENT,INVOCATION,CHANGE,PROJECT,RESOURCE}`, `register_rule/skill/agent/invocation`, `register_change`. Default path `foundation/axi-kernel`, overridable via `AXI_KERNEL_PATH`.
- `/Volumes/code/workspace/foundation/axi-rules/rules/agent-routing/` — AR-ROUTING-003 shared-consumer rule and AR-ROUTING-004 high-risk fan-out enumeration apply when modifying the runtime contract.
- `/Volumes/code/workspace/foundation/axi-rules/rules/verification/` — `tests/test_*.py` evidence; behavior-first frontend testing audit (`scripts/audit-frontend-testing.py`) does **not** apply to this Python CLI.
- `/Volumes/code/workspace/foundation/axi-apps` — `axi-apps aggregate` reads the rule/skill/agent counts via `data/governance.json` side-store (runtime's role is upstream registration); the aggregate reads `/Volumes/code/workspace/incubator/governance-runtime/data/governance.json` by default — note the **incubator path** rather than the promoted path in the current contract.
- `/Volumes/code/workspace/foundation/axi-sync` — Mirrors `inferrer.score` band table (L3 base 92 etc.) referenced by `_local_score`; runtime computes its own copy to avoid a layering inversion.
- `/Volumes/code/workspace/foundation/axi-workbench-cli` — `SKILL-AXI-SYNC` entry (`python3 -m axi_sync sync`), `SKILL-DOC-LINK` (`python3 -m axi_workbench relate`), `SKILL-CONTEXT-PACK` (`python3 -m axi_workbench context-pack <project-id>`) referenced from `DEFAULT_SEED["skills"]`.
- `/Volumes/code/workspace/foundation/axi-runtime/docs/adr/ADR-013-axi-runtime-rust-migration.md` — Rust migration ADR, sibling of ADR-011 (`axi-kernel-rs`) and ADR-012 (`axi-apps-rs`).
- `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/ADR-008-personal-os-repository-topology.md` — Bucket-corrects the runtime into `foundation/axi-runtime` (not `projects/axi-runtime` or `infra/axi-runtime`).

## Notes

`axi-runtime` is the **PRD-05 Governance Runtime** of the AXI Personal OS at `foundation/axi-runtime`. The 4-layer architecture (`L3 → L2 → L1 → L0`) is built on the Kernel v6 `Change` stream; Rule / Skill / Agent / Invocation are first-class Kernel objects, no side-store. The default seed installs 3 Rules + 3 Skills + 1 Agent via `registry.register_rule / register_skill / register_agent`. The admission gate in `recommend_via_backend` uses `ADMISSION_THRESHOLD = 90` and the sentinel `__AXI_ADMISSION_REQUIRED__` to prevent auto-invocation in the L3 band. `agent_backends.py` exposes `LocalNoopBackend` (default), `OllamaLocalBackend` (`qwen3-coder:30b`), `MiniMaxBackend` (`127.0.0.1:17027/v1`, 3 retries), `OpenAICompatibleBackend`. `observability.py` publishes a `workspace-event.v2` event when `AXI_RUNTIME_OBSERVABILITY_URL` is set. `daily-reflection --since 24h` walks L3 → L2 → L1 via `docs/cron/launchd.com.axi-runtime.daily-reflection.plist`. ADR-013 proposes migrating to `axi-runtime-rs` Rust crate (4 submodules), blocked on ADR-011 (`axi-kernel-rs`). `tests/test_*.py` covers `RuleEngine` / `SkillRegistry` / `AgentGateway` / `SchedulerTick` plus admission gate (30+ cases).
---
id: axi-docs-en-projects-axi-agent
title: Axi Agent
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Agent
graph-tags: [Projects, agent-cluster]
tags: [Axi Docs, Projects, agent-cluster, multi-agent, FastAPI, MCP, React, workflow-routing]
description: Axi Agent monorepo — owner of FastAPI multi-agent platform, SubAgent worktree code-dev mode, MCP model swarm, terminal agent transport, codex remote bridge, and the local Axi Todo task ledger.
project:
  id: axi-agent
  partition: agent-cluster
  path: /Volumes/code/workspace/agent-cluster/axi-agent
  source-section: core
---

# Axi Agent

> Mirror of the project root `AGENTS.md` + `README.md` + `INDEX.md` + `docs/state/PRD.md` + `docs/HANDOFF.md`. Source of truth:
> [`/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/README.md`](/Volumes/code/workspace/agent-cluster/axi-agent/README.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/INDEX.md`](/Volumes/code/workspace/agent-cluster/axi-agent/INDEX.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/PRD.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/PRD.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/docs/HANDOFF.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/HANDOFF.md).
> Section: core / Partition: `agent-cluster/`.

## Summary

Axi Agent is the personal-scale, locally-runnable multi-agent collaboration platform for the AxiomaticWorld workspace. It is the canonical owner of (1) a Python FastAPI multi-agent backend with OpenAI Swarm-style hand-offs, LangChain tool integration, Chroma long-term memory, and a SubAgent code-development mode that runs on Git worktrees; (3) a Node.js MCP model-swarm service (`infra/axi-agent-mcp`) that owns the runtime tool surface and enforces a server-side capability allowlist; (4) a terminal Claude-CLI transport bridge (`infra/axi-agent-transport`); (5) the Codex remote bridge sidecar (`infra/codex-remote-bridge`); (6) the local persistent task ledger CLI `axi-todo` (`tools/axi-todo`); and (7) a React + TypeScript dashboard frontend plus a React + Electron `desktop-glass-ui` macOS shell prototype.

The latest architecture pivots on a single workflow-first execution contract: `task-execution-routing/v1` (`POLICY_VERSION = "task-execution-routing/v1"`). The workflow engine (the Workbench durable approval side) is the only authority allowed to turn normalized signals into a route decision — `bounded_agent` (read-only), `workflow` (effect-issuing), or `escalate`. `backend/app/core/strategy_planner.py` is intentionally a legacy compatibility classifier that returns deterministic advisory signals (`advisoryOnly: true`, `controlFlowOwner: "workflow-engine"`, `routeSignals`); it never calls a model or chooses tools. `backend/app/core/task_routing.py` (the `TaskRoutingGuard`) is a fail-closed hard-rule enforcer that applies hard rules before queueing, model execution, and every tool call. `backend/app/core/governance_guard.py` + `governance_runtime.py` + `capability_broker.py` form a second layer: a `CapabilityBroker` issues action-digest-bound, TTL-bounded one-shot `Capability` tickets; the plan-level `GovernanceGuard` evaluates an `ExecutionPlan` into a 4-state `GovernanceDecision` (allow/deny/transform/pause) and, for `allow`, hands out one capability per step. `backend/app/core/axi_agent_mcp_client.py` enforces the same broker at the MCP tool-call boundary: every `call_tool` requires a `capability_id` (Phase 1 commit 3, 2026-09-29), and the MCP service itself rejects unallowlisted `swarm_*` tools with JSON-RPC `code = -32601` / `reasonCode = "deny_unregistered_tool"`; mutating tools additionally require a `capability_id` argument (Phase 1 commit 5, 2026-09-29).

SubAgent mode (v1.1.0) is the load-bearing differentiator. `backend/app/core/code_isolation_manager.py` manages Git worktrees — `WorktreeInfo(path, branch, agent_id, created_at)`, `_IDENTIFIER_RE` / `_BRANCH_RE` validators, `_ensure_worktrees_excluded()` to keep `.worktrees/` out of the host repo's `.git/info/exclude`. `backend/app/api/subagent.py` exposes `POST /subagent/worktree/{create|sync|commit|merge}`, `GET /subagent/worktree/{stats|{id}/changes}`, `POST /subagent/quality/assess`, and `GET /subagent/config`; the module's `require_approved_effect()` is a hard 409 gate that returns `legacy_direct_execution_detail("approval_required")`. The `tasks` schema (`backend/app/schemas/task.py`) carries `TaskStatus` (PENDING / PLANNING / RUNNING / PAUSED / COMPLETED / FAILED / CANCELLED / REVIEWING / MERGING), `TaskType` (GENERAL / CODE_DEVELOPMENT / CODE_REVIEW / TEST_WRITING / DOC_GENERATION / CLUSTER / HYBRID), `TaskRoute` (WORKFLOW / BOUNDED_AGENT / ESCALATE), `TaskExecutionLimits` (maxSteps / maxWallTimeMs / maxModelTokens / maxEstimatedCost), `TaskContextReference` (id / version / uri), `TaskRouteDecision`, `EffectProposal`, and a `TaskRouteCredential`; `task_route_ledger.py` persists `TaskRouteDecisionRecord` (schema_version / route / reason_code / policy_version / trace_id / idempotency_key / decision_json). `WorkflowLifecycleEventPublisher` (in `workflow_event_client.py`) is the only sanctioned outbound channel to Workbench, mapping event types `started`/`progress`/`completed`/`failed`/`cancelled`/`effect_proposed`/`approval_resumed` to topics `agent.started`/`agent.progress`/...; safe event data keys are a fixed `frozenset` (`status`, `progress`, `proposalId`, `actionDigest`, `tool`, `passed`, `reasonCode`, `errorCode`). The two tokens used (`WORKFLOW_INTERNAL_EVENT_TOKEN` for dispatch, `WORKFLOW_EVENT_SINK_TOKEN` for the event sink) MUST NOT leak to the browser, ordinary MCP callers, or human sessions.

**Stage**: live platform (multi-agent + SubAgent v1.1.0 + Phase 1 capability broker).
**Canonical path**: `/Volumes/code/workspace/agent-cluster/axi-agent`.
**Repo name in git**: `axi-agent-platform` (legacy rename pending).
**Branch**: `agent/audit-fix-a06-axi-todo-*` (working tree dirty: 12 staged files in `backend/` / `frontend/` / `tools/axi-todo/`; 89 new submit logs under `docs/logs/submit/`; new `.build/` artifacts).

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Backend HTTP | Python 3.10+ / FastAPI 0.109.1 / uvicorn[standard] 0.27.0 / websockets 15.0.1 / python-multipart 0.0.30 | Lifespan-managed singleton container in `backend/app/main.py`. |
| LangChain + Swarm | langchain 1.3.4 / langchain-community 0.4.2 / langchain-openai 1.2.2 / openai 2.41.0 / openai-swarm 0.1.0 | General collaboration mode. |
| Database / memory | SQLAlchemy 2.0.25 / alembic 1.13.1 / chromadb 0.4.22 / aiosqlite 0.19.0 / greenlet 3.4.0 / numpy ≥2.0,<3.0 | Chroma long-term vector memory. |
| Schemas / config | pydantic 2.13.4 / pydantic-settings 2.14.1 / python-dotenv 1.2.2 | `TaskRouteDecision`, `GovernanceDecision`, `ExecutionPlan`, `Capability`, `TaskExecutionLimits`, etc. |
| Security | cryptography 48.0.0 / passlib[bcrypt] 1.7.4 / python-jose[cryptography] 3.5.0 | Token / credential handling. |
| Testing | pytest 9.0.3 / pytest-asyncio 0.23.3 / httpx 0.26.0 / aiofiles 23.2.1 | `backend/tests/`, `test_code_isolation_manager.py`, `test_runtime_api_smoke.py`, `test_axi_agent_mcp_client.py`. |
| Frontend dashboard | React 18 + TypeScript + Vite 6 + Tailwind 3 + Zustand 5 + Recharts 2 + React Router 6 + Lucide-React + react-icons | `frontend/src/pages/{Agents,Chat,Dashboard,Memory,Settings,SubAgent,Tasks,Tools}.tsx`; Vitest + Testing Library. |
| MCP swarm service | Node 18+ / `@modelcontextprotocol/sdk` 1.27.0 / `@types/pg` 8.16.0 / `pg` 8.18.0 / `mongodb` 7.1.0 / `redis` 6.0.0 / `zod` 3.23.0 / `dotenv` 15.0.1 / `fast-glob` 3.3.3 | Server-side tool allowlist (`manifest.json` + middleware in `src/index.ts`); tool groups: `model-routing`, `workflow`, `workspace`, `git`, `ci`, `agents`, `skills`, `governance`, `data`. |
| Terminal agent transport | Node 18+ / `commander` 15.0.0 / `ws` 8.21.0 | `infra/axi-agent-transport`: HTTP / WebSocket transport bridge. |
| Codex remote bridge | Node `--test` + bin scripts `codex-remote-bridge` + `codex-remote-bridge-manager` | Sidecar lives in `~/.antigravity_cockpit/packages/codex-remote-bridge/current/`; user config at `~/.antigravity_cockpit/codex_remote_bridge.json`; launchd at `~/Library/LaunchAgents/cn.redamancy.codex-remote-bridge.plist`. |
| Desktop shell prototype | Electron 39 + electron-builder 26 + React 19.2.1 + Vite 7 + TypeScript 5.9 | `apps/desktop-glass-ui`: macOS `Axi Agent Platform` shell; appId `com.axi.agent-platform`; productName `Axi Agent Platform`. |
| Local task ledger `axi-todo` | Node 22+ / React 19.2.3 / Vite 8 / TypeScript 6 / antd 6.4.3 / dayjs / pg 8.21.0 / `@axi/icons` (link:axi-ui) | 4 bins (`axi-todo`, `axi-todo-daemon`, `axi-todo-mcp`, `axi-todo-launchd`); `verify` = `check + test + desktop:test + frontend:typecheck + desktop:build`. |

## Project Layout

```text
axi-agent/
├── AGENTS.md                       # Root boundary, read order, request defaults, capability broker narrative
├── README.md  README.zh-CN.md      # Source (Chinese) product entry + i18n mirror
├── INDEX.md                        # Doc map and source-of-truth registry
├── CHANGELOG.md  CHANGE.md  MILESTONE.md  TODO.md
├── docker-compose.yml  .env  .env.example
├── backend/                         # FastAPI Python service (the platform)
│   ├── AGENTS.md
│   ├── Dockerfile  requirements.txt  test_logic_mock.py  test_modes.py
│   ├── axi_agent_platform.db        # SQLite (gitignored)
│   ├── chroma_db/  projects/        # Worktree root (gitignored)
│   ├── app/
│   │   ├── main.py                  # FastAPI app, lifespan, container, gateway
│   │   ├── config.py
│   │   ├── api/                     # agents, tasks, tools, memory, mcp, dashboard, gateway, workstation, subagent
│   │   ├── core/                    # agent_manager, task_scheduler, task_routing, task_route_ledger,
│   │   │                              # strategy_planner (legacy), swarm_orchestrator, memory_manager,
│   │   │                              # code_isolation_manager, axi_agent_mcp_client, capability_broker,
│   │   │                              # governance_guard, governance_runtime, workflow_event_client
│   │   ├── schemas/                 # agent, task (TaskStatus/TaskType/TaskRoute/TaskRouteDecision/EffectProposal/
│   │   │                              # TaskRouteCredential/TaskExecutionLimits/TaskContextReference),
│   │   │                              # execution_plan, governance_decision, tool, workstation
│   │   ├── models/                  # base, minimax, openai
│   │   ├── tools/                   # ToolManager + builtin tools (search/file/calc/code-exec)
│   │   └── database/                # SQLAlchemy models + VectorStore (Chroma)
│   └── tests/
├── frontend/                        # React 18 + TS dashboard (Vite + Tailwind + Recharts + Zustand)
│   ├── AGENTS.md  Dockerfile  nginx.conf
│   ├── index.html  vite.config.ts  vitest.config.ts
│   └── src/  components, hooks, pages, services, store, test, types, utils
├── apps/desktop-glass-ui/           # Electron 39 + React 19 macOS shell prototype
│   └── src/ + electron/main.cjs + release/
├── infra/
│   ├── axi-agent-mcp/               # MCP model-swarm (Node 18+), server-side tool allowlist
│   ├── axi-agent-transport/         # Terminal Claude-CLI transport (HTTP / WS), start.js + Windows split panes
│   └── codex-remote-bridge/         # Standalone sidecar (AGENTS.md / PRD.md / TDD.md / TODO.md / VERSION),
│       # Hermes patch + bin + lib (account-switch-status, accounts, app-session-runtime, app-sessions,
│       # codex-output, codex-spawn, fs-json, history, manager-core, projects, runtime-capabilities,
│       # runtime, status, workdir)
├── tools/
│   ├── axi-feishu-codex-bridge/     # Feishu-Codex bridge CLI
│   └── axi-todo/                    # Local task ledger CLI (4 bins) + Swift Package.swift desktop shell
│       ├── AGENTS.md  OWNER_DECISIONS.md  Package.swift  README.md
│       ├── Sources/  bin/  lib/  migrations/  public/  resources/  scripts/
│       └── src/  test/  docs/  dist/  dist-web/
└── docs/
    ├── ADR/  HANDOFF.md  PRD.md  TDD.md  TESTING.md  VERIFICATION.md
    ├── project-docs.manifest.json
    ├── governance/SECURITY.md
    ├── axi-todo-evidence-guardrails-test-plan.md  axi-todo-prd-continuity-design.md
    ├── state/  # PRD/TDD/CHANGELOG/TODO/MILESTONE/UPGRADE_v1.1.0 / upgrade-plan / 参考 / VERIFICATION
    ├── testing/  logs/
```

## Build & Install

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                       # fill MINIMAX_API_KEY / OPENAI_API_KEY
uvicorn app.main:app --reload              # http://127.0.0.1:8000

# Frontend dashboard
cd frontend
pnpm install
pnpm dev                                    # http://127.0.0.1:5173
pnpm build                                  # tsc + vite build

# MCP swarm
cd infra/axi-agent-mcp
pnpm install
pnpm build                                  # tsc
pnpm dev                                    # tsx src/index.ts

# Terminal agent transport
cd infra/axi-agent-transport
pnpm start                                  # start.js; --workers=2 / --workers=4
pnpm test                                   # node tests/transport-contract.test.mjs

# Codex remote bridge (sidecar)
cd infra/codex-remote-bridge
node --test test/*.test.mjs
node --check bin/codex-remote-bridge-manager.mjs
node --check lib/runtime.mjs
install --no-start

# Desktop shell
cd apps/desktop-glass-ui
pnpm install
pnpm dev
pnpm app:mac                                # electron-builder --mac dir

# Local task ledger
cd tools/axi-todo
pnpm install
pnpm verify                                 # check + test + desktop:test + frontend:typecheck + desktop:build
pnpm run check                             # syntax check all bins/lib/test
pnpm test                                  # node --test
pnpm run desktop:test                       # swift run AxiTodoStoreSmokeTests

# Whole workspace via docker-compose
docker compose up -d
```

## Verification

```bash
# Backend regression (P0)
cd backend && pytest tests/
cd backend && pytest tests/test_code_isolation_manager.py
cd backend && pytest tests/test_axi_agent_mcp_client.py
cd backend && pytest tests/test_runtime_api_smoke.py

# Smoke via uv (per docs/HANDOFF.md)
PYTHONPATH=backend uv run --python 3.12 --with-requirements backend/requirements.txt \
  python -m pytest -q \
    backend/tests/test_code_isolation_manager.py \
    backend/tests/test_runtime_api_smoke.py

# Frontend
pnpm --dir frontend build
pnpm --dir frontend test
pnpm --dir frontend typecheck

# MCP swarm
pnpm --dir infra/axi-agent-mcp test
pnpm --dir infra/axi-agent-mcp build
pnpm --dir infra/axi-agent-mcp start

# Codex remote bridge
node --test infra/codex-remote-bridge/test/*.test.mjs
plutil -lint ~/Library/LaunchAgents/cn.redamancy.codex-remote-bridge.plist

# Axi Todo
pnpm --dir tools/axi-todo verify

# Cross-project (after contract changes)
workspace-project consumers axi-agent-platform
workspace-project health axi-agent-platform
```

## Architecture Highlights

The control-flow authority is now the Workbench workflow engine, not the local `TaskScheduler`. `TaskRoute` (`backend/app/schemas/task.py`) is the typed enum: `WORKFLOW`, `BOUNDED_AGENT`, `ESCALATE`. `TaskRouteDecision` is the authoritative workflow-issued decision; historical `strategy_mode` / `TaskType` / `use_subagent_mode` are parse-compatible inputs only — they cannot select tools, loops, subagents, or execution paths. The `TaskRoutingGuard` (`backend/app/core/task_routing.py`, `POLICY_VERSION = "task-execution-routing/v1"`) is a fail-closed enforcer: `SAFE_READ_ONLY_TOOLS` (`swarm_git_status`, `swarm_validate_with_gates`) are the only safe defaults; `HARD_SIGNAL_REASONS` enumerates the seven hard rules (`commands_requested` / `write_requested` / `external_side_effect_requested` / `privilege_escalation_requested`, each duplicated as `requires_*`). A `TaskRoutingError` carries `code`, `message`, and the `TaskRouteDecision` (as `dict` via `model_dump(by_alias=True, mode="json")`). `legacy_direct_execution_detail()` returns the stable migration response `{"code": "workflow_required", "policyVersion": "task-execution-routing/v1"}`.

`backend/app/core/strategy_planner.py` is the legacy compatibility classifier: it never invokes a model or chooses tools. `analyze_task()` returns `advisoryOnly: True`, `controlFlowOwner: "workflow-engine"`, and `routeSignals` (only `pathEnumerable` / `localPathUnenumerable` / `readOnly` / `requestsCommand` / `requestsWrite` / `requestsExternalSideEffect` / `requestsPrivilegeEscalation`). `_heuristic_analysis()` returns stable advisory hints — for example "开发"/"代码"/"implement"/"feature"/"bug" maps to `recommended_type: "subagent"` with `complexity_score: 70`, but the result is never an execution instruction.

Capability Broker + Governance Guard form the second enforcement layer (Phase 1 commit 3, 2026-09-29). `backend/app/core/capability_broker.py` defines `ToolManifest` / `ToolManifestEntry`, `Capability` (one-shot, action-digest-bound, TTL-bounded), `CapabilityBroker.issue` (gate against the manifest, compute SHA-256 `action_digest`, produce a `Capability`), `CapabilityBroker.consume` (verify + atomically redeem one `max_uses` slot), and `CapabilityBroker.compute_action_digest` (canonical SHA-256 of `(tool, parameters)`). Exception hierarchy: `CapabilityError` → `UnknownToolError` / `QuarantinedToolError` / `ExpiredCapabilityError` / `ReplayIdempotencyKeyError`. `governance_runtime.py` is the process-global singleton accessor: `get_runtime_broker()` lazily builds the default manifest; `reset_runtime_broker_for_tests()` exists for tests only. `governance_guard.py` consumes an `ExecutionPlan` (typed via `EXECUTION_PLAN_SCHEMA_VERSION`) and emits a 4-state `GovernanceDecision` (allow / deny / transform / pause); for `allow` steps it attaches `decision.metadata["issued_capabilities"]` with a `capability_id` per step that the runtime hands back to `CapabilityBroker.consume` at the `ToolManager.execute_tool` / `AxiAgentMcpClient.call_tool` boundary. Wiring the boundaries is deferred to Phase 1 commit 4.

The MCP client (`backend/app/core/axi_agent_mcp_client.py`) integrates with `infra/axi-agent-mcp` over MCP stdio (`default_axi_agent_mcp_args(service_root)` prefers `dist/index.js` and falls back to `tsx src/index.ts`). `AXI_AGENT_MCP_REQUIRED_TOOLS` (`swarm_chat`, `swarm_chat_with_model`, `swarm_analyze_task`, `swarm_validate_with_gates`, `swarm_git_status`, `swarm_run_test`), `AXI_AGENT_MCP_MUTATING_TOOLS` (`swarm_write_file`, `swarm_modify_file`, `swarm_git_commit`, `swarm_git_create_branch`, `swarm_autofix_lint`, `swarm_vector_upsert`), `AXI_AGENT_MCP_WORKSTATION_SAFE_TOOLS` (`swarm_git_status`). `call_tool()` requires a `capability_id`; `broker.consume(capability_id, action_digest=..., target=name)` is the server-side check before any wire dispatch; refusal raises `CapabilityError("missing capability_id; axi_agent_mcp_client.call_tool requires broker-issued capability")`. `validate_with_quality_gates()` is the broker-checked quality-gate entry point.

SubAgent mode (v1.1.0) layers on top of the routing guard. `backend/app/core/code_isolation_manager.py` (`CodeIsolationManager`) wraps Git worktrees: `_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")` and `_BRANCH_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,191}$")` validate directory / ref names before checkout / merge / worktree; `_ensure_worktrees_excluded()` writes `<worktree-rel-path>/` into `.git/info/exclude` so the host repo never sees the worktrees. `backend/app/api/subagent.py` exposes `POST /subagent/worktree/{create|sync|commit|merge}`, `GET /subagent/worktree/{stats|{id}/changes}`, `POST /subagent/quality/assess`, `GET /subagent/config`, and a `CreateWorktreeRequest` / `SyncWorktreeRequest` / `CommitWorktreeRequest` / `MergeWorktreeRequest` / `CodeQualityAssessment` schema. The module's `require_approved_effect()` is a hard 409 gate that returns `legacy_direct_execution_detail("approval_required")` — pre-v1 direct execution is disabled across the API surface; effects MUST go through the Workbench durable approval with `APPROVED_EFFECT` single-use authorization.

`SwarmOrchestrator` (`backend/app/core/swarm_orchestrator.py`) is the general-mode hand-off orchestrator. `TaskScheduler` (`backend/app/core/task_scheduler.py`) is the unified dispatch with explicit deps: `agent_manager`, `tool_manager`, `memory_manager`, `code_isolation_manager`, `axi_agent_mcp_client`, `task_routing_guard`, `workflow_event_publisher`; it owns a `_max_parallel_agents = 8` ceiling. `AgentManager` / `AgentInstance` (`backend/app/core/agent_manager.py`) wrap a per-agent `model_connector` with status, current task, message history, and an `execute(task_input, context, tools)` method that calls `self.model.chat(...)`. `MemoryManager` (`backend/app/core/memory_manager.py`) owns `SessionMemory` (deque messages + context + created/updated timestamps). The lifecycle event publisher (`workflow_event_client.py`) is the only sanctioned outbound channel; `SAFE_EVENT_DATA_KEYS` is a fixed `frozenset` — the only data keys that may leave the platform are `status`, `progress`, `proposalId`, `actionDigest`, `tool`, `passed`, `reasonCode`, `errorCode`.

The infra layer is a set of standalone Node sidecars. `infra/axi-agent-mcp` ships `model-routing`, `workflow`, `workspace`, `git`, `ci`, `agents`, `skills`, `governance`, `data` tool groups; Phase 1 commit 5 (2026-09-29) added a server-side tool allowlist (`manifest.json` + middleware in `src/index.ts`) that rejects unallowlisted `swarm_*` tools with JSON-RPC `code = -32601` / `reasonCode = "deny_unregistered_tool"`. `infra/axi-agent-transport` (`commander` + `ws`) wraps Claude CLI in a multi-worker HTTP / WS bridge (`start: {workers: 2|4}`). `infra/codex-remote-bridge` is a standalone sidecar with `bin/codex-remote-bridge.mjs` + `bin/codex-remote-bridge-manager.mjs`, lib internals (`app-session-runtime.mjs`, `codex-spawn.mjs`, `codex-output.mjs`, `runtime-capabilities.mjs`, `runtime.mjs`, `projects.mjs`, `accounts.mjs`, `account-switch-status.mjs`, `app-sessions.mjs`, `fs-json.mjs`, `history.mjs`, `manager-core.mjs`, `status.mjs`, `workdir.mjs`); installation lives in `~/.antigravity_cockpit/packages/codex-remote-bridge/current/`, config in `~/.antigravity_cockpit/codex_remote_bridge.json`, status in `~/.antigravity_cockpit/codex_remote_bridge_status.json`, logs in `~/.antigravity_cockpit/logs/codex-remote-bridge.*.log`, launchd plist at `~/Library/LaunchAgents/cn.redamancy.codex-remote-bridge.plist`.

`tools/axi-todo` is the local persistent task ledger. Its 4 bins (`axi-todo`, `axi-todo-daemon`, `axi-todo-mcp`, `axi-todo-launchd`) are linked: `link:/Volumes/code/workspace/foundation/axi-ui/packages/icons` for `@axi/icons`; UI runs on React 19.2.3 + antd 6.4.3 + dayjs; the Swift `Package.swift` + Swift sources ship the `AxiTodoDesktop` macOS shell. `apps/desktop-glass-ui` is the Electron 39 + React 19.2.1 macOS shell prototype that packages the frontend `dist/` into `release/` via `electron-builder --mac dir` under appId `com.axi.agent-platform`.

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| FastAPI + LangChain + Swarm backend | General-mode hand-off multi-agent platform | Done |
| Chroma long-term vector memory | Persisted agent memory via `chromadb` | Done |
| `task-execution-routing/v1` | `POLICY_VERSION` + `TaskRoute` (`WORKFLOW` / `BOUNDED_AGENT` / `ESCALATE`) | Done |
| `TaskRoutingGuard` fail-closed enforcer | Hard rules before queue / model execution / every tool call | Done |
| `strategy_planner.py` legacy compatibility | `advisoryOnly: true`, `controlFlowOwner: "workflow-engine"` | Done |
| `CapabilityBroker` + `GovernanceGuard` (Phase 1 commit 3, 2026-09-29) | Action-digest-bound TTL-bounded one-shot `Capability`; 4-state `GovernanceDecision` | Done |
| MCP server-side tool allowlist (Phase 1 commit 5, 2026-09-29) | Reject unallowlisted `swarm_*` with `code = -32601` / `reasonCode = "deny_unregistered_tool"` | Done |
| MCP boundary wiring | `CapabilityBroker.consume` at `ToolManager.execute_tool` / `AxiAgentMcpClient.call_tool` | Pending (deferred to Phase 1 commit 4) |
| SubAgent v1.1.0 mode | `CodeIsolationManager` + Git worktrees + `require_approved_effect()` 409 gate | Done |
| `backend/app/api/subagent.py` REST surface | `POST /subagent/worktree/{create|sync|commit|merge}`, `GET /subagent/worktree/{stats|{id}/changes}`, `POST /subagent/quality/assess`, `GET /subagent/config` | Done |
| `WorkflowLifecycleEventPublisher` | Only sanctioned outbound channel; `SAFE_EVENT_DATA_KEYS` `frozenset` | Done |
| MCP swarm service | `infra/axi-agent-mcp` Node 18+ with `manifest.json` + middleware allowlist | Done |
| Terminal agent transport | `infra/axi-agent-transport` HTTP / WS bridge with `--workers=2\|4` | Done |
| Codex remote bridge sidecar | `infra/codex-remote-bridge` install at `~/.antigravity_cockpit/packages/codex-remote-bridge/current/` | Done |
| `tools/axi-todo` local task ledger | 4 bins + Swift `Package.swift` macOS shell + `verify` chain | Done |
| `apps/desktop-glass-ui` macOS shell | Electron 39 + React 19.2.1 packaged via electron-builder | Done |

## Notes

Axi Agent is the personal-scale, locally-runnable multi-agent collaboration platform
for the AxiomaticWorld workspace. Latest architecture pivots on the workflow-first
execution contract `task-execution-routing/v1` (`POLICY_VERSION = "task-execution-routing/v1"`). The workflow engine (Workbench durable approval side)
is the only authority allowed to turn normalized signals into a route decision —
`bounded_agent` (read-only), `workflow` (effect-issuing), or `escalate`. The
`TaskRoutingGuard` (`backend/app/core/task_routing.py`) is a fail-closed hard-rule
enforcer; `SAFE_READ_ONLY_TOOLS` (`swarm_git_status`, `swarm_validate_with_gates`)
are the only safe defaults. `CapabilityBroker` (`backend/app/core/capability_broker.py`)
issues action-digest-bound, TTL-bounded one-shot `Capability` tickets; `GovernanceGuard`
emits 4-state `GovernanceDecision` (allow/deny/transform/pause) and, for `allow`,
hands out one capability per step. `WorkflowLifecycleEventPublisher`
(`workflow_event_client.py`) is the only sanctioned outbound channel to Workbench;
`SAFE_EVENT_DATA_KEYS` is a fixed `frozenset` (`status`, `progress`, `proposalId`,
`actionDigest`, `tool`, `passed`, `reasonCode`, `errorCode`). SubAgent v1.1.0 mode
runs on Git worktrees via `CodeIsolationManager` with `_IDENTIFIER_RE` /
`_BRANCH_RE` validators and `_ensure_worktrees_excluded()`. The two tokens used
(`WORKFLOW_INTERNAL_EVENT_TOKEN` for dispatch, `WORKFLOW_EVENT_SINK_TOKEN` for
the event sink) MUST NOT leak to the browser, ordinary MCP callers, or human
sessions. MCP service rejects unallowlisted `swarm_*` tools with
`code = -32601` / `reasonCode = "deny_unregistered_tool"`; mutating tools additionally
require a `capability_id` argument.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md) — root project boundary, read order, request defaults, capability-broker narrative.
- [`README.md`](/Volumes/code/workspace/agent-cluster/axi-agent/README.md) + [`README.zh-CN.md`](/Volumes/code/workspace/agent-cluster/axi-agent/README.zh-CN.md) — source + mirror.
- [`INDEX.md`](/Volumes/code/workspace/agent-cluster/axi-agent/INDEX.md) — doc map / source-of-truth registry.
- [`docs/HANDOFF.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/HANDOFF.md) — zero-context takeover: 90-second read order, commands, environment, contracts.
- [`docs/state/PRD.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/PRD.md) — product requirements: G1–G4, FR-1..FR-8, N1–N4, AC-1..AC-5, C1–C4.
- [`docs/state/TDD.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/TDD.md), [`docs/state/TODO.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/TODO.md), [`docs/state/MILESTONE.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/MILESTONE.md), [`docs/state/UPGRADE_v1.1.0.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/UPGRADE_v1.1.0.md) (+ `.zh-CN.md`) — architecture, ledger, milestone, v1.1.0 SubAgent upgrade.
- [`docs/state/升级方案.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/升级方案.md) + `upgrade-plan.zh-CN.md` — long-form v1.x upgrade plan (source zh-CN + mirror).
- [`docs/state/参考.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/参考.md) — third-party / upstream inspiration (reference only, not source-of-truth).
- [`docs/governance/SECURITY.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/governance/SECURITY.md) — security reporting policy.
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/project-docs.manifest.json) — machine-readable doc inventory + verification policy.
- [`docs/ADR/`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/ADR/) — architectural decision records (initialised 2026-06-08).
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/VERIFICATION.md), [`docs/TESTING.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/TESTING.md) — verification + testing playbook.
- [`backend/AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/backend/AGENTS.md) — backend module boundary.
- [`frontend/AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/frontend/AGENTS.md) — frontend module boundary.
- [`infra/axi-agent-mcp/README.zh-CN.md`](/Volumes/code/workspace/agent-cluster/axi-agent/infra/axi-agent-mcp/README.zh-CN.md) — MCP swarm service surface.
- [`infra/axi-agent-mcp/docs/axi-agent-mcp-service-contract.md`](/Volumes/code/workspace/agent-cluster/axi-agent/infra/axi-agent-mcp/docs/axi-agent-mcp-service-contract.md) — cross-project boundary contract.

## Cross-References

- Workspace registration: `/Volumes/code/workspace/WORKSPACE_INDEX.md` (`agent-cluster/axi-agent`).
- Workspace JSON: `/Volumes/code/workspace/foundation/workspace-governance/workspace.json`.
- Rule module: `/Volumes/code/workspace/foundation/axi-rules/INDEX.md`.
- ADRs: `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`.
- Workflow routing contract: `/Volumes/code/workspace/foundation/axi-kernel/contracts/task-execution-routing/v1/`.
- Capability broker + governance guard spec: `backend/app/core/capability_broker.py`, `governance_guard.py`, `governance_runtime.py`, `task_routing.py`, `workflow_event_client.py`.
- SubAgent spec: `backend/app/core/code_isolation_manager.py`, `backend/app/api/subagent.py`, `docs/state/UPGRADE_v1.1.0.md`.
- Axi Todo: `tools/axi-todo/AGENTS.md`, `tools/axi-todo/OWNER_DECISIONS.md`.
- Codex remote bridge: `infra/codex-remote-bridge/AGENTS.md`.

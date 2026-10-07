---
id: axi-docs-zh-projects-axi-agent
title: Axi Agent
type: project
status: published
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Agent
graph-tags: [Projects, agent-cluster]
tags: [Axi Docs, 项目, agent-cluster, multi-agent, FastAPI, MCP, React, workflow-routing]
description: Axi Agent monorepo —— FastAPI 多智能体平台、SubAgent worktree 代码开发模式、MCP 模型集群、终端 Agent 传输、codex remote bridge 以及本地 Axi Todo 任务账本的拥有者。
project:
  id: axi-agent
  partition: agent-cluster
  path: /Volumes/code/workspace/agent-cluster/axi-agent
  source-section: core
---

# Axi Agent

> 项目根 `AGENTS.md` + `README.md` + `INDEX.md` + `docs/state/PRD.md` + `docs/HANDOFF.md` 的镜像；项目根为唯一权威。
> Source of truth:
> [`/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/README.md`](/Volumes/code/workspace/agent-cluster/axi-agent/README.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/INDEX.md`](/Volumes/code/workspace/agent-cluster/axi-agent/INDEX.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/PRD.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/PRD.md),
> [`/Volumes/code/workspace/agent-cluster/axi-agent/docs/HANDOFF.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/HANDOFF.md).
> Section: core / Partition: `agent-cluster/`。

## 概述

Axi Agent 是面向 AxiomaticWorld 工作区的、personal-scale、本地可运行的多智能体协作平台。它是以下组件的权威所有者：(1) Python FastAPI 多智能体后端，集成 OpenAI Swarm 风格 hand-off、LangChain 工具集成、Chroma 长期记忆，以及基于 Git worktree 的 SubAgent 代码开发模式；(3) Node.js MCP 模型集群服务（`infra/axi-agent-mcp`），持有 runtime 工具面并强制服务端 capability allowlist；(4) 终端 Claude-CLI 传输桥（`infra/axi-agent-transport`）；(5) Codex remote bridge sidecar（`infra/codex-remote-bridge`）；(6) 本地持久化任务账本 CLI `axi-todo`（`tools/axi-todo`）；(7) React + TypeScript dashboard 前端，加 React + Electron `desktop-glass-ui` macOS 壳原型。

最新架构围绕唯一的 workflow-first 执行契约：`task-execution-routing/v1`（`POLICY_VERSION = "task-execution-routing/v1"`）。Workflow engine（Workbench durable approval 端）是唯一被允许将归一化信号转化为路由决策的权威 —— `bounded_agent`（只读）、`workflow`（发行 effect）或 `escalate`。`backend/app/core/strategy_planner.py` 刻意保持为遗留兼容分类器，返回确定性的 advisory signal（`advisoryOnly: true`、`controlFlowOwner: "workflow-engine"`、`routeSignals`）；它绝不调用模型或选择工具。`backend/app/core/task_routing.py`（即 `TaskRoutingGuard`）是 fail-closed 的硬规则强制器，在排队、模型执行、每一次工具调用前施加硬规则。`backend/app/core/governance_guard.py` + `governance_runtime.py` + `capability_broker.py` 形成第二层：`CapabilityBroker` 签发 action-digest-bound、TTL-bounded 的 one-shot `Capability` ticket；plan 层的 `GovernanceGuard` 将 `ExecutionPlan` 评估为 4 态 `GovernanceDecision`（allow/deny/transform/pause），对 `allow` 步骤每步签发一个 capability。`backend/app/core/axi_agent_mcp_client.py` 在 MCP 工具调用边界执行同一 broker：每一次 `call_tool` 都要求 `capability_id`（Phase 1 commit 3，2026-09-29），MCP 服务本身对未在 allowlist 中的 `swarm_*` 工具以 JSON-RPC `code = -32601` / `reasonCode = "deny_unregistered_tool"` 拒绝；变更型工具额外要求 `capability_id` 参数（Phase 1 commit 5，2026-09-29）。

SubAgent 模式（v1.1.0）是承重的差异化点。`backend/app/core/code_isolation_manager.py` 管理 Git worktree —— `WorktreeInfo(path, branch, agent_id, created_at)`、`_IDENTIFIER_RE` / `_BRANCH_RE` 校验器，`_ensure_worktrees_excluded()` 用于将 `.worktrees/` 排除在宿主仓库的 `.git/info/exclude` 之外。`backend/app/api/subagent.py` 暴露 `POST /subagent/worktree/{create|sync|commit|merge}`、`GET /subagent/worktree/{stats|{id}/changes}`、`POST /subagent/quality/assess`、`GET /subagent/config`；该模块的 `require_approved_effect()` 是一个硬性 409 gate，返回 `legacy_direct_execution_detail("approval_required")`。`tasks` schema（`backend/app/schemas/task.py`）承载 `TaskStatus`（PENDING / PLANNING / RUNNING / PAUSED / COMPLETED / FAILED / CANCELLED / REVIEWING / MERGING）、`TaskType`（GENERAL / CODE_DEVELOPMENT / CODE_REVIEW / TEST_WRITING / DOC_GENERATION / CLUSTER / HYBRID）、`TaskRoute`（WORKFLOW / BOUNDED_AGENT / ESCALATE）、`TaskExecutionLimits`（maxSteps / maxWallTimeMs / maxModelTokens / maxEstimatedCost）、`TaskContextReference`（id / version / uri）、`TaskRouteDecision`、`EffectProposal` 以及 `TaskRouteCredential`；`task_route_ledger.py` 持久化 `TaskRouteDecisionRecord`（schema_version / route / reason_code / policy_version / trace_id / idempotency_key / decision_json）。`WorkflowLifecycleEventPublisher`（在 `workflow_event_client.py` 中）是唯一被允许的到 Workbench 的出站通道，将事件类型 `started`/`progress`/`completed`/`failed`/`cancelled`/`effect_proposed`/`approval_resumed` 映射到 topic `agent.started`/`agent.progress`/...；安全事件数据键是固定的 `frozenset`（`status`、`progress`、`proposalId`、`actionDigest`、`tool`、`passed`、`reasonCode`、`errorCode`）。所用的两个 token（dispatch 用 `WORKFLOW_INTERNAL_EVENT_TOKEN`，event sink 用 `WORKFLOW_EVENT_SINK_TOKEN`）**严禁**泄漏到浏览器、普通 MCP 调用方或 human session。

**当前阶段**：活跃平台（multi-agent + SubAgent v1.1.0 + Phase 1 capability broker）。
**规范路径**：`/Volumes/code/workspace/agent-cluster/axi-agent`。
**Git 仓库名**：`axi-agent-platform`（legacy rename pending）。
**分支**：`agent/audit-fix-a06-axi-todo-milestones`（工作树 dirty：`backend/` / `frontend/` / `tools/axi-todo/` 12 个 staged 文件；`docs/logs/submit/` 下 89 个新 submit log；新 `.build/` artifact）。

## 技术栈

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

## 项目结构

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

## 构建与安装

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

## 验证

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

## 架构要点

控制流权威现在是 Workbench workflow engine，而非本地 `TaskScheduler`。`TaskRoute`（`backend/app/schemas/task.py`）是类型化枚举：`WORKFLOW`、`BOUNDED_AGENT`、`ESCALATE`。`TaskRouteDecision` 是权威的 workflow 决策；历史的 `strategy_mode` / `TaskType` / `use_subagent_mode` 只是 parse-compatible 的输入 —— 它们不能选择工具、循环、subagent 或执行路径。`TaskRoutingGuard`（`backend/app/core/task_routing.py`，`POLICY_VERSION = "task-execution-routing/v1"`）是 fail-closed 强制器：`SAFE_READ_ONLY_TOOLS`（`swarm_git_status`、`swarm_validate_with_gates`）是仅有的安全默认；`HARD_SIGNAL_REASONS` 列举七条硬规则（`commands_requested` / `write_requested` / `external_side_effect_requested` / `privilege_escalation_requested`，每条重复为 `requires_*`）。`TaskRoutingError` 携带 `code`、`message` 以及 `TaskRouteDecision`（通过 `model_dump(by_alias=True, mode="json")` 作为 `dict`）。`legacy_direct_execution_detail()` 返回稳定的迁移响应 `{"code": "workflow_required", "policyVersion": "task-execution-routing/v1"}`。

`backend/app/core/strategy_planner.py` 是遗留兼容分类器：从不调用模型或选择工具。`analyze_task()` 返回 `advisoryOnly: True`、`controlFlowOwner: "workflow-engine"`，以及 `routeSignals`（仅 `pathEnumerable` / `localPathUnenumerable` / `readOnly` / `requestsCommand` / `requestsWrite` / `requestsExternalSideEffect` / `requestsPrivilegeEscalation`）。`_heuristic_analysis()` 返回稳定的 advisory hint —— 例如 "开发"/"代码"/"implement"/"feature"/"bug" 映射到 `recommended_type: "subagent"` 并带 `complexity_score: 70`，但该结果**永远不是**执行指令。

Capability Broker + Governance Guard 形成第二层 enforcement（Phase 1 commit 3，2026-09-29）。`backend/app/core/capability_broker.py` 定义 `ToolManifest` / `ToolManifestEntry`、`Capability`（one-shot、action-digest-bound、TTL-bounded）、`CapabilityBroker.issue`（对照 manifest 守门、计算 SHA-256 `action_digest`、产出 `Capability`）、`CapabilityBroker.consume`（校验并原子化地赎回一个 `max_uses` 槽位）、`CapabilityBroker.compute_action_digest`（`(tool, parameters)` 的标准 SHA-256）。异常层级：`CapabilityError` → `UnknownToolError` / `QuarantinedToolError` / `ExpiredCapabilityError` / `ReplayIdempotencyKeyError`。`governance_runtime.py` 是 process-global 单例访问器：`get_runtime_broker()` 惰性构造默认 manifest；`reset_runtime_broker_for_tests()` 仅供测试使用。`governance_guard.py` 消费一个 `ExecutionPlan`（通过 `EXECUTION_PLAN_SCHEMA_VERSION` 类型化），输出 4 态 `GovernanceDecision`（allow / deny / transform / pause）；对 `allow` 步骤，它在 `decision.metadata["issued_capabilities"]` 上为每一步附一个 `capability_id`，runtime 在 `ToolManager.execute_tool` / `AxiAgentMcpClient.call_tool` 边界把它交回给 `CapabilityBroker.consume`。把边界接起来的工作推迟到 Phase 1 commit 4。

MCP client（`backend/app/core/axi_agent_mcp_client.py`）通过 MCP stdio 与 `infra/axi-agent-mcp` 集成（`default_axi_agent_mcp_args(service_root)` 优先 `dist/index.js`，回退 `tsx src/index.ts`）。`AXI_AGENT_MCP_REQUIRED_TOOLS`（`swarm_chat`、`swarm_chat_with_model`、`swarm_analyze_task`、`swarm_validate_with_gates`、`swarm_git_status`、`swarm_run_test`），`AXI_AGENT_MCP_MUTATING_TOOLS`（`swarm_write_file`、`swarm_modify_file`、`swarm_git_commit`、`swarm_git_create_branch`、`swarm_autofix_lint`、`swarm_vector_upsert`），`AXI_AGENT_MCP_WORKSTATION_SAFE_TOOLS`（`swarm_git_status`）。`call_tool()` 要求 `capability_id`；`broker.consume(capability_id, action_digest=..., target=name)` 是任何 wire dispatch 之前的服务端校验；拒绝时抛 `CapabilityError("missing capability_id; axi_agent_mcp_client.call_tool requires broker-issued capability")`。`validate_with_quality_gates()` 是经过 broker 校验的 quality-gate 入口。

SubAgent 模式（v1.1.0）层叠在 routing guard 之上。`backend/app/core/code_isolation_manager.py`（`CodeIsolationManager`）封装 Git worktree：`_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")` 与 `_BRANCH_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,191}$")` 在 checkout / merge / worktree 之前校验目录 / ref 名；`_ensure_worktrees_excluded()` 将 `<worktree-rel-path>/` 写入 `.git/info/exclude`，让宿主仓库看不到这些 worktree。`backend/app/api/subagent.py` 暴露 `POST /subagent/worktree/{create|sync|commit|merge}`、`GET /subagent/worktree/{stats|{id}/changes}`、`POST /subagent/quality/assess`、`GET /subagent/config`，以及 `CreateWorktreeRequest` / `SyncWorktreeRequest` / `CommitWorktreeRequest` / `MergeWorktreeRequest` / `CodeQualityAssessment` schema。该模块的 `require_approved_effect()` 是一个硬性 409 gate，返回 `legacy_direct_execution_detail("approval_required")` —— v1 之前的直接执行已在 API 面禁用；effect **必须**经过 Workbench durable approval 并携带 `APPROVED_EFFECT` 一次性授权。

`SwarmOrchestrator`（`backend/app/core/swarm_orchestrator.py`）是 general-mode hand-off 编排器。`TaskScheduler`（`backend/app/core/task_scheduler.py`）是统一派发器，显式依赖：`agent_manager`、`tool_manager`、`memory_manager`、`code_isolation_manager`、`axi_agent_mcp_client`、`task_routing_guard`、`workflow_event_publisher`；它拥有 `_max_parallel_agents = 8` 上限。`AgentManager` / `AgentInstance`（`backend/app/core/agent_manager.py`）封装每个 agent 的 `model_connector`，加上 status、current task、message history，并提供调用 `self.model.chat(...)` 的 `execute(task_input, context, tools)` 方法。`MemoryManager`（`backend/app/core/memory_manager.py`）持有 `SessionMemory`（deque messages + context + created/updated timestamps）。Lifecycle event publisher（`workflow_event_client.py`）是唯一被允许的出站通道；`SAFE_EVENT_DATA_KEYS` 是固定 `frozenset` —— 唯一可离开平台的数据键是 `status`、`progress`、`proposalId`、`actionDigest`、`tool`、`passed`、`reasonCode`、`errorCode`。

Infra 层是一组独立的 Node sidecar。`infra/axi-agent-mcp` 发布 `model-routing`、`workflow`、`workspace`、`git`、`ci`、`agents`、`skills`、`governance`、`data` 工具组；Phase 1 commit 5（2026-09-29）加入服务端工具 allowlist（`manifest.json` + `src/index.ts` 中的 middleware），对未在 allowlist 中的 `swarm_*` 工具以 JSON-RPC `code = -32601` / `reasonCode = "deny_unregistered_tool"` 拒绝。`infra/axi-agent-transport`（`commander` + `ws`）将 Claude CLI 包装为多 worker 的 HTTP / WS 桥（`start: {workers: 2|4}`）。`infra/codex-remote-bridge` 是独立 sidecar，拥有 `bin/codex-remote-bridge.mjs` + `bin/codex-remote-bridge-manager.mjs`，lib internals（`app-session-runtime.mjs`、`codex-spawn.mjs`、`codex-output.mjs`、`runtime-capabilities.mjs`、`runtime.mjs`、`projects.mjs`、`accounts.mjs`、`account-switch-status.mjs`、`app-sessions.mjs`、`fs-json.mjs`、`history.mjs`、`manager-core.mjs`、`status.mjs`、`workdir.mjs`）；安装位于 `~/.antigravity_cockpit/packages/codex-remote-bridge/current/`，配置 `~/.antigravity_cockpit/codex_remote_bridge.json`，状态 `~/.antigravity_cockpit/codex_remote_bridge_status.json`，日志 `~/.antigravity_cockpit/logs/codex-remote-bridge.*.log`，launchd plist 位于 `~/Library/LaunchAgents/cn.redamancy.codex-remote-bridge.plist`。

`tools/axi-todo` 是本地持久化任务账本。它的 4 个 bin（`axi-todo`、`axi-todo-daemon`、`axi-todo-mcp`、`axi-todo-launchd`）已 link：`link:/Volumes/code/workspace/foundation/axi-ui/packages/icons`（用于 `@axi/icons`）；UI 跑在 React 19.2.3 + antd 6.4.3 + dayjs 上；Swift `Package.swift` + Swift sources 提供 `AxiTodoDesktop` macOS 壳。`apps/desktop-glass-ui` 是 Electron 39 + React 19.2.1 macOS 壳原型，通过 `electron-builder --mac dir` 在 appId `com.axi.agent-platform` 下将 frontend `dist/` 打成 `release/`。

## 关键里程碑

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| FastAPI + LangChain + Swarm backend | General-mode hand-off 多智能体平台 | 完成 |
| Chroma 长期向量记忆 | 通过 `chromadb` 持久化 agent memory | 完成 |
| `task-execution-routing/v1` | `POLICY_VERSION` + `TaskRoute`（`WORKFLOW` / `BOUNDED_AGENT` / `ESCALATE`） | 完成 |
| `TaskRoutingGuard` fail-closed 强制器 | 在排队 / 模型执行 / 每次工具调用前施加硬规则 | 完成 |
| `strategy_planner.py` 遗留兼容 | `advisoryOnly: true`、`controlFlowOwner: "workflow-engine"` | 完成 |
| `CapabilityBroker` + `GovernanceGuard`（Phase 1 commit 3，2026-09-29） | action-digest-bound、TTL-bounded one-shot `Capability`；4 态 `GovernanceDecision` | 完成 |
| MCP 服务端工具 allowlist（Phase 1 commit 5，2026-09-29） | 对未在 allowlist 中的 `swarm_*` 以 `code = -32601` / `reasonCode = "deny_unregistered_tool"` 拒绝 | 完成 |
| MCP 边界接线 | `CapabilityBroker.consume` 接入 `ToolManager.execute_tool` / `AxiAgentMcpClient.call_tool` | 待办（推迟到 Phase 1 commit 4） |
| SubAgent v1.1.0 模式 | `CodeIsolationManager` + Git worktree + `require_approved_effect()` 409 gate | 完成 |
| `backend/app/api/subagent.py` REST 面 | `POST /subagent/worktree/{create|sync|commit|merge}`、`GET /subagent/worktree/{stats|{id}/changes}`、`POST /subagent/quality/assess`、`GET /subagent/config` | 完成 |
| `WorkflowLifecycleEventPublisher` | 唯一被允许的出站通道；`SAFE_EVENT_DATA_KEYS` `frozenset` | 完成 |
| MCP swarm service | `infra/axi-agent-mcp` Node 18+ 含 `manifest.json` + middleware allowlist | 完成 |
| Terminal agent transport | `infra/axi-agent-transport` HTTP / WS 桥， `--workers=2\|4` | 完成 |
| Codex remote bridge sidecar | `infra/codex-remote-bridge` 安装到 `~/.antigravity_cockpit/packages/codex-remote-bridge/current/` | 完成 |
| `tools/axi-todo` 本地任务账本 | 4 bins + Swift `Package.swift` macOS 壳 + `verify` 链 | 完成 |
| `apps/desktop-glass-ui` macOS 壳 | 通过 electron-builder 打包的 Electron 39 + React 19.2.1 | 完成 |

## 说明

Axi Agent 是面向 AxiomaticWorld 工作区的、personal-scale、本地可运行的多智能体协作平台。最新架构围绕唯一的 workflow-first 执行契约 `task-execution-routing/v1`（`POLICY_VERSION = "task-execution-routing/v1"`）。Workflow engine（Workbench durable approval 端）是唯一被允许将归一化信号转化为路由决策的权威 —— `bounded_agent`（只读）、`workflow`（发行 effect）或 `escalate`。`TaskRoutingGuard`（`backend/app/core/task_routing.py`）是 fail-closed 的硬规则强制器；`SAFE_READ_ONLY_TOOLS`（`swarm_git_status`、`swarm_validate_with_gates`）是仅有的安全默认。`CapabilityBroker`（`backend/app/core/capability_broker.py`）签发 action-digest-bound、TTL-bounded 的 one-shot `Capability` ticket；`GovernanceGuard` 输出 4 态 `GovernanceDecision`（allow/deny/transform/pause），对 `allow` 每步签发一个 capability。`WorkflowLifecycleEventPublisher`（`workflow_event_client.py`）是唯一被允许的到 Workbench 的出站通道；`SAFE_EVENT_DATA_KEYS` 是固定 `frozenset`（`status`、`progress`、`proposalId`、`actionDigest`、`tool`、`passed`、`reasonCode`、`errorCode`）。SubAgent v1.1.0 模式通过 `CodeIsolationManager` 运行在 Git worktree 上，使用 `_IDENTIFIER_RE` / `_BRANCH_RE` 校验器和 `_ensure_worktrees_excluded()`。所用的两个 token（dispatch 用 `WORKFLOW_INTERNAL_EVENT_TOKEN`，event sink 用 `WORKFLOW_EVENT_SINK_TOKEN`）**严禁**泄漏到浏览器、普通 MCP 调用方或 human session。MCP 服务对未在 allowlist 中的 `swarm_*` 工具以 `code = -32601` / `reasonCode = "deny_unregistered_tool"` 拒绝；变更型工具额外要求 `capability_id` 参数。

## 权威文档

- [`AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/AGENTS.md) — 根项目边界、读序、request defaults、capability-broker 叙述。
- [`README.md`](/Volumes/code/workspace/agent-cluster/axi-agent/README.md) + [`README.zh-CN.md`](/Volumes/code/workspace/agent-cluster/axi-agent/README.zh-CN.md) — 源 + 镜像。
- [`INDEX.md`](/Volumes/code/workspace/agent-cluster/axi-agent/INDEX.md) — 文档地图 / 源-of-truth 注册表。
- [`docs/HANDOFF.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/HANDOFF.md) — 零上下文接手：90 秒读序、命令、环境、契约。
- [`docs/state/PRD.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/PRD.md) — 产品需求：G1–G4、FR-1..FR-8、N1–N4、AC-1..AC-5、C1–C4。
- [`docs/state/TDD.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/TDD.md)、[`docs/state/TODO.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/TODO.md)、[`docs/state/MILESTONE.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/MILESTONE.md)、[`docs/state/UPGRADE_v1.1.0.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/UPGRADE_v1.1.0.md)（+ `.zh-CN.md`）—— 架构、ledger、里程碑、v1.1.0 SubAgent 升级。
- [`docs/state/升级方案.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/升级方案.md) + `upgrade-plan.zh-CN.md` —— 长篇 v1.x 升级计划（中文源 + 镜像）。
- [`docs/state/参考.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/参考.md) —— 第三方 / 上游灵感（仅参考，非 source-of-truth）。
- [`docs/governance/SECURITY.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/governance/SECURITY.md) — 安全上报策略。
- [`docs/project-docs.manifest.json`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/project-docs.manifest.json) — 机器可读文档清单 + 验证策略。
- [`docs/ADR/`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/ADR/) — 架构决策记录（2026-06-08 初始化）。
- [`docs/VERIFICATION.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/VERIFICATION.md)、[`docs/TESTING.md`](/Volumes/code/workspace/agent-cluster/axi-agent/docs/TESTING.md) — 验证 + 测试 playbook。
- [`backend/AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/backend/AGENTS.md) — backend 模块边界。
- [`frontend/AGENTS.md`](/Volumes/code/workspace/agent-cluster/axi-agent/frontend/AGENTS.md) — frontend 模块边界。
- [`infra/axi-agent-mcp/README.zh-CN.md`](/Volumes/code/workspace/agent-cluster/axi-agent/infra/axi-agent-mcp/README.zh-CN.md) — MCP swarm service surface。
- [`infra/axi-agent-mcp/docs/axi-agent-mcp-service-contract.md`](/Volumes/code/workspace/agent-cluster/axi-agent/infra/axi-agent-mcp/docs/axi-agent-mcp-service-contract.md) — 跨项目边界契约。

## 交叉引用

- Workspace registration: `/Volumes/code/workspace/WORKSPACE_INDEX.md` (`agent-cluster/axi-agent`)。
- Workspace JSON: `/Volumes/code/workspace/foundation/workspace-governance/workspace.json`。
- Rule module: `/Volumes/code/workspace/foundation/axi-rules/INDEX.md`。
- ADRs: `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`。
- Workflow routing contract: `/Volumes/code/workspace/foundation/axi-kernel/contracts/task-execution-routing/v1/`。
- Capability broker + governance guard spec: `backend/app/core/capability_broker.py`, `governance_guard.py`, `governance_runtime.py`, `task_routing.py`, `workflow_event_client.py`。
- SubAgent spec: `backend/app/core/code_isolation_manager.py`, `backend/app/api/subagent.py`, `docs/state/UPGRADE_v1.1.0.md`。
- Axi Todo: `tools/axi-todo/AGENTS.md`, `tools/axi-todo/OWNER_DECISIONS.md`。
- Codex remote bridge: `infra/codex-remote-bridge/AGENTS.md`。

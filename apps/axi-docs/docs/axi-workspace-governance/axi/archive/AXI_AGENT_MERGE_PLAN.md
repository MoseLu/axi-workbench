# Axi Agent 功能合并方案

生成时间：2026-05-25  
范围：Axi Agent 线的 active 项目与已归档原型

## 目标

本方案不是把相似目录简单归档，而是把 Agent 相关能力收敛成清晰 owner：

- `axi-agent`：Axi Agent 平台 runtime 和 Web/API 控制面。
- `axi-agent-mcp`：Axi Agent MCP 服务层、模型路由、工具编排、质量门禁和项目分析工具。
- `axi-agent-transport`：Axi Agent terminal transport，负责本地多终端、多 Claude CLI 实例编排。
- `agent-desktop` archive：UI、chat/proxy/工具调用展示参考，不再作为 active 产品。
- `termagent` archive：Windows named-pipe 消息协议与注册发现参考。
- `agent-scripts` archive：Cursor `agent` 非交互管道、PowerShell launcher/test 参考。

## 证据摘要

| 项目 | 直接证据 | 结论 |
|---|---|---|
| `axi-agent` | README 声明多智能体协作、任务调度、记忆、React Web UI 和 SubAgent worktree 模式；`backend/app/main.py` 初始化 FastAPI、AgentManager、TaskScheduler、MemoryManager、ToolManager、CodeIsolationManager；`backend/app/api/subagent.py` 提供 worktree create/sync/changes/commit/merge/cleanup/config API | 保留为 Axi Agent runtime/API owner |
| `axi-agent-mcp` | README 声明 MCP 服务、模型自动选择、OpenAI 兼容 API；`src/index.ts` 注册 `swarm_chat`、workflow、filesystem、code search、workspace analysis、git、CI、agent recommendation、dynamic swarm、skills、quality gates、vector/cache/code store 等 43 个工具 | 保留为 MCP/tooling service owner |
| `axi-agent-transport` | `start.js` fork WebSocket orchestrator 并启动 Windows Terminal pane；`src/orchestrator.js` 维护 agent registry、message、broadcast、shutdown；`src/agent-runner.js` 通过 Claude CLI `stream-json` 注入消息并解析 `DISPATCH` / `[SEND]` / `[BROADCAST]`；仓库仍有本地修改 | 保留为 terminal transport owner |
| `agent-desktop` archive | Electron/React chat UI、ScheduledTasksPage、ChatInput、local proxy、agent tools；工具实现中绝对路径直接放行，安全边界弱于现有 Local Assistant 方向 | 只提取 UI/proxy/交互经验，不恢复 active 产品 |
| `termagent` archive | Python `MessageType` 包含 text/command/response/task/heartbeat/discover/register/broadcast/error；registry 使用临时文件和命名管道做发现、心跳、join/leave；pipe 使用 pywin32 named pipe 多实例 | 只作为 transport 协议参考，必要时合入 `axi-agent-transport` |
| `agent-scripts` archive | PowerShell + C# named pipe server，按消息调用 Cursor `agent`；Start-Agent 启动 server/client 窗口；Test-MultiTerminal 执行 echo 测试 | 只作为 Windows launcher/test 参考，必要时合入 `axi-agent-transport` |

## 目标架构

```text
Axi Agent
├── Runtime/API owner: axi-agent
│   ├── tasks / agents / memory / tools / subagent worktrees
│   └── Web console and API contracts
├── MCP service owner: axi-agent-mcp
│   ├── model routing / fallback / budget / metrics
│   ├── project tools / git / CI / workflow / skills / gates
│   └── vector/cache/code store
├── Terminal transport owner: axi-agent-transport
│   ├── Windows Terminal pane launcher
│   ├── WebSocket broker
│   └── Claude CLI stream-json runners
└── Archive-derived references
    ├── agent-desktop: UI/proxy/task scheduling reference
    ├── termagent: named-pipe message protocol reference
    └── agent-scripts: Cursor agent pipe launcher/test reference
```

## 合并任务

| 优先级 | 功能 | 来源 | Owner | 合并方式 | 验证 |
|---|---|---|---|---|---|
| P0 | Agent runtime API 边界 | `axi-agent/backend/app/main.py`、`api/*.py`、`core/*.py` | `axi-agent` | 已定义 `/api/v1/agents`、`/api/v1/tasks`、`/api/v1/memory`、`/api/v1/tools`、`/subagent/*` 为 Axi Agent 平台合同；已修复数据库导出、API import、SQLAlchemy reserved 字段和依赖约束；后续其他项目只作为客户端/工具接入 | `backend/tests/test_runtime_api_smoke.py` 已覆盖 `/`、`/health`、OpenAPI 和 agents/tasks/tools/memory/subagent 路由注册 |
| P0 | Worktree 安全治理 | `axi-agent/backend/app/core/code_isolation_manager.py`、`backend/app/api/subagent.py`、`task_scheduler.py` | `axi-agent` | 已完成 guard：`agent_id` 不再可穿越路径，branch/base/target branch 进入 git 前先校验，git cwd 限定在 base repo 或受管 `.worktrees/*`，force cleanup 拒绝非受管路径，SubAgent API 用 `asyncio.to_thread` 调用同步 manager；已新增 `dry_run`、`require_clean`、merge 前 dirty guard、受管 `.worktrees/` 本地 exclude 和真实 git merge conflict abort 行为测试 | `backend/tests/test_code_isolation_manager.py` 覆盖 path traversal、危险 branch、受管路径、cleanup 拒绝外部路径、git cwd 边界、dry-run、dirty worktree 删除拒绝、dirty base merge 拒绝、cleanup dry-run、真实 git 冲突 abort 后保持 base clean |
| P0 | MCP service 边界 | `axi-agent-mcp/src/index.ts` 43 个 tool、`src/tool-contract.ts`、`docs/axi-agent-mcp-service-contract.md` | `axi-agent-mcp` | 已把 MCP 工具分为 model-routing、workflow、workspace、git、CI、agents、skills、governance、data 组；提供给 `axi-agent` 作为外部 service，而不是复制进平台；同时修正重复注册名，推荐工作流目录改为 `swarm_list_workflow_catalog`；Vitest 改用 Rollup WASM 包避开 macOS native 签名问题，Dynamic Agent 测试改成本地 mock；`axi-agent` 已新增 stdio MCP client 和 `/api/v1/mcp/axi-agent/status` smoke API | Contract smoke 已确认 43 个注册工具都被分类；`npm run build` 已通过；`npm test` 已通过 7 个测试文件、40 个测试；平台侧 `test_axi_agent_mcp_client.py` 已通过真实 `initialize` + `tools/list` 接入 smoke |
| P0 | Workstation AgentTask 集成 | `axi-workstation/services/control-plane`、`axi-agent/backend/app/api/workstation.py`、`axi-agent-mcp` quality gate | `axi-workstation` + `axi-agent` + `axi-agent-mcp` | 已新增受限 `/api/v1/workstation/agent-tasks/quality-gate`，Workstation 只在显式 `axi-agent` 审计/质量门禁请求中创建 `runtime=axi_agent` 的受管 `AgentTask`，调用 Axi Agent Platform，再由 Platform 调用 MCP `swarm_validate_with_gates`；结果写回 Workstation artifact 与 audit，不把普通写任务静默委派给 Axi Agent | `pnpm test:workstation` 覆盖 control-plane `16/16` 与 gateway `13/13`；`backend/tests/test_workstation_agent_tasks.py` 覆盖 API 合同；`test_axi_agent_mcp_client.py` 真实调用 MCP；MossCoder fixture 已覆盖 mobile -> gateway -> Workstation -> Axi Agent -> MCP -> audit/artifact -> notify event |
| P0 | Terminal transport 合并 | `axi-agent-transport` + `termagent` archive + `agent-scripts` archive | `axi-agent-transport` | 已保留 WebSocket broker/Claude CLI runner；已用 ADR 明确从 archive 后续只吸收 heartbeat、correlation、任务 telemetry 和 PowerShell launcher/test 经验；不恢复 Python named-pipe 或独立 PowerShell pipe runtime | `npm test` 已通过 transport contract；`node -c` 已校验 start/orchestrator/runner/config 语法 |
| P1 | Agent UI / Chat shell | `agent-desktop/src/components/ui/*`、`ScheduledTasksPage.tsx`、`ChatPage.tsx` | `axi-agent` 或 `ollama-menu-assistant` | 只迁移交互模式和组件经验，不迁移弱工具权限；chat input、model selector、task scheduling 进入 owner 的 UI backlog | UI 组件截图/手动 smoke；不引入 archive 的 unsafe tools |
| P1 | Provider/model contract | `axi-agent-mcp/model-router.ts`、`agent-desktop/electron/proxy/*`、`axi-coder` proxy | Axi Coder + `axi-agent-mcp` | `axi-agent-mcp` 负责 MCP 任务级模型选择；`axi-coder` 负责本机 CLI/provider proxy；`agent-desktop` proxy 只作模型命名和格式转换参考 | 合同文档列出 request shape、fallback、secret source、diagnostics |
| P1 | Quality gates | `axi-agent-mcp/src/governance/*`、`axi-agent` Judge flow | `axi-agent-mcp` + `axi-agent` | 已接入：`axi-agent` 的 Judge/TaskScheduler 通过 MCP `swarm_validate_with_gates` 调用外部门禁；MCP 不可用时记录 local fallback，不复制门禁实现 | `test_axi_agent_mcp_client.py` 真实调用 `swarm_validate_with_gates`；`test_task_scheduler_mcp_quality.py` 覆盖 Judge flow 记录 MCP 结果与 fallback |
| P2 | Scheduling UX | `agent-desktop/ScheduledTasksPage.tsx` | `axi-agent` Web console 或 Axi Local Assistant | 仅采纳“任务提醒/周期/关机风险提示”的 UI 需求；实际调度用 `axi-agent` TaskScheduler 或 Local Assistant automation，不复用 archive 的空 UI 状态 | 创建/列表/取消任务的最小 UI 和 API 测试 |

## 不迁移/不恢复项

| 来源 | 不迁移项 | 原因 |
|---|---|---|
| `agent-desktop/electron/agent/tools/index.js` | 直接文件写入、删除、shell 工具实现 | `resolve()` 对绝对路径直接放行，不能作为 Axi 工具安全边界 |
| `agent-desktop` local active 产品形态 | 整个 Electron replica | 与 Axi Coder / Axi Local Assistant / Axi Agent 重叠，且已归档为历史参考 |
| `termagent` Python runtime | 单独恢复 Python named-pipe 包 | 没有 active 消费者；transport owner 应是 `axi-agent-transport`，只迁移协议思想 |
| `agent-scripts` PowerShell runtime | 单独恢复脚本目录为 active entrypoint | 已被 `axi-agent-transport` 的 git-backed terminal orchestration 覆盖；只迁移 launcher/test 经验 |

## 下一步实施顺序

1. `axi-agent`：worktree 安全治理、runtime API smoke、MCP service-client smoke、Judge/TaskScheduler quality gate 调用、Workstation 受管 quality-gate AgentTask smoke 已落地；后续把更多 AgentTask 类型接入同一 API 边界。
2. `axi-agent-mcp`：MCP service contract、build、Vitest 门禁、平台 stdio smoke 和 quality gate 调用路径已恢复；后续扩展更多 runtime tool 调用。
3. `axi-agent-transport`：transport ADR 和 contract test 已完成；后续实现 WebSocket heartbeat/correlation envelope 时再改运行时代码。
4. `agent-desktop` archive：只做 UI/proxy checklist，不恢复工具实现。
5. 更新 `AXI_FUNCTION_MERGE_TODO.md` 的状态，把本文件作为 Axi Agent 线的执行依据。

## 2026-05-25 执行记录

- `axi-agent/backend/app/core/code_isolation_manager.py` 已补 worktree 安全边界：受管路径、agent id、branch/base/target branch、git cwd 校验。
- `axi-agent/backend/app/api/subagent.py` 已修正同步 manager 被直接 `await` 的接口错误，改为 `asyncio.to_thread`。
- `axi-agent/backend/app/core/__init__.py` 已导出 `CodeIsolationManager`，匹配 `app.main` 的真实导入方式。
- `axi-agent/backend/app/core/code_isolation_manager.py` 和 `backend/app/api/subagent.py` 已补 `dry_run`、`require_clean`、worktree dirty check、merge 前 base/worktree dirty guard。
- 新增 `axi-agent/backend/tests/test_code_isolation_manager.py`，作为 Axi Agent runtime worktree guard 回归测试；当前覆盖 10 个安全场景，其中包含真实 git worktree merge conflict abort。
- 新增 `axi-agent/backend/tests/test_runtime_api_smoke.py`，锁定 Axi Agent runtime API 基础入口：`/`、`/health`、OpenAPI、agents/tasks/tools/memory/subagent 路由注册。
- `axi-agent/backend/requirements.txt` 已把 `openai` 提升到 `1.33.0`，同时满足 `langchain-openai==0.0.2` 与 `openai-swarm==0.1.0` 的约束。
- `axi-agent/backend/app/database/__init__.py` 已导出 `init_db/get_db`；`AgentModel` 的 SQLAlchemy 属性名从 reserved `metadata` 改为 `metadata_json`，数据库列名仍为 `metadata`。
- `axi-agent/backend/app/api/tasks.py`、`tools.py`、`main.py` 已补齐 runtime smoke 暴露出的 `Query`/`datetime` import。
- 新增 `axi-agent/backend/app/core/axi_agent_mcp_client.py` 和 `backend/app/api/mcp.py`：平台可通过 MCP stdio 启动外部 `axi-agent-mcp`，执行 `initialize`、`tools/list`，并在 `/api/v1/mcp/axi-agent/status` 暴露只读 smoke 摘要。
- `axi-agent/backend/app/core/axi_agent_mcp_client.py` 已支持 `tools/call` 和 `swarm_validate_with_gates`；`TaskScheduler` 的 Judge flow 优先调用外部 MCP quality gate，失败时记录 local fallback。
- 新增 `axi-agent/backend/app/api/workstation.py` 与 `backend/app/schemas/workstation.py`：Axi Workstation 可通过受限 `/api/v1/workstation/agent-tasks/quality-gate` 调用 Axi Agent Platform；该 API 只暴露质量门禁任务，不接管 Workstation 编排和审计存储。
- 新增 `axi-agent/backend/tests/test_axi_agent_mcp_client.py`，真实连接 `axi-agent-mcp` 并确认 43 个工具、必需工具、mutating tool guard 元数据和 `swarm_validate_with_gates` 调用。
- 新增 `axi-agent/backend/tests/test_task_scheduler_mcp_quality.py`，覆盖 Judge flow 写入 MCP quality assessment 与 MCP 不可用 fallback。
- 新增 `axi-agent/backend/tests/test_workstation_agent_tasks.py`，锁定 Workstation -> Axi Agent Platform -> Axi Agent MCP 的质量门禁 API 合同。
- `test_modes.py` 仍依赖完整后端依赖链；裸 Python 与轻量依赖下分别卡在 `pydantic_settings`、`httpx`、`openai`，本轮未用它作为通过门禁。
- `axi-agent-mcp` 已由本地 `infra/mcp-swarm` 迁名而来，package/service/docs 使用 Axi 命名；remote 暂不改名。
- `axi-agent-mcp/src/tool-contract.ts` 已建立 9 个 runtime tool group 和 43 个工具的 contract；`src/tool-contract.test.ts` 负责防重复注册和漏分组。
- `axi-agent-mcp/docs/axi-agent-mcp-service-contract.md` 已写明 `axi-agent` 只能通过 MCP 消费这些能力，不能复制实现。
- `axi-agent-mcp` build 门禁已修复：`tsconfig.json` 排除 disabled DB 代码和 `*.test.ts`，`src/api-client.ts` 补 `tokens` 字段，`src/agents/dynamic-agent.ts` 修正 logger error 参数。
- `axi-agent-mcp/package.json` 已把 `rollup` 固定为 `npm:@rollup/wasm-node`，避开 macOS native optional dependency 签名问题；`src/agents/dynamic-agent.test.ts` 已改成本地 mock，单测不再访问外部模型接口。
- `axi-agent-mcp` 验证已通过：`npm test` 7 个测试文件、40 个测试通过；`npm run build`、`npx tsc --noEmit ... src/tool-contract*` 和 `node --import tsx` contract smoke 均通过。
- `axi-agent-transport` 已由本地 `agent/multi-agent` 迁名而来，package/start banner/README 使用 Axi 命名；remote 暂不改名。
- `axi-agent-transport/docs/adr/0001-axi-agent-transport.md` 已明确：保留 Node/WebSocket/Claude CLI transport，不恢复 `termagent` Python named-pipe runtime，也不恢复 `agent-scripts` 独立 PowerShell pipe runtime。
- `axi-agent-transport/tests/transport-contract.test.mjs` 已锁定 archive-derived 决策文本，避免后续把 archive 当 active runtime 恢复。
- `axi-workstation/services/control-plane/src/control-plane.mjs` 已新增 `axi_agent` runtime；显式 Axi Agent 质量/审计请求会创建受管 `AgentTask`，调用 Axi Agent Platform，生成 `axi-agent-task.json` artifact 与 audit report。
- `axi-workstation/services/communication-gateway/test/envelopes.test.mjs` 已新增 MossCoder/Axi Mobile fixture：mobile -> gateway -> Workstation -> Axi Agent -> MCP -> audit/artifact -> terminal notify event。

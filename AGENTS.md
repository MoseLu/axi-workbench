# Axi Workbench — 项目根级 AGENTS

> 本文件是 **Axi Workbench 仓库根级** AGENTS，是进入本仓库的 agent 第一站。
> 工作台下的应用（`apps/*`）、服务（`services/*`）、共享包（`packages/*`）、工具（`tools/axi-app-cli/`）均有各自的子级 `AGENTS.md`；本文件不重复子目录的细节，只描述「**项目门面 + 跨项目边界 + 六层控制面（Six-Layer Control Plane）**」的运行约束。
> **两者的关系：根级 AGENTS = 跨项目边界与六层 SOP；`apps/AGENTS.md` / `services/AGENTS.md` / `packages/AGENTS.md` / `tools/AGENTS.md` / `prompts/AGENTS.md` / `ai/AGENTS.md` = 子树内部实现与契约。** 修改 `apps/` `services/` `packages/` `tools/` `ai/` `prompts/` 任一子树前，先读对应子树的 `AGENTS.md`；任何对仓库结构、跨项目契约、六层控制面边界的判断先读本文件。

*最后更新：2026-06-07 — 在保留 2026-05-30 手工维护的六层 SOP 之上，补强 Authoritative Sources / Cross-Project Boundary / Verification / House Rules 段，由 workspace-docs-gap 子代理 W1 落地。*

---

## Scope

- **适用对象**：所有 agent（包括 Codex、Cursor、自动化扫描器、文档巡检子代理、OMX 编排器）首次接触 `/Volumes/code/workspace/projects/axi-workbench` 时。
- **不适用对象**：
  - `tools/axi-app-cli/packages/*/README.md` 等子包内的安装 / 路径示例（**只引顶层** `tools/axi-app-cli/AGENTS.md` / `README.md`，避免误把子包的 Windows / macOS 路径示例与本地构建路径混淆）。
  - `references/*`、`infra/axi-workspace-governance/references/*`、`infra/axi-workspace-governance/temp/*`（其治理在 `infra/axi-workspace-governance/`，见「Cross-Project Boundary」）。
  - `node_modules/`、`dist/`、`build/`、`.turbo/`、`.omx/`、`.codegraph/`、`.git/` 等运行时 / 构建 / 编排器状态。
- **阅读顺序**：本文件 → 子树 `AGENTS.md`（若要改 `apps/` `services/` `packages/` `tools/` `ai/` `prompts/` 任一子树）→ `docs/rules/epap-six-layer-sop.md`（若要改六层控制面边界）→ `docs/rules/epap-project-doc-agent-sop.md`（若要改项目文档系统）。

---

## Project Boundary

Axi Workbench 是 **「AxiomaticWorld（公理世界）工作台」**，是 Axi 工作台大项目的权威 owner。它由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成，承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。远端仓库名与少量 `EPAP_*`/`@epap/*` 兼容入口在迁移验证完成前保留。

**项目边界**（即本 agent 的修改半径）：

| 路径 | 是否项目内 | 说明 |
|------|------------|------|
| `apps/` | 是 | 6 个 Dashboard Apps（web-portal / devsvc-dashboard / axi-coder / verification-inbox / app-search-system / ollama-menu-assistant），子树 `apps/AGENTS.md` 详述 |
| `services/` | 是 | 8 个微服务（api-gateway / auth-service / core-service / file-service / notification-service / communication-gateway / control-plane / workflow-engine），子树 `services/AGENTS.md` 详述 |
| `packages/` | 是 | 8 个共享包（api-client / axi-rag / desktop / schemas / epap-schemas-compat / types / ui / utils / web），子树 `packages/AGENTS.md` 详述 |
| `tools/axi-app-cli/` | 是 | Axi 应用脚手架 CLI（独立子 monorepo），以 `tools/axi-app-cli/AGENTS.md` / `README.md` 为权威入口；**不引用**子包内 `README.md` |
| `ai/` | 是 | 知识库 / Agent Platform 集成层（`ai/AGENTS.md`） |
| `prompts/` | 是 | Prompt 分层底座（system / global / projects），`prompts/AGENTS.md` 与 `prompts/README.md` 详述 |
| `docs/` | 是 | 项目文档（`01-overview.md` ~ `08-todo.md`、`rules/`、`templates/`、`project-docs.manifest.json`） |
| `infra/fleet-console/` | 是 | Fleet Console 物理服务管理 |
| `AGENTS.md`, `README.md`, `SECURITY.md`, `Makefile`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml` | 是 | 根级项目门面与构建编排 |
| `references/*`（工作区级） | 否 | 由 `infra/axi-workspace-governance/` 治理，本项目不翻译、不编辑 |
| `infra/axi-workspace-governance/` | 否 | 工作区治理仓库，不在本项目所有权内 |
| `node_modules/`, `dist/`, `build/`, `.turbo/`, `.omx/`, `.codegraph/` | 否 | 运行时 / 构建 / 编排器状态，不进 commit |

**不要**把 `references/*` 或 `infra/axi-workspace-governance/` 的内容当作本项目的可写范围。

---

## Authoritative Sources

| 议题 | 权威来源 |
|------|----------|
| 项目入口与当前结构 | [`README.md`](README.md) |
| 安全策略 | [`SECURITY.md`](SECURITY.md) |
| 六层控制面边界与运行 SOP | [`docs/rules/epap-six-layer-sop.md`](docs/rules/epap-six-layer-sop.md) |
| Workbench 聚合边界与反耦合规则 | [`docs/rules/axi-workbench-boundary-sop.md`](docs/rules/axi-workbench-boundary-sop.md) |
| 项目文档系统 SOP | [`docs/rules/epap-project-doc-agent-sop.md`](docs/rules/epap-project-doc-agent-sop.md) |
| Prompt 分层（system / global / projects） | `prompts/README.md`、[`prompts/AGENTS.md`](prompts/AGENTS.md)、`prompts/prompt-layer.manifest.json` |
| 子树内部实现与契约 | `apps/AGENTS.md`、`services/AGENTS.md`、`packages/AGENTS.md`、`tools/AGENTS.md`、`ai/AGENTS.md` |
| Axi App CLI 脚手架（独立子 monorepo） | [`tools/axi-app-cli/AGENTS.md`](tools/axi-app-cli/AGENTS.md)、[`tools/axi-app-cli/README.md`](tools/axi-app-cli/README.md) |
| 可执行脚本与包边界 | `package.json`、`pnpm-workspace.yaml`、各子包 `package.json`、`turbo.json` |
| 文档清单与责任归属 | [`docs/project-docs.manifest.json`](docs/project-docs.manifest.json)（status: legacy，详见 House Rules §「manifest 状态说明」） |
| 工作区关系与验证 | `/Volumes/code/workspace/WORKSPACE_INDEX.md`、`/Volumes/code/workspace/workspace.graph.json` |

> **优先级冲突时**：根级 `AGENTS.md` > `docs/rules/epap-six-layer-sop.md` > 子树 `AGENTS.md` > `prompts/` 分层 > 个人记忆。
> 跨工作区引用冲突时，工作区根 `AGENTS.md` > 治理镜像 > 本项目根 `AGENTS.md`。

---

## Cross-Project Boundary

- **不翻译**：`references/*`、`references/archives/*`、`infra/axi-workspace-governance/references/*`、`infra/axi-workspace-governance/temp/*`。
- **不复制内容到本项目**：工作区其他项目的 README、AGENTS、ADR 都不应被原样搬入 `docs/`。本项目只承载「Axi Workbench 自身」的 8 份产品文档（`01-overview.md` ~ `08-todo.md`）+ 规则 + 模板。
- **不假装是源**：`docs/rules/epap-six-layer-sop.md` 等规则文件已迁移到本仓库；治理侧若再出现同名文件，应回写到本仓库并重新生成镜像。
- **可消费**：通过 workspace graph（`workspace-project`）查询 `axi-workbench` 的 `consumes` / `consumers` / `provides` / `contracts`；不要在业务代码里硬编码跨项目绝对路径。
- **可被消费**：本项目以 `IMEnvelope` / `AgentTask` 协议、`@axi/workstation-control-plane` 等共享包、Dashboard Apps `pnpm typecheck` 验证入口形式对外提供工作台能力；下游消费者（其他 Axi Dashboard Apps、AI 代理、CC-Connect）应通过这些契约入口接入。

### 跨工作区反链接（必引，根 AGENTS 收录清单）

执行版总览要求：补齐 owner 项目 ROOT_AGENTS 时必须回填跨工作区反链接，使任意一处的修改都能被其它项目检索到。

- 根工作区索引：[`/Volumes/code/workspace/AGENTS.md`](/Volumes/code/workspace/AGENTS.md)、[`/Volumes/code/workspace/WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md)（Axi Workbench 行）
- 命名与品牌：[`/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`](/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md)
- DevSvc / PM2 服务编排：[`/Volumes/code/workspace/docs/DEV_SERVICES.md`](/Volumes/code/workspace/docs/DEV_SERVICES.md)、[`/Volumes/code/workspace/dev-services.config.json`](/Volumes/code/workspace/dev-services.config.json)
- 治理仓库：[`/Volumes/code/workspace/infra/axi-workspace-governance/`](infra/axi-workspace-governance/)（本仓库引用，不写入）+ [`infra/axi-workspace-governance/docs/project-catalog.md`](/Volumes/code/workspace/infra/axi-workspace-governance/docs/project-catalog.md)
- 治理 PR 模板与发布流程：[`/Volumes/code/workspace/infra/axi-workspace-governance/.github/PULL_REQUEST_TEMPLATE.md`](/Volumes/code/workspace/infra/axi-workspace-governance/.github/PULL_REQUEST_TEMPLATE.md)、[`/Volumes/code/workspace/infra/axi-workspace-governance/docs/RELEASING.md`](/Volumes/code/workspace/infra/axi-workspace-governance/docs/RELEASING.md)
- 工作区级 i18n 总览与缺口审计：[`/Volumes/code/workspace/docs/audit/workspace-i18n-translation-2026-06-07.md`](/Volumes/code/workspace/docs/audit/workspace-i18n-translation-2026-06-07.md)、[`/Volumes/code/workspace/docs/audit/workspace-docs-gap-audit-2026-06-07.md`](/Volumes/code/workspace/docs/audit/workspace-docs-gap-audit-2026-06-07.md)
- 工作区图谱 CLI：[`/Volumes/code/workspace/scripts/workspace-project`](/Volumes/code/workspace/scripts/workspace-project)（`deps axi-workbench` / `consumers axi-workbench` / `validate`）
- 邻居项目（被本工作台控制面消费）：`/Volumes/code/workspace/projects/axi-notify/`、`/Volumes/code/workspace/projects/axi-pet/`、`/Volumes/code/workspace/projects/axi-agent-platform/`、`/Volumes/code/workspace/projects/axi-docs/`、`/Volumes/code/workspace/projects/axi-image-preview/`、`/Volumes/code/workspace/shared/axi-ui/`、`/Volumes/code/workspace/shared/axi-registry/`、`/Volumes/code/workspace/tools/axi-app-cli/`

---

## Verification

最小验证序列（来自工作区索引 `WORKSPACE_INDEX.md` Axi Workbench 行）：

```bash
# 跨项目契约与图谱完整性
/Volumes/code/workspace/scripts/workspace-project validate

# 整库默认类型检查
pnpm type-check

# 整库默认测试
pnpm test

# 控制面合同测试
pnpm test:workstation

# DevSvc Dashboard
pnpm --dir apps/devsvc-dashboard typecheck

# Axi Coder
pnpm --dir apps/axi-coder typecheck

# Verification Inbox
npm --prefix apps/verification-inbox run typecheck

# Fleet Console
python3 infra/fleet-console/scripts/fleetctl.py validate
```

变更驱动的最小验证选择：

- 改 `apps/<x>/**` → 跑 `apps/<x>` 的最小验证（`typecheck` / `test`），再视改动范围跑 `pnpm test:workstation`。
- 改 `services/<x>/**` → 跑对应服务的 `go test` / `mvn test` / `pytest` 入口。
- 改 `packages/<x>/**`（尤其 `epap-schemas-compat`）→ 跑 `pnpm type-check` + 至少一个下游 app 的 `typecheck`。
- 改 `tools/axi-app-cli/**` → 跑 `pnpm --dir tools/axi-app-cli boundaries:check` + `pnpm --dir tools/axi-app-cli capabilities:check`。
- 改 `prompts/**` → 跑 `prompts/AGENTS.md` 与 `prompts/README.md` 所列分层校验；不要为生成 AGENTS 终止会话或强制覆盖用户内容。
- 改 `docs/rules/*` 或本文件 → 不需构建；保证文件存在性 + 反链接不被破链。
- 跨项目共享契约（`@axi/workstation-*` 包）→ 跑 `workspace-project consumers axi-workbench` 列出的所有消费者的最小验证。

---

## 工作区入口（保留 2026-05-30 段）

- 当前项目根：`/Volumes/code/workspace/projects/axi-workbench`。
- 上级工作区规则：`/Volumes/code/workspace/AGENTS.md`。
- 工作区索引：`/Volumes/code/workspace/WORKSPACE_INDEX.md`。
- 工作区关系图：`/Volumes/code/workspace/workspace.graph.json`。
- 跨项目修改前，先用 `/Volumes/code/workspace/scripts/workspace-project deps axi-workbench` 或 `/Volumes/code/workspace/scripts/workspace-project consumers <project>` 确认 provider/consumer 边界。
- 不要把 `/Volumes/code/workspace` 当成一个统一 monorepo；按索引进入真实 owner 项目后再读最近的 `AGENTS.md`。

## 规范运行模型（六层控制面）

所有 IM、通信、项目管理、AgentTask、记忆、文档和基础能力相关工作，统一使用 Axi Workbench 六层控制面模型：

1. **IM 层**（IM Layer）：只负责用户输入和消息展示。
2. **通信层**（Communication Layer）：只负责 route 绑定、配对、审批、附件引用、幂等、回执和渠道渲染。
3. **软件层**（Software Layer）：拥有项目、服务、工作流、AgentTask、运行时会话和项目状态。
4. **基础服务层**（Base Service Layer）：拥有记忆库、文档库、文件库、审计库、工具注册表、MCP/skills、本地模型/浏览器/运行时能力目录。
5. **物理服务层**（Physical Service Layer）：拥有机器、设备、端口、磁盘、进程、网络资源。物理资源永远不拥有项目。
6. **外接能力层**（External Capability Layer）：拥有第三方 API、远端模型服务和远端 agent 服务。

> 架构文档中的旧产品技术栈分层只作为历史设计说明；控制面运行决策以 [`docs/rules/epap-six-layer-sop.md`](docs/rules/epap-six-layer-sop.md) 为准。

## 强制边界（六层控制面）

- IM adapter **不得**执行业务逻辑，**不得**读取项目目录。
- communication-gateway **不得**调用 Codex，**不得**读取工作区索引，**不得**查询记忆表，**不得**拥有项目状态。
- control-plane 的业务输入必须来自标准 `IMEnvelope` 或类型化控制 API。
- Agent 执行必须表示为软件层受管 `AgentTask`。
- memory、docs、files、audit、tool registry、capability catalog 都属于基础服务层。
- 服务器、ADB 设备、端口、进程、主机健康只属于物理服务层。
- 第三方 API 和远端 agent 只属于外接能力层。
- **不得**用 hook 作为 Axi Workbench 运行时旁路。

## 必须执行的 SOP

- 新增或修改控制面工作流前，先检查 [`docs/rules/epap-six-layer-sop.md`](docs/rules/epap-six-layer-sop.md)。
- 新增或修改 agent 行为、输出风格、默认工作方式前，先检查 [`prompts/README.md`](prompts/README.md) 和三层 prompt：
  - `prompts/system/*.mdc`：不可变底座。
  - `prompts/global/*.mdc`：所有项目通用。
  - `prompts/projects/*.mdc`：特定项目补充。
- 新增或修改项目文档系统前，先检查 [`docs/rules/epap-project-doc-agent-sop.md`](docs/rules/epap-project-doc-agent-sop.md)。
- 每个工作流必须声明：入口层 / 权威事实源 / 允许访问的下游层 / 输出渲染器 / 审计产物 / 验证路径。

测试用户可见行为时，使用分层验证梯：

1. API 级确定性测试。
2. 控制面审计检查。
3. 涉及 UI 时，用 Codex 浏览器或 Chrome 做视觉/产品体验检查。
4. 声称真实用户操作可用时，用 `computer-use` 或设备级验证。

---

## House Rules

- **不要**把 OMX 内部状态（`.omx/metrics.json`、`.omx/state/subagent-tracking.json`、`.omx/state/tmux-hook-state.json`、`.omx/state/session.json` 等）写入 commit。
- **不要**把 Codex/Cursor 会话目录（`.codegraph/`、agent transcripts 文件夹、`.cursor/projects/.../terminals/`）写入 commit。
- **不要**把 `.omx/` 整体加入版本控制（仅允许 `.omx/config/` 之类的显式配置例外）。
- **不要**在没有 owner 显式指令的情况下合并到 `main`、推送标签、删除远程分支、发布正式 release。
- **不要**把 `references/*` 或 `infra/axi-workspace-governance/` 的内容当作本项目可写范围。
- **不要**把邻居项目的实现代码、绝对路径或私有 schema 引入 Workbench runtime；新增跨项目能力前先走 [`docs/rules/axi-workbench-boundary-sop.md`](docs/rules/axi-workbench-boundary-sop.md) 并运行 `pnpm check:boundaries`。
- **不要**直接引用 `tools/axi-app-cli/packages/*/README.md` 等子包内安装 / 路径示例，只引顶层 `tools/axi-app-cli/AGENTS.md` / `tools/axi-app-cli/README.md`。
- **不要**复述任何硬编码 JWT / API key / 个人邮箱；如遇字面 token，**脱敏为 `Bearer <REDACTED>` 占位**。
- **要**保持根级 `AGENTS.md` 与 6 份子树 `AGENTS.md`（`apps/` `services/` `packages/` `tools/` `ai/` `prompts/`）的双层结构：根级谈边界与六层 SOP，子树谈实现与契约。
- **要**在改动跨项目契约前先查 `/Volumes/code/workspace/scripts/workspace-project consumers axi-workbench`。
- **要**保持 `git clone <url>` 类占位符原文，不替换为本地绝对路径。

### manifest 状态说明

`docs/project-docs.manifest.json` 的 `status: legacy` 表示：本仓库的 `CHANGELOG.md` / `TODO.md` / `MILESTONE.md` 等根级门面文件**尚未补齐**（参见 `docs/audit/workspace-docs-gap-audit-2026-06-07.md` §2.1 P0 清单）。Owner 决定补齐顺序前，本仓库的可审计变更请**直接走 commit 记录 + `docs/08-todo.md`**，不依赖 manifest 列出的根级门面文件。

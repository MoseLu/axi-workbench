# Axi Workbench — Architecture

> 状态：Active mirror + index; 最后刷新 2026-10-16。
> 这是 `Axi Workbench` 仓库的根级架构门面 (P2 engineering doc),与 [`AGENTS.md`](./AGENTS.md) 的项目边界与六层 SOP 互为镜像。
> 本文件**不复制** [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md) 和 [`docs/00-product-overview.md`](./docs/00-product-overview.md) 的内容,只做"门面 + 索引 + 跨组件关系"。
> 当以下事实发生变化时,只改权威源:
>
> - 源码角色 / workspace membership / 主入口 → [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md)
> - 产品矩阵 / 端口 / 设计原则 → [`docs/00-product-overview.md`](./docs/00-product-overview.md)
> - 项目边界 / 六层 SOP / 反链接 → [`AGENTS.md`](./AGENTS.md)
> - 重大决策 → [`docs/adr/`](./docs/adr/)

---

## 1. Overview

`Axi Workbench` 是 **AxiomaticWorld(公理世界)工作台**,承担 Axi 工作台大项目的权威 owner;由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成。

它不是一个单体应用,而是一套**多前端、多后端、多 AI 能力协同**的工作空间生态系统:统一的 monorepo(pnpm workspace + Turborepo)框架下,承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。

仓库对外通过以下契约暴露能力(详见 [`AGENTS.md` §Relationship Metadata](./AGENTS.md#relationship-metadata)):

- **IMEnvelope** 协议:`services/communication-gateway/`
- **AgentTask** 协议:`services/control-plane/` + `services/workflow-engine/`
- **Workstation control plane**: `@axi/workstation-control-plane` 等共享包
- **Dashboard apps**: `apps/workbench/` / `apps/workbench-mobile/` / `apps/workbench-desktop/` / `apps/devsvc-dashboard/`
- **Workspace entry render host**(2026-09-24 起):消费 `axi-kernel` 与 `axi-workbench-cli`,**只读不持久化事实**。

---

## 2. Six-Layer Control Plane(强制运行模型)

所有 IM、通信、项目管理、AgentTask、记忆、文档和基础能力相关工作统一遵循 **Axi Workbench 六层控制面模型**。权威 SOP 见 [`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md)。

| 层 | 职责 | 本仓库归属 | 严禁行为 |
|---|---|---|---|
| **L1 IM 层** | 用户输入和消息展示 | `apps/workbench/`、`apps/workbench-mobile/`、`apps/axi-coder/`、`apps/verification-inbox/`、`apps/axi-docs/` | 执行业务逻辑;读取项目目录 |
| **L2 通信层** | route 绑定、配对、审批、附件引用、幂等、回执和渠道渲染 | `services/communication-gateway/`、Gateway 的 `X-Axi-Subject` / `X-Axi-Tenant` 中间件 | 调用 Codex;读取工作区索引;查询记忆表;拥有项目状态 |
| **L3 软件层** | 项目、服务、工作流、AgentTask、运行时会话和项目状态 | `services/control-plane/`、`services/workflow-engine/`、`services/platform-core/`、`apps/workbench/`、`apps/workbench-mobile/` | 物理资源直接归属;第三方 API 直连 |
| **L4 基础服务层** | 记忆库、文档库、文件库、审计库、工具注册表、MCP/skills、本地模型/浏览器/运行时能力目录 | `services/file-service/`、`ai/agent-platform/`、`ai/knowledge-base/`、`backend/`、控制面的 docs/files/audit 子域 | 拥有项目;直接读取物理资源 |
| **L5 物理服务层** | 机器、设备、端口、磁盘、进程、网络资源 | `infra/fleet-console/`、`apps/ollama-menu-assistant/`、Host 启动器 | 物理资源**永远不拥有项目**;`backend/` 与外部进程归此层 |
| **L6 外接能力层** | 第三方 API、远端模型服务和远端 agent 服务 | `services/api-gateway/` 的上游代理、`@axi/api-client` 的 fetch 出口、ZITADEL/AI Gateway 等外部依赖 | 拥有项目状态;直接修改工作区事实源 |

**强约束**:

- control-plane 的业务输入必须来自标准 `IMEnvelope` 或类型化控制 API。
- Agent 执行必须表示为软件层受管 `AgentTask`。
- **不得**用 hook 作为 Axi Workbench 运行时旁路。
- 架构文档中的旧产品技术栈分层只作为历史设计说明;控制面运行决策以 [`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md) 为准。

新增或修改控制面工作流前,先检查 [`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md);每个工作流必须声明:入口层 / 权威事实源 / 允许访问的下游层 / 输出渲染器 / 审计产物 / 验证路径。

---

## 3. Source-Catalog Pointer

物理源码角色、workspace membership、主入口、Host 注册表、根 `pnpm` 实际边界、共享层与迁移边界,**全部以 [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md) 为权威**。本节只给出目录指针,不在此重写角色清单。

```text
物理源码拓扑(摘要,见 source-catalog.md)
├── apps/                  ← 用户端 + Host + Hosted 子应用 + 垂直工具
├── services/              ← 生产 Go / Python / Node 后端平面
├── packages/              ← 共享包(api-client / schemas / workbench-foundation / epap-schemas-compat 等)
├── ai/                    ← Agent Platform + 知识库
├── prompts/               ← system / global / projects 三层 prompt
├── tools/axi-app-cli/     ← 应用脚手架 CLI(独立子 monorepo)
├── backend/               ← 嵌入式 Python runtime(非根 pnpm member)
├── infra/fleet-console/   ← Fleet Console 物理服务管理
├── infra/helm/            ← Helm chart(axi-workbench-platform 部署单元)
└── docs/                  ← 项目文档 + 规则 + ADR
```

新人 / agent 阅读顺序(来自 `source-catalog.md`):

```text
AGENTS.md
  -> README.md + INDEX.md
  -> docs/architecture/source-catalog.md(本节指向)
  -> 目标子树 AGENTS.md
  -> 目标目录 package.json / pyproject.toml / Package.swift / Host registry
  -> 对应的最小验证命令
```

源码角色、根 workspace membership、主入口或 Host 注册发生变化时,**只改 [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md)**;本文件保留目录级指针与跨组件关系。

---

## 4. Apps Subprojects(用户端 + Host + 已吸收应用)

Axi Workbench 下 `apps/*` 是混合源码树,既包含真正的用户端,也有 Host 与已吸收的垂直工具。逐项物理清单见 [`docs/architecture/source-catalog.md` §源码角色与入口](./docs/architecture/source-catalog.md),本节按产品角色归纳。

### 4.1 用户端(独立客户端)

| 子应用 | 路径 | 形态 | 角色 |
|---|---|---|---|
| Workbench Web | `apps/workbench` | React 18 + TS + Vite + Axi UI | 唯一 Web 管理控制中心;Dashboard Chrome、侧栏、标签、设置以及 C 级复杂管理 / 治理只属于这里 |
| Workbench Mobile | `apps/workbench-mobile`(Web + Capacitor/Android) | React 18 + TS + Vite + Capacitor | 唯一移动角色执行 / 辅助端;Web 与原生 Android 共享产品契约和 API 边界,各自维护独立 UI 实现 |
| Workbench Desktop | `apps/workbench-desktop` | Tauri 2 | 桌面分发(已构建,统一构建流程由 `pnpm verify:ci` 驱动) |

Web 与 Mobile **共享**认证、API 合同、语言偏好、设计令牌和 `@axi/workbench-foundation`;**不共享**页面与布局实现。

### 4.2 Host / 运维壳

| 子应用 | 路径 | 角色 |
|---|---|---|
| DevSvc Dashboard | `apps/devsvc-dashboard` | 本地服务管理和 Axi 应用 Host;挂载表见 `config/axi-apps.json`;**不是**第三个用户门户 |

### 4.3 已吸收 / Hosted 子应用(垂直工具)

| 子应用 | 路径 | 形态 | 角色 |
|---|---|---|---|
| Axi Coder | `apps/axi-coder` | React + TS + Tauri/Rust | Hosted 编码工具;被 Host 挂载 |
| Verification Inbox | `apps/verification-inbox` | React + TS + Tauri/Python | Hosted OTP / IMAP 工具;真实邮箱能力由 Tauri/Python 边界承载 |
| Axi Docs | `apps/axi-docs` | React + Vite | 已吸收的文档产品与文档门户(MCP 文档搜索面);canonical rule router = [`../../foundation/axi-rules/INDEX.md`](../../foundation/axi-rules/INDEX.md) |
| Resource Orchestration | `apps/resource-orchestration/` | — | 资源网关 UI |
| Fleet Dashboard | `infra/fleet-console/dashboard` | React + Python `fleetctl` | 物理服务层 Dashboard;由 Host 注册,但不属于 `apps/*` 根包集合 |
| App Search | `apps/app-search-system` | React + Electron + Python | 嵌入式多运行时垂直工具;内部 `frontend` / Electron / Python backend 各自有运行边界,生命周期待补齐 |
| Ollama Menu Assistant | `apps/ollama-menu-assistant` | Swift Package | macOS 菜单助手;原生垂直工具,不是 Node Dashboard |
| Axi Artboard | `apps/axi-artboard` | — | Agent 节点选择器(node-picker overlay) |

### 4.4 应用脚手架

| 子应用 | 路径 | 角色 |
|---|---|---|
| Axi App CLI | `tools/axi-app-cli` | 应用脚手架 CLI;**独立子 monorepo**(内部另有 workspace);权威入口是 `tools/axi-app-cli/AGENTS.md` / `README.md`,**不引用**子包内 README |

> 任何新增用户入口必须先证明它**不是** Web / Mobile / Host 的重复实现,并同步 [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md)、对应子树 `AGENTS.md`、manifest 和验证命令。

---

## 5. Services(后端平面)

后端平面在 `services/*` 下;不要按目录数量把它们视为同一运行时,详见 [`services/AGENTS.md`](./services/AGENTS.md)。当前生产基线由 [`docs/adr/0001-zitadel-gin-platform-core.md`](./docs/adr/0001-zitadel-gin-platform-core.md) 锁定(ZITADEL 是中央 OIDC Issuer,Go/Gin `api-gateway` 是唯一业务 API 入口,`identity-adapter` 与模块化 `platform-core` 承担身份编排和租户业务)。

| 服务 | 技术栈 | 六层归属 | 角色 |
|---|---|---|---|
| `services/api-gateway` | Go + Gin + ZITADEL JWKS + Redis | L6 入口 / L2 转发 | 唯一业务 API 入口(`8080` 容器 / `18088` Windows 宿主 loopback) |
| `services/identity-adapter` | Go + Gin + ZITADEL + SMTP | L3 软件层 | 身份编排(`8081`,Docker 网络内) |
| `services/platform-core` | Go + Gin + PostgreSQL RLS + Outbox | L3 软件层 | 租户业务核心(`8082`,Docker 网络内) |
| `services/control-plane` | Node + TS + Express | L3 软件层 | 工作站控制面 / AgentTask / 快照(`8092`,宿主机进程) |
| `services/communication-gateway` | Node + TS + Socket.IO | L2 通信层 | IM / 通信路由 / `IMEnvelope` 入口 |
| `services/workflow-engine` | Python + FastAPI + PostgreSQL | L3 软件层 | 持久工作流执行器;Outbox + 人工审批 + 步骤超时(`8083`) |
| `services/notification-service` | Go + Gin + PostgreSQL + SMTP + Kafka(可选) | L3 软件层 | 消息通知(`8084`) |
| `services/file-service` | Python + FastAPI + S3/MinIO + PostgreSQL + ClamAV + Pillow | L4 基础服务层 | 文件处理(`8085`) |
| `auth-service` / `core-service` | Go JWT / Spring H2 | — | **只读迁移兼容**,生产 Helm Chart 不部署 |

`backend/` 是嵌入式 Python runtime(`mini_agent/` + `local_server/`),**非**根 pnpm member,见 `backend/AGENTS.md`。

---

## 6. Packages(共享包)

| 包 | 角色 | 状态 |
|---|---|---|
| `packages/api-client` | 浏览器 / Node 端统一 HTTP 客户端(`@axi/api-client`) | 生产 |
| `packages/schemas` | Zod Schema 源头(请求 / 响应 / 错误码) | 生产 |
| `packages/types` | 共享类型 | 生产 |
| `packages/workbench-foundation` | 认证会话 + 语言偏好;**只共享认证与语言状态,不导出页面或布局** | 生产 |
| `packages/epap-schemas-compat` | 旧命名空间兼容层(`@epap/*`) | 迁移兼容 |
| `packages/ui` | 旧 UI 出口 | legacy;新 Dashboard 不应继续基于它扩展 |
| `packages/artboard-vite-plugin` | AST source-stamp Vite 插件 | 生产 |
| `packages/axi-rag/` | RAG 源码目录,无根 package manifest | **未接入**;不应描述成已发布共享包 |
| `packages/commit-ledger-schema/` | Commit Ledger schema | 生产 |

共享包详情见 [`packages/AGENTS.md`](./packages/AGENTS.md)。

---

## 7. Rules(`docs/rules/`)

强制运行规则库,**不是普通设计笔记**,而是定义组件允许做什么、不允许做什么。

| 规则 | 用途 |
|---|---|
| [`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md) | 六层控制面边界与运行 SOP |
| [`docs/rules/axi-workbench-boundary-sop.md`](./docs/rules/axi-workbench-boundary-sop.md) | Workbench 聚合边界与反耦合规则(避免把邻居项目实现路径 / 私有 schema 引入 Workbench runtime) |
| [`docs/rules/epap-project-doc-agent-sop.md`](./docs/rules/epap-project-doc-agent-sop.md) | 项目文档系统 SOP(标准模板见 `docs/templates/project-docs/`) |
| [`docs/rules/axi-ui-page-contract.md`](./docs/rules/axi-ui-page-contract.md) | Axi UI 页面契约 |
| [`docs/rules/three-surface-style-architecture.md`](./docs/rules/three-surface-style-architecture.md) | 三界面(Web / Mobile / Desktop)样式架构 |

规则与 [`../../foundation/axi-rules/INDEX.md`](../../foundation/axi-rules/INDEX.md)(workspace-level rule catalog)的优先级冲突时,按 `AGENTS.md` 优先级:根级 `AGENTS.md` > `docs/rules/epap-six-layer-sop.md` > 子树 `AGENTS.md` > `prompts/` 分层 > 个人记忆。

---

## 8. API Surface(`docs/api/`)

Axi Workbench 的浏览器实际调用契约由 [`docs/api/README.md`](./docs/api/README.md) 维护,与代码同步;新增 endpoint 必须同步本目录对应文件并由 `pnpm docs:check` 校验。

| 服务 / 域 | 文档 | endpoint 数 |
|---|---|---:|
| Auth / Session | [`docs/api/auth.md`](./docs/api/auth.md) | 9 |
| Control Plane(snapshot / jobs / agent-tasks / approvals / risks / governance / query / commands) | [`docs/api/control-plane.md`](./docs/api/control-plane.md) | 24 |
| Personal OS(queue / focus / projects) | [`docs/api/personal-os.md`](./docs/api/personal-os.md) | 5 |
| Handoff(Web↔Mobile) | [`docs/api/handoff.md`](./docs/api/handoff.md) | 6 |
| Workflow Engine | [`docs/api/workflow.md`](./docs/api/workflow.md) | 8 |
| Platform Core(tenants / members / preferences / dictionaries / projects / tasks) | [`docs/api/platform.md`](./docs/api/platform.md) | 12 |
| Notification | [`docs/api/notification.md`](./docs/api/notification.md) | 7 |
| File Service | [`docs/api/file.md`](./docs/api/file.md) | 6 |
| Observability | [`docs/api/observability.md`](./docs/api/observability.md) | 7 |
| Commit Ledger | [`docs/api/commit-ledger.md`](./docs/api/commit-ledger.md) | 7 |
| EPS(API 资产审计) | [`docs/api/eps.md`](./docs/api/eps.md) | 6 |
| Mobile(Pairing / Scan / Auth / Workspace / Handoffs / Jobs / Approvals) | [`docs/api/mobile.md`](./docs/api/mobile.md) | 18 |

通用约定:JSON over HTTP;所有 endpoint 走 API Gateway;鉴权走 `Axi Identity OIDC` HttpOnly session cookie `axi.session`;响应封装 `{ data, meta? }` / 错误封装 `{ error: { code, message, details? } }`;幂等性由 `Idempotency-Key` 头 + 5 分钟窗口保证。详细规范见 [`docs/api/README.md`](./docs/api/README.md)。

每个 ADR (`docs/adr/`) 的重大决策:

| ADR | 标题 | 状态 | 日期 |
|---|---|---|---|
| [0001](./docs/adr/0001-zitadel-gin-platform-core.md) | ZITADEL 中央身份、Gin 网关与模块化 Go 核心 | 已接受 | 2026-08-07 |
| [0002](./docs/adr/0002-personal-os-project-queue.md) | Personal OS v0.1 归属 Workbench 与项目队列优先 | 已接受 | 2026-09-01 |

---

## 9. Cross-Component Relationships

### 9.1 渲染宿主 vs. 事实 owner

2026-09-24 起,本仓库被明确为 **Workspace Entrance Spatial Graph 的渲染宿主**,**不是事实 owner**(PRD §10.2 硬约束)。

| 层 | owner | 仓库 | 职责 |
|---|---|---|---|
| 事实源 | `axi-workspace-governance` | `infra/axi-workspace-governance/` | `workspace.json`、`workspace.graph.json`、catalog、handoff、completion、audit |
| 数据平面 | `axi-kernel`(PRD-01) | `projects/axi-kernel/` | 对象注册、关系、变更、漂移检测(Registry v6 schema) |
| 数据平面 | `axi-workbench-cli`(PRD-02) | `workbench/axi-workbench-cli/` | 工作区扫描、8 项 health check、DOT/JSON 关系图;CLI + DOT/JSON,**无 Web UI** |
| 渲染宿主 | `axi-workbench`(本仓库) | `workbench/axi-workbench/` | `apps/workbench` Web / Desktop (Tauri 2) / Mobile (Capacitor);**只读**消费数据平面,不持久化任何事实 |

对本仓库的硬约束(摘自 [`AGENTS.md` §Workspace Entry Render Host Boundary](./AGENTS.md#workspace-entry-render-host-boundaryprd-102-硬约束)):

1. **不得修改事实源**;所有持久治理变更必须经过 `scripts/workspace-project-cli.mjs` 或 `axi_kernel.register_*` API。
2. 必须以 `peerDependencies` 依赖数据平面;版本契约由 `workspace.graph.json.contracts` 锁定。
3. 纯渲染代码(UI / 交互 / 视图状态)可本地修改。
4. 引入新事实必须回到事实源:节点、关系、布局坐标、镜头状态、详情面板任何字段若要成为工作区事实,必须先在 `workspace.json` / `workspace.graph.json` 增加权威字段,再由数据平面适配器暴露。

### 9.2 Prompt 与规则并列管理

| 目录 | 角色 |
|---|---|
| `prompts/system/*.mdc` | 不可变底座 |
| `prompts/global/*.mdc` | 所有项目通用 |
| `prompts/projects/*.mdc` | 特定项目补充 |

`prompts/AGENTS.md` 与 `prompts/README.md` 是权威入口;详见 [`prompts/AGENTS.md`](./prompts/AGENTS.md)。

### 9.3 跨工作区反链接

跨项目修改前,先用 `/Volumes/code/workspace/scripts/workspace-project deps axi-workbench` 或 `consumers <project>` 确认 provider/consumer 边界。

- 根工作区索引:[`/Volumes/code/workspace/AGENTS.md`](/Volumes/code/workspace/AGENTS.md)、[`/Volumes/code/workspace/WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md)
- 命名与品牌:[`/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md`](/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md)
- DevSvc / PM2 服务编排:[`/Volumes/code/workspace/docs/DEV_SERVICES.md`](/Volumes/code/workspace/docs/DEV_SERVICES.md)、[`/Volumes/code/workspace/dev-services.config.json`](/Volumes/code/workspace/dev-services.config.json)
- 治理仓库:[`/Volumes/code/workspace/infra/axi-workspace-governance/`](/Volumes/code/workspace/infra/axi-workspace-governance/) (本仓库引用,不写入)
- Workspace-level rule catalog:[`/Volumes/code/workspace/foundation/axi-rules/INDEX.md`](/Volumes/code/workspace/foundation/axi-rules/INDEX.md)

---

## 10. Verification(最小验证序列)

详细验证矩阵见 [`AGENTS.md` §Verification](./AGENTS.md#verification);**本仓库**的最小验证序列(来自工作区索引 `WORKSPACE_INDEX.md` Axi Workbench 行):

```bash
# 跨项目契约与图谱完整性
/Volumes/code/workspace/scripts/workspace-project validate

# 整库 CI 验证(含 distributions 构建验证)
pnpm verify:ci

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

> **Distributions 构建统一**:workbench / workbench-mobile / workbench-desktop 三套 distributions 已合并为统一构建流程,由 `pnpm verify:ci` 驱动 CI 验证。

变更驱动的最小验证选择见 [`AGENTS.md` §Verification](./AGENTS.md#verification)。

---

## 11. References

| 议题 | 权威来源 |
|---|---|
| 项目边界 / 六层 SOP / 反链接 | [`AGENTS.md`](./AGENTS.md) |
| 项目入口与结构 | [`README.md`](./README.md) / [`INDEX.md`](./INDEX.md) |
| 物理源码角色与 workspace 边界 | [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md) |
| 合并产品文档(§1–§8) | [`docs/00-product-overview.md`](./docs/00-product-overview.md) |
| 变更日志(canonical) | [`docs/state/CHANGELOG.md`](./docs/state/CHANGELOG.md) |
| 根级变更指针 | [`CHANGE.md`](./CHANGE.md) |
| 接力状态 | [`docs/HANDOFF.md`](./docs/HANDOFF.md) / [`HANDOFF.md`](./HANDOFF.md) |
| 安全策略 | [`docs/governance/SECURITY.md`](./docs/governance/SECURITY.md) |
| 六层控制面 SOP | [`docs/rules/epap-six-layer-sop.md`](./docs/rules/epap-six-layer-sop.md) |
| 边界 SOP | [`docs/rules/axi-workbench-boundary-sop.md`](./docs/rules/axi-workbench-boundary-sop.md) |
| 项目文档系统 SOP | [`docs/rules/epap-project-doc-agent-sop.md`](./docs/rules/epap-project-doc-agent-sop.md) |
| Prompt 分层 | [`prompts/README.md`](./prompts/README.md) / [`prompts/AGENTS.md`](./prompts/AGENTS.md) |
| API 契约 | [`docs/api/README.md`](./docs/api/README.md) |
| ADR | [`docs/adr/`](./docs/adr/) |
| 文档清单与责任归属 | [`docs/project-docs.manifest.json`](./docs/project-docs.manifest.json)(status: legacy) |
| 子树内部实现与契约 | `apps/AGENTS.md`、`services/AGENTS.md`、`packages/AGENTS.md`、`tools/AGENTS.md`、`ai/AGENTS.md` |
| Axi App CLI 脚手架 | [`tools/axi-app-cli/AGENTS.md`](./tools/axi-app-cli/AGENTS.md) / [`tools/axi-app-cli/README.md`](./tools/axi-app-cli/README.md) |
| 工作区关系与验证 | [`/Volumes/code/workspace/WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) / [`/Volumes/code/workspace/workspace.graph.json`](/Volumes/code/workspace/workspace.graph.json) |
| Workspace-level rule catalog | [`../../foundation/axi-rules/INDEX.md`](../../foundation/axi-rules/INDEX.md) |

---

## Change Log

| 日期 | 变更 |
|---|---|
| 2026-10-16 | P2-4 整改(2026-10-16 audit):新增根级 `ARCHITECTURE.md` 作为架构门面 + 索引;**不复制** `docs/architecture/source-catalog.md` 与 `docs/00-product-overview.md` 内容,只做镜像 + 跨组件关系指针。权威源不变:源码角色看 source-catalog.md,产品矩阵看 00-product-overview.md,六层 SOP 看 docs/rules/epap-six-layer-sop.md,项目边界看 AGENTS.md。 |
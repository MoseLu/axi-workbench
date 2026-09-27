# Axi Workbench — 产品总览（v3）

> **本文件是合并后的产品文档入口**，由 8 份历史产品文档（`01-overview.md` ~ `08-todo.md`）整合而来，发布于 2026-09-27，作为 PR-11 文档 v3 化的成果。
>
> **当前生产后端（2026-08 起）**：以 [`docs/adr/0001-zitadel-gin-platform-core.md`](./adr/0001-zitadel-gin-platform-core.md) 为准。ZITADEL 是中央 OIDC Issuer，Go/Gin `api-gateway` 是唯一业务 API 入口，`identity-adapter` 与模块化 `platform-core` 承担身份编排和租户业务；本章未标注"当前"的旧 EPAP / Spring H2 / Celery 描述仅作历史设计参考，不反映生产现实。
>
> **物理源码角色与 workspace 边界**：以 [`docs/architecture/source-catalog.md`](./architecture/source-catalog.md) 为权威。本文 §3-§6 描述的产品角色与当前源码清单的对应关系在该文件中可逐项追溯。

---

## §1 Overview

### 1.1 平台简介

Axi Workbench 是 AxiomaticWorld（公理世界）的工作台，承担 Axi 工作台大项目的权威 owner。它由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成，承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。

> Axi Workbench 不是一个单体应用，而是一套**多前端、多后端、多 AI 能力协同**的工作空间生态系统。所有子系统在统一的 Monorepo 框架（pnpm workspace + Turborepo）下协同演进。

### 1.2 核心能力矩阵（2026-09）

| 能力域 | 子系统 | 技术栈 | 当前状态 |
|--------|--------|--------|----------|
| Web 用户端 | `apps/workbench` | React 18 + TS + Vite + Axi UI | 已上线 |
| 移动用户端 | `apps/workbench-mobile`（Web + Capacitor/Android） | React 18 + TS + Vite + Capacitor | 已上线 |
| 桌面分发 | `apps/workbench-desktop` | Tauri 2 | 已构建 |
| 组件体系 | `shared/axi-ui` + `packages/ui`（legacy） | Axi Core / Shell / Settings / Tokens | 已接入 |
| API 网关 | `services/api-gateway` | Go + Gin + ZITADEL JWKS + Redis | 已上线 |
| 身份适配 | `services/identity-adapter` | Go + Gin + ZITADEL + SMTP | 已上线 |
| 平台核心 | `services/platform-core` | Go + Gin + PostgreSQL RLS + Outbox | 已上线 |
| 原型兼容 | `auth-service` / `core-service`（Spring H2） | Go JWT / Spring H2 | **只读迁移兼容**，生产 Helm Chart 不部署 |
| 控制面 | `services/control-plane` | Node + TypeScript + Express | 已上线（`8092`） |
| 通信网关 | `services/communication-gateway` | Node + TypeScript + Socket.IO | 已上线 |
| 工作流 | `services/workflow-engine` | Python + FastAPI + PostgreSQL | 已上线（Outbox + 人工审批 + 步骤超时） |
| 消息通知 | `services/notification-service` | Go + Gin + PostgreSQL + SMTP + Kafka（可选） | 已上线（SMTP + Kafka Fetch/Commit 可选） |
| 文件处理 | `services/file-service` | Python + FastAPI + S3/MinIO + PostgreSQL + ClamAV + Pillow | 已上线（ClamAV 需集群接入） |
| 知识检索 | `apps/axi-docs` + `ai/knowledge-base` | React + Python + Qdrant + LangChain | apps/axi-docs 已接管文档产品 |
| 智能协作 | `ai/agent-platform` | Python + Anthropic SDK | 规划中 |
| 文档产品 | `apps/axi-docs` | React + Vite + 文档门户 | 已接管文档项目（取代原 7.1 Docusaurus 规划） |
| Host / 运维壳 | `apps/devsvc-dashboard` | React + TS + Vite | 已上线 |
| Hosted 编码工具 | `apps/axi-coder` | React + TS + Tauri/Rust | 已上线 |
| Hosted OTP 工具 | `apps/verification-inbox` | React + TS + Tauri/Python | 已上线 |
| 嵌入式搜索 | `apps/app-search-system` | React + Electron + Python | 嵌入式多运行时（生命周期待补齐） |
| Fleet Dashboard | `infra/fleet-console/dashboard` | React + Python `fleetctl` | 物理服务层 Dashboard |
| macOS 菜单助手 | `apps/ollama-menu-assistant` | Swift Package | 原生垂直工具 |
| 应用脚手架 CLI | `tools/axi-app-cli` | pnpm 子 monorepo | 独立子 monorepo |

### 1.3 设计原则

#### 架构级原则

- **单一职责（SRP）**：每个服务只负责一个有限的业务上下文，服务边界由领域模型驱动
- **关注点分离（SoC）**：前端 / 业务服务 / AI 能力 / 基础设施各层解耦，独立演进
- **类型安全优先（Type-First）**：从 Zod Schema 出发，贯通前端验证、API Contract、后端校验
- **基础设施即代码（IaC）**：所有环境配置通过 Helm + Kubernetes Manifest 版本化管理
- **可观测性内建（Observability-First）**：日志、指标、链路追踪在架构设计阶段即纳入
- **AI 能力松耦合**：Agent 与 RAG 通过标准 Tool Interface 接入业务，不硬依赖任何服务

#### 工程级原则

- **Monorepo 统一管理**：使用 Turborepo + PNPM Workspace 管理所有前端及共享包
- **每项目独立 CI/CD**：每个子系统有独立的流水线，但共享统一的基础 Action 库
- **测试覆盖门槛**：Unit ≥ 80%，Integration ≥ 60%，E2E 覆盖核心链路
- **文档与代码同步**：OpenAPI Spec 由代码注解自动生成，ADR 记录所有重要决策
- **代码生成减少重复**：API Client、类型定义、Mock 数据均通过 Schema 自动生成

### 1.4 六层控制面（强制边界）

Axi Workbench 的运行时模型统一使用六层控制面模型（详见 [`docs/rules/epap-six-layer-sop.md`](./rules/epap-six-layer-sop.md)）：

1. **IM 层**（IM Layer）：只负责用户输入和消息展示
2. **通信层**（Communication Layer）：只负责 route 绑定、配对、审批、附件引用、幂等、回执和渠道渲染
3. **软件层**（Software Layer）：拥有项目、服务、工作流、AgentTask、运行时会话和项目状态
4. **基础服务层**（Base Service Layer）：拥有记忆库、文档库、文件库、审计库、工具注册表、MCP/skills、本地模型/浏览器/运行时能力目录
5. **物理服务层**（Physical Service Layer）：拥有机器、设备、端口、磁盘、进程、网络资源。物理资源永远不拥有项目
6. **外接能力层**（External Capability Layer）：拥有第三方 API、远端模型服务和远端 agent 服务

**强制边界**：

- IM adapter **不得**执行业务逻辑，**不得**读取项目目录
- communication-gateway **不得**调用 Codex，**不得**读取工作区索引，**不得**查询记忆表，**不得**拥有项目状态
- control-plane 的业务输入必须来自标准 `IMEnvelope` 或类型化控制 API
- Agent 执行必须表示为软件层受管 `AgentTask`
- memory、docs、files、audit、tool registry、capability catalog 都属于基础服务层
- 服务器、ADB 设备、端口、进程、主机健康只属于物理服务层
- 第三方 API 和远端 agent 只属于外接能力层
- **不得**用 hook 作为 Axi Workbench 运行时旁路

### 1.5 端口规划（2026-09 当前生产基线）

| 服务 | 端口 | 备注 |
|------|------|------|
| `api-gateway` | 8080（容器） / 18088（Windows Docker 宿主 loopback） | 唯一业务 API 入口 |
| `identity-adapter` | 8081 | Docker 网络内，不开 Windows 端口 |
| `platform-core` | 8082 | Docker 网络内 |
| `workflow-engine` | 8083 | Docker 网络内 |
| `notification-service` | 8084 | Docker 网络内 |
| `file-service` | 8085 | Docker 网络内 |
| `control-plane` | 8092 | 宿主机进程（不是容器） |
| `communication-gateway` | Socket.IO | 软件层受管 |
| `apps/workbench` | 5173 | Vite dev server |
| `apps/workbench-mobile`（Web） | 5174 | Vite dev server |
| `apps/devsvc-dashboard` | 5175 | Vite dev server（Host） |
| `apps/axi-coder` | 5176 | Vite dev server |
| `apps/verification-inbox` | 5177 | Vite dev server |
| PostgreSQL | 5432（容器） / 15432（Windows Docker 宿主） | 数据库 |
| Redis | 6379（容器） / 16379（Windows Docker 宿主） | 会话、限流、短期事务 |
| Qdrant | 6333 / 6334 | 向量库（如启用） |
| Kafka | 9092 | broker（可选） |
| MinIO | 9000 / 9001 | 对象存储（如启用） |
| Prometheus | 9999 | 监控（如启用） |
| Grafana | 3001 | 可视化（如启用） |
| Jaeger UI | 16686 | 链路追踪（如启用） |

### 1.6 环境规划

| 环境 | 用途 | 部署方式 | 数据策略 |
|------|------|----------|----------|
| local | 本地开发 | docker-compose backend profile + Host | 脱敏测试数据 |
| dev | 集成测试 | Helm chart（`axi-workbench-platform`） | 自动刷新的种子数据 |
| staging | 预发布验证 | Helm chart staging namespace | 生产数据镜像（脱敏） |
| production | 生产环境 | Helm chart prod namespace | 真实数据，全备份 |

### 1.7 多端后台覆盖范围

用户后台按应用而非视口拆分：

- **Web 管理端**：`apps/workbench` 是独立的 Axi Dashboard 完整后台管理端，负责 C 级复杂配置、全量查询、批量操作、流程编排和审计；拥有侧边栏、顶栏插件、标签栏、面包屑、主题切换和设置面板
- **移动端（Web + 原生 Android）**：`apps/workbench-mobile` 是独立的移动辅助管理应用，负责 A 级个人待办/状态和经动作政策允许的 B 级单对象确认、扫码审批与个人设置；它不导入 Web Dashboard 壳，也不承担 C 级组织/全量后台配置。当前基线为 Home / Projects / Workspace / Me 四个常驻导航项，加一个顶部 Scan 动作
- **共享层**：只共享 Axi Identity 会话协议、相对 API/Schema 合同、语言偏好、设计令牌、服务端动作政策和审计事实。两个应用不共享页面、路由或布局组件
- **扫码语义**：Web 扫码用于通用识别与结果处理；移动端扫码用于受控审批确认。二者的权限、审计和验收不能合并
- **Host 与垂直工具**：`apps/devsvc-dashboard` 是本地运维 Host；Axi Coder、Verification Inbox、Fleet、App Search 等为 D 级专用工具，不属于用户后台一级信息架构

完整的产品任务分工、跨端交接与阶段路线以 [`docs/state/PRD.md`](./state/PRD.md) 为准。

---

## §2 Architecture

### 2.0 当前生产后端边界（2026-08 起）

本节是当前实现的权威入口；后续仍保留的 EPAP / `auth-service` / Spring `core-service` 图示属于历史或迁移兼容说明。

```text
独立 Web 管理端 / 独立移动端 / EPS（Authorization Code + PKCE）
                             │
                             ▼
              NGINX Ingress + cert-manager
                             │
                             ▼
              api-gateway（Go/Gin，唯一业务入口）
               ├── ZITADEL（JWKS 校验、中央 OIDC Issuer）
               ├── identity-adapter（邮件、扫码、EPS 映射）
               └── platform-core（租户、RBAC、偏好、字典、项目、任务）
                         ├── PostgreSQL（独立 schema + tenant_id + RLS）
                         └── Redis（会话、限流、短期二维码事务）
```

- Web 与移动端是独立界面应用，但当前浏览器交付都使用网关 BFF 的 Authorization Code + PKCE 会话；JavaScript 不保存 access 或 refresh token。EPS 使用独立 client 的 PKCE access token
- 网关只接受同时满足 ZITADEL JWKS、audience 与所需 scope 的 Bearer access token；浏览器 ID Token 不可作为业务 API 凭据
- Gateway 仅将已验证 subject 注入到内部服务，剥离客户端伪造的身份/租户头；`platform-core` 再执行成员检查和 RLS
- Python 文件/工作流服务、Node 控制面与通信网关保持各自六层职责，经 Gateway/合同访问，不承担用户认证或租户业务核心
- `auth-service` 和 H2 `core-service` 仅在显式配置 `LEGACY_CORE_SERVICE_URL` 时提供只读兼容路由，生产 Helm Chart 不部署它们

部署细节见 [`infra/helm/README.md`](../infra/helm/README.md)，决策依据见 [`ADR-0001`](./adr/0001-zitadel-gin-platform-core.md)。

### 2.1 系统分层架构（产品技术栈）

Axi Workbench 采用六层架构模型，从用户交互到数据存储，每层职责清晰，层间通过定义良好的接口通信。**实际运行时边界以六层控制面 SOP（§1.4）为准**；下图是早期产品技术栈分层的历史图示。

```
┌─────────────────────────────────────────────────────────────┐
│  L6  展示层 (Presentation)                                   │
│  apps/workbench · apps/workbench-mobile · apps/devsvc-dashboard
│  · apps/axi-coder · apps/verification-inbox · axi-ui        │
├─────────────────────────────────────────────────────────────┤
│  L5  共享包层 (Shared)                                       │
│  packages/workbench-foundation · packages/schemas · packages/types
│  · packages/api-client · packages/ui (legacy)               │
├─────────────────────────────────────────────────────────────┤
│  L4  网关与控制面层 (Gateway / Control Plane)                │
│  api-gateway · control-plane · communication-gateway         │
├─────────────────────────────────────────────────────────────┤
│  L3  业务服务层 (Business)                                   │
│  identity-adapter · platform-core · workflow-engine          │
│  · notification-service · file-service                      │
├─────────────────────────────────────────────────────────────┤
│  L2  AI 能力层 (Intelligence)                                │
│  knowledge-base (RAG) · agent-platform · apps/axi-docs      │
├─────────────────────────────────────────────────────────────┤
│  L1  基础设施层 (Infrastructure)                             │
│  PostgreSQL · Redis · Qdrant · Kafka · S3 · Prometheus      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 工作空间目录结构（物理源码）

```
axi-workbench/
├── apps/                          # 前端应用层（混合：用户端 / Host / 垂直工具）
│   ├── workbench/                 # Web 管理端（React 18 + Vite + Axi UI）
│   ├── workbench-mobile/          # 移动端（React 18 + Vite + Capacitor，含 android/）
│   ├── workbench-desktop/         # 桌面分发（Tauri 2 壳）
│   ├── workbench-shared/          # Web/Desktop 共享模块
│   ├── devsvc-dashboard/          # 本地运维 Host（Vite + React）
│   ├── axi-coder/                 # Hosted 编码工具（React + Tauri/Rust）
│   ├── verification-inbox/        # Hosted OTP 工具（React + Tauri/Python）
│   ├── axi-docs/                  # 文档产品（React + Vite + 文档门户）
│   ├── app-search-system/         # 嵌入式多运行时（React + Electron + Python，根 workspace 外）
│   ├── ollama-menu-assistant/     # macOS 菜单助手（Swift Package）
│   ├── axi-artboard/              # 垂直画布工具
│   └── resource-orchestration/    # 资源编排垂直工具
│
├── packages/                      # 共享包（pnpm + Turborepo 管理）
│   ├── workbench-foundation/      # 认证、语言状态共享（仅基础服务）
│   ├── api-client/                # API 客户端
│   ├── schemas/                   # Zod schema 共享层
│   ├── types/                     # 跨项目类型定义
│   ├── ui/                        # legacy UI 组件（仅兼容/参考）
│   ├── utils/                     # 工具函数
│   ├── epap-schemas-compat/       # legacy 迁移兼容入口
│   ├── gateway-contracts/         # API Gateway OpenAPI 契约
│   ├── resource-api-docs/         # 资源 API 文档
│   ├── resource-adapters/         # 资源适配器
│   ├── resource-config/           # 资源配置
│   ├── resource-memory/           # 资源记忆
│   ├── resource-orchestrator/     # 资源编排
│   ├── resource-session/          # 资源会话
│   └── artboard-vite-plugin/      # Artboard Vite 插件
│
├── services/                      # 后端服务层（混合多语言）
│   ├── api-gateway/               # Go + Gin — 唯一业务 API 入口
│   ├── identity-adapter/          # Go + Gin — 身份适配
│   ├── platform-core/             # Go + Gin — 平台核心
│   ├── control-plane/             # Node + TS — 软件层受管控制面
│   ├── communication-gateway/     # Node + TS — 通信网关
│   ├── workflow-engine/           # Python + FastAPI — 工作流引擎
│   ├── notification-service/      # Go + Gin — 消息通知
│   ├── file-service/              # Python + FastAPI — 文件处理
│   ├── auth-service/              # Go + JWT — 迁移兼容（生产不部署）
│   ├── core-service/              # Java Spring + H2 — 迁移兼容（生产不部署）
│   └── resource-gateway/          # 资源网关
│
├── ai/                            # AI 能力层
│   ├── knowledge-base/            # RAG 知识库（Python + Qdrant + LangChain）
│   └── agent-platform/            # Agent 协作（Python + Anthropic SDK）
│
├── shared/                        # 工作区级共享
│   └── axi-ui/                    # 跨项目的 Axi UI 组件（`workspace:*` 协议）
│
├── infra/                         # 基础设施即代码
│   ├── helm/                      # 生产 Helm Chart（`axi-workbench-platform`）
│   ├── fleet-console/             # Fleet Console 物理服务管理（Python `fleetctl` + dashboard/）
│   ├── docker/                    # 本地 docker-compose 配置
│   └── kubernetes/                # 历史 K8s base（已被 Helm 取代）
│
├── docs/                          # 本仓库产品文档（本文件 + state/ + rules/ + architecture/）
├── tools/axi-app-cli/             # 应用脚手架 CLI（独立子 monorepo）
├── backend/                       # 根 Python 运行时（mini-agent，根 workspace 外）
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.backend.yml     # 本地后端容器化 profile
```

> 物理目录存在不等于根 workspace 成员；根 `pnpm` 实际覆盖范围以 `docs/architecture/source-catalog.md` 的"根 workspace 成员"表为准。

### 2.3 服务通信矩阵（生产）

| 调用方 | 被调用方 | 通信方式 | 说明 |
|--------|---------|---------|------|
| `apps/workbench` | `api-gateway` | HTTPS REST（Authorization Code + PKCE） | Web 浏览器标准调用 |
| `apps/workbench-mobile`（Web） | `api-gateway` | HTTPS REST（Authorization Code + PKCE） | 移动端统一走网关 |
| `apps/workbench-mobile`（Android） | `api-gateway` | HTTPS REST（独立 PKCE client） | EPS 使用独立 client |
| `apps/devsvc-dashboard` | `control-plane` | HTTP REST | Host 调用控制面启动应用 |
| `apps/axi-coder` | `control-plane` + `api-gateway` | HTTP REST + WebSocket | Hosted 子应用 |
| `api-gateway` | `identity-adapter` | HTTP proxy + ZITADEL webhook | 仅 ClusterIP |
| `api-gateway` | `platform-core` | HTTP proxy | 业务请求转发 |
| `api-gateway` | `workflow-engine` | HTTP proxy | 工作流触发 |
| `api-gateway` | `notification-service` | HTTP proxy | 通知请求 |
| `api-gateway` | `file-service` | HTTP proxy | 文件上传下载 |
| `api-gateway` | ZITADEL | JWKS（OIDC 验证） | 中央 OIDC Issuer |
| `platform-core` Outbox | `notification-service` / `workflow-engine` | Kafka（可选）+ HTTP fallback | 至少一次投递 |
| `workflow-engine` | `platform-core` | HTTP via `api-gateway` | 工作流步骤读取业务数据 |
| `notification-service` | SMTP | SMTP 协议 | 邮件投递 |
| `file-service` | S3/MinIO | S3 Protocol | 文件存储 |
| `control-plane` | `apps/devsvc-dashboard` Host registry | HTTP + WebSocket | 软件层受管 |
| `communication-gateway` | `control-plane` | Socket.IO | IM 协议 |

### 2.4 数据流设计

#### 2.4.1 用户请求主链路

```
浏览器
  │── HTTPS ──► api-gateway (:8080)
                    │── ZITADEL JWKS 验证 Bearer access token
                    │── audience + scope 校验
                    │── HttpOnly 会话（PKCE 流程）
                    │
                    │── HTTP proxy ──► platform-core (:8082)
                                          │── PostgreSQL RLS（按 tenant_id）
                                          └── Platform Outbox
                                                ├──► notification-service（Outbox 事件派发）
                                                ├──► workflow-engine（事件触发）
                                                └── 5 分钟租约、指数退避、第十次失败死信
```

步骤说明：

1. 浏览器发起 HTTPS 请求 → `api-gateway:8080`
2. api-gateway 验证 ZITADEL JWKS、audience、scope；如使用 PKCE 则不接触 JS 中的 token
3. api-gateway 注入已验证 subject，剥离伪造身份/租户头
4. 后端服务处理业务逻辑 → 写入 PostgreSQL（按 tenant_id RLS），发布 Outbox 事件
5. Outbox 事件至少一次投递，五分钟租约、指数退避、第十次失败死信标记和 `X-Axi-Event-ID` 共同构成消费者幂等契约
6. 各消费者把事件 ID 写入自己的 `event_inbox` 后才返回成功
7. 响应原路返回，api-gateway 统一包装响应格式

#### 2.4.2 Agent / AI 辅助链路

```
前端 AI 请求
  │── HTTPS ──► api-gateway
                    │── HTTP ──► agent-platform (:8091)（规划中）
                                    │
                                    ├── Orchestrator（任务分解）
                                    │       │── gRPC ──► knowledge-base（检索上下文）
                                    │                        └── Qdrant（向量检索）
                                    │
                                    ├── Agent（调用 LLM + Tools）
                                    │       └── Anthropic Claude API
                                    │
                                    └── SSE 流式返回 ──► 前端
```

当前 production 实现以 `apps/axi-docs` 提供的文档门户为主，Agent / RAG 全链路仍处于规划 / 部分上线阶段。

---

## §3 Frontend（apps/workbench + apps/workbench-mobile + 共享包）

### 3.1 工作空间组织 — Turborepo + PNPM

#### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

#### turbo.json（简化）

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "API_BASE_URL", "VITE_API_URL"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

#### 实际包依赖关系（Web）

```
apps/workbench       ──► packages/workbench-foundation, packages/api-client, packages/schemas, packages/types, packages/utils, shared/axi-ui (workspace:*)
apps/workbench-mobile──► packages/workbench-foundation, packages/api-client, packages/schemas, packages/types, packages/utils
apps/workbench-shared──► packages/* (共享模块)
packages/api-client  ──► packages/types, packages/schemas
packages/schemas     ──► (仅依赖 zod)
packages/types       ──► (无内部依赖)
packages/utils       ──► (无内部依赖)
packages/ui          ──► packages/types (legacy)
shared/axi-ui        ──► (跨工作区共享，通过 workspace:* 协议)
```

### 3.2 packages/schemas — Zod Schema 共享层

**核心价值**：同一份 Zod Schema 同时用于前端表单验证、API 类型推断、生成 JSON Schema 供后端校验、生成 Mock 数据。

目录结构（摘要）：

```
packages/schemas/src/
├── common/         # pagination, sort, response, errors, id
├── entities/       # user, project, task, workflow, file, notification, tag
├── requests/       # auth, project, task, workflow, search
├── responses/      # auth, project, workflow, kb
└── index.ts
```

### 3.3 packages/types 与 packages/utils

`packages/types` 跨项目类型定义（`api.ts` / `auth.ts` / `events.ts` / `theme.ts` / `route.ts` / `upload.ts` / `sse.ts`）。

`packages/utils` 工具函数库（`cn` / `date` / `string` / `url` / `storage` / `array` / `object` / `error` / `async` / `crypto`）。

### 3.4 组件体系：shared/axi-ui vs packages/ui (legacy)

**当前生产 Axi Dashboard 组件体系**：`shared/axi-ui`（工作区级共享，通过 `workspace:*` 协议）。组成包括 Axi Core / Axi Shell / Axi Settings / Tokens。

**`packages/ui`**：legacy 出口，保留作兼容/参考；Web 已完成无活跃引用清理（[`docs/audit/20260913-web-legacy-consumer-validation.md`](./audit/20260913-web-legacy-consumer-validation.md)），后续 `@epap/*` API 兼容出口与 `packages/ui` 的 repository-wide 退役仍须另立治理批次。

### 3.5 packages/api-client — 自动生成 API 客户端

```
packages/api-client/src/
├── client.ts              # baseURL、超时、拦截器
├── interceptors/          # auth.ts（401 自动刷新）、error.ts
├── generated/             # ⚠️ 自动生成，勿手动修改
├── hooks/                 # TanStack Query 封装（useAuth / useProjects / useTasks / useWorkflows / useKnowledge / useAgentChat / useFiles）
├── query-keys.ts          # 统一 Query Key 工厂
└── index.ts
```

### 3.6 apps/workbench — Web 管理端

技术栈：

| 类别 | 方案 |
|------|------|
| 框架 | React 18 + TypeScript 5.x |
| 构建 | Vite 5 |
| 路由 | React Router v6（Data Router 模式） |
| 全局状态 | Zustand |
| 服务端状态 | TanStack Query v5 |
| 样式 | Tailwind CSS + CSS Modules（局部） |
| UI | `shared/axi-ui` (workspace:*) |
| 表单 | React Hook Form + `packages/schemas` (Zod) |
| 图表 | Recharts |
| 拖拽 | dnd-kit |
| 测试 | Vitest + React Testing Library + Playwright |

目录结构（摘要）：

```
apps/workbench/
├── src/
│   ├── app/
│   │   ├── router.tsx          # 路由定义（含懒加载）
│   │   ├── providers.tsx       # 全局 Provider 树
│   │   └── layout/             # Shell, Sidebar, Topbar
│   ├── features/               # auth / projects / tasks / workflows / knowledge / agents / files / notifications / analytics / commit-ledger ...
│   ├── pages/                  # 顶层路由页面（commit-ledger、operations 等）
│   ├── shared/                 # store / hooks / utils
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── e2e/                    # Playwright 测试
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

Feature 模块结构规范：每个 feature 模块遵循统一结构（`pages/` / `components/` / `hooks/` / `store/` / `index.ts`）。

### 3.7 apps/workbench-mobile — 移动端（Web + Capacitor + Android）

技术栈：React 18 + TypeScript 5.x + Vite 5 + Capacitor（Android）+ `packages/workbench-foundation`。

**Web package 入口**：`apps/workbench-mobile/src/main.tsx`，`pnpm dev:mobile`。

**Android 原生入口**：`apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/MainActivity.kt`，`./gradlew :app:installDebug`。

Web 与原生 Android 共享产品契约和 API 边界，**各自维护独立 UI 实现**（不共享页面/路由/布局组件）。

### 3.8 apps/workbench-desktop — 桌面分发（Tauri 2）

基于 `apps/workbench` Web 入口的 Tauri 2 桌面壳。桌面安装包提供"系统设置 → 设备与会话 → 手机配对"入口并可生成配对 QR。

### 3.9 apps/devsvc-dashboard — Host / 运维壳

**定位**：本地服务管理和 Axi 应用 Host，不是第二用户门户。

挂载表：`apps/devsvc-dashboard/config/axi-apps.json`（决定哪些本地应用被 Host 发现、启动和挂载；不等同于 pnpm membership）。

启动：`pnpm dev:dashboard` → `apps/devsvc-dashboard/src/main.tsx`。

### 3.10 垂直工具（Hosted 子应用 / 嵌入式 / 原生）

| 应用 | 形态 | 入口 | 角色 |
|------|------|------|------|
| `apps/axi-coder` | React + Tauri/Rust | `src/main.tsx` | 被 Host 挂载的开发工具 |
| `apps/verification-inbox` | React + Tauri/Python | `src/main.tsx` | Hosted OTP 工具，真实邮箱能力由 Tauri/Python 边界承载 |
| `apps/app-search-system` | React + Electron + Python | `frontend/src/index.tsx`、Electron control/display、`backend/server.py` | 嵌入式多运行时；根 workspace 外 |
| `apps/ollama-menu-assistant` | Swift Package | `Sources/OllamaMenuAssistant/MainApp.swift` | macOS 菜单助手，原生垂直工具 |
| `apps/axi-artboard` | React + Vite | `src/main.tsx` | 画布工具 |
| `infra/fleet-console/dashboard` | React + Python `fleetctl` | `src/main.tsx` | 物理服务层 Dashboard |
| `tools/axi-app-cli` | pnpm 子 monorepo | 顶层 wrapper | 应用脚手架 CLI |

---

## §4 Backend（services/*）

### 4.0 当前生产实现（2026-08 起）

以 [`ADR-0001`](./adr/0001-zitadel-gin-platform-core.md) 为准，当前后端不是重写成另一套 Gin，而是将已有 Go 网关演进为身份、平台核心和专职能力三类明确边界：

| 边界 | 当前实现 | 生产职责 |
|---|---|---|
| API Gateway | `services/api-gateway`（Go + Gin） | 唯一 `/api/v1` 入口、ZITADEL JWKS 校验、授权码 + PKCE、HttpOnly 会话、Redis 限流、请求/追踪/审计关联、安全转发 |
| Axi Identity | `services/identity-adapter`（Go + Gin） + ZITADEL | 邮箱验证、短期 Redis 扫码事务、ZITADEL custom-login 续接、EPS 外部主体映射；不手写 JWT Issuer |
| Platform Core | `services/platform-core`（Go + Gin） | 租户、成员/RBAC、偏好、字典、项目、任务、Outbox；PostgreSQL schema、`tenant_id` 与强制 RLS |
| Workflow Engine | `services/workflow-engine`（Python + FastAPI） | 仅接受 gateway 可信请求；工作流定义、执行认领、Outbox event inbox、租约派发与执行结果进入 PostgreSQL；worker 支持并发领取、退避重试和重启恢复 |
| Notification Service | `services/notification-service`（Go + Gin） | 仅接受 gateway 可信请求；通知收件箱、delivery jobs 与 event inbox 进入 PostgreSQL；SMTP 适配器、重启可恢复 worker 和 Outbox 幂等消费已接入 |
| File Service | `services/file-service`（Python + FastAPI） | 仅接受 gateway 可信请求；生产使用 S3/MinIO 对象 + PostgreSQL 元数据并按 subject 隔离，上传流计算 SHA-256，写对象前可经 ClamAV INSTREAM 扫描，图片生成受尺寸约束的 WebP 缩略图；开发保留本地存储降级 |
| Control Plane | `services/control-plane`（Node + TS） | 软件层受管的控制面，宿主机进程运行在 `8092`；容器 Gateway 通过 `host.docker.internal:8092` 访问 |
| Communication Gateway | `services/communication-gateway`（Node + TS + Socket.IO） | 通信层：route 绑定、配对、审批、附件引用、幂等、回执和渠道渲染；不读项目目录，不调用 Codex |
| Resource Gateway | `services/resource-gateway` | 资源网关 |
| 原型兼容 | `auth-service`（Go JWT）+ Spring H2 `core-service` | 迁移兼容来源；网关只会在显式配置时向它们开放只读旧路径，生产 Chart 不部署 |

关键约束：

- Web 和移动端是独立应用，当前浏览器交付共享 gateway BFF 的 Authorization Code + PKCE 身份合同，而不共享 UI 壳。生产构建必须显式指向同一 HTTPS `VITE_API_BASE_URL`；EPS 使用独立 PKCE client
- Bearer token 必须通过 ZITADEL JWKS、配置的 API audience 与全部所需 scope 校验；浏览器 ID Token 不能替代业务 API access token
- QR 轮询只返回状态，审批后由一次性 resume 事务进入 ZITADEL；任何 QR 接口不返回 JWT 或 OIDC code
- ZITADEL 的 QR completion 仅经 gateway 的 `/api/v1/internal/zitadel/...` 反向代理进入 ClusterIP identity-adapter，并额外校验 webhook secret
- Outbox 采用至少一次投递；五分钟租约、指数退避、第十次失败死信标记和 `X-Axi-Event-ID` 共同构成消费者幂等契约
- Platform Core 的 Outbox 只配置一个 Gateway 内部投递 URL；Gateway 用独立的 `GATEWAY_PLATFORM_OUTBOX_TOKEN` 校验平台 worker，再用各专职服务凭据扇出到 notification/workflow。两个消费者都把事件 ID 写入自己的 `event_inbox` 后才返回成功
- 运行时 `axi_platform_app` 是 `NOBYPASSRLS`；只有 pre-install/pre-upgrade migration Job 的专用账号拥有 `BYPASSRLS`，从而让 `SECURITY DEFINER` 的 RLS helper 可工作而不泄露运行时权限

Go 单测、可选 PostgreSQL RLS 集成测试和 Helm Chart 位于各服务与 [`infra/helm`](../infra/helm/README.md)。

### 4.0.1 本地生产形态 profile

本地完整后端使用 `make dev-backend` 启动。它先启动 Compose 的 PostgreSQL、Redis、Mailpit，确保本地数据库角色/数据库存在，依次执行 Identity、Platform、Workflow、Notification、File 五类迁移，再按依赖顺序启动 Control Plane、Identity Adapter、Platform Core、Workflow Engine、Notification Service、File Service 和 API Gateway，并逐项检查 readiness。

本地仍允许 Go/Python/Node 进程直接运行，以保留快速反馈；但端口、DSN、内部 token、迁移职责、服务边界和 Gateway 下游地址与 Helm 生产合同保持一致。生产集群、Ingress、Secret manager、ZITADEL、S3/ClamAV 等仍由 `infra/helm/axi-workbench-platform` 管理，不由本地 profile 模拟。

### 4.0.2 容器化生产形态 API 平面

为验证容器边界与 Helm 服务拓扑，`docker-compose.backend.yml` 提供独立的 `backend` profile。当前实际运行目标是 Windows `DESKTOP-519U63K` 上的 Docker Desktop。它复用各业务服务自己的 Dockerfile，以 Compose DNS 连接 PostgreSQL、Redis 和 Mailpit；五类迁移作为一次性任务先执行成功，再启动 Identity、Platform、Workflow、Notification、File、Control Plane 和 API Gateway。

当前 Windows Docker 端口边界如下：

| Windows 主机端口 | 容器端口 | 用途 |
|---|---:|---|
| `127.0.0.1:18088` | `api-gateway:8080` | 唯一业务 API 入口 |
| `127.0.0.1:15432` | `postgres:5432` | 后端 PostgreSQL 开发数据库 |
| `127.0.0.1:16379` | `redis:6379` | 后端 Redis |

Identity Adapter `8081`、Platform Core `8082`、Workflow Engine `8083`、Notification Service `8084`、File Service `8085` 和 Control Plane `8092` 只在 Docker 网络内通信，不作为 Windows 主机端口开放。`18088` 当前绑定 Windows loopback，因此 Mac 或其他局域网客户端不能直接使用 Windows IP 访问，必须经过端口转发或反向代理。

```bash
make docker-backend
make verify-docker-backend
docker compose -f docker-compose.yml -f docker-compose.backend.yml --profile backend ps -a
make docker-backend-down
```

### 4.1 api-gateway — Go + Gin

**职责**：统一入口、流量路由、ZITADEL JWKS 校验、HttpOnly 会话（PKCE）、Redis 限流、链路追踪注入、响应日志。

目录结构（摘要）：

```
services/api-gateway/
├── cmd/gateway/main.go
├── internal/
│   ├── config/         # viper 配置（env + yaml）
│   ├── router/         # routes.go、groups.go
│   ├── middleware/     # auth / ratelimit / cors / logger / tracing / recovery
│   ├── proxy/          # reverse_proxy.go（含 Header 注入）
│   ├── health/         # handler.go（/health 和 /ready）
│   └── metrics/        # prometheus.go（/metrics）
└── pkg/                # response/ errors
```

中间件链：`recovery → tracing → logger → cors → ratelimit → auth → reverse_proxy`。

### 4.2 identity-adapter — Go + Gin + ZITADEL

**职责**：身份适配（不手写 JWT Issuer）。邮箱验证、短期 Redis 扫码事务、ZITADEL custom-login 续接、EPS 外部主体映射。

### 4.3 platform-core — Go + Gin

**职责**：租户、成员/RBAC、偏好、字典、项目、任务、Outbox。PostgreSQL schema、`tenant_id` 与强制 RLS。运行时账号 `axi_platform_app` 是 `NOBYPASSRLS`。

主要 API：

| Method | 路径 | 说明 |
|--------|------|------|
| GET | `/projects` | 分页查询项目列表（status/name/owner 过滤） |
| POST | `/projects` | 创建项目 |
| GET | `/projects/{id}` | 查询项目详情 |
| PUT | `/projects/{id}` | 更新项目 |
| DELETE | `/projects/{id}` | 软删除项目 |
| GET | `/projects/{id}/tasks` | 项目下任务（看板/列表视图参数） |
| POST | `/projects/{id}/tasks` | 创建任务 |
| PUT | `/tasks/{id}` | 更新任务（状态/描述/优先级） |
| POST | `/tasks/{id}/assign` | 分配任务给成员 |
| GET | `/users/me/tasks` | 我的任务列表 |
| GET | `/projects/{id}/members` | 项目成员列表 |
| POST | `/projects/{id}/members` | 添加成员 |

### 4.4 workflow-engine — Python + FastAPI

**职责**：工作流定义、实例管理与执行调度。支持 DAG 型工作流，步骤类型包括 HTTP 调用、脚本执行、人工审批、AI Agent 任务等。

已实现能力（生产基线 2026-09）：

- 工作流定义、执行认领
- Outbox event inbox（幂等接收）
- 租约派发与执行结果进入 PostgreSQL
- worker 支持并发领取、退避重试和重启恢复
- 安全结构化条件表达式
- 步骤超时
- 有限并行编排
- 受 HTTPS/主机白名单/DNS 公网地址/响应体上限保护的 HTTP 外部任务
- 带 PostgreSQL approval 记录、主体授权、幂等决策和事件派发挂起/恢复的人工审批步骤

目录结构（摘要）：

```
services/workflow-engine/
├── src/
│   ├── api/main.py          # FastAPI 应用
│   ├── engine/              # dag / executor / step_runner / state_machine
│   ├── steps/               # base / http / script / approval / agent / condition / parallel
│   ├── models/              # SQLAlchemy 2 ORM
│   └── events/              # event_inbox 消费者
├── alembic/
└── pyproject.toml
```

### 4.5 notification-service — Go + Gin

**职责**：通知收件箱、delivery jobs、event inbox 进入 PostgreSQL。SMTP 适配器、重启可恢复 worker 和 Outbox 幂等消费已接入。

已实现能力（生产基线 2026-09）：

- 核心、工作流、文件与安全事件的代码模板 registry
- 收件箱、已读状态、delivery worker
- 可选 Kafka Fetch/Commit 消费适配（broker 未配置时不启动，持久化失败不提交 offset）

### 4.6 file-service — Python + FastAPI

**职责**：S3/MinIO 对象 + PostgreSQL 元数据，按 subject 隔离；上传流计算 SHA-256；写对象前可经 ClamAV INSTREAM 扫描；图片生成受尺寸约束的 WebP 缩略图；开发保留本地存储降级。

已实现能力（生产基线 2026-09）：

- S3/MinIO 对象适配
- PostgreSQL 元数据
- SHA-256 完整性校验
- 迁移 Job
- subject 隔离
- 短时预签名下载 URL
- 写入前 ClamAV INSTREAM 扫描适配
- 图片 WebP 缩略图派生对象
- **生产仍需在集群中接入 ClamAV、验证 Pillow 处理资源边界并完成故障演练后才可称为最终生产完成**

存储路径规范（生产）：

```
S3 Bucket: axi-files
  /{tenant_id}/
    /projects/{project_id}/           # 项目文件
    /users/{user_id}/avatars/         # 用户头像
    /knowledge/{kb_id}/               # 知识库源文件
    /tmp/{upload_id}/                 # 分片上传临时文件
```

### 4.7 control-plane — Node + TypeScript + Express

**职责**：软件层受管的控制面。业务输入必须来自标准 `IMEnvelope` 或类型化控制 API。宿主机进程运行在 `8092`；容器 Gateway 通过 `host.docker.internal:8092` 访问。

业务能力：Git commit collector + evidence linker + ingestion 模块（`commit-ledger/`），7 个只读 API 路由（summary, commits, commits/:id, projects/:id, verification, sources, sync）。

### 4.8 communication-gateway — Node + TypeScript + Socket.IO

**职责**：通信层 route 绑定、配对、审批、附件引用、幂等、回执和渠道渲染。**不调用 Codex，不读工作区索引，不查记忆表，不拥有项目状态**。

### 4.9 auth-service / core-service（迁移兼容）

**当前状态**：迁移兼容来源；网关只会在显式配置 `LEGACY_CORE_SERVICE_URL` 时向它们开放只读旧路径。生产 Helm Chart 不部署它们。

新功能与新决策请走 `identity-adapter` + `platform-core` + ZITADEL + ZITADEL webhook 链路（[`ADR-0001`](./adr/0001-zitadel-gin-platform-core.md)）。

---

## §5 AI Layer

> 当前 §5 内容主要由 `apps/axi-docs`（已上线的文档产品）与 `ai/knowledge-base` / `ai/agent-platform`（规划 / 部分上线）协同承担。

### 5.1 knowledge-base — RAG 知识库

**定位**：平台的统一知识中枢。支持多种格式摄入，提供混合检索（向量 + 关键词），被工作流引擎和 Agent 平台共同依赖。

目录结构（摘要）：

```
ai/knowledge-base/
├── src/
│   ├── ingestion/       # loaders / chunkers / enrichers / pipeline.py
│   ├── embeddings/      # openai / local / cache
│   ├── vector_store/    # qdrant_store + collection_manager
│   ├── retrieval/       # vector / bm25 / hybrid / reranker
│   ├── api/             # FastAPI (:8090) + gRPC (:9090)
│   ├── models/          # SQLAlchemy ORM（document / chunk / ingestion_job）
│   └── config/
└── pyproject.toml
```

**摄入管道**：`Load → Chunk → Enrich → Embed → Store`，对 `sha256(file_content)` 哈希去重保证幂等。

**混合检索策略**：

```
Query
  ├── 向量化 → Qdrant cosine 检索 → Top-20（Dense Path）
  └── BM25 分词 → PostgreSQL 全文检索 → Top-20（Sparse Path）
           ↓ RRF (k=60) 融合 → Top-10
           ↓ Cross-Encoder 精排 (可选) → Top-5
```

**RRF 公式**：`score(d) = Σ 1 / (k + rank(d, list_i))`

### 5.2 agent-platform — 智能协作平台（规划中）

**定位**：AI 智能执行核心。将复杂用户请求分解为多个子任务，调度专能 Agent 并行或串行执行，通过 Tool Interface 与其他服务交互，SSE 流式返回结果。

#### Agent 类型

| Agent | 专能 | 主要 Tools | 典型用例 |
|-------|------|-----------|---------|
| `CodeAgent` | 代码生成与重构 | code_exec, git_tools, kb_tools | 根据需求描述生成代码框架 |
| `DocsAgent` | 文档生成与维护 | kb_tools, file_tools, project_tools | 自动更新 API 文档、生成 README |
| `TestAgent` | 测试用例生成 | code_tools, kb_tools | 为函数自动生成单元测试 |
| `ReviewAgent` | Code Review | git_tools, kb_tools, web_tools | PR 代码质量分析与建议 |
| `ResearchAgent` | 知识调研 | kb_tools, web_tools | 调研技术方案、汇总文档 |
| `DataAgent` | 数据分析 | code_exec, file_tools | 分析上传的数据文件、生成报告 |

#### 编排器状态机

```
PENDING → PLANNING → DISPATCHING → RUNNING → AGGREGATING → STREAMING → COMPLETED
   │                                              │                │
   │                                              │                └──→ FAILED
   │                                              └──→ CANCELLED
   └── 资源就绪                                       ↑ 用户取消
```

### 5.3 apps/axi-docs — 文档产品（已接管原 §7 文档项目）

详见 §7。

---

## §6 Infrastructure

### 6.0 当前可部署基线（2026-08 起）

当前实现不再使用本章后续示例中的泛化 `eap-*` Kubernetes 目录作为生产来源。可执行入口是 [`infra/helm/axi-workbench-platform`](../infra/helm/README.md)：

- NGINX Ingress + cert-manager 只把 `/api` 公开给 `api-gateway`；identity 与 platform Service 均为 ClusterIP
- pre-install/pre-upgrade Helm Job 分别执行 identity 与 platform migration；运行时容器不自动迁移数据库
- `axi_platform_app` 为 `NOBYPASSRLS`，迁移 Job 使用只存在于 Job Secret 的 `PLATFORM_MIGRATION_DATABASE_URL`；业务表均有 `tenant_id` 与 RLS
- Runtime Secret 通过 External/Sealed Secret 注入 OIDC、Redis、PostgreSQL、SMTP、内部 token 和 ZITADEL webhook 密钥；真实值不进入 Chart 或前端
- Chart 提供 PDB、非 root/read-only 容器、NetworkPolicy 和 OTLP/HTTP trace export；三项 Go 服务会继续 W3C `traceparent` 并在配置 Collector 时实际导出服务端 Span。本地 Compose 用 `scripts/init-db.sql` 创建开发数据库角色，Mailpit 用于 SMTP 集成验收
- Web 与移动端为独立构建产物；生产分别注入同一 HTTPS `VITE_API_BASE_URL`，Gateway 只对精确白名单 Origin 允许带 cookie 的 CORS。ZITADEL QR 回调仍经 Gateway 转发，identity-adapter 不暴露 Ingress
- ZITADEL 采用官方 Helm Chart，生产禁用 bundled PostgreSQL；参考 [`infra/helm/zitadel-values.example.yaml`](../infra/helm/zitadel-values.example.yaml) 与官方文档

安装顺序、Secret 键、数据库角色和验收步骤见 [`infra/helm/README.md`](../infra/helm/README.md)。以下章节是保留的历史运维蓝图，不应覆盖本节。

### 6.1 本地开发环境 — Docker Compose

`docker-compose.yml` + `docker-compose.backend.yml` 提供本地后端容器化 profile（详见 §4.0.2）。

Makefile 常用命令（与生产合同保持一致）：

```makefile
.PHONY: help dev dev-backend infra-up infra-down build test clean gen-api db-reset db-seed

dev-backend:  ## 本地生产形态：Compose PostgreSQL/Redis/Mailpit + 五类迁移 + 七个服务
docker-backend:  ## 启动 docker-compose.backend.yml backend profile
verify-docker-backend:
docker-backend-down:

build:  ## 构建所有项目
pnpm turbo build
$(MAKE) -C services/api-gateway build
$(MAKE) -C services/identity-adapter build
$(MAKE) -C services/platform-core build
cd services/workflow-engine && uv run python -m pytest --co -q
cd services/notification-service && go build ./...

test:  ## 运行全部测试
pnpm turbo test
$(MAKE) -C services/api-gateway test
cd services/workflow-engine && uv run pytest --cov
cd services/file-service && uv run pytest --cov

gen-api:  ## 从 OpenAPI 生成 API Client
./tools/scripts/gen-api-client.sh

db-reset:  ## 重置所有数据库
./tools/scripts/init-db.sh

lint:  ## 运行全部 lint
pnpm turbo lint
$(MAKE) -C services/api-gateway lint
cd services/workflow-engine && uv run ruff check .
```

### 6.2 Kubernetes / Helm 部署架构

可执行入口：`infra/helm/axi-workbench-platform`。

Namespace 规划：

| Namespace | 用途 |
|-----------|------|
| `axi-workbench-dev` | 开发环境，PR 自动部署预览 |
| `axi-workbench-staging` | 预发布，与生产同等配置 |
| `axi-workbench-prod` | 生产环境 |
| `axi-workbench-infra` | 共享基础设施（Kafka, Qdrant） |
| `axi-workbench-monitoring` | Prometheus, Grafana, Jaeger |
| `axi-workbench-ops` | ArgoCD, cert-manager, ESO |

> `infra/kubernetes/` 目录保留为历史 K8s base 蓝图，已被 Helm Chart 取代，不作为生产来源。

### 6.3 CI/CD 流水线

- 前端 CI：`.github/workflows/ci-frontend.yml`（pnpm install → lint → type-check → test → build）
- Go 服务 CI：`.github/workflows/ci-backend-go.yml`（golangci-lint + `go test ./... -race`）
- Python 服务 CI：`.github/workflows/ci-backend-python.yml`（ruff + mypy + pytest）
- 部署流水线：`.github/workflows/deploy-production.yml`（Helm/kubectl apply + rollout status + smoke test）

最小验证序列（来自 `WORKSPACE_INDEX.md` Axi Workbench 行）：

```bash
# 跨项目契约与图谱完整性
/Volumes/code/workspace/scripts/workspace-project validate

# 整库 CI 验证（含 distributions 构建验证）
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

变更驱动的最小验证选择：

- 改 `apps/<x>/**` → 跑 `apps/<x>` 的最小验证（`typecheck` / `test`），再视改动范围跑 `pnpm test:workstation`
- 改 `services/<x>/**` → 跑对应服务的 `go test` / `pytest` 入口
- 改 `packages/<x>/**`（尤其 `epap-schemas-compat`）→ 跑 `pnpm type-check` + 至少一个下游 app 的 `typecheck`
- 改 `tools/axi-app-cli/**` → 跑 `pnpm --dir tools/axi-app-cli boundaries:check` + `pnpm --dir tools/axi-app-cli capabilities:check`
- 改 `prompts/**` → 跑 `prompts/AGENTS.md` 与 `prompts/README.md` 所列分层校验
- 改 `docs/rules/*` 或根 `AGENTS.md` → 不需构建；保证文件存在性 + 反链接不被破链
- 跨项目共享契约（`@axi/workstation-*` 包）→ 跑 `workspace-project consumers axi-workbench` 列出的所有消费者的最小验证

### 6.4 可观测性设计

三大支柱：

| 支柱 | 工具 | 数据格式 | 保留策略 |
|------|------|---------|---------|
| 日志（Logs） | Loki + Grafana | JSON 结构化 | 30 天热存，90 天冷存 |
| 指标（Metrics） | Prometheus + Grafana | OpenMetrics | 15 天高精度，1 年降采样 |
| 链路追踪（Traces） | Jaeger (OTel Collector) | OpenTelemetry | 7 天 |

关键告警规则（摘要）：`HighErrorRate`（5xx > 5% for 2m）、`HighLatency`（P95 > 2s for 5m）、`LLMHighCost`（1h token 用量 > 1M）、`KBSearchSlowDown`（P95 > 3s）。

### 6.5 安全设计

#### 网络安全

```
Internet
   │
   ▼
CloudFlare WAF / AWS WAF
   │
   ▼
Kubernetes Ingress (nginx-ingress + TLS)
   │
   ▼
api-gateway (唯一对外入口)
   │
   ├── NetworkPolicy: 允许 → identity-adapter
   ├── NetworkPolicy: 允许 → platform-core
   ├── NetworkPolicy: 允许 → workflow-engine
   ├── NetworkPolicy: 允许 → notification-service
   ├── NetworkPolicy: 允许 → file-service
   └── NetworkPolicy: 允许 → control-plane（仅来自 Gateway / Host）

所有内部服务:
   - 拒绝来自 Internet 的直接访问
   - 只允许来自 api-gateway 的流量（NetworkPolicy）
   - 内部服务间按白名单通信
```

#### 密钥管理

```
HashiCorp Vault
   │
   └── Vault Kubernetes Auth (Pod SA 自动认证)
           │
           └── External Secrets Operator
                   │
                   └── K8s Secrets（自动同步，定期轮换）
                           │
                           └── Pod 环境变量注入
```

#### 安全 Checklist

- [x] 所有外部流量强制 HTTPS（HSTS Header）
- [x] CSP Header 防 XSS
- [x] CORS 白名单（仅允许已知域名，精确白名单 Origin）
- [x] Bearer access token 通过 ZITADEL JWKS、audience、scope 校验；HttpOnly 会话不暴露 token
- [x] Redis 黑名单防 Token 重放（按需）
- [x] 登录失败 5 次锁定 15 分钟（Redis 计数）
- [x] 所有输入参数化查询（禁止字符串拼接 SQL）
- [x] Pod Security Standard: Restricted
- [x] 容器以非 root 用户运行
- [x] 镜像 CI 中 Trivy 漏洞扫描
- [x] GitLeaks 防止密钥提交
- [x] 数据库连接强制 SSL
- [x] S3 桶默认私有，预签名 URL TTL 15 分钟
- [x] 敏感字段日志自动脱敏

### 6.6 公网移动访问整改（PRD §14，PUB-00…PUB-09）

当前基线：局域网真机 + 桌面端"系统设置 → 设备与会话 → 手机配对"已闭环（2026-09-13）。公网部署仍待执行。

| ID | 子任务 | 状态 |
|---|---|---|
| PUB-00 | DNS / 证书 / 域名 owner 探针 | 部分完成 |
| PUB-01 | 公网 Ingress `/api` → Gateway | **核心阻塞：未配置** |
| PUB-02 | Gateway 生产路由 / OIDC / CORS / Redis session / rate limit / 移动合同 | 部分完成 |
| PUB-03 | Control Plane 生产 `GATEWAY_PUBLIC_URL` / `AXI_MOBILE_GATEWAY_BASE_URL` | 部分完成 |
| PUB-04 | Web owner 公网 QR 闭环 | 部分完成（局域网真机闭环通过） |
| PUB-05 | Android Release 公网 endpoint | 部分完成 |
| PUB-06 | 生产 OIDC / session / Secret / 审计 | 待执行 |
| PUB-07 | TLS / HSTS / CORS / 脱敏 / rate limit / 公网观测门禁 | 部分完成 |
| PUB-08 | 4G/5G 真机闭环 | 部分完成（同网段真机闭环通过） |
| PUB-09 | 发布 / 回滚 / runbook / CHANGELOG / HANDOFF / TODO 收口 | 待执行 |

---

## §7 Docs Project（apps/axi-docs 已接管）

> **原 §7.1 Docusaurus 文档站点规划已由 `apps/axi-docs` 接管**。本节描述当前 Axi Docs 产品的实际形态，不再保留 Docusaurus 目录示例。

### 7.1 apps/axi-docs — 文档门户（已上线）

**定位**：Axi Workbench 的官方文档门户，整合架构文档、API 规范、开发指南、运维手册和 ADR。支持 MDX、内置搜索，通过 GitHub Actions 自动发布。

主入口：`apps/axi-docs/app/src/main.tsx`。

核心子目录：

```
apps/axi-docs/
├── app/
│   ├── src/                     # React + Vite 应用
│   ├── scripts/                 # sync-workspace / check-source-locks / smoke-pages / verify-workspace-root
│   └── public/                  # 静态资源
├── docs/
│   ├── axi-workspace-governance/    # 工作区治理镜像（catalog / handoff / completion / adr / ownership-matrix）
│   ├── audit/                       # 工作区级审计副本（与根 docs/audit/ 对齐，owner 待决定合并方向）
│   └── content/                     # 多语言内容（en / zh-CN）
└── vite.config.ts
```

### 7.2 公开来源索引

公开来源索引位于 [`apps/axi-docs/docs/axi-workspace-governance/`](../../apps/axi-docs/docs/axi-workspace-governance/)：

- `architecture/git-system.md`
- `audits/`（2026-09-24 ~ 2026-09-26 的多份 owner decision / batch snapshot / baseline）
- `adr/`（工作区级 ADR 镜像）
- `workflows/`（`WF-AUDIT-001` / `WF-AUDIT-GAP-001` / `WF-CROSS-COMMIT-001` / `WF-INDEX-001`）
- `project-catalog.md`、`project-handoff.md`、`project-completion.md`
- `integration-map.md`、`ownership-matrix.md`、`repo-topology.md`

### 7.3 API 规范管理策略

业务 API 按 `/api/v1/...` 的 REST 风格设计，并由 `packages/gateway-contracts` 与 `packages/resource-api-docs` 维护 OpenAPI 3.1 契约。当前 Windows API Gateway 已验证 `/health` 返回 200，但 `/openapi.json` 和 `/docs` 返回 404；因此 OpenAPI 契约已经存在，Swagger/Redoc 文档入口尚未接入当前 API Gateway 暴露面，不能把它描述成已上线的网关路由。

API 版本管理规则：

| 变更类型 | 版本影响 | 兼容性 |
|---------|---------|--------|
| 新增可选字段 | Patch | ✅ 向后兼容 |
| 新增必填字段 | Minor | ⚠️ 需更新客户端 |
| 删除字段 / 修改语义 | Major | ❌ 破坏性变更 |
| 新增接口 | Minor | ✅ 向后兼容 |
| 删除接口 | Major | ❌ 需废弃通知 |

### 7.4 ADR — 架构决策记录

权威 ADR 位置：

- [`docs/adr/0001-zitadel-gin-platform-core.md`](./adr/0001-zitadel-gin-platform-core.md) — ZITADEL + Go/Gin + platform-core
- [`docs/adr/`](./adr/) 目录下的其他历史 ADR
- 工作区级 ADR 镜像：[`apps/axi-docs/docs/axi-workspace-governance/adr/`](../../apps/axi-docs/docs/axi-workspace-governance/adr/)

新决策必须先在根 `docs/adr/` 中落地；镜像由 `apps/axi-docs` 的 sync 脚本按 owner 决策拉取，不应双写。

### 7.5 文档发布 CI

`apps/axi-docs` 由自身 CI 流水线构建并发布到 GitHub Pages / Vercel / 内网（按 owner 决策）；本仓库根 `docs/` 同步 GitHub 源码但不直接对外发布。

---

## §8 TODO 状态（已封存）

> **§8 已封存**：本节内容来自 `docs/08-todo.md`（1020 项 TODO 清单）。该清单于 2026-08 编写，描述当时设想的 EPAP 工作量分布。截至 2026-09-27，实际物理源码已演进为 Go 单栈 + React 18 + Vite + Axi UI，原清单中的 Spring H2 `core-service`、Celery 工作流、Taro 移动端、Docusaurus 文档站等条目不再对应生产现实。本节保留为**封存状态**，所有指向"未完成"或"待实现"的项目以 [`docs/state/TODO.md`](./state/TODO.md) 与 [`docs/state/MILESTONE.md`](./state/MILESTONE.md) 为准。

### 8.1 原 1020 项 TODO 的实际映射

| 原章节 | 原条目数 | 当前映射 |
|--------|--------:|----------|
| 8.1 工作空间初始化（#1 - #50） | 50 | 多数已完成；剩余由 [`docs/state/TODO.md`](./state/TODO.md) 跟踪 |
| 8.2 共享包层（#51 - #165） | 115 | `packages/` 实际包：`workbench-foundation` / `api-client` / `schemas` / `types` / `ui`（legacy）/ `utils` / `epap-schemas-compat` / `gateway-contracts` / `resource-api-docs` / `resource-adapters` / `resource-config` / `resource-memory` / `resource-orchestrator` / `resource-session` / `artboard-vite-plugin` |
| 8.3 前端应用层（#166 - #322） | 157 | `apps/workbench` / `apps/workbench-mobile` / `apps/workbench-desktop` / `apps/workbench-shared` / Host + Hosted + 垂直工具均已落地；Taro 多端目标已被 Capacitor/Android 取代 |
| 8.4 后端服务层（#323 - #510） | 188 | Go 单栈落地 + Python（`workflow-engine` / `file-service`）；Spring H2 `core-service` 与 Go `auth-service` 已转为迁移兼容 |
| 8.5 AI 能力层（#511 - #610） | 100 | `ai/knowledge-base`（部分上线）/ `ai/agent-platform`（规划）；文档产品已由 `apps/axi-docs` 接管 |
| 8.6 基础设施 / CI / CD（#611 - #738） | 128 | Helm Chart（`infra/helm/axi-workbench-platform`）取代泛化 K8s base；docker-compose backend profile 落地；CI 流水线按 monorepo 重组 |
| 8.7 测试 / 安全 / 数据库（#739 - #756） | 18 | Unit ≥ 80% / Integration ≥ 60% 已部分达成；安全 Checklist 见 §6.5 |
| 8.8 文档 / 运营 / 扩展（#757 - #771） | 15 | Docusaurus 规划已由 `apps/axi-docs` 取代；CHANGELOG / HANDOFF / TODO 收口由 [`docs/state/`](./state/) 治理 |
| 8.9 ~ 8.14 各类追加 | — | 已被 [`docs/state/PRD.md`](./state/PRD.md) §14（PUB-00…PUB-09）等章节收纳 |

### 8.2 已核验交付缺口（追加自原 §8.15 / §8.16）

#### 桌面 / Android 设备配对闭环（#1021）

- **优先级**：🔴 P0
- **当前状态**：局域网真机闭环已通过（2026-09-13、2026-09-14）；公网 4G/5G 闭环待执行（PUB-08）
- **2026-09-13 验证**（小米 M2012K10C + ADB）：桌面不退出 → 截图二维码推入手机 Download → Android 从图片选择二维码 → Gateway `/mobile/pair/qr/scan` 返回 200 → Web 设备管理确认 → Android `/mobile/pair/status` 后恢复概览并同步 37 个项目；控制面重启并强制重启 App 后仍可同步 37 个项目
- **2026-09-14 验证**（换网 + 新 Debug APK）：手机 `192.168.101.14/24` 与开发机 `192.168.101.13/24` 同网段互通条件下，配对 QR 经"从图片选择二维码"成功登记，Android 获得 `device_id/access_token`，工作区恢复并显示"已整理 40 项待办"
- **尚待**：真实摄像头取景（非相册）、公网 API Gateway/Ingress/身份部署及"手机授权新 Web 会话"的独立验收

#### 公网移动访问整改（PRD §14）

详见 §6.6。当前**线上域名探针**仍显示其他静态站点与 Workbench `/api` 404；PUB-01（公网 Ingress `/api` 路由指向 Gateway）仍是核心阻塞。

### 8.3 后续 PR 应继续清理的方向

1. **§8.1 TODO 收纳**：将已完成的子条目从原 1020 项清单中迁移到 [`docs/state/TODO.md`](./state/TODO.md) 的"已交付"区
2. **公网完成度跟进**（PUB-00…PUB-09）：以 `infra/helm/axi-workbench-platform` 的实际部署验证为唯一证据
3. **apps/axi-docs 文档门户补全**：ADR / Audit / Workflow 镜像按 owner 决策继续同步
4. **packages/ui legacy 退役**：repository-wide 的 `@epap/*` API 兼容出口清理
5. **apps/app-search-system 生命周期补齐**：先补 manifest、启动 / 健康检查和 Host / 工作区注册，再考虑代码拆分

### 8.4 原统计汇总

| 模块 | 原 P0 | 原 P1 | 原 P2/P3 | 原合计 |
|------|----:|----:|----:|----:|
| 工作空间初始化 | 15 | 20 | 15 | 50 |
| 共享包层 | 38 | 47 | 30 | 115 |
| 前端应用层 | 42 | 63 | 52 | 157 |
| 后端服务层 | 78 | 82 | 28 | 188 |
| AI 能力层 | 36 | 50 | 14 | 100 |
| 基础设施/CI/CD | 42 | 68 | 18 | 128 |
| 测试/安全/数据库 | 22 | 58 | 12 | 92 |
| 文档/运营/扩展 | 8 | 42 | 140 | 190 |
| **合计** | **~281** | **~430** | **~309** | **~1020** |

> MVP 原目标：完成全部 P0 任务（约 281 项）即具备核心功能可用性。当前实际完成度以 [`docs/state/MILESTONE.md`](./state/MILESTONE.md) 为准；公网验收（§6.6 PUB-01~PUB-09）仍未完成。

---

## 附录 A：权威源反链接（必引）

| 议题 | 权威来源 |
|------|----------|
| 本文件 | [`docs/00-product-overview.md`](./00-product-overview.md) |
| 变更日志（Change Log） | [`CHANGE.md`](../CHANGE.md) (root pointer) → [`docs/state/CHANGELOG.md`](./state/CHANGELOG.md) (canonical) |
| 项目入口与当前结构 | [`README.md`](../README.md) |
| 物理源码角色与 workspace 边界 | [`docs/architecture/source-catalog.md`](./architecture/source-catalog.md) |
| 安全策略 | [`docs/governance/SECURITY.md`](../docs/governance/SECURITY.md) |
| 六层控制面边界与运行 SOP | [`docs/rules/epap-six-layer-sop.md`](./rules/epap-six-layer-sop.md) |
| Workbench 聚合边界与反耦合规则 | [`docs/rules/axi-workbench-boundary-sop.md`](./rules/axi-workbench-boundary-sop.md) |
| 项目文档系统 SOP | [`docs/rules/epap-project-doc-agent-sop.md`](./rules/epap-project-doc-agent-sop.md) |
| ADR 入口 | [`docs/adr/0001-zitadel-gin-platform-core.md`](./adr/0001-zitadel-gin-platform-core.md) |
| 当前生产部署 | [`infra/helm/axi-workbench-platform`](../infra/helm/axi-workbench-platform) + [`infra/helm/README.md`](../infra/helm/README.md) |
| 子树内部实现与契约 | `apps/AGENTS.md`、`services/AGENTS.md`、`packages/AGENTS.md`、`tools/AGENTS.md`、`ai/AGENTS.md` |
| 工作区索引 | [`/Volumes/code/workspace/WORKSPACE_INDEX.md`](../../WORKSPACE_INDEX.md) |

## 附录 B：术语表

- **EPAP**：Enterprise Project Automation Platform，历史命名空间；当前以 Axi Workbench 为权威
- **EPS**：External Principal Service，使用独立 PKCE client 的外部主体身份合同
- **IMEnvelope**：基础消息信封协议（IM 层 ↔ 通信层）
- **AgentTask**：软件层受管的 agent 执行单元
- **RLS**：PostgreSQL Row-Level Security
- **BFF**：Backend for Frontend（Gateway 在浏览器交付场景下的角色）
- **WFB**：Workbench Batch 前缀（治理批次的简短编号）

---

*最后整合：2026-09-27（PR-11 文档 v3 化）。原始 8 份文档（`01-overview.md` ~ `08-todo.md`）已删除；删除前的快照保留在 PR `workbench-remediation-pr11` 的 commit diff 中。如需查阅旧文档，请通过 `git log -- docs/01-overview.md` 等命令检索历史。*
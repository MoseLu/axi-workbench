# 第二章 总架构设计

## 2.1 系统分层架构

EPAP 采用六层架构模型，从用户交互到数据存储，每层职责清晰，层间通过定义良好的接口通信。

> 注意：本节描述的是早期产品技术栈分层。IM 自然语言控制面、通信网关、AgentTask、记忆面、文档库、物理资源和外接能力的运行时边界，以 [六层控制面 SOP](./rules/epap-six-layer-sop.md) 为准。

```
┌─────────────────────────────────────────────────────────────┐
│  L6  展示层 (Presentation)                                   │
│  web-portal · admin-dashboard · mobile-app · design-system  │
├─────────────────────────────────────────────────────────────┤
│  L5  共享包层 (Shared)                                       │
│  schemas · ui-components · api-client · types · utils       │
├─────────────────────────────────────────────────────────────┤
│  L4  网关层 (Gateway)                                        │
│  api-gateway · auth-service                                  │
├─────────────────────────────────────────────────────────────┤
│  L3  业务服务层 (Business)                                   │
│  core-service · workflow-engine · notification · file       │
├─────────────────────────────────────────────────────────────┤
│  L2  AI 能力层 (Intelligence)                                │
│  knowledge-base (RAG) · agent-platform                      │
├─────────────────────────────────────────────────────────────┤
│  L1  基础设施层 (Infrastructure)                             │
│  PostgreSQL · Redis · Qdrant · Kafka · S3 · Prometheus      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2.2 工作空间目录结构

```
enterprise-project-automation-platform/
├── .github/
│   ├── workflows/
│   │   ├── ci-frontend.yml
│   │   ├── ci-backend-python.yml
│   │   ├── ci-backend-go.yml
│   │   ├── ci-backend-java.yml
│   │   └── deploy-production.yml
│   └── CODEOWNERS
│
├── .vscode/
│   ├── extensions.json
│   ├── settings.json
│   └── launch.json
│
├── apps/                             # 前端应用层
│   ├── web-portal/                   # 主控制台 (React + TS + Vite)
│   ├── mobile-app/                   # 移动端 (Taro)
│   ├── admin-dashboard/              # 管理后台 (React + TS + Vite)
│   └── design-system/                # 组件库 (Storybook)
│
├── packages/                         # 共享包 (Turborepo 管理)
│   ├── ui-components/
│   ├── schemas/                      # Zod schema 共享层
│   ├── api-client/                   # 自动生成的 API 客户端
│   ├── types/                        # 跨项目类型定义
│   ├── utils/
│   └── eslint-config/
│
├── services/                         # 后端服务层
│   ├── api-gateway/                  # Go — 统一网关
│   ├── auth-service/                 # Go — 认证授权
│   ├── core-service/                 # Java Spring Boot — 核心业务
│   ├── workflow-engine/              # Python — 工作流引擎
│   ├── notification-service/         # Go — 消息通知
│   └── file-service/                 # Python — 文件处理
│
├── ai/                               # AI 能力层
│   ├── knowledge-base/               # RAG 知识库
│   └── agent-platform/               # Agent 协作平台
│
├── docs/                             # 文档项目 (Docusaurus)
│   ├── architecture/
│   ├── api-specs/                    # OpenAPI YAML 规范
│   ├── adr/                          # Architecture Decision Records
│   └── docusaurus.config.ts
│
├── infra/                            # 基础设施即代码
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
│
├── tools/
│   ├── scripts/
│   └── generators/
│
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── docker-compose.override.yml
└── Makefile
```

---

## 2.3 服务通信矩阵

| 调用方 | 被调用方 | 通信方式 | 说明 |
|--------|---------|---------|------|
| web-portal | api-gateway | HTTPS REST | 浏览器客户端标准调用 |
| mobile-app | api-gateway | HTTPS REST | 移动端统一走网关 |
| admin-dashboard | api-gateway | HTTPS REST | 管理接口走网关 |
| api-gateway | auth-service | **gRPC** | Token 验证高频调用，低延迟优先 |
| api-gateway | core-service | HTTP/1.1 代理 | 业务请求转发 |
| api-gateway | workflow-engine | HTTP/1.1 代理 | 工作流触发 |
| api-gateway | file-service | HTTP/1.1 代理 | 文件上传下载代理 |
| core-service | workflow-engine | **Kafka 事件** | 业务事件异步触发工作流 |
| core-service | notification-service | **Kafka 事件** | 状态变更通知 |
| workflow-engine | knowledge-base | **gRPC** | 工作流步骤检索知识 |
| workflow-engine | agent-platform | HTTP REST | 调用 Agent 执行子任务 |
| agent-platform | knowledge-base | **gRPC** | Agent 检索知识上下文 |
| agent-platform | core-service | HTTP REST | Agent 写回执行结果 |
| notification-service | Kafka | Kafka Consumer | 消费通知事件 |
| file-service | S3/MinIO | S3 Protocol | 文件存储 |

---

## 2.4 数据流设计

### 2.4.1 用户请求主链路

```
浏览器
  │── HTTPS ──► api-gateway (:8080)
                    │── gRPC ──► auth-service (Token 验证)
                    │                └── Redis (黑名单检查)
                    │
                    │── HTTP proxy ──► core-service (:8082)
                                          │── PostgreSQL (持久化)
                                          └── Kafka (发布领域事件)
                                                ├──► workflow-engine (异步工作流)
                                                └──► notification-service (推送通知)
```

步骤说明：

1. 浏览器发起 HTTPS 请求 → `api-gateway:8080`
2. api-gateway 提取 JWT Token → gRPC 调用 auth-service 验证
3. auth-service 检查 Redis 黑名单，验证签名 → 返回用户身份上下文
4. api-gateway 注入 `X-User-Id` 等请求头，路由到对应后端服务
5. 后端服务处理业务逻辑 → 写入 PostgreSQL，发布 Kafka 事件
6. Kafka 消费者处理异步副作用（通知推送、工作流触发）
7. 响应原路返回，api-gateway 统一包装响应格式

### 2.4.2 AI 辅助链路

```
前端 AI 请求
  │── HTTPS ──► api-gateway
                    │── HTTP ──► agent-platform (:8091)
                                    │
                                    ├── Orchestrator (任务分解)
                                    │       │── gRPC ──► knowledge-base (检索上下文)
                                    │                        └── Qdrant (向量检索)
                                    │
                                    ├── Agent (调用 LLM + Tools)
                                    │       └── Anthropic Claude API
                                    │
                                    └── SSE 流式返回 ──► 前端
```

步骤说明：

1. 前端发起 AI 请求 → api-gateway → agent-platform
2. Orchestrator 分解任务，调用 knowledge-base gRPC 检索相关上下文
3. knowledge-base 执行混合检索（向量 + BM25）→ 返回 Top-K 文档块
4. 将检索结果注入 Agent system prompt，调用 Claude API
5. Agent 通过 Tool 接口回写结果到 core-service
6. 以 SSE 流式推送结果给前端

---

## 2.5 Kafka Topics 规划

| Topic | 生产者 | 消费者 | 说明 |
|-------|--------|--------|------|
| `project.created` | core-service | workflow-engine, notification | 项目创建事件 |
| `project.updated` | core-service | notification | 项目更新事件 |
| `task.assigned` | core-service | notification | 任务分配事件 |
| `task.completed` | core-service | workflow-engine, notification | 任务完成事件 |
| `workflow.triggered` | core-service | workflow-engine | 工作流触发 |
| `workflow.step.completed` | workflow-engine | workflow-engine | 步骤完成推进 |
| `file.uploaded` | file-service | knowledge-base | 文件上传后自动索引 |
| `notification.send` | 所有服务 | notification-service | 统一通知发送 |

---

## 2.6 跨项目类型安全链路

```
packages/schemas (Zod 定义)
    │
    ├── 前端表单验证 (React Hook Form + zodResolver)
    │
    ├── 生成 JSON Schema → 后端请求体校验
    │
    └── openapi-generator
            │
            └── packages/api-client (TypeScript Axios + TanStack Query hooks)
                    │
                    └── apps/ 前端应用直接使用带类型的 API 调用
```

---

[← 上一章](./01-overview.md) · [下一章：前端层详细设计 →](./03-frontend.md)

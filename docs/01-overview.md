# 第一章 文档索引与总览

## 1.1 平台简介

Enterprise Project Automation Platform（**EPAP**）是一个面向企业级软件研发场景的全栈自动化平台，核心目标是通过 AI 辅助、智能工作流和统一知识管理，显著提升团队的研发效率与质量。

> EPAP 不是一个单体应用，而是一套**多前端、多后端、多 AI 能力协同**的工作空间生态系统，所有子系统在统一的 Monorepo 框架下协同演进。

> **当前生产后端口径（2026-08）**：以 [`ADR-0001`](./adr/0001-zitadel-gin-platform-core.md) 为准。ZITADEL 是中央 OIDC Issuer，Go/Gin `api-gateway` 是唯一业务 API 入口，`identity-adapter` 与模块化 `platform-core` 承担身份编排和租户业务；本章以下未标注“当前”的旧 EPAP/Spring 方案仅作历史设计参考。

---

## 1.2 核心能力矩阵

| 能力域 | 子系统 | 技术栈 | 状态 |
|--------|--------|--------|------|
| 前端展示 | `apps/workbench`（桌面 Web） | React + TS + Vite + Axi UI | 已接入 |
| 移动端 | `apps/workbench-mobile`（独立应用） | React + TS + Vite + 微信式移动端壳 | 已接入 |
| 组件体系 | `shared/axi-ui` | Axi Core / Shell / Settings / Tokens | 已接入 |
| API 网关 | api-gateway | Go + Gin + ZITADEL JWKS + Redis | 已实现（待集群验收） |
| 身份适配 | identity-adapter | Go + Gin + ZITADEL + SMTP | 已实现（待集群验收） |
| 平台核心 | platform-core | Go + Gin + PostgreSQL RLS + Outbox | 已实现（待集群验收） |
| 原型兼容 | auth-service / core-service | Go JWT / Spring H2 | 只读迁移兼容 |
| 工作流 | workflow-engine | Python + FastAPI + PostgreSQL | 已接入网关（持久化与原子执行认领已实现，异步编排待补） |
| 消息通知 | notification-service | Go + Gin + PostgreSQL + SMTP | 已接入网关（收件箱、delivery worker 与 SMTP 已实现，Kafka 事件消费待补） |
| 文件处理 | file-service | Python + FastAPI + S3/MinIO + PostgreSQL | 已接入网关（对象/元数据持久化与预签名 URL 已实现，处理链待补） |
| 知识检索 | knowledge-base (RAG) | Python + Qdrant + LangChain | 规划中 |
| 智能协作 | agent-platform | Python + Anthropic SDK | 规划中 |
| 文档站点 | docs | Docusaurus 3 | 规划中 |

---

## 1.3 设计原则

### 1.3.1 架构级原则

- **单一职责（SRP）**：每个服务只负责一个有限的业务上下文，服务边界由领域模型驱动
- **关注点分离（SoC）**：前端 / 业务服务 / AI 能力 / 基础设施各层解耦，独立演进
- **类型安全优先（Type-First）**：从 Zod Schema 出发，贯通前端验证、API Contract、后端校验
- **基础设施即代码（IaC）**：所有环境配置通过 Terraform + Kubernetes Manifest 版本化管理
- **可观测性内建（Observability-First）**：日志、指标、链路追踪在架构设计阶段即纳入
- **AI 能力松耦合**：Agent 与 RAG 通过标准 Tool Interface 接入业务，不硬依赖任何服务

### 1.3.2 工程级原则

- **Monorepo 统一管理**：使用 Turborepo + PNPM Workspace 管理所有前端及共享包
- **每项目独立 CI/CD**：每个子系统有独立的流水线，但共享统一的基础 Action 库
- **测试覆盖门槛**：Unit ≥ 80%，Integration ≥ 60%，E2E 覆盖核心链路
- **文档与代码同步**：OpenAPI Spec 由代码注解自动生成，ADR 记录所有重要决策
- **代码生成减少重复**：API Client、类型定义、Mock 数据均通过 Schema 自动生成

---

## 1.4 技术选型决策摘要

| 决策项 | 选型结论与理由 |
|--------|---------------|
| 前端构建工具 | **Vite** — 极速 HMR，原生 ESM，生产构建性能优秀；Turbo 加速跨包任务 |
| 前端状态管理 | **Zustand**（全局）+ **TanStack Query**（服务端状态），轻量无样板代码 |
| 跨端移动框架 | **Taro 3** — 一套 React 代码同时构建微信小程序 / H5 / React Native |
| Schema 验证 | **Zod** — TypeScript-first，运行时验证与类型推断统一，支持自动生成 JSON Schema |
| API 网关语言 | **Go** — 高并发、低延迟、极小内存占用，适合高频代理场景 |
| 核心业务语言 | **Java + Spring Boot 3** — 成熟生态、事务管理、DDD 支持完善 |
| 工作流/AI 语言 | **Python** — LangChain/LlamaIndex 生态最完整，AI 工程首选 |
| 向量数据库 | **Qdrant** — Rust 实现，高性能，支持 payload 过滤，HTTP + gRPC 双接口 |
| 消息队列 | **Kafka** — 持久化、高吞吐、精确一次语义，适合跨服务异步事件 |
| 服务间同步通信 | **gRPC**（内部高频）+ **REST**（外部公开）双模式 |
| 容器编排 | **Kubernetes** — 生产环境标配，支持 HPA、滚动发布、多环境 |
| 文档框架 | **Docusaurus 3** — MDX 支持，搜索内置，与 Git 工作流集成自然 |

---

## 1.5 端口规划

| 服务 | 端口 |
|------|------|
| api-gateway | 8080 |
| identity-adapter | 8081 |
| platform-core | 8082 |
| api-gateway（宿主机开发映射） | 8088 |
| workflow-engine | 8083 |
| notification-service | 8084 |
| file-service | 8085 |
| knowledge-base HTTP | 8090 |
| knowledge-base gRPC | 9090 |
| agent-platform | 8091 |
| docs site | 3000 |
| workbench（Web + 移动 Web dev） | 5173 |
| Storybook | 6006 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Qdrant | 6333 |
| Kafka | 9092 |
| MinIO | 9000 |
| Prometheus | 9999 |
| Grafana | 3001 |
| Jaeger UI | 16686 |

---

## 1.6 环境规划

| 环境 | 用途 | 部署方式 | 数据策略 |
|------|------|----------|----------|
| local | 本地开发 | docker-compose | 脱敏测试数据 |
| dev | 集成测试 | K8s dev namespace | 自动刷新的种子数据 |
| staging | 预发布验证 | K8s staging namespace | 生产数据镜像（脱敏） |
| production | 生产环境 | K8s prod namespace | 真实数据，全备份 |

## 1.7 多端后台覆盖范围

用户后台按应用而非视口拆分：

- **桌面 Web**：`apps/workbench` 是独立的 Axi Dashboard 管理端，拥有侧边栏、顶栏插件、标签栏、面包屑、主题切换和设置面板。
- **移动端**：`apps/workbench-mobile` 是独立的微信式移动应用，拥有自己的顶栏、底部导航、扫码与个人页；它不导入 Web Dashboard 壳。
- **共享层**：只共享 Axi Identity 会话协议、相对 API 合同、语言偏好和设计令牌。两个应用不共享页面、路由或布局组件。

---

[← README](./README.md) · [下一章：总架构设计 →](./02-architecture.md)

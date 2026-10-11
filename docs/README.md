# Enterprise Project Automation Platform
## 完整架构设计文档集

> **版本** v1.0.0 · **状态** 规划中

---

## 文档索引

> 当前物理源码角色、主入口和根 workspace membership 以 [`architecture/source-catalog.md`](./architecture/source-catalog.md) 为准；本目录中的早期架构设计文档保留历史设计背景，不作为目录结构的唯一事实源。

| 章节 | 合并后入口 | 核心内容 |
|------|----------|----------|
| §1 Overview | [00-product-overview.md §1](./00-product-overview.md#1-overview) | 平台简介、设计原则、技术选型 |
| §2 Architecture | [00-product-overview.md §2](./00-product-overview.md#2-architecture) | 总架构、分层模型、数据流、通信矩阵 |
| §3 Frontend | [00-product-overview.md §3](./00-product-overview.md#3-frontendappsworkbench--appsworkbench-mobile--共享包) | Turborepo、所有前端应用与共享包 |
| §4 Backend | [00-product-overview.md §4](./00-product-overview.md#4-backendservices) | 六个后端服务详细设计 |
| §5 AI Layer | [00-product-overview.md §5](./00-product-overview.md#5-ai-layer) | RAG 知识库、Agent 协作平台 |
| §6 Infrastructure | [00-product-overview.md §6](./00-product-overview.md#6-infrastructure) | Docker、K8s、CI/CD、监控、安全 |
| §7 Docs Project | [00-product-overview.md §7](./00-product-overview.md#7-docs-projectappsaxi-docs-已接管) | Docusaurus 文档站、API 规范、ADR |
| §8 TODO 状态（已封存） | [00-product-overview.md §8](./00-product-overview.md#8-todo-状态已封存) | 完整 TODO 清单（已合并封存） |

> 8 份产品文档（`01-overview.md` ~ `08-todo.md`）已于 2026-09-27 合并为 [`00-product-overview.md`](./00-product-overview.md)；旧文件保留在仓库历史中，物理文件已被合并文档取代。
| 现行产品定位 | [state/PRD.md](./state/PRD.md) | Web 控制中心、Mobile 角色执行端与专业工具的分层；定义动作等级、能力归属与跨端交接 |
| 运行规约 | [rules/epap-six-layer-sop.md](./rules/epap-six-layer-sop.md) | 六层控制面 SOP、AGENT/MEMORY/SOUL/HEARTBEAT/DOCS 边界 |
| 项目文档系统 | [rules/epap-project-doc-agent-sop.md](./rules/epap-project-doc-agent-sop.md) | 每个项目的 README/AGENTS/CHANGELOG/MILESTONE/TODO/PRD/TDD/MEMORY 接入方式 |
| Prompt 层 | [../prompts/README.md](../prompts/README.md) | system/global/project 三层 prompt 管理 |

---

## 平台一句话简介

EPAP 是一个面向企业研发场景的全栈自动化平台，通过 **多前端 + 多后端 + AI 协作** 的 Monorepo 工作空间，统一管理项目、工作流、知识库与智能 Agent，显著提升团队研发效率。

## 技术栈速览

```
前端      React 18 + TypeScript + Vite + Turborepo + Taro + Zod
后端      Go (网关/认证) · Java Spring Boot (核心业务) · Python FastAPI (AI/工作流)
AI        LangChain · Qdrant · Anthropic Claude · RAG · Multi-Agent
基础设施   PostgreSQL · Redis · Kafka · MinIO · Kubernetes · Terraform
```

## 快速导航

- 想了解平台整体？→ [§2 Architecture](./00-product-overview.md#2-architecture)
- 想开发前端？→ [§3 Frontend](./00-product-overview.md#3-frontendappsworkbench--appsworkbench-mobile--共享包)
- 想开发后端服务？→ [§4 Backend](./00-product-overview.md#4-backendservices)
- 想做 AI 功能？→ [§5 AI Layer](./00-product-overview.md#5-ai-layer)
- 想部署运维？→ [§6 Infrastructure](./00-product-overview.md#6-infrastructure)
- 想知道要做什么？→ [§8 TODO 状态](./00-product-overview.md#8-todo-状态已封存)
- 想修改 IM/通信/控制面/Agent/记忆/文档/心跳工作流？→ [六层控制面 SOP](./rules/epap-six-layer-sop.md)
- 想让某个项目接入文档系统 agent？→ [项目文档系统 Agent SOP](./rules/epap-project-doc-agent-sop.md)

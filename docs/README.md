# Enterprise Project Automation Platform
## 完整架构设计文档集

> **版本** v1.0.0 · **状态** 规划中

---

## 文档索引

> 当前物理源码角色、主入口和根 workspace membership 以 [`architecture/source-catalog.md`](./architecture/source-catalog.md) 为准；本目录中的早期架构设计文档保留历史设计背景，不作为目录结构的唯一事实源。

| 章节 | 文件 | 核心内容 |
|------|------|----------|
| 第一章 | [01-overview.md](./01-overview.md) | 平台简介、设计原则、技术选型 |
| 第二章 | [02-architecture.md](./02-architecture.md) | 总架构、分层模型、数据流、通信矩阵 |
| 第三章 | [03-frontend.md](./03-frontend.md) | Turborepo、所有前端应用与共享包 |
| 第四章 | [04-backend.md](./04-backend.md) | 六个后端服务详细设计 |
| 第五章 | [05-ai-layer.md](./05-ai-layer.md) | RAG 知识库、Agent 协作平台 |
| 第六章 | [06-infrastructure.md](./06-infrastructure.md) | Docker、K8s、CI/CD、监控、安全 |
| 第七章 | [07-docs-project.md](./07-docs-project.md) | Docusaurus 文档站、API 规范、ADR |
| 第八章 | [08-todo.md](./08-todo.md) | 完整 TODO 清单（1020 项） |
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

- 想了解平台整体？→ [第二章 总架构](./02-architecture.md)
- 想开发前端？→ [第三章 前端层](./03-frontend.md)
- 想开发后端服务？→ [第四章 后端层](./04-backend.md)
- 想做 AI 功能？→ [第五章 AI 能力层](./05-ai-layer.md)
- 想部署运维？→ [第六章 基础设施](./06-infrastructure.md)
- 想知道要做什么？→ [第八章 TODO 清单](./08-todo.md)
- 想修改 IM/通信/控制面/Agent/记忆/文档/心跳工作流？→ [六层控制面 SOP](./rules/epap-six-layer-sop.md)
- 想让某个项目接入文档系统 agent？→ [项目文档系统 Agent SOP](./rules/epap-project-doc-agent-sop.md)

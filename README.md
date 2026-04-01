# Enterprise Project Automation Platform (EPAP)

> AI-powered enterprise project management and automation platform

## Overview

EPAP 是企业自动化平台的权威仓库，保留为项目级 monorepo。2026-04-01 的工作区治理收敛已移除嵌入式 `admin-dashboard` 副本，当前仓库聚焦于 EPAP 自身的 Web 门户、共享包、后端服务与 AI 能力。

## Current Structure

```text
enterprise-project-automation-platform/
├── apps/
│   └── web-portal/            # 主 Web 门户
├── packages/
│   ├── api-client/
│   ├── axi-rag/
│   ├── desktop/
│   ├── schemas/
│   ├── types/
│   ├── ui/
│   ├── utils/
│   └── web/
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── core-service/
│   ├── file-service/
│   ├── notification-service/
│   └── workflow-engine/
├── ai/
├── backend/
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

## Tech Stack

- Frontend: React 18 + TypeScript + Vite + Turborepo
- Backend: Go, Java Spring Boot, Python FastAPI
- AI: LangChain, Qdrant, RAG, Multi-Agent
- Infrastructure: PostgreSQL, Redis, Kafka, MinIO, Kubernetes, Terraform

## Commands

```bash
pnpm install
pnpm run dev
pnpm run dev:web
pnpm run build
pnpm run test
pnpm run lint
```

## Governance Notes

- 本仓库是批准保留的项目级 monorepo 之一。
- `btc-shopflow-monorepo` 是 `@btc/*` 包和 admin-dashboard 微前端树的唯一权威源，本仓库不再内嵌该副本。
- 跨项目共享能力应通过 `shared/*` 包或显式服务边界接入，而不是直接 vendoring 外部应用树。

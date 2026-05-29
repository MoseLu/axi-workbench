# Axi Workbench

> Axi workbench monorepo for control plane, dashboards, coder, docs/search, fleet, inbox, local assistants, and app CLI

## Overview

`Axi Workbench` 是 Axi 工作台大项目的权威 owner。它由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成，承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。远端仓库名称与少量 `EPAP_*`/`@epap/*` 兼容入口在迁移验证完成前保留。

## Current Structure

```text
axi-workbench/
├── apps/
│   ├── web-portal/            # 主 Web 门户
│   ├── devsvc-dashboard/      # 本地服务管理和 Axi 应用 host
│   ├── axi-coder/             # Axi 开发工作台
│   ├── verification-inbox/    # 验证码收件箱
│   ├── app-search-system/     # Docs/Search 控制与展示
│   └── ollama-menu-assistant/ # macOS Ollama 菜单助手
├── packages/
│   ├── api-client/
│   ├── axi-rag/
│   ├── desktop/
│   ├── schemas/
│   ├── epap-schemas-compat/  # `@epap/schemas` 迁移兼容出口
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
│   ├── communication-gateway/
│   ├── control-plane/
│   └── workflow-engine/
├── ai/
├── backend/
├── docs/
├── infra/
│   └── fleet-console/
├── tools/
│   └── axi-app-cli/
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
- `btc-shopflow-monorepo` 已归档为 Vue/qiankun 骨架参考；本仓库不迁入其业务 app、`@btc/*` 包或品牌资产。
- 跨项目共享能力应通过 `shared/*` 包或显式服务边界接入，而不是直接 vendoring 外部应用树。
- 新的公共服务/合同包使用 `@axi/workstation-control-plane`、`@axi/workstation-communication-gateway` 与 `@axi/workstation-contracts`；`@epap/schemas` 仅保留为迁移兼容转发。

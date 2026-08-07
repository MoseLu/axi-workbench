# Axi Workbench

> AxiomaticWorld workbench monorepo for control plane, dashboards, coder, docs/search, fleet, inbox, local assistants, and app CLI

**AxiomaticWorld: Build your working world from first principles.**

## Overview

`Axi Workbench` 是 AxiomaticWorld（公理世界）产品线的本地工作站控制面，也是 Axi 工作台大项目的权威 owner。它由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成，承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。远端仓库名称与少量 `EPAP_*`/`@epap/*` 兼容入口在迁移验证完成前保留。

## Naming

AxiomaticWorld（公理世界）是父品牌，域名为 `axiomaticworld.com`。`Axi` 是本地项目 id、app id、包作用域和 dashboard 标签使用的短前缀。命名原则来自数学公理：应用应当明确、可组合、可验证、专业，并由清晰合同约束。

中文 slogan：**以第一性原则，构建可验证的工作世界。**

正式口径：

- **Axi Core Projects**：顶层代码和能力 owner。
- **Axi Dashboard Apps**：可以在 DevSvc Dashboard 中打开的应用。
- **Axi Resources**：服务、合同、工具、shared runtime 和本地基础设施的完整能力索引。

## 生产后端演进（2026-08）

用户应用是两个独立部署的客户端：Web 管理端与移动端拥有各自的 UI、路由和交互；共享的仅是 Axi Identity OIDC、API 合同、语言偏好和设计令牌。开发环境使用相对 `/api`，生产构建各自注入同一 HTTPS 网关地址。

- `api-gateway`（Go + Gin）是唯一业务 API 入口，使用 ZITADEL JWKS、HttpOnly 会话、Redis 限流、追踪关联和无请求体审计日志。
- `identity-adapter`（Go + Gin）承接邮件验证、扫码登录事务和 EPS 身份映射；短期二维码事务在 Redis，长期验证/映射数据在 PostgreSQL。
- `platform-core`（Go + Gin）是模块化租户核心，包含成员/RBAC、偏好、字典、项目、任务、Outbox 与 PostgreSQL RLS。
- `workflow-engine`、`notification-service`、`file-service` 已接入同一 Gateway/Helm 内部拓扑；workflow 与 notification 已落 PostgreSQL 持久化和 migration Job，notification 还具备可恢复 delivery worker 与 SMTP，file 已支持生产 S3/MinIO + PostgreSQL 元数据及短时预签名 URL，分别保留 Python/Go/Python 专职边界，workflow 异步编排、Kafka 事件消费与文件处理链仍在迁移。
- `auth-service` 和 Spring/H2 `core-service` 只保留为迁移兼容来源，不是生产身份或业务数据 owner。

部署说明位于 [`infra/helm/README.md`](infra/helm/README.md)，架构决策位于 [`docs/adr/0001-zitadel-gin-platform-core.md`](docs/adr/0001-zitadel-gin-platform-core.md)。

## Current Structure

```text
axi-workbench/
├── apps/
│   ├── workbench/             # ★ Web 管理端（独立 Axi Dashboard 应用）
│   ├── workbench-mobile/      # ★ 移动端应用（独立微信式路由与移动壳）
│   ├── devsvc-dashboard/      # 本地服务管理和 Axi 应用 host（运维壳，非第二门户）
│   ├── axi-coder/             # 编码工具（可被 host 挂载）
│   ├── verification-inbox/    # 验证码收件箱
│   ├── app-search-system/     # Docs/Search 控制与展示
│   └── ollama-menu-assistant/ # macOS Ollama 菜单助手
├── packages/
│   ├── api-client/
│   ├── axi-rag/
│   ├── schemas/
│   ├── epap-schemas-compat/  # `@epap/schemas` 迁移兼容出口
│   ├── types/
│   ├── ui/                    # legacy layout（仅 workbench 过渡期）
│   ├── workbench-foundation/  # Web / 移动端共享认证与语言状态
│   └── utils/
├── services/
│   ├── api-gateway/            # Go/Gin 唯一业务 API 入口
│   ├── identity-adapter/        # Go/Gin Axi Identity 适配边界
│   ├── platform-core/           # Go/Gin 租户与业务模块核心
│   ├── auth-service/            # 原型兼容，不进入生产身份链路
│   ├── core-service/            # Spring/H2 只读迁移兼容
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
- Backend: Go/Gin + ZITADEL OIDC；Python/Node 专职能力；Spring/H2 仅迁移兼容
- AI: LangChain, Qdrant, RAG, Multi-Agent
- Infrastructure: PostgreSQL, Redis, Kafka, MinIO, Kubernetes, Terraform

## Commands

```bash
pnpm install
# ★ Web 管理端
pnpm run dev:workbench
# ★ 移动端应用
pnpm run dev:mobile
# 本地运维 Host（可选）
pnpm run dev:dashboard
pnpm run build
pnpm run test
pnpm run lint
# 后端本地依赖与迁移（容器内 8080，宿主机网关 8088）
make docker-up
make migrate-identity
make migrate-platform
```

打开：Web `http://127.0.0.1:5173` · 移动端 `http://127.0.0.1:5174`。

## Governance Notes

- 本仓库是批准保留的项目级 monorepo 之一。
- `btc-shopflow-monorepo` 已归档为 Vue/qiankun 骨架参考；本仓库不迁入其业务 app、`@btc/*` 包或品牌资产。
- 跨项目共享能力应通过 `shared/*` 包或显式服务边界接入，而不是直接 vendoring 外部应用树。
- 新的公共服务/合同包使用 `@axi/workstation-control-plane`、`@axi/workstation-communication-gateway` 与 `@axi/workstation-contracts`；`@epap/schemas` 仅保留为迁移兼容转发。

# Axi Workbench 工作台

> AxiomaticWorld 工作台 monorepo，承载控制面、dashboard、coder、docs/search、fleet、inbox、本地助手以及 app CLI

**AxiomaticWorld：以第一性原则，构建可验证的工作世界。**

## 概览

`Axi Workbench` 是 AxiomaticWorld（公理世界）产品线的本地工作站控制面，也是 Axi 工作台大项目的权威 owner。它由原 Axi Workstation 控制面吸收 DevSvc Dashboard、Axi Coder、Verification Inbox、App Search、Fleet Console、Ollama Menu Assistant 和 Axi App CLI 后形成，承载 Web 门户、`IMEnvelope`、`AgentTask`、资源快照、审计、artifact 服务边界和本地工作台入口。远端仓库名称与少量 `EPAP_*`/`@epap/*` 兼容入口在迁移验证完成前保留。

## 命名

AxiomaticWorld（公理世界）是父品牌，域名为 `axiomaticworld.com`。`Axi` 是本地项目 id、app id、包作用域和 dashboard 标签使用的短前缀。命名原则来自数学公理：应用应当明确、可组合、可验证、专业，并由清晰合同约束。

中文 slogan：**以第一性原则，构建可验证的工作世界。**

正式口径：

- **Axi Core Projects**：顶层代码和能力 owner。
- **Axi Dashboard Apps**：可以在 DevSvc Dashboard 中打开的应用。
- **Axi Resources**：服务、合同、工具、shared runtime 和本地基础设施的完整能力索引。

## 目录结构

```text
axi-workbench/
├── apps/
│   ├── workbench/             # ★ 唯一用户工作台（Web + 移动 Web）
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

## 技术栈

- 前端：React 18 + TypeScript + Vite + Turborepo
- 后端：Go、Java Spring Boot、Python FastAPI
- AI：LangChain、Qdrant、RAG、Multi-Agent
- 基础设施：PostgreSQL、Redis、Kafka、MinIO、Kubernetes、Terraform

## 命令

```bash
pnpm install
pnpm run dev
pnpm run dev:workbench
pnpm run build
pnpm run test
pnpm run lint
```

## 治理说明

- 本仓库是批准保留的项目级 monorepo 之一。
- `btc-shopflow-monorepo` 已归档为 Vue/qiankun 骨架参考；本仓库不迁入其业务 app、`@btc/*` 包或品牌资产。
- 跨项目共享能力应通过 `shared/*` 包或显式服务边界接入，而不是直接 vendoring 外部应用树。
- 新的公共服务/合同包使用 `@axi/workstation-control-plane`、`@axi/workstation-communication-gateway` 与 `@axi/workstation-contracts`；`@epap/schemas` 仅保留为迁移兼容转发。
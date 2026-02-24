# 第七章 文档项目设计

## 7.1 文档站点 — Docusaurus 3

> **定位**：EPAP 的官方文档站，整合架构文档、API 规范、开发指南、运维手册和 ADR。支持 MDX、内置 Algolia 全文搜索，通过 GitHub Actions 自动发布。

### 目录结构

```
docs/
├── docs/                               # 正文文档
│   ├── getting-started/
│   │   ├── prerequisites.md            # 环境要求（Node/Python/Go/Java/Docker）
│   │   ├── local-setup.md              # 本地启动完整步骤
│   │   └── first-contribution.md       # 贡献入门（PR 流程、规范）
│   │
│   ├── architecture/
│   │   ├── overview.md                 # 总架构概述
│   │   ├── frontend.md                 # 前端层详解
│   │   ├── backend.md                  # 后端服务详解
│   │   ├── ai-layer.md                 # AI 层详解
│   │   └── infrastructure.md           # 基础设施详解
│   │
│   ├── guides/
│   │   ├── adding-a-service.md         # 新增后端服务完整流程
│   │   ├── adding-a-feature.md         # 新增前端功能模块流程
│   │   ├── schema-driven-dev.md        # Schema 驱动开发流程（Zod → OpenAPI → Client）
│   │   ├── agent-development.md        # 开发新 Agent 完整指南
│   │   ├── knowledge-ingestion.md      # 知识库文档摄入指南
│   │   ├── writing-tests.md            # 测试最佳实践（各层级）
│   │   └── performance-optimization.md # 性能优化指南
│   │
│   ├── api-reference/                  # 由 OpenAPI 自动生成（docusaurus-plugin-openapi-docs）
│   │   ├── gateway.md
│   │   ├── core-service.md
│   │   ├── workflow-engine.md
│   │   ├── knowledge-base.md
│   │   └── agent-platform.md
│   │
│   ├── operations/
│   │   ├── deployment.md               # 各环境部署操作手册
│   │   ├── monitoring.md               # 监控指标与告警配置
│   │   ├── scaling.md                  # 扩缩容操作手册
│   │   ├── backup-recovery.md          # 备份与恢复流程
│   │   └── incident-runbook.md         # 故障处理手册（P0/P1 流程）
│   │
│   └── adr/                            # Architecture Decision Records
│       ├── template.md
│       ├── 001-monorepo-structure.md
│       ├── 002-api-gateway-go.md
│       ├── 003-rag-knowledge-base.md
│       ├── 004-agent-orchestration.md
│       ├── 005-frontend-state-management.md
│       └── 006-database-selection.md
│
├── api-specs/                          # OpenAPI YAML 源文件（手写 + 生成混合）
│   ├── gateway.openapi.yaml
│   ├── core-service.openapi.yaml
│   ├── workflow-engine.openapi.yaml
│   ├── kb-service.openapi.yaml
│   └── agent-platform.openapi.yaml
│
├── static/
│   ├── img/
│   │   ├── architecture-overview.png
│   │   └── logo.svg
│   └── diagrams/                       # PlantUML / Mermaid 源文件
│
├── src/
│   ├── components/                     # 自定义 MDX 组件
│   │   ├── ApiEndpoint.tsx
│   │   └── ArchDiagram.tsx
│   └── theme/                          # 自定义主题
│
├── docusaurus.config.ts
├── sidebars.ts
└── package.json
```

### docusaurus.config.ts（骨架）

```typescript
import type { Config } from "@docusaurus/types"

const config: Config = {
  title: "EPAP Docs",
  tagline: "Enterprise Project Automation Platform",
  url: "https://docs.epap.example.com",
  baseUrl: "/",
  organizationName: "your-org",
  projectName: "eap",

  themeConfig: {
    algolia: {
      appId: "YOUR_APP_ID",
      apiKey: "YOUR_SEARCH_API_KEY",
      indexName: "eap-docs",
    },
    navbar: {
      title: "EPAP",
      items: [
        { to: "/docs/getting-started/prerequisites", label: "快速开始" },
        { to: "/docs/architecture/overview", label: "架构" },
        { to: "/docs/api-reference/gateway", label: "API 参考" },
        { to: "/docs/adr/001-monorepo-structure", label: "ADR" },
        { href: "https://github.com/your-org/eap", label: "GitHub" },
      ],
    },
  },

  plugins: [
    [
      "docusaurus-plugin-openapi-docs",
      {
        id: "apiDocs",
        docsPluginId: "classic",
        config: {
          gateway: {
            specPath: "api-specs/gateway.openapi.yaml",
            outputDir: "docs/api-reference",
          },
        },
      },
    ],
    ["@docusaurus/plugin-mermaid", {}],
  ],
}

export default config
```

---

## 7.2 API 规范管理策略

### Spec-First 流程

```
① 编写 OpenAPI YAML (api-specs/*.openapi.yaml)
        │
        ├── ② openapi-generator → packages/api-client (前端 TypeScript 客户端)
        │
        ├── ③ Prism Mock Server → 前端开发阶段 Mock API
        │
        ├── ④ Spectral Lint → CI 中校验规范合规性
        │
        ├── ⑤ Pact Contract Test → 前后端契约测试
        │
        └── ⑥ docusaurus-plugin-openapi-docs → 生成 API 参考文档页面
```

### API 版本管理规则

| 变更类型 | 版本影响 | 兼容性 |
|---------|---------|--------|
| 新增可选字段 | Patch | ✅ 向后兼容 |
| 新增必填字段 | Minor | ⚠️ 需更新客户端 |
| 删除字段 / 修改语义 | Major | ❌ 破坏性变更 |
| 新增接口 | Minor | ✅ 向后兼容 |
| 删除接口 | Major | ❌ 需废弃通知 |

### Spectral 规范规则（`.spectral.yaml`）

```yaml
extends: ["spectral:oas"]
rules:
  operation-summary: error          # 所有接口必须有 summary
  operation-tags: error             # 必须有 tags
  response-200: error               # 所有接口必须有 200 响应定义
  info-contact: warn                # 建议填写联系信息
  no-eval-in-markdown: error        # 文档中禁止 eval
```

### OpenAPI 规范示例片段

```yaml
# api-specs/core-service.openapi.yaml
openapi: 3.1.0
info:
  title: Core Service API
  version: 1.0.0
  contact:
    name: EPAP Team
    email: dev@epap.example.com

paths:
  /projects:
    get:
      summary: 分页查询项目列表
      operationId: listProjects
      tags: [Projects]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: pageSize
          in: query
          schema:
            type: integer
            default: 20
        - name: status
          in: query
          schema:
            $ref: "#/components/schemas/ProjectStatus"
      responses:
        "200":
          description: 成功
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProjectListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

components:
  schemas:
    ProjectStatus:
      type: string
      enum: [active, archived, draft, completed]
```

---

## 7.3 ADR — 架构决策记录

### ADR 模板

```markdown
# ADR-NNN: 决策标题

**状态**: Proposed | Accepted | Deprecated | Superseded by [ADR-XXX]
**日期**: YYYY-MM-DD
**决策者**: @username1, @username2

---

## 背景

> 描述驱动这个决策的问题或需求。包含当时面临的约束和上下文。

## 决策

> 我们选择了什么。用主动语态清晰描述。

## 结果

### 正面影响
- ...

### 负面影响 / 权衡
- ...

### 风险
- ...

## 替代方案

### 方案 A：...
**未选择原因**：...

### 方案 B：...
**未选择原因**：...
```

### 已有 ADR 列表

| ADR | 标题 | 状态 |
|-----|------|------|
| [001](./adr/001-monorepo-structure.md) | Monorepo 策略与 Turborepo 选型 | Accepted |
| [002](./adr/002-api-gateway-go.md) | API Gateway 选用 Go + Gin | Accepted |
| [003](./adr/003-rag-knowledge-base.md) | RAG 知识库技术选型（Qdrant + LangChain） | Accepted |
| [004](./adr/004-agent-orchestration.md) | Agent 编排策略（Plan-Execute vs ReAct） | Accepted |
| [005](./adr/005-frontend-state-management.md) | 前端状态管理（Zustand vs Redux Toolkit） | Accepted |
| [006](./adr/006-database-selection.md) | 数据库选型（PostgreSQL + Redis + Qdrant） | Accepted |

---

## 7.4 文档发布 CI

```yaml
# .github/workflows/docs-deploy.yml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths: ["docs/**"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: cd docs && pnpm install
      - run: cd docs && pnpm build
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/build
```

---

[← 上一章](./06-infrastructure.md) · [下一章：完整 TODO 清单 →](./08-todo.md)

# Axi Docs - Axi 知识中枢

> 基于 Vite + React 的多文档库知识中枢，用于给人浏览 Axi 工作区文档，也通过 MCP 给 agent 提供项目、技能和知识库参考。

## 当前定位

Axi Docs 不是单一 Markdown 站点，而是多个文档项目的统一索引层：

- **Web**: Dashboard + VitePress-like 文档阅读页 + 搜索 + 图谱
- **MCP**: 面向 agent 的 source 列表、跨库搜索、原文读取、workspace 状态和项目摘要
- **文档项目**: Workspace registry、Axi Skills、dbskill、Obsidian、Blinko

`axi-skills` 作为独立仓库保持原生 `skills/**/SKILL.md` 结构，Axi Docs 通过 `skills` adapter 解析，不要求技能文件改成 Obsidian frontmatter。

## 技术栈

- **构建工具**: Vite 5.x
- **前端框架**: React 18 + TypeScript
- **文档解析**: react-markdown + remark-gfm
- **文件监听**: chokidar (文件变化监听)
- **样式**: CSS Modules + CSS Variables

## 文档来源

| 源 | 类型 | 说明 |
|----|------|------|
| Axi Workspace | 本地 registry | 工作区项目状态、路径、验证命令、治理目录 |
| Axi Skills | 本地 skill library | 共享 agent 技能库，读取 700+ `skills/**/SKILL.md`，并按 dbskill-style 能力族组织 |
| dbskill | 本地 skill library | dontbesilent 最新 dbskill 工具箱，完整索引 21 个 dbs skill、知识包、模板和内容工程脚手架 |
| Obsidian | 本地目录 | 本地 Obsidian Vault |
| Blinko | API | 闪念笔记 & 灵感捕捉 |

主文档项目 registry 在 `src/config/documentSources.ts`，旧 `src/config/sources.ts` 仅保留兼容入口。

## 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 初始化 Git 运维规范
pnpm git:bootstrap
pnpm hooks:install

# 复制环境变量模板
cp .env.example .env

# 启动开发服务器
pnpm dev
```

### 生产部署（Docker）

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env 文件，配置 Blinko Token（如 Blinko 开启认证）
BLINKO_TOKEN=your-blinko-api-token

# 3. 启动 Docker 容器
docker-compose up -d

# 4. 访问服务
http://localhost:5173
```

### 生产部署（Node.js + systemd）

```bash
# 1. 安装依赖并构建
pnpm install --frozen-lockfile
pnpm build

# 2. 准备服务环境
cp .env.example .env.server

# 3. 启动统一的 HTTP + MCP 服务
MCP_HTTP_PORT=3010 BIND_ADDRESS=0.0.0.0 pnpm mcp:http
```

和 Hermes 同机部署时，推荐至少补这两个环境变量：

- `OBSIDIAN_PATH=/root/.hermes/knowledge`
- `AXI_DOCS_EXTRA_SOURCES_JSON=[{"id":"hermes-system","name":"Hermes System","path":"/root/.hermes/memories","type":"local","enabled":true,"description":"Hermes 长期记忆与系统文档","icon":"folder"}]`

这样 Axi Docs 的前端和 MCP 都能直接读取 Hermes 的知识目录与长期记忆目录。

## 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `VITE_API_BASE` | 否 | API 基础路径，默认 `/docs/api` |
| `BLINKO_URL` | 否 | Blinko API 地址，默认 `http://localhost:3006` |
| `BLINKO_TOKEN` | 条件 | Blinko API Token（Blinko 开启认证时必填） |
| `OBSIDIAN_PATH` | 条件 | Obsidian Vault 路径（本地开发时需要） |
| `AXI_DOCS_EXTRA_SOURCES_JSON` | 否 | 追加本地/API 知识源的 JSON 数组，可用于挂载 Hermes 目录 |
| `AXI_SKILLS_PATH` | 否 | Axi Skills 仓库路径，默认 `/Volumes/code/workspace/shared/axi-skills` |
| `DBSKILL_PATH` | 否 | dbskill 仓库路径，默认 `/Volumes/code/workspace/shared/dbskill` |
| `DBSKILL_CONTENT_ASSETS_ENABLED` | 否 | 是否启用 dbskill 来源，设为 `false` 可关闭 |
| `AXI_WORKSPACE_GOVERNANCE_PATH` | 否 | workspace governance 仓库路径 |

### Token 优先级

```
1. BLINKO_TOKEN 环境变量（Docker/生产环境推荐）
2. 空字符串（Blinko 关闭认证时）
```

## 开发命令

```bash
pnpm install            # 安装依赖
pnpm git:bootstrap      # 初始化 dev/main 治理基线
pnpm hooks:install      # 安装 commit-msg / pre-commit / pre-push
pnpm commit             # 交互式约定式提交
pnpm quality:check      # 治理 + lint + coverage
pnpm verify             # 构建验证
pnpm dev                # 开发模式
pnpm build              # 生产构建
pnpm preview            # 预览生产构建
pnpm test               # 运行测试
pnpm mcp                # 运行 MCP 服务器
pnpm mcp:http           # MCP HTTP 模式
```

## MCP 语义化工具

保留旧 `obsidian_*` 工具，同时新增 Axi Docs 统一工具：

- `axi_docs_list_sources`
- `axi_docs_search`
- `axi_docs_read`
- `axi_docs_skill_search`
- `axi_docs_workspace_status`
- `axi_docs_project_summary`

## 运维规范

Axi Docs 已对齐 Axi 的统一运维基线：

- `dev` 是默认集成分支
- `main` 是生产发布分支
- 所有工作通过 Pull Request 合入
- commit message 和 PR 标题统一使用 Conventional Commits

运维入口文档：

- `docs/OPERATIONS.md`
- `docs/GITHUB_FLOW.md`
- `docs/BRANCH_PROTECTION.md`
- `docs/COMMIT_CONVENTION.md`
- `docs/RELEASE_OPERATIONS.md`
- `docs/QUALITY_GATE.md`

## 端口

- 开发服务器：`http://localhost:5173`
- Vite 代理：`/docs/api` → `http://localhost:3009`
- MCP HTTP 服务：`http://localhost:3010`

## Docker 部署 Blinko + Axi Docs

完整的 Blinko + Axi Docs 部署：

```yaml
version: '3.8'

networks:
  blinko-network:
    driver: bridge

services:
  blinko:
    container_name: blinko
    image: blinko:latest
    ports:
      - "3006:3006"
    environment:
      - BLINKO_TOKEN=your-secure-token
    networks:
      - blinko-network

  axi-docs:
    container_name: axi-docs
    build: .
    ports:
      - "5173:5173"
    environment:
      - BLINKO_URL=http://blinko:3006
      - BLINKO_TOKEN=your-secure-token
    depends_on:
      - blinko
    networks:
      - blinko-network
```

## 项目结构

```
app/
├── src/
│   ├── components/     # React 组件
│   ├── hooks/          # 自定义 Hooks
│   ├── services/       # 文件服务、同步服务
│   ├── mcp/            # MCP 服务器
│   ├── types/          # TypeScript 类型
│   ├── config/         # 配置文件
│   ├── styles/         # 全局样式
│   ├── App.tsx
│   └── main.tsx
├── public/
├── .env.example        # 环境变量模板
├── .env                # 本地环境变量（不提交）
├── docker-compose.yml  # Docker 编排
├── Dockerfile          # Docker 镜像
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 常见问题

### Q: Blinko Token 在哪里获取？

A: 在 Blinko 的用户设置或 API 设置页面获取 JWT Token。

### Q: Docker 容器无法访问 Blinko？

A:
- 方案 1：配置 `BLINKO_URL=http://host.docker.internal:3006`（访问宿主机）
- 方案 2：将 Blinko 和 Axi Docs 放在同一 Docker 网络中

### Q: 如何持久化同步的笔记？

A: `docker-compose.yml` 中已配置 `axi-docs-data` 卷，数据会自动持久化。

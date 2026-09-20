---
name: axi-docs
description: Axi Docs 文档同步与查看平台的架构规则和 Agent 指南
---

# Axi Docs AGENTS.md

> 本文件定义 Axi Docs 项目的架构规则。当前应用代码仍位于 `app/` 子目录，所有代码变更必须符合本文件的模块划分和技术选型。

---

## 项目概述

Axi Docs 是一个文档同步与查看平台，提供以下功能：
- 从 Blinko API 同步笔记到本地
- 提供 Web 界面浏览和搜索文档
- 提供 MCP (Model Context Protocol) 服务器供 AI 访问
- 支持知识图谱可视化

---

## 模块划分

| 模块 | 路径 | 职责 | 技术栈 |
|------|------|------|--------|
| `src/App.tsx` | 主应用 | 应用入口和路由 | React 18 / TypeScript |
| `src/components/` | UI 组件 | 可复用组件库 | React / TSX |
| `src/config/` | 配置管理 | 文档源配置 | TypeScript |
| `src/mcp/` | MCP 服务器 | MCP 协议实现 | Node.js / Anthropic SDK |
| `src/services/` | 服务层 | 文档处理和同步 | TypeScript |
| `src/types/` | 类型定义 | 共享类型定义 | TypeScript |
| `src/test/` | 测试代码 | 单元测试和集成测试 | Vitest / Testing Library |

---

## 技术栈约束

| 约束类型 | 规则 |
|---------|------|
| 语言版本 | TypeScript 5.5+ / Node.js 20+ |
| 包管理 | pnpm（本项目运维基线使用 pnpm） |
| 代码格式 | Vite + TypeScript |
| 测试框架 | Vitest（单元/集成）+ Testing Library（组件测试） |
| 构建工具 | Vite 5+ |
| UI 框架 | React 18 / React Router 7 |
| 数据格式 | Markdown / JSON |

---

## 仓库治理规则

- `dev` 是默认集成分支，`main` 是生产发布分支
- 常规开发从 `dev` 拉出短生命周期分支
- 生产问题使用 `hotfix/*` 从 `main` 拉出并在上线后回灌 `dev`
- Commit Message 与 PR 标题统一使用 Conventional Commits
- 提交前至少通过：
  - `pnpm quality:check`
  - `pnpm verify`
- 参考运维文档：
  - `docs/OPERATIONS.md`
  - `docs/GITHUB_FLOW.md`
  - `docs/BRANCH_PROTECTION.md`
  - `docs/COMMIT_CONVENTION.md`
  - `docs/RELEASE_OPERATIONS.md`
  - `docs/QUALITY_GATE.md`

---

## 核心功能模块

### 1. 文档源配置 (`src/config/`)

**职责**：管理多个文档源的配置（Obsidian、Blinko 等）

**关键文件**：
- `sources.ts` - 文档源定义和注册
- `sources.test.ts` - 配置测试

**规则**：
- 每个文档源必须有唯一的 `id`
- 文档源接口必须实现 `DocSource` 接口
- 支持环境变量覆盖配置

### 2. MCP 服务器 (`src/mcp/`)

**职责**：实现 MCP 协议，提供文档访问工具

**关键文件**：
- `server.ts` - MCP 服务器主逻辑
- 工具：`obsidian_scan`, `obsidian_read`, `obsidian_write`, `obsidian_search`

**规则**：
- 遵循 MCP JSON-RPC 2.0 规范
- 提供标准错误响应格式
- 支持认证 Token 验证（生产环境）
- 提供健康检查端点 `/health`

#### Workflow-first 受限 Agent 身份

- `bounded_agent` 是独立调用身份，必须使用
  `AXI_DOCS_BOUNDED_AGENT_TOKEN`；不得复用人工/UI 的 `MCP_AUTH_TOKEN`。
- 该身份只能调用能力目录标为 `read_only` 且 `agentAllowed=true` 的 MCP
  工具，取得带内容哈希版本的 `contextRef`；原始文档读取和未知工具默认拒绝。
- 该身份请求 `obsidian_write`、`blinko_*` 写入或其他副作用时，服务只返回
  `task-execution-routing/v1` 的 `approval_required` 副作用提案及精确
  `actionDigest`，绝不直接落盘或调用外部写接口。
- 人工 MCP/UI 的既有授权路径不因该 Agent 约束而改变；跨项目控制流由
  Workbench durable approval 的 `APPROVED_EFFECT` 持有。

### 3. 组件库 (`src/components/`)

**职责**：UI 组件，支持可复用和组合

**关键组件**：
- `Header.tsx` - 应用头部导航
- `FileTree.tsx` - 文件树视图
- `KnowledgeGraph.tsx` - 知识图谱可视化
- `Sidebar.tsx` - 侧边栏导航
- `SearchResults.tsx` - 搜索结果展示

**规则**：
- 每个组件必须有对应的测试文件
- 使用 TypeScript 严格模式
- 组件接受 `className` prop 用于样式定制
- 使用 React Hooks 管理状态

---

## API 规范

### MCP 工具响应格式

```typescript
interface McpToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

### REST API 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 代码组织规则

| 规则 | 说明 |
|------|------|
| 单一职责 | 每个文件只做一件事 |
| 类型优先 | 先写类型定义，再写实现 |
| 测试覆盖 | 核心功能必须有测试 |
| 错误处理 | 使用 try-catch 并提供有意义的错误消息 |

---

## 同步机制

### Blinko 同步流程

```
sync-blinko.js
    ↓
调用 Blinko API
    ↓
解析 Markdown 内容
    ↓
写入 blinko-notes/ 目录
    ↓
触发前端更新
```

**关键文件**：
- `sync-blinko.js` - Blinko 同步脚本
- `blinko-notes/` - 同步后的笔记目录

**规则**：
- 同步前检查 API 可用性
- 使用幂等操作，支持重复同步
- 记录同步日志
- 处理网络错误和重试

---

## 安全约束

| 约束 | 说明 |
|------|------|
| API Token | 存储在 `.env` 文件，不提交到 Git |
| 认证 | MCP 服务器使用 Token 认证（生产环境） |
| 文件访问 | 限制访问路径，防止路径遍历攻击 |
| CORS | 配置合适的 CORS 策略 |

---

## 性能约束

| 指标 | 目标 |
|------|------|
| 首屏加载 | < 2s (3G) |
| API 响应 | < 200ms (p95) |
| 测试覆盖率 | > 60% |
| Bundle 大小 | < 500KB |

---

## 开发工作流

### 启动开发服务器

```bash
pnpm install
pnpm dev
```

### 启动 MCP 服务器

```bash
pnpm mcp:http
```

### 运行测试

```bash
pnpm test             # 监听模式
pnpm test:run         # 单次运行
pnpm test:coverage    # 覆盖率报告
```

### 构建

```bash
pnpm build
pnpm preview
```

---

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|---------|------|
| `OBSIDIAN_PATH` | `./obsidian` | Obsidian Vault 路径 |
| `BLINKO_URL` | `http://localhost:1111` | Blinko 服务地址 |
| `BLINKO_TOKEN` | 空 | Blinko API Token |
| `MCP_AUTH_TOKEN` | 自动生成 | MCP 访问 Token |
| `AXI_DOCS_BOUNDED_AGENT_TOKEN` | 空 | 受限 Agent 专用 MCP 身份凭证 |
| `AXI_DOCS_CALLER` | `human` | 进程默认调用身份；部署中由专用 Token 识别 Agent |
| `ANTHROPIC_API_KEY` | 空 | Anthropic API Key |

---

## 常见任务

### 添加新的文档源

1. 在 `src/config/sources.ts` 中定义新文档源
2. 实现 `DocSource` 接口
3. 在 MCP 服务器中注册新工具
4. 添加测试用例

### 添加新的 UI 组件

1. 在 `src/components/` 创建组件文件
2. 编写对应的测试文件
3. 在主应用中导入并使用
4. 确保类型安全

### 修复 Bug

1. 找到相关文件
2. 编写测试用例重现问题
3. 修复代码
4. 验证测试通过
5. 检查覆盖率

---

## 参考文档

- [MCP 协议规范](https://modelcontextprotocol.io)
- [React 文档](https://react.dev)
- [Vite 文档](https://vitejs.dev)
- [Vitest 文档](https://vitest.dev)

---

*最后更新：2026-03-26；2026-08-08 增 Gotchas 章节；2026-08-17 增 Rules reminder*

---

## Rules reminder

> 本节列出当前生效的 R-NNN 约束(详见 `docs/rules/`)。每条带守卫命令,
> 违反即在 `pnpm --dir app verify` 链退出 1。

- [R001](docs/rules/R001-no-fragmented-commits.md) — 不允许把单个 feature 拆成多个并列 commit
- [R002](docs/rules/R002-naming-singular-plural.md) — 命名漂移:同一概念必须使用同一单词(单复数一致)
- [R003](docs/rules/R003-mcp-log-dir-must-match.md) — MCP 读端与 launcher 写端必须共享日志目录常量

完整列表与新增流程见 [`docs/rules/README.md`](docs/rules/README.md)。

---

## Gotchas（踩过的坑）

### `docs/projects.index.json` 是生成产物，不可手改

`docs/projects.index.json` 与 `docs/content/{en,zh}/projects/<id>/*.md` 全部由
`scripts/build-projects-index.mjs` 从
`/Volumes/code/workspace/.workspace/project-handoff.json`（首选）和
`/Volumes/code/workspace/WORKSPACE_INDEX.md`（兜底）自动重建。

**严禁**：

- `Edit` / `Write` `docs/projects.index.json` 的 `projects` 数组 — 下一次
  `pnpm --dir app projects:build` 会按 handoff 真源整列冲掉。
- 直接 `rm -rf docs/content/{en,zh}/projects/<id>/` 删除 dossier — `projects:build`
  会基于 `preservedAddenda` 字段（status 含 `hand-curated` 字面量）尝试恢复，
  或在 handoff 中含该 id 时再次生成。

**正确路径**：

- 增删 dossier → 改 handoff 生成器
  (`infra/axi-workspace-governance/scripts/project-handoff.mjs`)；
  或改 build script 里的"显式 skip"清单（如 `axi-workspace-governance` /
  `axi-registry` 在 `scripts/build-projects-index.mjs:228-229`）。
- 改 dossier 内容（描述/状态/技术栈）→ 改项目根 `AGENTS.md` / `README.md`，
  重新跑 `pnpm --dir app projects:build` 让 dossier 重建。
- 仅"逃生口"项目（无任何项目根门面，如 `codex-plus-app`）需手工维护 dossier —
  此时把 dossier 加进 `preservedAddenda`，并在文件 frontmatter 中显式标
  `status: hand-curated`，避免被无差别冲掉。

### `axi-workspace-governance` 永远不在 `projects.index.json`

`scripts/build-projects-index.mjs:228` 显式 skip 该项目（连同 `axi-registry`），
因为它的展示面是 `docs/axi-workspace-governance/` 镜像目录，不是 dossier 总表。
**不要**把它加回 `projects.index.json` —— 下一次 build 会再次冲掉。如需在
dossier 总表出现，需改 build script（默认不改）。

### handoff 优先于 `WORKSPACE_INDEX.md`

`build-projects-index.mjs` 走"handoff 优先"策略：从
`/Volumes/code/workspace/.workspace/project-handoff.json` 解析 19 项 active Axi
项目，再从 `WORKSPACE_INDEX.md` 联合 references 与 virtual 项目（标
`supplementary: true`）。如果两源对同一项目说法冲突，以 handoff 为准。

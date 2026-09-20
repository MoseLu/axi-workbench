# Axi Docs PRD

> 本文件是 axiom-docs 项目的正式产品需求文档。

## 1. 项目概述

**项目名称**: Axi Docs
**项目类型**: 工作区文档中心 + MCP 文档访问层
**核心定位**: 聚合多源文档、通过 MCP 工具为 AI agent 提供结构化文档访问

### 核心价值主张

- **文档枢纽**: 聚合 Obsidian、Blinko、workspace registry、Axi Skills 等多源文档
- **知识图谱 UI**: 将文档间标签/链接关系可视化为力导向图
- **MCP 文档总线**: 通过 `axi_docs_*` 语义化工具让 AI agent 从外部访问文档
- **项目门面镜像**: 跨 5 个分区的 Axi 项目档案镜像

### 非目标（Non-Goals）

- **不是规则引擎**: 不执行行为约束或 SOP
- **不是源权威**: 工作区治理文档的权威源在 `infra/axi-workspace-governance/`
- **不是翻译引擎**: `references/*` 不翻译

## 2. 在工作区中的职责

### 职责矩阵

| 职责 | 描述 | 优先级 |
|------|------|--------|
| 文档聚合 | 从多源适配器聚合文档内容 | P0 |
| MCP 服务 | 提供 `axi_docs_*` 工具供 agent 调用 | P0 |
| Web 阅读 | Vite React 阅读器展示文档 | P1 |
| 知识图谱 | 力导向图可视化文档关系 | P1 |
| 项目镜像 | 工作区项目档案的本地镜像 | P1 |

### 在 Agent 决策链中的位置

```
1. System / Developer / Direct User 指令
2. axiom-rules 规则索引和规则模块
3. Local Codex 记忆和生成的 bridge 记忆
4. axiom-docs 回退知识库 (本项目)
5. 实时工作区检查
6. 仅在 unsafe / irreversible / credential-gated / 外部生产 / 重大范围变更时询问用户
```

## 3. MCP 工具列表

### 核心工具

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `axi_docs_search` | 语义化文档搜索 | `query`, `sources?`, `limit?` |
| `axi_docs_get_project` | 获取项目档案 | `projectId` |
| `axi_docs_list_projects` | 列出所有项目档案 | `partition?` |
| `axi_docs_get_doc` | 获取指定文档 | `path`, `lang?` |
| `axi_docs_get_knowledge_graph` | 获取知识图谱数据 | `projectId?` |

### 工具约束

- 工具返回结构化 JSON，不返回原始 Markdown
- 受限 agent 消费者仅获取只读、版本化上下文
- 任何文档写入必须返回副作用提案并交由 Workbench 审批

## 4. 与 axiom-rules 的分工

### 分工原则

| 维度 | axiom-rules (Rank 2) | axiom-docs (Rank 4) |
|------|----------------------|---------------------|
| **性质** | 约束层 + SOP 层 | 知识层 + 文档层 |
| **内容** | 规则、流程、决策树 | 说明、指南、背景 |
| **受众** | AI agent | 人类开发者 + AI agent |
| **粒度** | 可执行的操作指引 | 解释性文档 |
| **优先级** | 先查 rules，再查 docs | 仅在 rules 不够时回退 |

### 协作模式

```
Agent 启动 → axiom-rules INDEX.md → 查具体规则模块 → 无法回答 → axiom-docs
                                              ↓
                                       实时工作区检查
```

### 边界定义

- **axiom-rules 独有**: 行为规则、SOP、提交协议、生命周期门控、安全约束
- **axiom-docs 独有**: 产品使用指南、API 参考、架构说明、示例代码
- **axi-docs 对 axiom-rules 的关系**: 规则正文在 rules 中索引，解释性内容在 docs 中

## 5. 项目结构

```
axi-docs/
├── app/                      # React/Vite 应用包
│   ├── src/
│   │   ├── components/       # UI 组件
│   │   ├── mcp/              # MCP server 和工具定义
│   │   ├── adapters/         # 文档源适配器
│   │   └── scripts/          # 构建脚本
│   ├── AGENTS.md             # 应用包内部约束
│   └── package.json
├── docs/
│   ├── content/
│   │   ├── en/               # 英文文档
│   │   │   ├── guide/        # 使用指南
│   │   │   ├── plans/        # 长期方案
│   │   │   └── projects/     # 项目档案
│   │   └── zh/               # 中文文档（与 en 同构）
│   ├── axi-workspace-governance/  # 工作区治理镜像（只读）
│   └── project-docs.manifest.json # 文档清单
├── plans/                    # 根级规划入口
└── PRD.md                    # 本文档
```

## 6. 验收标准

### 功能验收

- [ ] MCP server 成功启动并注册所有 `axi_docs_*` 工具
- [ ] Web 阅读器成功渲染中英文文档
- [ ] 知识图谱正确展示文档关系
- [ ] 项目档案镜像包含工作区所有项目的基本信息

### 集成验收

- [ ] Agent 在 axiom-rules 无法回答时正确回退到 axiom-docs
- [ ] `axi_docs_search` 返回语义相关结果
- [ ] `axi_docs_get_project` 返回项目档案的完整信息
- [ ] 受限 agent 消费者无法通过 MCP 工具写入文档

### 文档验收

- [ ] 中英文文档的 frontmatter `id` 保持一致
- [ ] `docs/axi-workspace-governance/` 保持只读镜像状态
- [ ] `references/*` 不被翻译或编辑
- [ ] 文档内容变更不触发不必要的构建

### 技术验收

- [ ] `pnpm --dir app verify` 通过（MCP 协议冒烟测试）
- [ ] `pnpm --dir app quality:check` 通过
- [ ] `pnpm --dir app test` 通过
- [ ] `pnpm --dir app build` 成功生成构建产物

## 7. 关键约束

### 禁止事项

- 不将 `references/*` 或 `infra/axi-workspace-governance/` 的内容当作本项目可写范围
- 不把 `references/*` 翻译为中英文
- 不将其他 Axi 项目的 README、AGENTS、ADR 原样复制到 `docs/content/`
- 不在业务代码中硬编码跨项目绝对路径

### 强制事项

- 根级 AGENTS.md 与 app/AGENTS.md 保持双层结构
- 文档源通过 `docs/sources.lock.json` 管理，不使用 git submodule
- 变更记录写入 `docs/state/CHANGELOG.md`
- 跨项目契约变更前先查 `workspace-project consumers axi-docs`

## 8. 维护协议

### 文档同步

- 工作区治理文档: 权威源在 `infra/axi-workspace-governance/`，镜像按需更新
- Axi Skills: 通过 `docs/sources.lock.json` 版本化消费
- 项目档案: 由 `app/scripts/build-projects-index.mjs` 维护

### 验证流程

| 变更类型 | 验证命令 |
|----------|----------|
| `app/src/**` | `pnpm --dir app quality:check` |
| `app/src/mcp/**` | `pnpm --dir app verify` |
| `docs/content/{en,zh}/**` | frontmatter 检查（无构建） |
| `docs/content/{en,zh}/plans/**` | 方案正文为长期决策 |

---

*最后更新: 2026-09-17*

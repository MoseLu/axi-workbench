# Axi 共享栈架构：Axi Skills × Axi Rules × Axi Docs

> 范围：Axi 工作区中负责"代理能力 / 代理行为 / 知识呈现"三件事的共享基础设施。
> 读这份文档的人/代理：想知道"我的运行时怎么拼出来"以及"应该先查哪一份"的工程师或代理。
> 不在范围：单个项目的内部实现（看各自的 `AGENTS.md` / `app/AGENTS.md` / `app/src/**`），也不在范围：业务产品（`axi-image-preview`、`axi-pet` 等）。

---

## 1. 一句话定位

| 项目 | 路径 | 回答什么问题 | 一句话 |
|---|---|---|---|
| **Axi Skills** | `/Volumes/code/workspace/shared/axi-skills` | 「这个**能力**存不存在、怎么调用？」 | 700+ 共享 `SKILL.md` 的**运行时真源**，所有代理读同一份。 |
| **Axi Rules** | `/Volumes/code/workspace/projects/axi-rules` | 「我**应该怎么**做？」 | 行为约束 + 项目路由 + 源序索引 + 前端力导向图。 |
| **Axi Docs** | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs` | 「这个项目/技能/工作区**是什么**？」 | 文档枢纽 + 知识图谱 + MCP 文档总线。 |

三者**不是同级替代品**，而是 agent 工作流的**三个不同环节**。

---

## 2. 角色拓扑

```
                    ┌──────────────────────────────────────┐
                    │  System / Developer / User 直接指令  │  ← 最高优先级
                    └──────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │  axi-rules  (行为层 · projects/)     │
                    │  ─ 解析顺序: rules > memory > docs  │
                    │  ─ 产物: index/{projects,rules,     │
                    │           fallbacks}.{md,json}      │
                    │  ─ 前端: 力导向图 (项目/规则关系)    │
                    └──────────────────────────────────────┘
                                       │ (fallback)
                                       ▼
                    ┌──────────────────────────────────────┐
                    │  axi-docs    (知识层 · projects/)    │
                    │  ─ Web: Dashboard + 阅读页 + 知识图谱│
                    │  ─ MCP: axi_docs_* 工具集            │
                    │  ─ 源: workspace / axi-skills /      │
                    │        dbskill / Obsidian / Blinko   │
                    └──────────────────────────────────────┘
                                       │ (本地存储)
                                       ▼
                    ┌──────────────────────────────────────┐
                    │  axi-skills  (能力层 · shared/)      │
                    │  ─ skills/  : 700+ SKILL.md 真源      │
                    │  ─ skills.zh: 中文镜像 (git-ignored)  │
                    │  ─ scripts/ : verify / i18n / sync    │
                    └──────────────────────────────────────┘
```

> **关键不变量**：Skills 不"消费" Rules 或 Docs；Rules 不"消费" Docs（只把它列为 fallback knowledge）；Docs **不修改** Skills 文件，只**读取并渲染** Skills 树（详见 §5）。

---

## 3. Axi Skills（能力层）

`/Volumes/code/workspace/shared/axi-skills`（`shared/` 分区，独立仓库）。

**职责**：为 Codex / Claude / Cursor / MiniMax 等代理维护**同一份**技能树，结束"每个 agent 各维护一份 skills"导致的漂移。

**关键产物**：

- `skills/` — 英文运行时真源，每个能力是 `skills/<name>/SKILL.md` 自包含目录。
- `skills.zh/` — 中文本地化镜像，**git-ignored**，由 `scripts/build_batches.py` + `verify_i18n.py` 管理；运行时**不读**。
- `scripts/verify.py` — 校验：每个 skill 有 `SKILL.md`、frontmatter `name` 唯一、运行时目录与密钥类文件不混入、单文件 < 100 MB。
- `scripts/verify_i18n.py` — i18n 守卫：每个英文 SKILL.md 出现在**恰好一个** batch；禁止英文漂移。
- `scripts/install-global-links.sh` — 把共享 skill 树软链进各 agent 的全局 skill 目录。

**真源声明**（`README.md` 第 35-42 行）：

```
/Volumes/code/workspace/shared/axi-skills/skills   ← 终态真源
/Users/mose/.agent-skills/skills                   ← 仅作为初始导入
```

**治理**：`AGENTS.md` 第 1-25 行规定 — skill 必须自包含、入口必须叫 `SKILL.md`、改脚本前先读现有 `SKILL.md`、不提交凭据/local session/缓存。

---

## 4. Axi Rules（行为层）

`/Volumes/code/workspace/projects/axi-rules`（`projects/` 分区，独立仓库）。

**职责**：给代理一份**机器可读**的"先看哪、怎么做"的快查表。

**结构**：

```
axi-rules/
├── AGENTS.md / INDEX.md / README.md       # 根级入口
├── rules/
│   ├── agent-routing/                     # 项目推断、源序、桥接行为
│   ├── memory/                            # recall 序、持久化、生成索引
│   ├── verification/                      # 证据、测试、完成声明
│   └── safety/                            # 密钥、破坏性、运行时排除
├── index/                                 # 生成式索引
│   ├── projects.{md,json}                 # 6 个分区共 25+ 项目路由
│   ├── rules.{md,json}                    # 规则族元数据
│   ├── fallbacks.md + sources.json        # 源序
├── scripts/
│   ├── build-index.py                     # 从 6 个分区扫描生成 index/
│   └── validate-index.py                  # 校验索引一致性
└── frontend/                              # Vite/React 力导向图
    ├── src/main.tsx + App.tsx
    ├── vite.config.ts / vitest.config.ts
    └── dist/  +  .verify-*.png  (大量视觉验证产物)
```

**Resolution Order**（`AGENTS.md` 第 17-25 行）：

1. System / developer / direct user instructions
2. `axi-rules` 根索引 + 规则模块
3. 本地 Codex memory + 桥接 memory
4. **`axi-docs` 作为 fallback 知识**
5. 工作区实时巡检
6. 仅在不可逆 / 凭据 / 外生产 / 实质范围变更时才问用户

**生成与校验**：

```bash
python3 scripts/build-index.py        # 重新生成 index/*
python3 scripts/validate-index.py     # 校验 index/* 一致性
pnpm --dir frontend test              # 前端单测
pnpm --dir frontend typecheck         # TS 类型检查
pnpm --dir frontend build             # 前端构建
```

**索引里的 axi-docs 怎么被引用**（`index/projects.md` line 13）：

```
| axi-docs | Axi Docs | projects | /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs |
  AGENTS.md, README.md, ..., app/AGENTS.md, app/package.json |
  TODO.md, docs/, app/AGENTS.md, app/package.json
```

——Rules **只到指针层**：知道 axi-docs 的入口文档、验证命令、所属包，不拉内容。

---

## 5. Axi Docs（知识层）

`/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs`（`projects/` 分区，独立仓库）。

**职责**：把工作区里的项目 / 技能 / 工作区 registry / Obsidian / Blinko 通过统一适配器**统一展示**给人和 agent。

**三合一**（`AGENTS.md` 第 19-23 行）：

1. **文档枢纽（Knowledge Hub）** — 多源适配器统一 Web 渲染
2. **知识图谱 UI** — 文档间标签/链接的力导向图
3. **MCP 文档总线** — `axi_docs_*` 语义化工具

**目录边界**（`AGENTS.md` 第 25-37 行）：

| 路径 | 是否项目内 |
|---|---|
| `app/` | ✅ 应用包（React + Vite + MCP Server），规则见 `app/AGENTS.md` |
| `docs/content/{en,zh}/` | ✅ 产品内容源 |
| `docs/axi-workspace-governance/` | ✅ 治理镜像（只读快照） |
| `docs/project-docs.manifest.json` | ✅ 文档清单 |
| `SECURITY.md` / `TODO.md` / `AGENTS.md` / `CHANGELOG.md` | ✅ 根级门面 |
| `references/*`（工作区级） | ❌ 由 `infra/axi-workspace-governance/` 治理 |
| `blinko/`（symlink 到 `../blinko`） | ❌ 外部依赖 |

**与 axi-skills 的关系**（`app/README.md` 第 5-12 行）：

> `axi-skills` 作为独立仓库保持原生 `skills/**/SKILL.md` 结构，Axi Docs 通过 `skills` adapter 解析，**不要求技能文件改成 Obsidian frontmatter**。

即：
- Axi Docs 是 `axi-skills` 的**只读消费者**。
- 数据源锁在 `docs/sources.lock.json`（不用 git submodule）。
- 工作区元数据来自 `/Volumes/code/workspace/WORKSPACE_INDEX.md` 与 `workspace.graph.json`。

**MCP 工具集**（`app/README.md` 第 110-119 行）：

```
axi_docs_list_sources          # 列出已注册文档源
axi_docs_search                # 跨源搜索
axi_docs_read                  # 读取原文
axi_docs_skill_search          # 在 skills/ 中检索
axi_docs_workspace_status      # 工作区状态
axi_docs_project_summary       # 项目摘要
+ 旧版 obsidian_* 工具保留
```

**环境变量桥接**（`app/README.md` 第 78-99 行）：

- `AXI_SKILLS_PATH`（默认 `/Volumes/code/workspace/shared/axi-skills`）
- `DBSKILL_PATH`、`OBSIDIAN_PATH`、`AXI_DOCS_EXTRA_SOURCES_JSON`
- `BLINKO_URL` / `BLINKO_TOKEN`

**验证序列**（`AGENTS.md` 第 73-87 行）：

```bash
pnpm --dir app docs:check       # 文档源结构
pnpm --dir app source:check     # 源配置
pnpm --dir app verify           # 构建 + MCP 协议冒烟
pnpm --dir app test:run         # 单元/集成测试
pnpm --dir app build            # 生产构建
```

---

## 6. 三者如何相互引用

### 6.1 axi-rules → axi-docs

- `axi-rules/AGENTS.md` 第 5-6 行：
  > `axi-rules` is the first local authority for Axi agent behavior ... Use it **before** `axi-docs`.
- `INDEX.md` Resolution Order 第 3-4 条：把 `axi-docs` 列为第 4 级 fallback knowledge。
- `index/projects.md` line 13 记录 axi-docs 路径与入口文件清单。

→ **单向引用**：Rules 把 Docs 列入 fallback 体系。

### 6.2 axi-rules → axi-skills

- `index/projects.md` line 27 记录 `axi-skills` 为 `shared/` 分区项目。
- 规则模块 `rules/agent-routing/AGENTS.md` 在源序里隐含"先看 `shared/axi-skills` 是否有可复用 skill"。

→ **路由层引用**：Rules 通过 projects 索引知道 Skills 的物理路径与契约。

### 6.3 axi-docs → axi-skills

- `app/src/config/documentSources.ts` 注册 `axi-skills` 来源（默认 `/Volumes/code/workspace/shared/axi-skills`）。
- `app/README.md` 第 6 行：「Axi Docs 通过 `skills` adapter 解析」 700+ `SKILL.md`。
- `docs/sources.lock.json` 锁定数据源版本，**不**用 git submodule。

→ **消费层引用**：Docs 把 Skills 当**只读内容源**渲染进 Web 与 MCP 工具结果。

### 6.4 axi-docs → axi-rules

- **无显式引用**。Docs 不读 Rules 的 `index/*` 索引，也不解析 `rules/*/AGENTS.md`。
- 间接联系：Docs 注册的 `workspace` 来源读 `/Volumes/code/workspace/WORKSPACE_INDEX.md` 与 `workspace.graph.json`——Rules 的 `index/projects.json` **也**由同一份 workspace graph 生成（`scripts/build-index.py`）。

→ **共享同一上游真源**（workspace graph），而不是相互依赖。

### 6.5 axi-skills → 其他两者

- `AGENTS.md` 第 9-25 行：Skills 自给自足，**不依赖** Rules 或 Docs。
- Skills 树对所有 agent 一视同仁，agent 怎么决定何时调用某个 skill 属于**调用方**（即 Rules + Docs 的代理）行为。

→ **零向上依赖**。

### 6.6 引用矩阵

| 消费方 ↓ / 被引用 → | axi-skills | axi-rules | axi-docs | shared/axi-ui |
|---|:---:|:---:|:---:|:---:|
| **axi-skills** | — | ❌ | ❌ | ❌ |
| **axi-rules** | 🟡 路由层（projects.json line 27）| — | 🟡 fallback knowledge（Resolution Order #4）| 🟡 路由层 + AR-ROUTING-003/004/007（@axi/* 共享包与新消费者入门）|
| **axi-docs** | 🟢 数据源（documentSources.ts / sources.lock.json）| ❌ | — | 🟡 文档枢纽：shared/axi-ui/docs/INTEGRATION.md 是新 @axi/* 消费者的首要文档入口；docs/state/PRD.md / TDD.md / CHANGELOG.md 由 docs/content 镜像 |

> 🟢 = 数据/内容消费 · 🟡 = 索引/路由层引用 · ❌ = 无显式依赖

---

## 7. 写入边界

三者各自**严格不可写**对方：

| 项目 | 不能写 |
|---|---|
| axi-skills | 不写 `skills/` 之外的运行时产物；`skills.zh/` 只能由 `verify_i18n.py` 校验后由翻译 worker 写入；不写 `axi-rules/` 或 `axi-docs/` |
| axi-rules | 不写 `index/*` 之外的运行时产物（`build-index.py` 是唯一入口）；不写 `axi-skills/` 或 `axi-docs/` |
| axi-docs | 不写 `references/*`（`infra/axi-workspace-governance/` 治理）；不写 `axi-skills/skills/`；不写 `axi-rules/index/*`；`docs/axi-workspace-governance/` 是只读镜像 |

跨项目修改的**正确路径**：

- 想给 Skills 加能力 → 在 `axi-skills` 仓库提交 → Rules 重跑 `build-index.py` 自动收录 → Docs 重启即拉取新文件。
- 想给 Rules 加规则 → 在 `axi-rules/rules/<family>/AGENTS.md` 提交 → 重跑 `build-index.py`。
- 想改 Docs 知识呈现 → 在 `axi-docs/app/src/**` 或 `docs/content/{en,zh}/**` 提交。
- 想改工作区治理 → 在 `infra/axi-workspace-governance/` 提交 → 由镜像同步任务回灌到 `axi-docs/docs/axi-workspace-governance/`。

---

## 8. 共同的工程纪律

三个项目都强制 Axi 统一基线（互相印证）：

| 基线项 | axi-skills | axi-rules | axi-docs |
|---|---|---|---|
| 顶层门面 vs 子包契约 | `AGENTS.md` 单层（无子包）| 根 `AGENTS.md` + `rules/*/AGENTS.md` | 根 `AGENTS.md` + `app/AGENTS.md` |
| `dev` 集成 / `main` 生产 | — | 由 `rules/verification` 覆盖 | `app/AGENTS.md` 仓库治理段 |
| Conventional Commits | — | 由 `rules/verification` 覆盖 | `app/AGENTS.md` 仓库治理段 |
| 不提交 `.omx` / `.git` / cache | `AGENTS.md` 第 19 行 | `README.md` + `AGENTS.md` 第 35 行 | 根 `AGENTS.md` House Rules |
| 验证命令具体到包管理器 | `python3 scripts/verify.py` | `python3 scripts/validate-index.py` + `pnpm --dir frontend ...` | `pnpm --dir app ...` |
| 根级 AGENTS = 门面 / 子包 AGENTS = 契约 | N/A | ✅ | ✅ |
| 路径不可嵌入凭据 | `AGENTS.md` 第 21-22 行 | `rules/safety/` 覆盖 | `app/.env.example` + `SECURITY.md` |

---

## 9. 给新 agent 的"先看哪一份"指南

按场景：

| 场景 | 第一站 | 第二站 | 最后手段 |
|---|---|---|---|
| 我不知道这个项目在哪 | `axi-rules/index/projects.json` | `axi-rules/INDEX.md` → `AGENTS.md` | `ls /Volumes/code/workspace/projects` |
| 我不知道该不该做 / 怎么做 | `axi-rules/AGENTS.md` Resolution Order | `rules/<family>/AGENTS.md` 对应家族 | 问用户（仅限不可逆/凭据/外生产/实质范围变更）|
| 我要查某个 skill 怎么用 | `axi-skills/skills/<name>/SKILL.md` | `axi-docs/...` 渲染版（人读）| 该 skill 自带的 `references/` 目录 |
| 我要查某个项目的内部约束 | 该项目 `AGENTS.md` | 该项目 `app/AGENTS.md`（如有）| 项目的 `docs/` 子目录 |
| 我要查工作区治理 | `infra/axi-workspace-governance/` | `axi-docs/docs/axi-workspace-governance/`（只读镜像）| — |

---

## 10. 引用表（速查）

| 文件 | 路径 | 谁在何时读 |
|---|---|---|
| `axi-skills/AGENTS.md` | `/Volumes/code/workspace/shared/axi-skills/AGENTS.md` | 所有需要写 skill 树的 worker |
| `axi-skills/skills/<name>/SKILL.md` | 同上 | 调用该 skill 的代理 |
| `axi-rules/AGENTS.md` | `/Volumes/code/workspace/projects/axi-rules/AGENTS.md` | 任何进入工作区的 agent |
| `axi-rules/INDEX.md` | `/Volumes/code/workspace/projects/axi-rules/INDEX.md` | 同上（机器优先 json）|
| `axi-rules/index/projects.json` | 同上 | 机器（项目路由）|
| `axi-rules/rules/agent-routing/AGENTS.md` | `/Volumes/code/workspace/projects/axi-rules/rules/agent-routing/AGENTS.md` | AR-ROUTING-003/004/007：共享包变更与 @axi/* 新消费者入门 |
| `axi-docs/AGENTS.md` | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/AGENTS.md` | 进入 axi-docs 的 agent |
| `axi-docs/app/AGENTS.md` | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/app/AGENTS.md` | 进入 `app/` 的 agent |
| `axi-docs/docs/project-docs.manifest.json` | `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/project-docs.manifest.json` | 文档巡检子代理 |
| `shared/axi-ui/docs/INTEGRATION.md` | `/Volumes/code/workspace/shared/axi-ui/docs/INTEGRATION.md` | 新 `@axi/*` 消费者项目首选入口（AR-ROUTING-007）|
| `shared/axi-ui/INDEX.md` | `/Volumes/code/workspace/shared/axi-ui/INDEX.md` | 维护者首选入口（含 Package Map / Document Map）|

---

*最后更新：2026-08-18 — 新增 shared/axi-ui 引用矩阵列；补 `AR-ROUTING-003/004/007` 与 `shared/axi-ui/docs/INTEGRATION.md` / `INDEX.md` 引用表条目；下次 axiom-ui 包结构或 axiom-rules 规则族再次变更时同步本文件。*

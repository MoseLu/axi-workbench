# Axi Docs — 项目根级 AGENTS

> 本文件是 **Axi Docs 仓库根级** AGENTS，是进入本仓库的 agent 第一站。
> 应用包内部的 AGENTS 位于 [`app/AGENTS.md`](app/AGENTS.md)，包含模块划分、技术栈、组件规则、环境变量、API 规范等详细实现约束。
> **两者的关系：根级 AGENTS = 项目门面与边界；`app/AGENTS.md` = 应用包内部规则。** 任何对 `app/` 的修改必须先读 `app/AGENTS.md`；任何对仓库整体结构、文档源、跨项目边界的判断必须先读本文件。

---

## Scope

- **适用对象**：所有 agent（包括 Codex、Cursor、自动化扫描器、文档巡检子代理）首次接触 `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs` 时。
- **不适用对象**：纯运行时的 Blinko 同步脚本（其约束见 `app/AGENTS.md` 中的「同步机制」）；纯 `references/*` 引用文档（其治理在 `infra/axi-workspace-governance/`，见「Cross-Project Boundary」）。
- **阅读顺序**：本文件 → `app/AGENTS.md`（若要改 `app/`）→ `docs/content/{en,zh}/README.md`（若要改产品内容）。

---

## Project Boundary

Axi Docs 是 **「文档枢纽 + 知识图谱 + MCP 文档总线 + 工作区项目门面镜像」四合一** 的项目：

1. **文档枢纽（Knowledge Hub）**：聚合多份文档源（Obsidian、Blinko、workspace registry、Axi Skills），通过统一适配器在 Web 端展示。
2. **知识图谱（Knowledge Graph UI）**：把文档之间的标签/链接关系可视化为力导向图，辅助跨文档检索。
3. **MCP 文档总线（MCP Document Bus）**：通过 `axi_docs_*` 语义化工具，让 AI 代理从外部以结构化方式访问本仓库文档。
4. **工作区项目门面镜像（Workspace Project Dossier Mirror）**：跨 5 个分区（`projects/` / `shared/` / `infra/` / `products/` / `tools/`）的 Axi 项目级档案由 `app/scripts/build-projects-index.mjs` 维护：必选 7 件套 + 源存在性驱动的 4 件可选 + 2 件 passthrough（详见 `docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md`）。

**项目边界**（即本 agent 的修改半径）：

| 路径 | 是否项目内 | 说明 |
|------|------------|------|
| `app/` | 是 | 应用包（React + Vite + MCP Server），规则在 `app/AGENTS.md` |
| `plans/` | 是 | 当前仓库根级规划入口；只做分类、定位与指针，不承载长期方案正文 |
| `docs/content/en/` | 是 | 产品内容源（英文），frontmatter 含 `id/type/status/tags`；`guide/` 写使用说明，`plans/` 写长期方案，`projects/` 写项目档案 |
| `docs/content/zh/` | 是 | 产品内容源（简体中文），与 `en/` 同构翻译；`guide/`、`plans/`、`projects/` 语义保持一致 |
| `docs/axi-workspace-governance/` | 是 | 工作区治理文档的本地镜像（只读快照） |
| `docs/project-docs.manifest.json` | 是 | 项目文档清单，标明各文档的归属路径 |
| `docs/governance/SECURITY.md` / `SECURITY.zh-CN.md`, `docs/state/TODO.md` / `TODO.zh-CN.md`, `AGENTS.md`, `docs/state/CHANGELOG.md` / `CHANGELOG.zh-CN.md`, `docs/state/ERROR.md` (`ERROR.zh-CN.md` 为中文镜像) | 是 | 根级 / 治理 / 状态文档（按 docs/state 与 docs/governance 分桶） |
| `references/*`（工作区级） | 否 | 由 `infra/axi-workspace-governance/` 治理，本项目不翻译、不编辑 |
| `blinko/`（symlink 到 `../blinko`） | 否 | 外部依赖，不在本项目所有权内 |

**不要**把 `references/*` 或 `infra/axi-workspace-governance/references/*` 当作本项目的可写范围。

---

## Authoritative Sources

| 议题 | 权威来源 |
|------|----------|
| 跨项目行为规则、SOP、提交协议、commit-msg Lore trailer 强制 | [`axi-rules`](../../axi-rules/INDEX.md)（兜底权威；本仓不自有该层规则） |
| `@axi/*` 共享包的新消费者集成（scenario matrix、dependency order、Verdaccio wiring、gallery 参考实现） | [`shared/axi-ui/docs/INTEGRATION.md`](../../../shared/axi-ui/docs/INTEGRATION.md)（AR-ROUTING-007） |
| `@axi/*` 包结构、组件清单、Public API、Release ledger | [`shared/axi-ui/INDEX.md`](../../../shared/axi-ui/INDEX.md) 与 `shared/axi-ui/docs/axi-ui/COMPONENTS.md` / `PUBLIC_API.md` / `RELEASES.md` |
| 模块划分、技术栈、组件规则、API 规范、环境变量 | [`app/AGENTS.md`](app/AGENTS.md) |
| 产品内容（用户可见的英文/中文文档） | `docs/content/en/README.md`, `docs/content/zh/README.md` |
| 根级规划分类入口（给当前目录巡检 agent） | `plans/README.md` |
| 想法到落地方案库（长期方案 source of truth） | `docs/content/{en,zh}/plans/README.md`, `docs/content/{en,zh}/plans/idea-to-landing.md` |
| 仓库治理（branch / commit / quality gate / release） | `app/docs/OPERATIONS.md`, `app/docs/GITHUB_FLOW.md`, `app/docs/BRANCH_PROTECTION.md`, `app/docs/COMMIT_CONVENTION.md`, `app/docs/RELEASE_OPERATIONS.md`, `app/docs/QUALITY_GATE.md` |
| 安全策略 | [`docs/governance/SECURITY.md`](docs/governance/SECURITY.md) |
| 项目待办与 P0~P3 路线图 | [`docs/state/TODO.md`](docs/state/TODO.md) |
| 文档清单与责任归属 | [`docs/project-docs.manifest.json`](docs/project-docs.manifest.json) |
| 变更历史 | [`docs/state/CHANGELOG.md`](docs/state/CHANGELOG.md) |
| 错误复盘（结构性缺陷的根因分析与记录） | [`docs/state/ERROR.md`](docs/state/ERROR.md) |
| 工作区治理镜像 | `docs/axi-workspace-governance/`（只读，权威源是 `infra/axi-workspace-governance/`） |

> **优先级冲突时**：`axi-rules` 兜底 > 根级 `AGENTS.md` > `app/AGENTS.md` > 治理镜像 > 个人记忆。
>
> `axi-rules` 只在**行为/SOP/规则族**层面兜底（提交协议、git automation、handoff、verification 等），不接管本项目的**内容归属与边界声明**（那仍然是本文件）。当 `axi-rules` 与本文件在「本项目改什么、不改什么」上发生冲突时，**以本文件为准**；当冲突发生在「如何改、怎么提交、怎么验证」上时，**以 `axi-rules` 为准**。

---

## Cross-Project Boundary

- **不翻译**：`references/*`、`references/archives/*`、`infra/axi-workspace-governance/references/*`、`infra/axi-workspace-governance/temp/*`。
- **不复制内容到本项目**：工作区其他项目的 README、AGENTS、ADR 都不应被原样搬入 `docs/content/{en,zh}/`。本项目只承载「Axi Docs 自身产品」的内容源。
- **不假装是源**：`docs/axi-workspace-governance/*` 是只读镜像，对它的「修改」应回写到 `infra/axi-workspace-governance/`，然后重新生成镜像。
- **可消费**：通过 workspace graph（`workspace-project`）查询 `axi-docs` 的 `consumes` / `consumers` / `provides` / `contracts`；不要在业务代码里硬编码跨项目绝对路径。
- **可被消费**：本项目以 MCP 工具 `axi_docs_*`、Web 前端构建产物、知识图谱 JSON 形式对外提供文档能力；下游消费者（其他项目、AI 代理、CC-Connect）应通过这些契约入口接入。
- **受限 Agent 消费者**：按 `task-execution-routing/v1` 使用专用身份，只能取得标注的
  只读、版本化上下文；任何文档写入必须返回副作用提案并交由 Workbench 审批，不能通过
  MCP 或 REST 直写旁路。人工 UI/MCP 的授权路径保持原样。

---

## Verification

最小验证序列（来自工作区索引 `WORKSPACE_INDEX.md` 中 axi-docs 行）：

```bash
pnpm --dir app verify
```

补充可选步骤（视改动范围）：

```bash
pnpm --dir app quality:check
pnpm --dir app test:run
pnpm --dir app build
```

- 修改 `app/src/**` → 至少 `pnpm --dir app quality:check` 通过。
- 修改 `app/src/mcp/**` → 至少 `pnpm --dir app verify` 通过（含 MCP 协议冒烟）。
- 修改 `docs/content/{en,zh}/**` → 不需构建，但需保证 frontmatter 的 `id` 在两种语言下保持一致、相对路径镜像。
- 修改 `docs/content/{en,zh}/plans/**` → 保持方案正文为长期决策/验收记录；执行状态只写入 Axi Todo，并从 Todo 链回方案页。
- 修改本文件 / `docs/state/CHANGELOG.md` / `docs/state/TODO.md` / `docs/governance/SECURITY.md` / `docs/project-docs.manifest.json` → 不需构建，但需保持文件存在性。

---

## House Rules

- **不要**把 OMX 内部状态（`.omx/metrics.json`、`.omx/state/subagent-tracking.json`、`.omx/state/tmux-hook-state.json`、`.omx/state/session.json` 等）写入 commit。这些是 OMX 编排器的运行时状态，应留在工作区本地。
- **不要**把 Codex/Cursor 会话目录（`.codegraph/`、agent transcripts 文件夹、`.cursor/projects/.../terminals/`）写入 commit。
- **不要**把 `.omx/` 整体加入版本控制（仅允许 `.omx/config/` 之类的显式配置例外）。
- **不要**在没有 owner 显式指令的情况下合并到 `main`、推送标签、删除远程分支、发布正式 release。
- **不要**把 `references/*` 或 `infra/axi-workspace-governance/` 的内容当作本项目可写范围。
- **要**保持根级 `AGENTS.md` 与 `app/AGENTS.md` 的双层结构：根级谈边界与门面，应用包内谈实现与契约。
- **要**在 `docs/state/CHANGELOG.md` 记录对仓库结构、依赖、文档源的可见变更（与 Conventional Commits 配合，但不重复 commit 标题）。
- **要**在改动跨项目契约前先查 `workspace-project consumers axi-docs`。

---

*最后更新：2026-08-18 — Authoritative Sources 表新增 `shared/axi-ui/docs/INTEGRATION.md` 与 `shared/axi-ui/INDEX.md` 两行，把 `@axi/*` 共享包文档入口纳入本仓权威清单；与 `axi-rules` 的 AR-ROUTING-007 对齐，避免新消费者绕开 INTEGRATION.md 直接读 package metadata。*

## Relationship Metadata

This section declares relationship metadata consumed by the workspace control-plane snapshot for relationship provenance tracking.

### As a Provider (targetRef)

When other projects declare a dependency on this project in `workspace.graph.json`, they inherit the following metadata contract:

- **requiredness**: "required" (this project is a mandatory dependency for consumers)
- **dependencyPhase**: varies by capability (see below)
- **versionConstraint**: "workspace protocol" (workspace dependencies use `link:/catalog:` protocol, no explicit version pinning)
- **validityWindow**: "indefinite" (no expiration on workspace protocol dependencies)

#### Capability Phases

| Capability | Dependency Phase | Notes |
|---|---|---|
| document-hub | runtime | Knowledge hub serves docs at runtime |
| knowledge-graph | runtime | Graph visualization runs during doc browsing |
| mcp-document-bus | runtime | MCP tools enable agent access to docs |
| project-dossier-mirror | runtime | Project profiles are served from snapshot |

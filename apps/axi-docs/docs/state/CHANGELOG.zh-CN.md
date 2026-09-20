# Axi Docs 变更日志

本文档记录本项目所有值得关注的变更。
格式：[Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/)。
本项目对公开 MCP 工具面（`axi_docs_*`）和 Web 路由遵循 [Semantic Versioning](https://semver.org/)；内部构建/重构工作不进行版本化。

> 用途：根级 `CHANGELOG.md` 只记录**对仓库结构、依赖、文档源、用户可见契约**的
> 重大变更。**不**复制 `app/docs/logs/submit/2026*.md` 中由 OMX 自动生成的逐批
> 提交记录（那些是机器流水日志，留在原处）。Commit hash 也不在此处列出，请以
> `git log` 为准。

---

## [Unreleased]

### Added
- 2026-08-22: 新增双语 `docs/content/{en,zh}/guide/frontend-bff.md`，并在指南中登记“架构参考”分组，记录前端 BFF 模式的边界、接口契约、可靠性、安全、测试和渐进式引入检查表。
- 2026-06-07: 根级 `AGENTS.md` 创建（与 `app/AGENTS.md` 形成「根级门面 + 应用包内部规则」双层结构）。
- 2026-06-07: 根级 `CHANGELOG.md` 创建（本文件，按 Keep a Changelog 1.1 规范）。
- 2026-06-07: 8 份子代理 i18n 审计完成，审计报告见
  `docs/audit/workspace-i18n-audit-2026-06-07.md`（覆盖 `docs/content/{en,zh}/` 双语化与 frontmatter 守恒检查）。
- 2026-06-07: 根级文档清单 `docs/project-docs.manifest.json` 与「workspace-docs-gap-audit」对齐，明确各门面文档归属路径与验证方式。
- 2026-06-07: 新增 `docs/sources.lock.json` 与 `pnpm source:check`，用锁定 commit 管理 `axi-skills` 外部仓库快照，替代 Git submodule 方案。

### Changed
- (无)

### Deprecated
- (无)

### Removed
- (无)

### Fixed
- 2026-06-08: 修复 `docs/content/{en,zh}/` 下的 12 份错放翻译副本（`*.zh-CN.md` / `*.en.md`
  被错放到了相反语言目录，导致 `axi-docs-en` / `axi-docs-zh` Markdown adapter
  扫不到中文版 README、getting-started 的英文版、configuration / document-sources /
  frontmatter / localization 的更详细英文版等）；按"主文件在前、翻译副本放在同目录用
  `.<lang>.md` 后缀"的命名约定把内容搬回正确位置并修对 frontmatter `id`、内链 `/en/`↔`/zh/`。
  同步修复 `frontmatter.md` YAML 示例块里残留的 `id: axi-docs-zh-guide-search` 错字（应
  为 `axi-docs-en-guide-search`），并新增 `docs/content/README.zh-CN.md` 作为根 README
  的中文翻译副本。
- 2026-06-08: 二次修正 `docs/content/{en,zh}/README.md` 的正文——`en/README.md` 先前被
  误填成"英文版中文 README"（正文在英文里介绍中文内容树），现已回滚为描述英文内容树的英文
  README；`zh/README.md` 同步重写为描述中文内容树的中文 README。

### Security
- (无)

---

## [Earlier]

> 2026-Q1 之前为更早期阶段条目，详细 commit history 请通过 `git log --reverse`
> 派生，本文件只保留里程碑级别的归纳。

### 2026-Q2
- 2026-Q2: 文档源注册与适配器（`registry` + `adapter`）概念落地，首批接入
  workspace registry、Axi Skills、Obsidian、Blinko。
- 2026-Q2: 为 `axi-skills` 保留原生 `SKILL.md` 格式，通过适配器生成 Web/MCP 可用索引。
- 2026-Q2: MCP 新增 `axi_docs_*` 语义化工具集，统一对外文档访问契约。
- 2026-Q2: 知识图谱 UI 升级为可独立打开的 Knowledge Hub 视图。

### 2026-Q1
- 2026-Q1: `docs/content/{en,zh}/**` 双语产品内容源完成，frontmatter 包含
  `id/type/status/tags/graph-title/graph-tags/description` 语义。
- 2026-Q1: MCP 文档总线接入 workspace graph（见
  `infra/axi-workspace-governance/workspace.json` 中的 `axi-docs` 条目）。
- 2026-Q1: 知识图谱 UI 首次上线。
- 2026-Q1: Vite + React 18 + TypeScript 5.5 + Vitest 基线确立（详见
  `app/AGENTS.md` 中「技术栈约束」段）。

### Earlier (2026-Q1 之前)
- 仓库初始化：React 单页应用 + Blinko API 同步脚本 + MCP 协议服务端。
- 基础同步机制：`app/sync-blinko.js` 与 `blinko-notes/` 目录结构首次落地。
- 早期单语种 UI（中文硬编码），由后续 i18n 路线图替代。

---

## Notes

- 提交日志自动产物位于 `app/docs/logs/submit/`，本文件不复述其内容。
- 详细的 P0~P3 待办与架构路线图见 [`TODO.md`](TODO.md)。
- 仓库治理与发布流程见 `app/docs/OPERATIONS.md`、
  `app/docs/RELEASE_OPERATIONS.md`、`app/docs/QUALITY_GATE.md`。
- 本项目通过 `pnpm --dir app verify` 验证构建与契约一致性。

---

*最后更新：2026-06-07 — 根级 CHANGELOG 首版，由 workspace-docs-gap 子代理 A4 落地。*

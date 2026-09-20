# Axi Docs Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/) for public MCP
tool surfaces (`axi_docs_*`) and Web routes; internal build / refactor work is
not versioned.

> 用途：根级 `CHANGELOG.md` 只记录**对仓库结构、依赖、文档源、用户可见契约**的
> 重大变更。**不**复制 `app/docs/logs/submit/2026*.md` 中由 OMX 自动生成的逐批
> 提交记录（那些是机器流水日志，留在原处）。Commit hash 也不在此处列出，请以
> `git log` 为准。

---

## [Unreleased]

### Changed
- 2026-08-24: 同步刷新 `axi-soul-world` dossier (en/zh 16 份) 至当前产品状态：去掉过期的 `axi-mood-app/android` 路径，加入 `axi-soul-api` / `apps/web-admin` / `apps/web-bff` 三端拆分，反映 Todo v3、`axi-soul-api` C++20 分层骨架、回环 `/healthz` `/readyz` 等已落地变更。同步刷新 `docs/projects.index.json`、`app/public/workspace-project-handoff.json`、`docs/axi-workspace-governance/*` 治理镜像。

### Added
- 2026-08-22: 新增双语 `docs/content/{en,zh}/guide/frontend-bff.md`，并在指南中登记“架构参考”分组，记录前端 BFF 模式的边界、接口契约、可靠性、安全、测试和渐进式引入检查表。
- 2026-08-17: 新增 `docs/rules/` 约束性经验日志模块,承载可被 hook 拦截的硬规则
  (区别于 ERROR.md 的结构化 RCA 与 submit/ 的 per-commit 流水)。
  首版落地 R001(不允许把单个 feature 拆成多个并列 commit)、
  R002(命名漂移:同一概念必须使用同一单词)、
  R003(MCP 读端与 launcher 写端必须共享日志目录常量)三条约束,
  配套 `app/scripts/check-{fragmented-commits,naming-drift,mcp-log-dir}.mjs`
  守卫脚本,接入 `pnpm --dir app rule:check` 与 `pnpm --dir app verify` 链。
  新增 `app/scripts/lint-rules-doc.mjs` 校验 R-NNN 结构与 INDEX 对齐,
  接入 `pnpm --dir app governance:check`。在根级 `app/AGENTS.md` 顶部加
  Rules reminder;`docs/project-docs.manifest.json` 的 `documents.rules`
  与 `commands.verify.rule:check` 已同步登记。
- 2026-08-10: MCP 工具能力现按 `task-execution-routing/v1` 标注只读/副作用。
  受限 Agent 只能获取带 SHA-256 版本引用的固定上下文摘要；原始读取、未知工具和
  所有写入均拒绝或转换为 `approval_required` 副作用提案，人工 UI/MCP 授权不变。
- 2026-07-22: 全量重建 `docs/content/{en,zh}/projects/` 下 17 个 handoff 项目档案
  （axi-agent、axi-workbench、axi-skills、axi-registry、axi-pet 等，除
  已单独刷新的 axi-ui 外的全部 handoff 项目）。旧片段停留在 2026-06-10/06-11
  `draft` scaffold，因生成器 `writeIfMissing` 从未被 2026-07-17 handoff 快照刷新；
  本次删除旧片段后 `projects:build` 全量重建（wrote=312），frontmatter/描述现反映
  各项目当前 purpose。preservedAddenda（dbskill、codex-plus-app）与参考项目档案
  按设计未受影响。`projects:check` 通过（392 必选档案齐全）。
- 2026-07-22: 删除 `docs/content/{en,zh}/projects/ielts-vocabulary/` 旧名孤儿档案
  （不在当前 handoff/projects.index.json，path 重复指向 `products/ielts-vocab`，为
  2026-06-10 旧名残留；canonical `ielts-vocab/` 档案已完整）。重跑 `projects:build`
  同步 locale INDEX 表与机器索引，`projects:check` 通过（392 必选档案齐全）。
- 2026-07-22: 基于 2026-07-17 handoff 快照重建 `docs/content/{en,zh}/projects/axi-ui/`
  项目档案（`projects:build`）。旧片段停留在 2026-06-10 `draft` scaffold，因生成器
  使用 `writeIfMissing` 从未被新快照刷新；本次删除旧片段后重建，frontmatter 与 Summary
  现反映 axi-ui 的 Black Gold 设计令牌/主题运行时基线与 `@axi/*` 包表述。按源存在性
  规则，镜像随之从 `CHANGELOG.md`/`SECURITY.md` 迁为 `CHANGE.md`（root 层结构迁移的
  如实反映）。`projects:check` 通过（392 必选档案齐全），其余 27 个项目档案未受影响。
  解决只列仓库顶层时只能看到 `todo/`、看不到方案库的问题；同步登记到
  README、INDEX、AGENTS、TODO facade 和 manifest readOrder。
- 2026-06-13: 新增双语 `docs/content/{en,zh}/plans/` 方案库，明确
  “Axi Docs = 长期方案 source of truth / Axi Todo = execution queue”的归属边界；
  新增 `idea-to-landing.md` 方案契约与 `/guide/plans` 导航页，并在
  `siteConfig`、根级 README、TODO facade、PRD、MILESTONE 和 manifest 中登记。
- 2026-06-13: 补齐 manifest 已声明但缺失的 `docs/state/VERIFICATION.md`，
  记录根级治理文档、项目档案、source lock、前端配置和方案库变更的验证入口。
- 2026-06-13: 修正 `docs/project-docs.manifest.json` 的 readOrder/currentWork，
  从不存在的根级 `TODO.md` / `MILESTONE.md` 指向真实的 `docs/state/*` 文件，
  并把方案契约纳入接手阅读顺序。
- 2026-06-07: 根级 `AGENTS.md` 创建（与 `app/AGENTS.md` 形成「根级门面 + 应用包内部规则」双层结构）。
- 2026-06-07: 根级 `CHANGELOG.md` 创建（本文件，按 Keep a Changelog 1.1 规范）。
- 2026-06-07: 8 份子代理 i18n 审计完成，审计报告见
  `docs/audit/workspace-i18n-audit-2026-06-07.md`（覆盖 `docs/content/{en,zh}/` 双语化与 frontmatter 守恒检查）。
- 2026-06-07: 根级文档清单 `docs/project-docs.manifest.json` 与「workspace-docs-gap-audit」对齐，明确各门面文档归属路径与验证方式。
- 2026-06-07: 新增 `docs/sources.lock.json` 与 `pnpm source:check`，用锁定 commit 管理 `axi-skills` 外部仓库快照，替代 Git submodule 方案。
- 2026-06-11: 根级 `ERROR.md` 创建，作为跨项目结构性缺陷（命名漂移、目录归属错误、read/write 路径不一致等）的根因分析与复盘记录。首条记录
  `2026-06-11-01` 收录 `products/ielts-vocab` 的 `mac-app` 单复数漂移及
  `microservices-mac` 重命名为 `app-services-mac` 的全过程。
- 2026-06-11: `ERROR.md` 重构为按 `P0`（必修）/ `P1`（强烈建议）/ `P2`
  （经验性观察）三个等级分章节的形式，配套补充等级判定表、编号规则、
  `open`/`fixed`/`accepted-as-limitation` 状态约定，并预留 P1/P2 候选方
  向。`AGENTS.md` 同步在根级门面文档清单与「Authoritative Sources」表
  中登记 `ERROR.md`。
- 2026-06-11: 增设 `ERROR.zh-CN.md` 中文镜像（与根级其他门面文档
  `README/CHANGELOG/SECURITY/TODO` 保持英文权威 + `.zh-CN.md` 镜像模式）；
  新增 `app/scripts/lint-error-doc.mjs`，校验 ERROR 文档的结构（编号、
  索引/正文对齐、anchor、必填字段、5 段子标题、状态枚举），并接入
  `pnpm governance:check` 链（`error-doc:lint`）；
  `docs/project-docs.manifest.json` 增加 `error: ERROR.md` 登记项；
  `AGENTS.md` 在门面清单注释 `ERROR.zh-CN.md` 为中文镜像。
- 2026-06-11: 调整 `app/scripts/build-projects-index.mjs` 的 `PIECES` 数组，
  将里程碑文件名从复数 `MILESTONE.md` 改为单数 `MILESTONE.md`，与工作区
  模板源 `projects/axi-workbench/docs/templates/project-docs/MILESTONE.md`
  对齐；同步清理 `docs/content/{en,zh}/projects/*/MILESTONE.md` 共 48 个
  旧产物。注释从「8/11-piece」改为准确的「7 必选 + 4 源驱动可选 + 2
  passthrough = 13 件」。`projects:check` 验证 336 件 dossier 文件齐全。
- 2026-06-11: 补齐 `projects/axi-rules` 的 4 件缺失门面（`TODO.md`、
  `MILESTONE.md`、`PRD.md`、`TDD.md`），按项目实际内容填充。
- 2026-06-11: 补齐 `tools/axi-feishu-codex-bridge` 的 5 件缺失门面
  （`INDEX.md`、`TODO.md`、`MILESTONE.md`、`PRD.md`、`TDD.md`），
  按三 surface（codex-exec / codex-app-ws / codex-plus-cdp）填充。
- 2026-06-11: 统一里程碑命名为单数 `MILESTONE.md`：13 个项目根级
  `MILESTONE.md` 重命名为 `MILESTONE.md`，并批量更新 231 个文件内部
  文本引用（PRD/TODO/TDD/INDEX/CHANGELOG/AGENTS 等）；同步处理
  `products/ielts-vocab` 的复数孤儿 `MILESTONE.md` 并修正
  `docs/projects.index.json` 中 dbskill hand-curated mirror 备注里残留的
  复数文件名。16 个 Axi 项目 7 件套全部 7/7 满。
- 2026-06-11: 标准化 14 处 `PULL_REQUEST_TEMPLATE.md`（原以为分裂在 yml vs md，
  实际全是 md）到 workbench 5 段结构（Intent / Workflow Link / Verification
  / Release Gate / Operator Notes）。`projects/axi-pet` 原生是 GitHub 默认
  风格（269 字节、无 checklist），升到 workbench 风格（451 字节，含
  `## Verification` 3 项 CI / 本地 / secret 自检清单）。
  `projects/axi-image-preview` 保留其独有的 release-manifest 扩展
  checklist（694 字节）。
- 2026-06-11: 补齐 12 个 Axi 项目 + `products/ielts-vocab` 的 Issue 模板
  （原只有 `task.yml` 单表单）。新增 `bug_report.yml` 与
  `feature_request.yml`（结构化字段：summary / repro / expected / actual
  / environment / logs / self-check），共 26 个新文件。`projects/axi-pet`
  保留 4 个 yaml（typo / ai-task 等特色），references/* 不动。

### Changed
- 2026-06-08: Workspace adapter 从“每个项目一个单页”扩展为“每个项目一套虚拟文档”
  （概览、架构、运维与验证、协作规范）；项目概览只归入「项目知识」，架构/规范/运维页分别进入
  对应分类，避免侧边栏在多个分类中重复显示同一张项目卡。

### Deprecated
- (无)

### Removed
- (无)

### Fixed
- 2026-07-23: 修正 `error-doc:lint` 的文档定位：ERROR 双语镜像已经由根目录
  迁至 `docs/state/`，校验脚本现与项目清单一致，恢复 `quality:check` 的可执行性。
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
- 2026-07-23: 更新 `pnpm` overrides 与锁文件，修复经 `pnpm audit --json`
  确认的 28 条传递依赖安全公告（原始严重度：12 high / 12 moderate / 4 low）。
  覆盖 Hono、esbuild、undici、js-yaml、tmp、form-data、brace-expansion、
  body-parser 与 fast-uri；升级后审计结果为 0 high / 0 moderate / 0 low。

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
- 2026-07-23: `pnpm --dir app quality:check` 的应用内 lint / 测试部分可单独执行；
  完整门禁仍会被外部 `axi-skills` source lock 漂移阻断（当前
  `7e8e446f3af253677d3541fc346bbc3c7c89bde9`，锁定
  `c3fd7cea2ad1f90f03f7f86bbe52a1eb5c565923`）。该快照需在独立的源验证
  任务中审阅后更新，未在本次依赖安全修复中改动。

---

*最后更新：2026-07-23 — 修复传递依赖安全公告，并同步校准项目质量门禁路径。*

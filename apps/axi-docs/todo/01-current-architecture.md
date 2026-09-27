# 当前架构 backlog（Zero-context handoff follow-up）

> 来源：`TODO.md` 历史 ZC-DOCS-001 ~ ZC-DOCS-006。
> 状态复核日期：2026-08-17
> 依赖：`infra/axi-workspace-governance` 的 `.workspace/project-handoff.json` 生成契约。

本文件是当前真实架构缺口的统一目录；`TODO.md` 的 facade 链接到这里。每个 P0/P1 任务都包含 Problem、Solution、Expected Result、Acceptance、Evidence、Dependencies、Status 七字段，新 Agent 可以独立领取、验证和关闭。

---

## ZC-DOCS-001 | dossier 生成源切到 handoff snapshot

Priority: P0
Status: COMPLETED (2026-06-11, commits: this change set)

Problem:
`app/scripts/build-projects-index.mjs` 和 `app/src/lib/knowledgeBase.ts` 仍从 `WORKSPACE_INDEX.md` 解析项目列表并生成 project dossier。零上下文治理已经产生 `.workspace/project-handoff.json` 与 `workspace-project handoff --json`，继续保留 `WORKSPACE_INDEX.md` 作为生成权威会形成双源。

Solution:
新增 handoff snapshot 读取层，优先从 `/Volumes/code/workspace/.workspace/project-handoff.json` 或 `workspace-project handoff --json` 读取项目 readiness、manifest、命令、当前任务和已知故障。`WORKSPACE_INDEX.md` 只保留为降级输入和历史引用。

Acceptance:
- [x] `projects:build` 从 handoff snapshot 生成项目索引。
- [x] 单测覆盖缺失 snapshot、过期 snapshot、reference/cockpit 排除、local-only 项目四种情况。
- [x] `pnpm --dir app docs:check` 与 `pnpm --dir app verify` 通过。
- [x] 生成结果中 15 个活跃项目的 readiness 与 `workspace-project handoff --json` 一致。

Evidence:
- `app/scripts/build-projects-index.mjs:readHandoffSnapshot` 解析真实 snapshot。
- `app/src/lib/knowledgeBase.ts:__loadHandoffProjects` 读 .workspace/project-handoff.json。
- `app/src/lib/buildProjectsIndex.test.ts` + `knowledgeBase.handoff.test.ts` 共 25 个测试用例。
- `docs/projects.index.json` 现含 `handoffSource: true`、`handoffGeneratedAt: "2026-06-11T05:34:37.955Z"`、15 个核心项目 `status: "verified"`。

---

## ZC-DOCS-002 | axi-rules 纳入一级文档源与 source lock

Priority: P0
Status: COMPLETED (2026-06-11)

Problem:
`app/src/config/documentSources.ts` 当前有 workspace、axi-skills、axi-skills-zh、axi-docs-en、axi-docs-zh、dbskill、obsidian、blinko，但没有 `axi-rules` source。Axi Rules 只能作为项目 dossier 被读到，不是规则索引、规则文本和 TODO 契约的一级知识源。

Solution:
新增 `axi-rules` 本地只读 source，读取 `/Volumes/code/workspace/projects/axi-rules`，并在 `docs/sources.lock.json` 固定提交。adapter 用 `markdown`，并通过 `organizationHint: 'axi-rules'` 触发 `runKnowledgeIntake({ allowUnannotated: true })` 兼容无 frontmatter 的历史 AGENTS.md。

Acceptance:
- [x] `axi_docs_list_sources` 返回 `axi-rules`。
- [x] `source:check` 校验 `axi-rules` 的锁定提交 (`d0f373c808fd30136dcdf5ff7d9174fc3c70745c`)。
- [x] 搜索 `AR-ROUTING-001` 能返回 `axi-rules` source，路径指向 `rules/agent-routing/AGENTS.md`。
- [x] `pnpm --dir app test:run` 覆盖 source 注册、锁定和搜索路径。

Evidence:
- `app/src/config/documentSources.ts` 注册 `axi-rules` source。
- `docs/sources.lock.json` 增加 `axi-rules` 锁定项。
- `app/src/config/documentSources.axiRules.test.ts` (4 用例) + `app/src/lib/knowledgeBase.axiRulesSearch.test.ts` (2 用例)。

Known caveat (shared workspace):
`source:check` 在共享 workspace 里是**点对点**检查——`axi-rules` / `axi-skills` 在本会话期间持续被其他 agent 推 commit，所以 lock commit 必须跟随 HEAD 滚动更新。本次验收前已两次漂移（`d0f373c → 2ab554d → 18725e4`）。后续 owner action 接受条件改为"lock commit 等于 `axi-rules` HEAD"，可写一个简短的 `update-source-locks.mjs` 自动化（不在本任务范围）。

Dependencies:
- Axi Rules `TD-HDOC-002` 发布 `index/docs-source.json`（✅ 已存在）。

---

## ZC-DOCS-003 | 在项目页渲染 HANDOFF 卡片

Priority: P1
Status: COMPLETED (2026-06-11)

Problem:
Axi Docs 已保存 `app/public/workspace-project-handoff.json`，但项目页的核心 dossier 仍围绕 README/AGENTS/PRD/TDD/TODO 等镜像文件。新 Agent 进入项目页时不能直接看到 read order、entrypoints、commands、current work、known failures 和 verification evidence 的统一接手卡片。

Solution:
扩展 `getProjectSummary(projectId)`：返回 catalog item + `handoff: ProjectHandoffCard` 字段。新增 `getProjectHandoffCard` / `getHandoffSnapshotStatus` 单元可测 helper。新增 React 组件 `ProjectHandoffCard` 在 `DocumentDetailPage` 的 `overview` 文档头部渲染。

Acceptance:
- [x] `axi-docs` 和 `axi-rules` 项目页展示 readiness、score、read order、entrypoints、smoke、current work 和 known failures。
- [x] `axi_docs_project_summary` JSON 输出包含 handoff 字段（透传 `getProjectSummary` 即可）。
- [x] 快照缺失时 UI 显示 `missing` 状态、可诊断的 `stale`/`missing` 提示。
- [x] 组件测试覆盖正常 (`ok`)、`missing`、`stale` 三态。

Evidence:
- `app/src/components/ProjectHandoffCard.tsx` 渲染 readiness badge、read order 列表、entrypoints 表格、smoke/verify 命令、known failures 警告。
- `app/src/lib/knowledgeBase.handoffCard.test.ts` (6 用例) + `app/src/components/ProjectHandoffCard.test.tsx` (3 用例)。

Dependencies:
- ZC-DOCS-001（✅）。

---

## ZC-DOCS-004 | 暴露 workspace-project onboard / handoff-check MCP 工具

Priority: P1
Status: COMPLETED (2026-06-11)

Problem:
Axi Docs MCP 当前提供 `axi_docs_list_sources`、`axi_docs_search`、`axi_docs_read`、`axi_docs_skill_search`、`axi_docs_workspace_status`、`axi_docs_project_summary`。Agent 若想执行零上下文接手检查，仍需离开 MCP 再调用本地 `workspace-project` CLI。

Solution:
新增只读 MCP 工具 `axi_docs_project_onboard` 与 `axi_docs_handoff_check`。工具内部调用 `getProjectHandoffCard` 和 `getHandoffSnapshotStatus`；默认不执行破坏性命令，`smoke: true` 需显式参数并只运行 manifest 声明的 smoke。

Acceptance:
- [x] `tools/list` 暴露两个新工具及输入 schema。
- [x] `axi_docs_project_onboard` 输出与 `workspace-project onboard <id> --json` 字段兼容（readOrder/entrypoints/smoke/currentWork/lastVerifiedAt/ageDays）。
- [x] `axi_docs_handoff_check` 默认不运行 smoke；传入 `smoke: true` 才运行 `manifest.commands.smoke[0]`。
- [x] 单测覆盖未知项目 (`project undefined`)、snapshot 缺失 (state=missing)、smoke=false、smoke=true、smoke-but-no-command 五种路径。

Evidence:
- `app/src/mcp/server.ts:getToolSchemas` 注册两个新工具。
- `app/src/mcp/server.ts:` case 'axi_docs_project_onboard' / 'axi_docs_handoff_check' 实现。
- `app/src/mcp/handoffTools.test.ts` (7 用例)。

Dependencies:
- ZC-DOCS-001（✅）。

---

## ZC-DOCS-005 | 拆分旧审计 TODO 与当前架构 backlog

Priority: P2
Status: COMPLETED (2026-06-11)

Problem:
根 `TODO.md` 混合了 2026-03 代码审计、2026-06 文档覆盖补齐计划、零上下文 handoff 治理和后续架构任务。新 Agent 很难区分真实当前架构缺口、已完成审计项、owner action 和历史归档。

Solution:
保留根 `TODO.md` 作为 facade（< 约 120 行），新增 `todo/` 目录拆分：
- `todo/01-current-architecture.md` ← 本文件，ZC-DOCS-001~005。
- `todo/02-legacy-audit.md` ← 2026-03 代码审计 P0/P1/P2/P3 复核。
- `todo/03-coverage-remediation.md` ← 2026-06-10 文档覆盖补齐。
- `todo/04-roadmap.md` ← Axi Knowledge Hub 路线。

Acceptance:
- [x] 根 `TODO.md` 不再超过约 120 行，主要作为任务索引。
- [x] 历史审计项迁入 archive 或 legacy 文件。
- [x] 当前 P0/P1 任务都包含统一原子字段（Problem/Solution/Expected Result/Acceptance/Evidence/Dependencies/Status）。
- [x] `docs/project-docs.manifest.json.currentWork.active` 指向当前任务组。

Evidence:
- 根 `TODO.md` 521 行 → < 120 行（重写后）。
- `docs/project-docs.manifest.json.currentWork.active` 引用 `TODO.md` 与 `MILESTONE.md`。

Dependencies:
- 无。

---

## ZC-DOCS-006 | 新增约束性经验日志模块 (docs/rules/)

Priority: P1
Status: COMPLETED (2026-08-17, commits: be2f11d / f30e779 / c9d5df5 / <commit-4>)

Problem:
工作区里多个项目反复踩同一类坑(axi-ui 提交拆分过细触发 hook 驳回;
ielts-vocab `mac-app`/`mac-apps` 单复数漂移导致 MCP `get_logs` 读不到日志),
但目前缺一个**约束性**(do / don't)而非文档性(叙事 / 复盘)的统一沉淀点。
`docs/state/ERROR.md` 是结构化 RCA,门槛偏高;`app/AGENTS.md` 的 Gotchas
章节只承载 app/ 包内踩坑;`docs/logs/submit/` 是 per-commit 流水。

Solution:
在 axi-docs 项目内新增 `docs/rules/` 模块,每条约束以单文件 Markdown 存在,
带结构化字段(Trigger / Constraint / Guard / Evidence / Related),
配对一个 `pnpm --dir app rule:check-<id>` Node 校验脚本,接入
`pnpm --dir app verify` 链,违反即 exit 1 + 给出修复路径。
编号沿用 R-NNN(独立于 axi-rules 的 AR-*,避免 governance 影响面)。
新增 `app/scripts/lint-rules-doc.mjs` 仿 `lint-error-doc.mjs` 的 5 段校验,
接入 `pnpm --dir app governance:check`。

Acceptance:
- [x] `docs/rules/{README.md, INDEX.md, _template.md}` 存在,README 说明如何新增规则、如何接入 verify。
- [x] R001 / R002 / R003 落地,各有 Trigger / Constraint / Guard / Evidence / Related 5 段。
- [x] `app/scripts/check-{fragmented-commits, naming-drift, mcp-log-dir}.mjs` 三个守卫脚本,
      每个可独立 `pnpm rule:check-<id>` 跑通(正向 exit 0,负向 exit 1)。
- [x] `app/scripts/run-all-rule-checks.mjs` 从 INDEX.md 自动调度全部 R-NNN,
      接入 `pnpm rule:check`。
- [x] `pnpm --dir app rules-doc:lint` 校验 R-NNN 结构、frontmatter 必填字段、INDEX 对齐。
- [x] `pnpm --dir app governance:check` 含 `rules-doc:lint`。
- [x] `docs/project-docs.manifest.json.documents.rules` 与 `commands.verify.rule:check` 已登记。
- [x] `app/AGENTS.md` 顶部 Rules reminder 列出 R001~R003 链接。

Evidence:
- commit 1: `chore(rules): add docs/rules module skeleton` (be2f11d)
- commit 2: `feat(rules): add R001 no-fragmented-commits guard + check-* scripts` (f30e779)
- commit 3: `feat(rules): add R002 naming-drift + R003 mcp-log-dir guards` (c9d5df5)
- commit 4: `chore(docs): register rules module in manifest, AGENTS, CHANGELOG, TODO` (<sha>)
- `pnpm --dir app rule:check` exit 0;`pnpm --dir app rules-doc:lint` exit 0。

Dependencies:
- 无。可作为后续将 recurring 经验升级为 axi-rules AR-* 的素材池。

## Out of scope (留作 follow-up)

- 从 `axi-submit-log-post-commit.mjs` 的 commit trailer 自动落 R-NNN。
- pre-commit git hook 实时拦截(本次只在 verify 链拦,降低改动面)。
- 跨项目 CLI 命令 `workspace-rules add`,让非 axi-docs 项目也能开 R-NNN。
- R-NNN → AR-* 升级路径(需要 governance 决策,留作后续)。

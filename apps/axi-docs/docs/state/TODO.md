# Axi Docs Project — 待办事项 (TODO)

> 状态复核日期: 2026-08-17（ZC-DOCS-006 完成后重排）
> 本文件是任务 facade；详细内容由 `todo/` 目录下的分节文件承担。
> 方案正文不写在本文件。长期“想法到落地”方案写入 `docs/content/{en,zh}/plans/`；
> 本文件和 Axi Todo 只承载执行队列、状态和下一步动作。
> 当前目录下的规划分类入口是根级 `plans/README.md`。

---

## 30-Second 索引

| 类别 | 文件 | 说明 |
|---|---|---|
| 当前架构 backlog | [`todo/01-current-architecture.md`](todo/01-current-architecture.md) | ZC-DOCS-001~006：handoff-first dossier、axi-rules 一级源、项目页 HANDOFF 卡片、MCP 接手工具、TODO 拆分、约束性经验日志模块 |
| 旧审计清单 | [`todo/02-legacy-audit.md`](todo/02-legacy-audit.md) | 2026-03 代码审计 P0/P1/P2/P3 复核（owner action 表） |
| 文档覆盖补齐 | [`todo/03-coverage-remediation.md`](todo/03-coverage-remediation.md) | 2026-06-10 文档覆盖补齐计划（已归档） |
| 当前路线 | [`todo/04-roadmap.md`](todo/04-roadmap.md) | Axi Knowledge Hub 路线 + 下一轮重点 |
| 约束性经验日志 | [`docs/rules/INDEX.md`](../rules/INDEX.md) | R001~R003 约束与守卫命令(commit trailer / naming / mcp log dir) |
| 根级规划索引 | [`../../plans/README.md`](../../plans/README.md) | 当前目录下可见的规划分类入口 |
| 方案库契约 | [`../content/zh/plans/idea-to-landing.md`](../content/zh/plans/idea-to-landing.md) / [`../content/en/plans/idea-to-landing.md`](../content/en/plans/idea-to-landing.md) | grill-me 产物、长期方案记录与 Axi Todo 执行任务的归属边界 |

---

## 当前最高优先级

ZC-DOCS-001~006 已于 2026-08-17 实施完成（见 `todo/01-current-architecture.md`）。新 Agent 接手时应按以下顺序阅读：

1. `AGENTS.md` → 项目职责与边界
2. `README.md` → 入口与命令
3. `plans/README.md` → 当前目录下的规划分类
4. `docs/state/MILESTONE.md` → 当前里程碑
5. `todo/01-current-architecture.md` → 当前真实架构 backlog（6 项 P0/P1/P2，全部 COMPLETED）
6. `todo/02-legacy-audit.md` → 待修 owner action 跟踪表
7. `docs/HANDOFF.md` → Axi Docs 自身的 handoff 视图
8. `docs/rules/INDEX.md` → 约束性经验日志(R-NNN)的当前生效列表
9. `docs/content/zh/plans/idea-to-landing.md` → 方案库与 Axi Todo 的边界

---

## Verification

- `pnpm --dir app docs:check` ✅
- `pnpm --dir app projects:check` ✅（ZC-DOCS-001 后 26 项目 × 2 locales × 7 必选件 = 364 必选 dossier 文件）
- `pnpm --dir app projects:build` ✅（handoff-first 输出 `handoffSource: true`、`handoffGeneratedAt: "2026-06-11T05:34:37.955Z"`）
- `pnpm --dir app verify` ✅（tsc + vite build，~50s）
- `pnpm --dir app test:run` ✅（47+ 新增 ZC-DOCS 测试全过；pre-existing Axi Skills 5s timeout 仍失败，与本改动无关）
- `pnpm --dir app source:check` ❌ — **preexisting, owner action**：axi-skills 上游漂移，与本次改动无关

---

## 跨文件引用

- 旧审计统计表 → `todo/02-legacy-audit.md` 末尾
- Zero-context handoff governance（manifest schema v2）→ `docs/project-docs.manifest.json`
- 审计报告归档 → `docs/axi-workspace-governance/audits/`
- 提交日志 → `app/docs/logs/submit/`

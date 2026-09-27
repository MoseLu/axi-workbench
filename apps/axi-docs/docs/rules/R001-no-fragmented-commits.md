---
id: R001
title: 不允许把单个 feature 拆成多个并列 commit
severity: must-follow
status: active
verified-by: pnpm --dir app rule:check-fragmented-commits
origin-commit: 9cff682
tags: [git, commit-hygiene, hook-rejection]
created: 2026-08-17
---

## Trigger

触发场景:开发者准备 `git commit` 且 staged 文件跨越 ≥3 个**根目录**
(例如同时改动 `app/` + `docs/` + `infra/`)。

> 阈值"≥3"是面向多包项目的保守值;**单包项目**触发的概率低,
> 主要用于工作区级 multi-repo 场景(如 shared/axi-ui、projects/*)。

## Constraint

硬约束:**不允许**把单个 user-visible feature 拆成 N 个并列 commit;
也不允许把一次完整修复拆成多个并列 commit。

判定标准:

- 一次 commit 的 staged 文件**不能同时跨越 ≥3 个根目录**(如
  `app/` + `docs/` + `infra/`),除非 commit message 显式带
  `Reason: <解释>` trailer(此 trailer 是放行凭证)。
- 单次 commit diff >1000 行应按 feature 拆分(此条由 axi-rules
  AR-GIT-002 提供;本规则只做"约束提醒 + 校验命令",不重新定义阈值)。

## Guard

校验命令:`pnpm --dir app rule:check-fragmented-commits`

退出码:

- `0`:通过。
- `1`:违反,提示:
  - 跨目录列表
  - 修复路径:加 `Reason:` trailer 或拆 commit

实现:`app/scripts/check-fragmented-commits.mjs`(`git diff --staged --name-only`
+ 根目录去重 + 阈值检查 + `Reason:` trailer 白名单)。

## Evidence

- 首次发现:`shared/axi-ui` `9cff682` (2026-08-17) — 当天 5-commit 批次拆得过细,
  触发 hook 驳回,新增 3 个 guards(`guard-commit-message-integrity.mjs` /
  `guard-reachability.mjs` / `guard-rebase-policy.mjs`)。
- 关联提交:`projects/axi-rules/rules/git-automation/AGENTS.md:30-57`
  AR-GIT-002。

## Related

- 上游规则:`axi-rules/rules/git-automation/AGENTS.md` AR-GIT-002
- 触发源头:ERROR.md 无对应条目(未达 P0)
- 关联约束:R002、R003(同批次同源)

## Notes

中文解释:本次约束**专门**拦截"跨多根目录的合并型 commit"。开发者若确需合并
跨目录的改动(例如"重命名 + 重写 README + 迁移配置"是同一项治理任务),
在 commit message 末尾加 `Reason: <解释>` trailer 即可放行。

---
id: R{NNN}
title: {一句话标题,do/don't 形态}
severity: must-follow
status: active
verified-by: pnpm --dir app rule:check-{short-id}
origin-commit: {首次触发该约束的 commit,8 位短 hash}
tags: [{tag1}, {tag2}]
created: {YYYY-MM-DD}
---

## Trigger

触发场景:用一段话讲清楚**什么时候这条规则开始生效**。例如:

- 开发者准备 `git commit` 且 staged 文件跨 ≥3 个根目录。
- 任意代码 / 文档 / 配置写入,且文件名或目录名涉及关键词 X。

## Constraint

硬约束:**不允许** {具体的禁止行为}。

判定标准:

- 可机器判定的:列出明确阈值 / 模式 / 关键字。
- 不可机器判定的:列入"建议"段,不放在本约束。

## Guard

校验命令:`pnpm --dir app rule:check-{short-id}`

退出码:

- `0`:通过。
- `1`:违反,输出违反明细 + 修复路径。

## Evidence

- 首次发现:{项目路径} {commit-hash} ({date}) — 一句话讲触发场景。
- 关联提交:列出与之相关的 commit / 规则 ID。

## Related

- 上游规则:{若有,axi-rules/rules/<category>/AGENTS.md 的 AR-XXX}
- 触发源头:{若有,ERROR.md 的 YYYY-MM-DD-NN}
- 关联约束:{同批次兄弟约束,如 R002 关联 R003}

## Notes

(可选)中文解释或示例,不超过 5 行;不强制。

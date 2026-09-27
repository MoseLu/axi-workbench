---
id: R002
title: 命名漂移:同一概念必须使用同一单词(单复数一致)
severity: must-follow
status: active
verified-by: pnpm --dir app rule:check-naming-drift
origin-commit: ielts-vocab-mac-app-drift
tags: [naming, governance, single-source]
forbidden-pairs: [['logs/runtime/mac-app', 'logs/runtime/mac-apps']]
created: 2026-08-17
---

## Trigger

触发场景:任意代码 / 文档 / 配置文件涉及"同一概念"的多处命名时
(典型如日志目录 `mac-app` vs `mac-apps`,服务目录
`microservices-mac` vs `app-services-mac`)。

## Constraint

硬约束:**不允许**在同一项目内对"同一概念"使用不同单复数 / 不同拼写。

判定标准:

- 一处引入路径常量(如 `LOG_DIR = "logs/runtime/mac-app"`),
  所有读写方必须引用同一变量 / 同一字符串,**不允许**各自硬编码。
- 若历史曾用旧名,新代码必须用新名 + 一次性迁移脚本,且不得保留旧字符串在
  源码 / 配置 / 文档(避免下一次又有人用旧名)。
- 项目内 13,000+ 源文件的全量扫描每季度一次,用于发现漂移。

## Guard

校验命令:`pnpm --dir app rule:check-naming-drift`

退出码:

- `0`:通过(本项目内未发现漂移候选)。
- `1`:发现漂移候选,列出(目录,行号,出现位置) + 修复路径。

实现策略:`app/scripts/check-naming-drift.mjs`:
1. 维护一份"敏感对"(canonical / forbidden),如 `mac-app` ←→ `mac-apps`。
2. 扫描 `app/`、`docs/`、`infra/`、`<project-root>/**` 下源码与配置,统计
   forbidden 形式出现次数(≥1 即报错)。
3. 报告以 fail-fast 方式输出,exit 1。

## Evidence

- 首次发现:`products/ielts-vocab` (2026-06-11) — `mac-app`(writer) vs
  `mac-apps`(reader)单复数漂移,导致 MCP `get_logs` 工具返回空内容。
  见 `docs/state/ERROR.md:2026-06-11-01`。
- 同批次:`microservices-mac` → `app-services-mac` 重命名 + `start-microservices.sh`
  与 `server.py` 同步对齐。
- 全量扫描:13,299 个源文件,仅发现 1 处真实漂移,但 5 月 31 日幽灵目录
  `mac-apps/` 显示该模式历史上发生过。

## Related

- 触发源头:`docs/state/ERROR.md` 2026-06-11-01
- 关联约束:R003(同源;MCP 日志读写必须用同一常量)
- 工程教训:"读端与写端必须共享一个目录常量,不要各自硬编码" / "扫描整个
  workspace 找'目录名漂移'应作为周期性巡检项"

## Notes

中文解释:本规则**专门**防止"`mac-app` 与 `mac-apps` 共存"这类低级但极难
排查的 bug。每加一个项目,新概念应在 README 第一根处定下 canonical 名,
其余地方只能引用变量。
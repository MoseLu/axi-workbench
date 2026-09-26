---
id: R003
title: MCP 读端与 launcher 写端必须共享日志目录常量
severity: must-follow
status: active
verified-by: pnpm --dir app rule:check-mcp-log-dir
origin-commit: ielts-vocab-mac-app-drift
tags: [mcp, log-dir, single-source]
created: 2026-08-17
---

## Trigger

触发场景:任意 MCP 工具的 `get_logs` / 类似读端函数,与对应 launcher / writer
(bash / Swift / Node 脚本)涉及同一物理目录的路径时。

## Constraint

硬约束:**不允许** MCP 读端与 launcher 写端各自硬编码路径字符串。

判定标准:

- 路径必须以**单一变量 / 单一常量**定义(典型形式:`LOG_DIR = path.join(ROOT, 'logs/runtime/mac-app')`)。
- 读端只能引用该常量;写端也只能引用该常量。
- 任意一端的常量被修改,**另一端**必须同步或在 CI 红。
- 写入脚本必须显式 `cd "${root}"` 或注入绝对路径,**不**依赖 caller cwd。

## Guard

校验命令:`pnpm --dir app rule:check-mcp-log-dir`

退出码:

- `0`:通过(读端与写端常量一致)。
- `1`:发现路径字符串不一致,列出两侧差异。

实现:`app/scripts/check-mcp-log-dir.mjs`:
1. 解析本项目内 `app/src/mcp/**` 与 `app/scripts/**` 中的 `LOG_DIR = ...`
   表达式,提取路径字面量。
2. 与 launcher / writer 脚本中的对应字符串比对。
3. 不一致 → exit 1 并指出两侧路径。

> 注:本规则当前以 **axi-docs 自身**为守护样本(因为 axi-docs 有 MCP server)。
> 其他项目(products/ielts-vocab、shared/axi-ui 等)的 MCP 路径常量在
> 各自项目内复用本规则的实现,**编号仍用 R003**,evidence 指向同源头。

## Evidence

- 首次发现:`products/ielts-vocab` `packages/mac-bridge-mcp/server.py:31`
  读端用 `logs/runtime/mac-apps/`(复数),launcher 写端用 `logs/runtime/mac-app/`,
  导致 MCP `get_logs` 永远返回空。
- 修复:`server.py:31` 改 `…/mac-app` + 新增 2 个守卫测试
  (`test_mac_local_app_launcher_keeps_vite_inside_generated_app_bundle` /
  `test_microservice_log_dir_aligns_with_app_services_mac`)。

## Related

- 触发源头:`docs/state/ERROR.md` 2026-06-11-01
- 关联约束:R002(同源)

## Notes

中文解释:本规则**不是**只针对 axi-docs,而是把 ielts-vocab 这次踩坑"制度化"
为 axiom——任何项目的 MCP 读端与 launcher 写端都不得各自硬编码路径。
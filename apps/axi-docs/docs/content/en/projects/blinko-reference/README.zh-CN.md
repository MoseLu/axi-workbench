---
id: axi-docs-en-projects-blinko-reference
title: Blinko 参考文档
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: Blinko Reference
graph-tags: [Projects, references]
description: 从嵌套 docs 项目导入中提升出的上游 Blinko 参考仓库。
project:
  id: blinko-reference
  partition: references
  path: /Volumes/code/workspace/references/blinko
  source-section: reference
---
## 2026-08-08 同步记录

为配合 workbench 2026-08 批次而前移。Frontmatter 刷新 `status: draft` -> `status: active`，`modified` -> `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范项目入口仍为项目根目录 AGENTS.md；后续批次将把卷宗正文其余部分与各项目最新已验证状态对齐。本次改动的动因见跨项目新鲜度审计 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Blinko 参考文档

> Workspace 项目卷宗。事实源：`/Volumes/code/workspace/references/blinko`。
> Section: reference / Partition: `references/`。

## 摘要

从嵌套 docs 项目导入中提升出的上游 Blinko 参考仓库。

## 技术栈

Bun、TypeScript、Docker

## 权威文档

- Workspace 入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Blinko Reference"。
- 项目根目录：`/Volumes/code/workspace/references/blinko`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/blinko/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/references/blinko/README.md`（如存在）。

## 备注

直接使用此规范参考路径。

## 验证（建议）

_参见项目根目录 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。始终在项目目录下运行，而非本卷宗。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费 workspace 索引。
- `docs/content/{en,zh}/guide/routing.md` — workspace 项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

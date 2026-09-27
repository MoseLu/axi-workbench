---
id: axi-docs-en-projects-axi-registry
title: Axi 本地注册表
type: project
status: active
tags: [Axi Docs, Projects, infra, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Local Registry
graph-tags: [Projects, infra]
description: 仅本地使用的 Verdaccio 注册表，用于 @axi/* 运行时包的鉴权发布与本地消费。
project:
  id: axi-registry
  partition: infra
  path: /Volumes/code/workspace/infra/axi-registry
  source-section: shared
---
## 2026-08-08 同步记录

随 workbench 2026-08 批次一并前移。Frontmatter 将 `status: draft` 更新为 `status: active`，`modified` 更新为 `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范的项目入口仍为项目根目录的 AGENTS.md；后续批次将使档案正文其余部分与各项目最新已验证状态保持一致。参见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` 了解驱动本次修订的跨项目新鲜度审计。

# Axi 本地注册表

> 工作区项目档案。事实来源：`/Volumes/code/workspace/infra/axi-registry`。
> 板块：shared / 分区：`infra/`。

## 摘要

仅本地使用的 Verdaccio 注册表，用于 @axi/* 运行时包的鉴权发布与本地消费。

## 技术栈

_未在 WORKSPACE_INDEX.md 中记录技术栈。_

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表中的行 "Axi Local Registry"。
- 项目根目录：`/Volumes/code/workspace/infra/axi-registry`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/infra/axi-registry/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/infra/axi-registry/README.md`（如存在）。

## 备注

_无备注。_

## 验证（建议）

_参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。务必在项目目录下运行，而非本档案。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` — 工作区项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

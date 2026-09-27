---
id: axi-docs-en-projects-axi-tauri-starter
title: Axi Tauri 起步模板
type: project
status: active
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Tauri Starter
graph-tags: [Projects, shared]
description: Tauri 2 桌面外壳布局、命令约定以及可复用的 npm、pnpm、Cargo 与 Rust 缓存引导的共享参考。
project:
  id: axi-tauri-starter
  partition: shared
  path: /Volumes/code/workspace/shared/axi-tauri-starter
  source-section: shared
---
## 2026-08-08 同步记录

随 workbench 2026-08 批次一并前移。Frontmatter 将 `status: draft` 更新为 `status: active`，`modified` 更新为 `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范的项目入口仍为项目根目录的 AGENTS.md；后续批次将使档案正文其余部分与各项目最新已验证状态保持一致。参见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` 了解驱动本次修订的跨项目新鲜度审计。

# Axi Tauri 起步模板

> 工作区项目档案。事实来源：`/Volumes/code/workspace/shared/axi-tauri-starter`。
> 板块：shared / 分区：`shared/`。

## 摘要

Tauri 2 桌面外壳布局、命令约定以及可复用的 npm、pnpm、Cargo 与 Rust 缓存引导的共享参考。

## 技术栈

_未在 WORKSPACE_INDEX.md 中记录技术栈。_

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表中的行 "Axi Tauri Starter"。
- 项目根目录：`/Volumes/code/workspace/shared/axi-tauri-starter`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/shared/axi-tauri-starter/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/shared/axi-tauri-starter/README.md`（如存在）。

## 备注

_无备注。_

## 验证（建议）

_参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。务必在项目目录下运行，而非本档案。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` — 工作区项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

---
id: axi-docs-en-projects-sports-management
title: 体育管理应用（项目卷宗）
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: 体育管理应用
graph-tags: [Projects, projects]
description: 采用 Quasar 与 Vue 3 的体育管理应用骨架，含 Pinia、Vue Router、Vue I18n 与 Capacitor Android 封装；后端目录仅为占位。
project:
  id: sports-management
  partition: projects
  path: /Volumes/code/workspace/projects/axi-sports-management-app
  source-section: core
---
## 2026-08-08 同步记录

为配合 workbench 2026-08 批次而前移。Frontmatter 刷新 `status: draft` -> `status: active`，`modified` -> `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范项目入口仍为项目根目录 AGENTS.md；后续批次将把卷宗正文其余部分与各项目最新已验证状态对齐。本次改动的动因见跨项目新鲜度审计 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# 体育管理应用

> Workspace 项目卷宗。事实源：`/Volumes/code/workspace/projects/axi-sports-management-app`。
> Section: core / Partition: `projects/`。

## 摘要

采用 Quasar 与 Vue 3 的体育管理应用骨架，含 Pinia、Vue Router、Vue I18n 与 Capacitor Android 封装；后端目录仅为占位。

## 技术栈

_未在 WORKSPACE_INDEX.md 中记录技术栈。_

## 权威文档

- Workspace 入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "体育管理应用"。
- 项目根目录：`/Volumes/code/workspace/projects/axi-sports-management-app`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/projects/axi-sports-management-app/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/projects/axi-sports-management-app/README.md`（如存在）。

## 备注

_无备注。_

## 验证（建议）

_参见项目根目录 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。始终在项目目录下运行，而非本卷宗。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费 workspace 索引。
- `docs/content/{en,zh}/guide/routing.md` — workspace 项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

---
id: axi-docs-en-projects-axi-ui
title: Axi 共享 UI 层
type: project
status: active
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi UI
graph-tags: [Projects, shared]
description: Axi 共享 UI 运行时层（tokens + react + react-antd + react-addons）。驱动 workbench、axiom-agent-platform、axiom-pet-desktop、axiom-pet 与 axiom-image-preview 所用的 Axi 控制台外壳。已按 2026-08 workbench 双应用态势刷新。
project:
  id: axi-ui
  partition: shared
  path: /Volumes/code/workspace/shared/axi-ui
  source-section: shared
---
## 2026-08-08 同步记录

axi-ui 位于所有 Axi-om 控制台与 workbench 外壳之下。2026-08 批次有两条后续线索：全新的 tools/axi-app-cli 导入依赖拆分，以及 workbench @axi/shell 升级到 0.3.0 / AxiTabActionMenu。本镜像记录这些变更；规范 changelog 位于包根目录。


# Axi 共享 UI 层

> 工作区项目档案。事实来源：`/Volumes/code/workspace/shared/axi-ui`。
> 板块：shared / 分区：`shared/`。

## 摘要

规范的 Axi 黑金设计 tokens 与主题运行时，外加共享的 React 基础组件、外壳、设置、CRUD、部件、插件与 Vite 工具链，以 @axi 包形式发布。

## 技术栈

_未在 WORKSPACE_INDEX.md 中记录技术栈。_

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表中的行 "Axi UI"。
- 项目根目录：`/Volumes/code/workspace/shared/axi-ui`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/shared/axi-ui/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/shared/axi-ui/README.md`（如存在）。

## 备注

_无备注。_

## 验证（建议）

_参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。务必在项目目录下运行，而非本档案。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` — 工作区项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

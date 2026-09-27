---
id: axi-docs-zh-projects-workspace-dev-services
title: Workspace Dev Services
type: project
status: active
tags: [Axi Docs, 项目, dev-services.config.json, shared]
created: 2026-06-10
modified: 2026-08-08
graph-title: Workspace Dev Services
graph-tags: [项目, dev-services.config.json]
description: 由 PM2 驱动的本地服务配置、面板路由、飞书告警监听器，以及 NATAPP 入口目标配置。
project:
  id: workspace-dev-services
  partition: dev-services.config.json
  path: /Volumes/code/workspace/dev-services.config.json
  source-section: shared
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Workspace Dev Services

> 工作区项目档案。权威来源：`/Volumes/code/workspace/dev-services.config.json`。
> 章节：shared / 分区：`dev-services.config.json/`。

## 摘要

由 PM2 驱动的本地服务配置、面板路由、飞书告警监听器，以及 NATAPP 入口目标配置。

## 技术栈

JSON、Node.js、PM2、LaunchAgent

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) —— 分区表中 "Workspace Dev Services" 一行。
- 项目根目录：`/Volumes/code/workspace/dev-services.config.json`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/dev-services.config.json/AGENTS.md`（若存在）。
- 项目 `README.md`：`/Volumes/code/workspace/dev-services.config.json/README.md`（若存在）。

## 备注

运行时状态存放在 `.devsvc` 下；请把配置与包装脚本当作可编辑的入口来使用。

## 验证（建议）

_请参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本中定义的权威验证命令。始终从项目目录运行，而不是从本档案目录运行。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` —— Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` —— 工作区项目路由。
- `app/src/config/documentSources.ts` —— Axi Docs 文档源注册表。

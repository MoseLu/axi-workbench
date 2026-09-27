---
id: axi-docs-zh-guide-document-sources
title: 文档来源
type: guide
status: published
tags: [Axi Docs, 数据源, 文档, 中文]
created: 2026-06-07
modified: 2026-06-13
graph-title: 文档来源
graph-tags: [Axi Docs, 数据源]
description: 了解 Axi Docs 如何注册、区分和读取本地文档来源。
---

## 来源注册表

`app/src/config/documentSources.ts` 是文档来源的注册入口。每个来源包含唯一 `id`、显示名称、根路径、适配器、内容类型、语言和只读状态。

## 内置来源

- `axi-docs-zh` 与 `axi-docs-en`：本站中英文 Markdown，包括指南、方案和项目档案。
- `axi-skills` 与 `axi-skills-zh`：共享技能库及中文镜像。
- `workspace`：工作区治理与项目索引。
- `dbskill`、`obsidian`、`blinko`：按配置接入的扩展知识来源。

## 路径与环境变量

默认路径从工作区相对位置解析，也可以通过 `AXI_DOCS_CONTENT_PATH`、`AXI_SKILLS_PATH`、`AXI_WORKSPACE_GOVERNANCE_PATH` 等环境变量覆盖。密钥类配置不应写入 Markdown 或提交到仓库。

## 增加来源

新增来源时先选择已有适配器：`markdown`、`skills`、`workspace` 或 `api`。完成注册后运行测试和生产构建，确认目录加载、搜索和文档详情都能读取该来源。

处理“想法到落地”工作时，把长期方案页写入 `docs/content/{locale}/plans/`，再让 Axi Todo 执行任务链接回这些页面。

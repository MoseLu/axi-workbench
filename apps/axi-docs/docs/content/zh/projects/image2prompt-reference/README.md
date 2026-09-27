---
id: axi-docs-zh-projects-image2prompt-reference
title: Image2Prompt Reference
type: project
status: active
tags: [Axi Docs, 项目, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: Image2Prompt Reference
graph-tags: [项目, references]
description: 浏览器扩展参考，覆盖图像到提示词的交互与可视化提示工作流。
project:
  id: image2prompt-reference
  partition: references
  path: /Volumes/code/workspace/references/image2prompt
  source-section: reference
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Image2Prompt Reference

> 工作区项目档案。权威来源：`/Volumes/code/workspace/references/image2prompt`。
> 章节：reference / 分区：`references/`。

## 摘要

浏览器扩展参考，覆盖图像到提示词的交互与可视化提示工作流。

## 技术栈

JavaScript, browser extension

## 权威文档

- 工作区条目：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) —— 分区表中 "Image2Prompt Reference" 一行。
- 项目根目录：`/Volumes/code/workspace/references/image2prompt`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/image2prompt/AGENTS.md`（若存在）。
- 项目 `README.md`：`/Volumes/code/workspace/references/image2prompt/README.md`（若存在）。

## 备注

可选的提示词交互参考；既不是 Axi 自有项目，也不是 Axi 活跃应用。

## 验证（建议）

_请参见项目根目录的 `AGENTS.md` 或 `package.json` 脚本中定义的权威验证命令。始终从项目目录运行，而不是从本档案目录运行。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` —— Axi Docs 如何消费工作区索引。
- `docs/content/{en,zh}/guide/routing.md` —— 工作区项目路由。
- `app/src/config/documentSources.ts` —— Axi Docs 文档源注册表。

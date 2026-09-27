---
id: axi-docs-en-projects-image2prompt-reference
title: Image2Prompt 参考文档
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: Image2Prompt Reference
graph-tags: [Projects, references]
description: 面向图生提示词 UX 与可视化提示工作流的浏览器扩展参考。
project:
  id: image2prompt-reference
  partition: references
  path: /Volumes/code/workspace/references/image2prompt
  source-section: reference
---
## 2026-08-08 同步记录

为配合 workbench 2026-08 批次而前移。Frontmatter 刷新 `status: draft` -> `status: active`，`modified` -> `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范项目入口仍为项目根目录 AGENTS.md；后续批次将把卷宗正文其余部分与各项目最新已验证状态对齐。本次改动的动因见跨项目新鲜度审计 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Image2Prompt 参考文档

> Workspace 项目卷宗。事实源：`/Volumes/code/workspace/references/image2prompt`。
> Section: reference / Partition: `references/`。

## 摘要

面向图生提示词 UX 与可视化提示工作流的浏览器扩展参考。

## 技术栈

JavaScript、浏览器扩展

## 权威文档

- Workspace 入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Image2Prompt Reference"。
- 项目根目录：`/Volumes/code/workspace/references/image2prompt`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/image2prompt/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/references/image2prompt/README.md`（如存在）。

## 备注

可选的提示 UX 参考；非 Axi 所有者或活跃应用。

## 验证（建议）

_参见项目根目录 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。始终在项目目录下运行，而非本卷宗。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费 workspace 索引。
- `docs/content/{en,zh}/guide/routing.md` — workspace 项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

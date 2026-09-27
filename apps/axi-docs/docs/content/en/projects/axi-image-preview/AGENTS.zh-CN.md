---
id: axi-docs-en-projects-axi-image-preview
title: Axi 图片预览
type: project
status: active
tags: [Axi Docs, Projects, projects, core]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Image Preview
graph-tags: [Projects, projects]
description: 基于 Vite 与 React 的图片预览 UI，附带本地壁纸库、stdio MCP 上传服务器以及预留的 macOS Swift 桌面外壳。
project:
  id: axi-image-preview
  partition: projects
  path: /Volumes/code/workspace/projects/axi-image-preview
  source-section: core
---
## 2026-08-08 同步记录

随 workbench 2026-08 批次一并前移。Frontmatter 将 `status: draft` 更新为 `status: active`，`modified` 更新为 `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范的项目入口仍为项目根目录的 AGENTS.md；后续批次将使档案正文其余部分与各项目最新已验证状态保持一致。参见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md` 了解驱动本次修订的跨项目新鲜度审计。

# Axi 图片预览 — 智能体契约

> 本档案是 Axi Docs 面向 **Axi Image Preview** 的智能体契约（工作区路径：`/Volumes/code/workspace/projects/axi-image-preview`）。
> 它不替代项目根目录的 `AGENTS.md`。项目本地规则以项目根目录为准；本文件仅记录 Axi Docs 如何*呈现*该项目。

## 阅读顺序

1. 本文件（档案）。
2. `docs/content/{en,zh}/projects/axi-image-preview/README.md`（档案摘要）。
3. 项目根目录 `AGENTS.md`，位于 `/Volumes/code/workspace/projects/axi-image-preview/AGENTS.md`。
4. 项目根目录 `README.md`，位于 `/Volumes/code/workspace/projects/axi-image-preview/README.md`。

## 边界

- Axi Docs 将本项目视为**只读内容源**。
- Axi Docs 绝不编辑 `/Volumes/code/workspace/projects/axi-image-preview` 下的文件。
- 改动必须回提给所属项目（PR、issue 或属主交接）。

## 更新节奏

- 每当 `WORKSPACE_INDEX.md` 变化时，重新运行 `pnpm --dir app projects:build`。
- 仅当 Axi Docs 是该变更的*主要*呈现面时才手工编辑本档案（例如跨项目摘要、MCP 工具映射）。

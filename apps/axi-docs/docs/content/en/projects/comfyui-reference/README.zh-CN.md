---
id: axi-docs-en-projects-comfyui-reference
title: ComfyUI 参考文档
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: ComfyUI Reference
graph-tags: [Projects, references]
description: 迁入 workspace 参考目录的本地 ComfyUI 参考 / 运行时树。
project:
  id: comfyui-reference
  partition: references
  path: /Volumes/code/workspace/references/comfyui
  source-section: reference
---
## 2026-08-08 同步记录

为配合 workbench 2026-08 批次而前移。Frontmatter 刷新 `status: draft` -> `status: active`，`modified` -> `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范项目入口仍为项目根目录 AGENTS.md；后续批次将把卷宗正文其余部分与各项目最新已验证状态对齐。本次改动的动因见跨项目新鲜度审计 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# ComfyUI 参考文档

> Workspace 项目卷宗。事实源：`/Volumes/code/workspace/references/comfyui`。
> Section: reference / Partition: `references/`。

## 摘要

迁入 workspace 参考目录的本地 ComfyUI 参考 / 运行时树。

## 技术栈

Python、PyTorch

## 权威文档

- Workspace 入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "ComfyUI Reference"。
- 项目根目录：`/Volumes/code/workspace/references/comfyui`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/comfyui/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/references/comfyui/README.md`（如存在）。

## 备注

原路径 `/Volumes/code/models/comfyui/ComfyUI` 为兼容符号链接。

## 验证（建议）

_参见项目根目录 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。始终在项目目录下运行，而非本卷宗。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费 workspace 索引。
- `docs/content/{en,zh}/guide/routing.md` — workspace 项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

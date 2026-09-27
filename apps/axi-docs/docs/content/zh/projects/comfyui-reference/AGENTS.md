---
id: axi-docs-zh-projects-comfyui-reference
title: ComfyUI Reference
type: project
status: active
tags: [Axi Docs, 项目, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: ComfyUI Reference
graph-tags: [项目, references]
description: 已迁移到工作区 references 下的本地 ComfyUI 参考/运行时目录。
project:
  id: comfyui-reference
  partition: references
  path: /Volumes/code/workspace/references/comfyui
  source-section: reference
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# ComfyUI Reference —— 代理契约

> 本档案是 **ComfyUI Reference**（工作区路径：`/Volumes/code/workspace/references/comfyui`）在 Axi Docs 中的代理契约。
> 它不取代项目根目录的 `AGENTS.md`。项目级规则始终以项目根目录的 `AGENTS.md` 为准；本文件仅记录 Axi Docs 如何*呈现*该项目。

## 阅读顺序

1. 本文件（档案）。
2. `docs/content/{en,zh}/projects/comfyui-reference/README.md`（档案摘要）。
3. 项目根目录的 `AGENTS.md`：`/Volumes/code/workspace/references/comfyui/AGENTS.md`。
4. 项目根目录的 `README.md`：`/Volumes/code/workspace/references/comfyui/README.md`。

## 边界

- Axi Docs 将本项目视为**只读的内容来源**。
- Axi Docs 绝不编辑 `/Volumes/code/workspace/references/comfyui` 下的任何文件。
- 任何修改都必须以 PR、issue 或所有者交接的方式回写到归属项目。

## 更新节奏

- 每当 `WORKSPACE_INDEX.md` 发生变化时，重新运行 `pnpm --dir app projects:build`。
- 仅当 Axi Docs 是该变更的*主要*呈现面（例如跨项目摘要、MCP 工具映射）时，才手工编辑本档案。

---
id: axi-docs-zh-projects-dbskill
title: dbskill — Agent 契约
type: project
status: draft
tags: [Axi Docs, 项目, shared, dbskill]
created: 2026-06-10
modified: 2026-06-10
graph-title: dbskill
graph-tags: [项目, shared]
description: Axi Docs 中 dbskill 镜像的 Agent 契约。
project:
  id: dbskill
  partition: shared
  path: /Volumes/code/workspace/shared/dbskill
  source-section: shared
  mirror-strategy: hand-curated
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md
---

# dbskill — Agent 契约

> 本档案是 Axi Docs 中 **dbskill**（工作区路径：`/Volumes/code/workspace/shared/dbskill`）的 Agent 契约。
> **不**替代项目根 `README.md`。项目根约定优先于本档案，本档案只说明 Axi Docs 如何**呈现**该项目。

## 阅读顺序

1. 本文件（档案）
2. `docs/content/{en,zh}/projects/dbskill/README.md`（档案摘要）
3. 项目根 `README.md`（`/Volumes/code/workspace/shared/dbskill/README.md`）
4. 项目根 `README.zh-CN.md`（`/Volumes/code/workspace/shared/dbskill/README.zh-CN.md`）

## 边界

- Axi Docs 把本项目视为**只读内容源**。
- Axi Docs 永不修改 `/Volumes/code/workspace/shared/dbskill/` 下的任何文件。
- 修改需回到上游项目（`github.com/dontbesilent2025/dbskill`）通过 PR / issue / owner 移交。
- 上游许可：CC BY-NC 4.0。从本档案再分发内容需遵循署名要求。

## 更新节奏

- 当 upstream `README.md` 实质变更时手工更新本档案。本档案**故意**走 `build-projects-index.mjs` 之外。
- 当且仅当 dbskill 被加入 `WORKSPACE_INDEX.md` 后再切到自动生成。

---
id: axi-docs-en-projects-cockpit-tools-reference
title: Cockpit Tools 参考文档
type: project
status: active
tags: [Axi Docs, Projects, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: Cockpit Tools Reference
graph-tags: [Projects, references]
description: 用于账号 / 运行时 UI 模式的外部参考桌面工具；非 Axi 所有者或 Axi 应用。
project:
  id: cockpit-tools-reference
  partition: references
  path: /Volumes/code/workspace/references/cockpit-tools
  source-section: reference
---
## 2026-08-08 同步记录

为配合 workbench 2026-08 批次而前移。Frontmatter 刷新 `status: draft` -> `status: active`，`modified` -> `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范项目入口仍为项目根目录 AGENTS.md；后续批次将把卷宗正文其余部分与各项目最新已验证状态对齐。本次改动的动因见跨项目新鲜度审计 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Cockpit Tools 参考文档

> Workspace 项目卷宗。事实源：`/Volumes/code/workspace/references/cockpit-tools`。
> Section: reference / Partition: `references/`。

## 摘要

用于账号 / 运行时 UI 模式的外部参考桌面工具；非 Axi 所有者或 Axi 应用。

## 技术栈

Tauri、Vite、TypeScript、Rust

## 权威文档

- Workspace 入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Cockpit Tools Reference"。
- 项目根目录：`/Volumes/code/workspace/references/cockpit-tools`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/cockpit-tools/AGENTS.md`（如存在）。
- 项目 `README.md`：`/Volumes/code/workspace/references/cockpit-tools/README.md`（如存在）。

## 备注

产品名保持为 Cockpit Tools，不要改名为 Axi。

## 验证（建议）

_参见项目根目录 `AGENTS.md` 或 `package.json` 脚本获取规范的验证命令。始终在项目目录下运行，而非本卷宗。_

## 交叉引用

- `docs/content/{en,zh}/guide/workspace.md` — Axi Docs 如何消费 workspace 索引。
- `docs/content/{en,zh}/guide/routing.md` — workspace 项目路由。
- `app/src/config/documentSources.ts` — Axi Docs 源注册表。

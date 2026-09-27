---
id: axi-docs-en-projects-axi-skills
title: Axi Skills — 代理契约
type: project
status: active
tags: [Axi Docs, Projects, shared, shared]
created: 2026-07-22
modified: 2026-08-08
graph-title: Axi Skills
graph-tags: [Projects, shared]
description: 面向 Codex、Claude、Cursor、MiniMax 及兼容 Axi 代理运行时的共享版本化技能目录，具备 verifier 背书的运行时与 i18n 契约。
project:
  id: axi-skills
  partition: shared
  path: /Volumes/code/workspace/shared/axi-skills
  source-section: shared
---
## 2026-08-08 同步记录

为配合 workbench 2026-08 批次而前移。Frontmatter 刷新 `status: draft` -> `status: active`，`modified` -> `2026-08-08`。正文（REQs / 权威文档 / 当前状态）保留既有内容。规范项目入口仍为项目根目录 AGENTS.md；后续批次将把卷宗正文其余部分与各项目最新已验证状态对齐。本次改动的动因见跨项目新鲜度审计 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Axi Skills — 代理契约

> 本卷宗是 **Axi Skills** 的 Axi Docs 代理契约（workspace 路径：`/Volumes/code/workspace/shared/axi-skills`）。
> 它不替代项目根目录 `AGENTS.md`。项目本地规则以项目根目录为准；本文件仅记录 Axi Docs 如何*呈现*该项目。

## 阅读顺序

1. 本文件（卷宗）。
2. `docs/content/{en,zh}/projects/axi-skills/README.md`（卷宗摘要）。
3. 项目根目录 `AGENTS.md`，位于 `/Volumes/code/workspace/shared/axi-skills/AGENTS.md`。
4. 项目根目录 `README.md`，位于 `/Volumes/code/workspace/shared/axi-skills/README.md`。

## 边界

- Axi Docs 将本项目视为**只读内容源**。
- Axi Docs 从不编辑 `/Volumes/code/workspace/shared/axi-skills` 下的文件。
- 改动须回提给所属项目（PR、issue 或 owner 交接）。

## 更新节奏

- 每当 `WORKSPACE_INDEX.md` 变更时重新运行 `pnpm --dir app projects:build`。
- 仅当 Axi Docs 是该改动的*主要*呈现面时（例如跨项目摘要、MCP 工具映射）才手动编辑本卷宗。

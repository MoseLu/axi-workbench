---
id: axi-docs-zh-projects-cockpit-tools-reference
title: Cockpit Tools Reference
type: project
status: active
tags: [Axi Docs, 项目, references, reference]
created: 2026-06-10
modified: 2026-08-08
graph-title: Cockpit Tools Reference
graph-tags: [项目, references]
description: 外部/参考性桌面工具，覆盖账号与运行时 UI 模式；既非 Axi 自有项目，也不是 Axi 应用。
project:
  id: cockpit-tools-reference
  partition: references
  path: /Volumes/code/workspace/references/cockpit-tools
  source-section: reference
---
## 2026-08-08 同步记录

与 workbench 2026-08 batch 同步。Frontmatter 把 `status: draft` 改为 `status: active`，`modified` 改为 `2026-08-08`。ZH 镜像与对应 EN 镜像配套保留原 `status: draft` 主体（REQs / Authoritative Documents / 当前状态）。project 端权威入口仍是各项目根 `AGENTS.md`；后续 batch 会逐步把每个 dossier 的正文（Current State、Authoritative Documents、Exit Criteria）对齐到对应项目的最新 verified 状态。详细动机见 `projects/axi-workbench/docs/audit/2026-08-08-axi-docs-axi-rules-staleness.md`。

# Cockpit Tools Reference —— TDD 分片

> Cockpit Tools Reference 在 Axi Docs 中的 TDD 分片。描述的是档案自身的测试设计，而非项目本身。

## 单元检查

- `pnpm --dir app projects:check` 会遍历 `docs/content/{en,zh}/projects/cockpit-tools-reference/README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md`，并断言每个期望文件都存在且 frontmatter 有效。
- `pnpm --dir app projects:check --project=cockpit-tools-reference` 会在该项目范围内运行同样的检查。

## 手工检查

- 在 Axi Docs Web 应用中打开档案，确认它在 `/en/projects/cockpit-tools-reference`（以及 `/zh/...`）下能正确路由。
- 验证知识图谱为该项目渲染了一个节点（graph-title 和 graph-tags 必须足够唯一）。

## 失败模式

- 文件缺失 → `projects:check` 非零退出，错误信息中包含缺失的路径。
- 用途说明过时 → 重新运行 `projects:build` 以从 `WORKSPACE_INDEX.md` 重新生成。
- 项目根路径过时 → 先更新 `WORKSPACE_INDEX.md`，档案会随之同步。

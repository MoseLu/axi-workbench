---
id: axi-docs-zh-projects-dbskill
title: dbskill — TDD 切片
type: project
status: draft
tags: [Axi Docs, 项目, shared, dbskill]
created: 2026-06-10
modified: 2026-06-10
graph-title: dbskill
graph-tags: [项目, shared]
description: Axi Docs 中 dbskill 镜像的 TDD 切片。
project:
  id: dbskill
  partition: shared
  path: /Volumes/code/workspace/shared/dbskill
  source-section: shared
  mirror-strategy: hand-curated
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md
---

# dbskill — TDD 切片

> Axi Docs 中 **dbskill** 的 TDD 切片。描述档案本身的测试设计，而非项目。

## 单元检查

- `docs/content/{en,zh}/projects/dbskill/{README,AGENTS,INDEX,TODO,MILESTONE,PRD,TDD,README.zh-CN}.md` 全部存在且 frontmatter 有效。
- 两个语种的 `frontmatter.project.path` 都等于 `/Volumes/code/workspace/shared/dbskill`。

## 手动检查

- 在 Axi Docs Web 中打开档案，验证路由到 `/zh/projects/dbskill`。
- 验证知识图谱为该项目渲染节点（graph-title 和 graph-tags 应足够唯一）。

## 失败模式

- 缺失件 → 在档案目录列表可见。
- 项目根路径失效 → 直接修改档案 frontmatter；本档案无自动源。

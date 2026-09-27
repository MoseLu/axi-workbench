---
id: axi-docs-zh-guide-project-dossiers
title: 项目档案
type: guide
status: published
tags: [Axi Docs, 项目, 档案, 工作区, i18n]
created: 2026-06-10
modified: 2026-06-10
graph-title: 项目档案
graph-tags: [Axi Docs, Projects, Dossiers]
description: 介绍 Axi Docs 如何为工作区索引中的每个 active 项目维护项目档案。
---

## 什么是项目档案

项目档案是 Axi Docs 对单个项目提供的**只读**展示层。工作区索引 `/Volumes/code/workspace/WORKSPACE_INDEX.md` 是档案清单的权威源；构建脚本 `app/scripts/build-projects-index.mjs` 按需重新生成。

## 路径

- 英文：`docs/content/en/projects/<id>/`
- 简体中文：`docs/content/zh/projects/<id>/`
- 双语镜像：相对路径完全一致，仅 frontmatter 中 `id` 字段不同。

按 `app/AGENTS.md` 约定，每份档案由以下七件套组成：

| 文件 | 用途 |
| --- | --- |
| `README.md` | 档案摘要（目的、技术栈、状态、备注）。 |
| `AGENTS.md` | 阅读顺序、边界、更新节奏。 |
| `INDEX.md` | 档案内目录。 |
| `TODO.md` | Axi Docs 还需要补齐的内容。 |
| `MILESTONE.md` | 档案级里程碑与转正条件。 |
| `PRD.md` | Axi Docs 自身对该项目展示层的需求。 |
| `TDD.md` | 档案本身的验证设计。 |

## 真源

项目根永远优先。档案是指针层，链接到项目自己的 `AGENTS.md`、`README.md` 与验证命令，而不是复制它们。

## 构建与校验

```bash
pnpm --dir app projects:build   # 从 WORKSPACE_INDEX.md 生成 / 刷新
pnpm --dir app projects:check   # 校验全部 322 个档案文件就位
```

`projects:build` 是非破坏性的：已存在文件会被跳过（`skipped`），仅重写 locale 级别的 `INDEX.md` 总表。

## 何时新增档案

不要手工新增。当 `WORKSPACE_INDEX.md` 在已识别章节（Core Active / Shared And Infrastructure Foundations / Reference Repos）下出现新 active 项目时，重跑 `projects:build` 即可自动落档。

## 何时手工编辑档案

仅在 Axi Docs 是该变更的**主展示面**时（例：跨项目 MCP 工具映射、说明 Axi Docs 如何*消费*该项目）。项目内部变更请直接改项目根。

## 状态流转

- `draft` — 刚生成脚手架，尚未人工 review。
- `published` — 已对照项目根核对、内容可信。

构建脚本首版统一写 `status: draft`，需经人工 review 后再手工改为 `published`。

## 11 件套（自 2026-06-10 起）

档案在 [2026-06-10 覆盖审计](../../axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md) 后由 7 件扩为 **11 件**。结构如下：

- **必选（7 件）**：`projects:build` 总生成。缺任一则 `projects:check` 报非零退出。
- **可选（4 件）**：仅当项目根存在对应源文件时才生成。缺可选件**不**导致 check 失败，仅告警。
- **透传（2 件）**：`CHANGE.md` / `CLAUDE.md` 在项目根存在时**逐字复制**并前置 frontmatter。

| 分组 | 文件 | 行为 |
| --- | --- | --- |
| 必选 | `README.md`, `AGENTS.md`, `INDEX.md`, `TODO.md`, `MILESTONE.md`, `PRD.md`, `TDD.md` | 总是生成。 |
| 可选 | `CHANGELOG.md`, `SECURITY.md`, `README.zh-CN.md`, `AGENTS.zh-CN.md` | 项目根有源文件时才生成。 |
| 透传 | `CHANGE.md`, `CLAUDE.md` | 存在时按 verbatim 复制（前置 frontmatter）。 |

7 → 11 的变化在各项目目录里可见。例如 `axi-image-preview` 镜像现含 12 件（必选 7 + 可选 4 + `CHANGE.md` 透传 + 多一个 `AGENTS.zh-CN.md` 别名）。

## 手工维护档案（preserved addenda）

`projects:build` 默认从 `WORKSPACE_INDEX.md` 重新生成档案，但**保留** `status` 字段含字面量 `hand-curated`（或 `placeholder`）的手工条目。当前有两个项目走这条逃生口：

- **dbskill**（`shared/`）— `docs/projects.index.json` 中标记为 `hand-curated mirror (not auto-generated)`。镜像下 `docs/content/{en,zh}/projects/dbskill/` 是手工的，因为 `dbskill`（还）不在 `WORKSPACE_INDEX.md` 表格中。
- **codex-plus-app**（`tools/`）— 标记为 `hand-curated mirror (no face-level docs)`。项目无 `AGENTS.md` / `README.md` / `package.json`；档案仅 3 件占位。

重跑 `projects:build` 时，JSON 的 `preservedAddenda` 字段会列出哪些手工条目在重建中幸存。

## 范围外

- 档案**不是**项目文档的复制品，复制会漂移。
- 档案**不是**项目自身的 PRD / TDD / MILESTONE——那些在项目根。
- 档案**不是**项目内容的翻译。按根 `AGENTS.md`，`references/*` 不被翻译；档案是关于项目的元数据，所以它们像其他 Axi Docs 页面一样正常双语。

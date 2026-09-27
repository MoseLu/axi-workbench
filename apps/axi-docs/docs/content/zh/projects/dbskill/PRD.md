---
id: axi-docs-zh-projects-dbskill
title: dbskill — PRD 切片
type: project
status: draft
tags: [Axi Docs, 项目, shared, dbskill]
created: 2026-06-10
modified: 2026-06-10
graph-title: dbskill
graph-tags: [项目, shared]
description: Axi Docs 中 dbskill 镜像的 PRD 切片。
project:
  id: dbskill
  partition: shared
  path: /Volumes/code/workspace/shared/dbskill
  source-section: shared
  mirror-strategy: hand-curated
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md
---

# dbskill — PRD 切片

> Axi Docs 中 **dbskill** 的 PRD 切片。这**不是**项目自身的 PRD，而是 Axi Docs 为呈现该项目而收集的需求。

## REQ-PROJ-DBSKILL-001

| 字段 | 值 |
| --- | --- |
| 需求 | 为 dbskill 维护一份可发现的 Axi Docs 档案。 |
| 验收 | `docs/content/{en,zh}/projects/dbskill/{README.md, AGENTS.md, INDEX.md, TODO.md, MILESTONE.md, PRD.md, TDD.md, README.zh-CN.md}` 全部存在且 frontmatter 有效。 |
| 来源 | `docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md`（覆盖缺口 #1）。 |

## REQ-PROJ-DBSKILL-002

| 字段 | 值 |
| --- | --- |
| 需求 | 档案反映工作区规范路径、分区、目的陈述。 |
| 验收 | `frontmatter.project.path` 等于 `/Volumes/code/workspace/shared/dbskill`。 |
| 来源 | `WORKSPACE_INDEX.md`（在 dbskill 被加入后引用）。 |

## 非目标

- Axi Docs 不拥有 dbskill；只镜像 2 份 README。
- Axi Docs 不复制 dbskill 的技能包、知识原子、知识包。
- Axi Docs 不在不符合署名要求的使用场景下再分发 dbskill 内容。

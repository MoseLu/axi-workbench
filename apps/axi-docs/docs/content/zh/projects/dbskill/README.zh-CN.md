---
id: axi-docs-zh-projects-dbskill
title: dbskill — README.zh-CN（镜像）
type: project
status: draft
tags: [Axi Docs, 项目, shared, dbskill]
created: 2026-06-10
modified: 2026-06-10
graph-title: dbskill (README.zh-CN)
graph-tags: [项目, shared]
description: dbskill 镜像的 README.zh-CN 副本（来源：upstream `shared/dbskill/README.zh-CN.md`）。
project:
  id: dbskill
  partition: shared
  path: /Volumes/code/workspace/shared/dbskill
  source-section: shared
  mirror-strategy: hand-curated
  reason-not-in-build-script: not listed in WORKSPACE_INDEX.md
---

# dbskill — README.zh-CN（镜像）

> 本文件是 `docs/content/zh/projects/dbskill/README.md` 的 zh-CN 别名镜像。
> 上游真源：`/Volumes/code/workspace/shared/dbskill/README.zh-CN.md`。
>
> 完整中文版（包含工具箱表、知识库结构、许可证）请直接读上游源。
> 本文件保留作为 11 件套扩展后的语种占位，方便 `axi_docs_read --locale zh` 的查询走快捷路径。

## 摘要

dontbesilent 商业诊断工具箱。从 12,307 条推文中提炼方法论，做成 21 个 Agent skill。

**最新更新：v2.14.2**

## 安装（节选）

#### Claude Code

```bash
claude plugin marketplace add dontbesilent2025/dbskill
claude plugin install dbs@dontbesilent-skills
```

#### 通用（Codex / Claude Code）

```bash
npx -y skills add dontbesilent2025/dbskill -g --all
```

## 许可证

CC BY-NC 4.0。详见 `README.md` 同段。

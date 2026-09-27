---
id: axi-docs-zh-guide-what-is-axi-docs
title: 什么是 Axi Docs？
type: guide
status: published
tags: [Axi Docs, 指南, 中文]
created: 2026-06-06
modified: 2026-06-13
graph-title: 什么是 Axi Docs？
graph-tags: [Axi Docs, 指南]
description: 了解 Axi Docs 如何统一组织指南、技能库与工作区知识。
---

## 一个面向阅读与检索的文档中心

Axi Docs 是基于 React、Vite 和 Markdown 的文档应用。它把分散在工作区、共享技能库和项目文档中的内容统一成稳定的阅读入口，同时保留全文搜索、标签和知识关系能力。

## 三个顶级文档集

- **指南**：解释站点结构、写作规则、搜索方式和维护流程。
- **技能库**：索引 Axi Skills 中可复用的 Agent 能力与工作流。
- **工作区**：呈现项目索引、治理文档和长期维护的工作区知识。

顶级导航决定当前文档集，左侧侧栏负责文档集内部导航，右侧目录负责当前页面内的章节定位。

## 内容如何进入站点

文档来源由 `app/src/config/documentSources.ts` 注册。Axi Docs 自有内容位于 `docs/content/{locale}/guide`、`docs/content/{locale}/plans` 和 `docs/content/{locale}/projects`，技能与工作区内容则来自各自的本地仓库。服务端索引这些来源，前端通过统一接口加载目录、正文、搜索结果和关系数据。

## 适合从哪里开始

第一次使用时先阅读[快速开始](/zh/guide/getting-started)，再根据目标进入技能库或工作区。需要维护内容时，从[文档来源](/zh/guide/document-sources)、[方案库](/zh/guide/plans)、[Markdown 写作](/zh/guide/markdown)和 [Frontmatter](/zh/guide/frontmatter)开始。

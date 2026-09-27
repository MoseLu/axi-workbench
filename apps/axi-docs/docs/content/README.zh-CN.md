---
id: axi-docs-content-root
title: Axi Docs 内容根
type: index
status: active
tags: [Axi Docs, i18n, content, 方案]
created: 2026-06-06
modified: 2026-06-06
graph-title: Axi Docs Content Root
graph-tags: [Axi Docs, i18n]
description: Axi Docs 站点的按语言组织的 Markdown 内容根。
---

# Axi Docs 内容根

本目录是 Axi Docs 的 Markdown 内容平面。

## 语言布局

- `en/` 是源语言（英文）文档树。
- `zh/` 是简体中文翻译树。

请保证不同语言下的同名页面保持一致的相对路径。例如：

- `en/guide/getting-started.md`
- `zh/guide/getting-started.md`
- `en/plans/idea-to-landing.md`
- `zh/plans/idea-to-landing.md`

React 应用会把本地化后的指南页面路由为 `/en/guide/*` 与 `/zh/guide/*`，而知识索引则分别读取语言特定源 `axi-docs-en` 与 `axi-docs-zh`。

## 内容角色

- `guide/` 解释 Axi Docs 如何工作。
- `plans/` 存放长期“想法到落地”方案与方案契约。
- `projects/` 存放生成或手工维护的项目档案。

执行状态、排期和下一步动作属于 Axi Todo。方案页可以链接到 Axi Todo 任务，但方案正文仍是长期权威来源。

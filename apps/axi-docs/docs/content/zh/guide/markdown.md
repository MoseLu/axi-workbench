---
id: axi-docs-zh-guide-markdown
title: Markdown 写作
type: guide
status: published
tags: [Axi Docs, Markdown, 写作, 中文]
created: 2026-06-07
modified: 2026-06-07
graph-title: Markdown 写作
graph-tags: [Axi Docs, Markdown]
description: 使用 Axi Docs 支持的 Markdown 结构编写清晰、可检索的技术文档。
---

## 标题与页面结构

页面标题来自 frontmatter 的 `title`，正文从 `##` 开始组织。二级标题构成右侧页面导航，三级标题用于拆分较长章节。标题应描述任务或概念，避免使用“其他”“说明”等弱信息名称。

## 链接与强调

使用标准 Markdown 链接连接站内页面和外部资料。站内链接保持语言前缀一致；外链会自动获得外链样式。文件名、命令、配置键和路由使用行内代码。

## 代码块

围栏代码块应声明语言：

```bash
pnpm --dir app verify
```

声明语言后会显示语法高亮、语言标签和复制按钮。纯文本块使用 `text`。

## 列表、引用与表格

列表适合步骤和并列条件，表格适合字段对照，引用块适合补充限制：

> 指南必须描述当前已经存在的行为，不应把计划中的功能写成已交付能力。

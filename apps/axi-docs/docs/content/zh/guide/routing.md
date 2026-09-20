---
id: axi-docs-zh-guide-routing
title: 导航与路由
type: guide
status: published
tags: [Axi Docs, 路由, 导航, 中文]
created: 2026-06-07
modified: 2026-06-07
graph-title: 导航与路由
graph-tags: [Axi Docs, 路由]
description: 理解语言前缀、文档集路由、文档详情路由和站内导航的关系。
---

## 指南路由

指南使用 `/{locale}/guide/{pageId}` 结构，例如 `/zh/guide/getting-started`。`locale` 当前支持 `zh` 和 `en`，`pageId` 由 `app/src/config/siteConfig.ts` 中的指南页面配置决定。

## 文档集路由

技能库和工作区使用 `/{locale}/{collection}`：

- `/zh/skills`
- `/en/skills`
- `/zh/workspace`
- `/en/workspace`

进入文档集后，左侧侧栏由该来源的目录数据生成，不复用指南的固定页面列表。

## 文档详情路由

具体文档使用 `/docs/{sourceId}/{documentPath}`。来源标识和相对路径共同确定正文，路径中的 `.md` 扩展名不会显示在 URL 中。

## 编写站内链接

指南正文优先使用绝对站内路径，例如 `[Frontmatter](/zh/guide/frontmatter)`。跨语言页面应链接到对应语言前缀，外部 HTTP 链接会在新标签页打开并显示外链标识。

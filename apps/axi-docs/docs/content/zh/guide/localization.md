---
id: axi-docs-zh-guide-localization
title: 国际化
type: guide
status: published
tags: [Axi Docs, 国际化, 中文]
created: 2026-06-07
modified: 2026-06-07
graph-title: 国际化
graph-tags: [Axi Docs, 国际化]
description: 维护中英文镜像页面、语言路由和界面文案。
---

## 语言路由

中文指南位于 `/zh/guide/*`，英文指南位于 `/en/guide/*`。顶部语言菜单会保留当前路径，只替换语言前缀，因此两个语言版本必须使用相同的页面 id。

## 文件镜像

源文件位于：

```text
docs/content/zh/guide/
docs/content/en/guide/
```

新增、重命名或删除页面时，应同时处理两个目录中的同名文件，并同步 `app/src/config/siteConfig.ts` 中的页面标题。

## 翻译原则

保持章节顺序和链接目标一致，但不要机械直译术语。代码、路径、配置键和命令保持原样；界面名称使用站点实际显示的翻译。

## 界面文案

导航、搜索和错误页文案集中在 `siteConfig` 的 locale 配置中。正文属于 Markdown，界面控件属于 TypeScript 配置，避免在组件中散落语言判断。

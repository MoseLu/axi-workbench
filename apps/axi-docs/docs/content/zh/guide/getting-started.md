---
id: axi-docs-zh-guide-getting-started
title: 入门指南
type: guide
status: published
tags: [Axi Docs, 指南, 中文]
created: 2026-06-06
modified: 2026-06-08
graph-title: 入门指南
graph-tags: [Axi Docs, 指南]
description: 启动 Axi Docs 并学习指南、技能、工作区和搜索的基本工作流。
---

## 启动本地站点

从仓库根目录安装依赖并启动应用：

```bash
pnpm --dir app install
pnpm --dir app dev
```

打开 Vite 输出的本地 URL。`docs/content/` 或 `app/src/` 下的变更会刷新开发页面。

## 浏览文档

1. 使用顶部导航在 **指南（Guide）**、**技能（Skills）** 和 **工作区（Workspace）** 之间切换。
2. 使用分组后的左侧边栏选择当前集合中的页面。
3. 使用右侧大纲跳转到当前页面的某个标题。
4. 使用底部的「上一页 / 下一页」链接继续阅读。

## 搜索文档

点击搜索控件或按下 `⌘K`。搜索会匹配标题、描述、路径、标签和正文内容。提交查询后会跳转到 [搜索与索引](/zh/guide/search) 并展示匹配的文档。

## 验证变更

```bash
pnpm --dir app test:run
pnpm --dir app lint
pnpm --dir app verify
```

`verify` 当前会运行 TypeScript 类型检查和 Vite 生产构建。文档结构与镜像语言路径需要单独检查。

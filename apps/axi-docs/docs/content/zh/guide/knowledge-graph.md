---
id: axi-docs-zh-guide-knowledge-graph
title: 知识图谱
type: guide
status: published
tags: [Axi Docs, 知识图谱, 关系, 中文]
created: 2026-06-07
modified: 2026-06-07
graph-title: 知识图谱
graph-tags: [Axi Docs, 知识图谱]
description: 理解文档、标签和双向链接如何形成可导航的知识关系。
---

## 关系从哪里来

Axi Docs 会从已索引文档中读取路径、标签和 Wiki 链接。文档节点通过共享标签和 `[[Wiki Link]]` 形成关系，未连接的文档会作为孤立节点保留。

## 图谱元数据

`graph-title` 可以提供更适合图谱显示的短标题，`graph-tags` 可以补充主题标签。未提供这些字段时，系统会使用普通标题和标签作为回退。

## 文档内关系

文档详情页可以展示当前文档的出链、入链、标签节点和相关页面。点击关系项会跳到文档或搜索相应主题，帮助读者从正文继续探索。

## 编写建议

优先链接稳定的概念和文档名称，不要为每个普通词创建 Wiki 链接。标签用于主题聚合，正文链接用于表达明确的知识依赖。

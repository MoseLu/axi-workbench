---
id: axi-docs-zh-guide-frontmatter
title: Frontmatter
type: guide
status: published
tags: [Axi Docs, Frontmatter, 元数据, 中文]
created: 2026-06-07
modified: 2026-06-13
graph-title: Frontmatter
graph-tags: [Axi Docs, 元数据]
description: 配置文档标题、描述、标签、时间和知识图谱显示信息。
---

## 常用字段

- `id`：稳定且唯一的文档标识。
- `title`：页面标题和默认搜索标题。
- `type`：如 `guide`、`skill`、`project`、`plan` 或 `plan-contract`。
- `status`：内容状态，例如 `draft` 或 `published`。
- `tags`：搜索、筛选和关系构建使用的标签。
- `description`：列表、搜索结果和页面摘要。
- `created`、`modified`：创建和最后修改日期。
- `graph-title`、`graph-tags`：知识图谱使用的显示标题与标签。

## 示例

```yaml
---
id: axi-docs-zh-guide-search
title: 搜索与索引
type: guide
status: published
tags: [Axi Docs, 搜索, 中文]
created: 2026-06-06
modified: 2026-06-07
graph-title: 搜索与索引
graph-tags: [Axi Docs, 搜索]
description: 了解全局搜索的匹配范围与结果页。
---
```

## 编写原则

标题和描述应使用读者能搜索到的词。标签数量保持克制，同一主题复用稳定标签。双语页面可以使用不同的文档 `id`，但相对文件路径必须一致。

方案页应包含能把长期方案与执行概念连接起来的标签，例如 `方案`、`想法到落地`、`执行` 和受影响项目名。

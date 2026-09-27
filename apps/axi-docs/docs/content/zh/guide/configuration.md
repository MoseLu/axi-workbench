---
id: axi-docs-zh-guide-configuration
title: 配置与数据源
type: guide
status: published
tags: [Axi Docs, 配置, 数据源, 中文]
created: 2026-06-07
modified: 2026-06-07
graph-title: 配置与数据源
graph-tags: [Axi Docs, 配置]
description: 定位站点导航、文档来源、路径覆盖和本地服务配置。
---

## 站点配置

`app/src/config/siteConfig.ts` 管理语言、顶部导航、指南分组、页面标题、文档集映射和界面文案。新增指南页时需要同时更新页面 id、所属分组和中英文标题。

## 文档来源

`app/src/config/documentSources.ts` 管理来源 id、路径、适配器、语言和只读属性。优先复用现有适配器，只有新的存储协议才需要扩展读取逻辑。

## 路径覆盖

本地路径可以通过环境变量覆盖，例如：

```bash
AXI_DOCS_CONTENT_PATH=/path/to/content
AXI_SKILLS_PATH=/path/to/axi-skills
AXI_WORKSPACE_GOVERNANCE_PATH=/path/to/governance
```

路径配置可以进入本地环境文件，凭证和访问令牌不得写入指南。

## 验证配置

修改配置后运行相关单元测试、`pnpm --dir app lint` 和 `pnpm --dir app verify`，并实际打开受影响的语言路由和文档集。

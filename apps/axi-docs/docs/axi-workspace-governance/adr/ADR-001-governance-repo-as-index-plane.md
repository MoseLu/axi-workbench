---
id: adr-workspace-001
title: ADR-001: Use the governance repo as the multi-repo index plane
type: reference
status: evergreen
tags: [workspace, adr, governance, polyrepo]
created: 2026-04-01
modified: 2026-04-01
agent-readable: true
---

# ADR-001: Use the governance repo as the multi-repo index plane

## Status

Accepted

## Context

工作区已经采用多仓协作，但在治理、目录清单、权威远端、共享策略和架构文档方面长期缺少单一入口。继续新增一个“总代码仓”只会把现有复杂度再包一层，而不会减少边界混乱。

## Decision

选择 `/Volumes/code/workspace/infra/axi-workspace-governance` 根治理仓库作为唯一多仓索引平面。

它承担以下职责：

- 保存 `workspace.json`
- 生成 `.workspace/registry.json`
- 运行审计脚本
- 生成多仓索引文档
- 向个人文档站镜像治理文档

## Consequences

- 工作区继续保持 `Polyrepo + 注册表 + 治理仓库` 模式，不建立工作区级 mega monorepo
- 多仓索引和文档入口被收敛到同一个仓库
- 其他业务仓库不再承担“总入口”职责

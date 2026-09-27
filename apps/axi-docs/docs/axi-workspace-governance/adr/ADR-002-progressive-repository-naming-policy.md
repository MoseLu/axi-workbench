---
id: adr-workspace-002
title: ADR-002: Adopt progressive repository naming instead of bulk renaming
type: reference
status: evergreen
tags: [workspace, adr, naming, governance]
created: 2026-04-01
modified: 2026-04-01
agent-readable: true
---

# ADR-002: Adopt progressive repository naming instead of bulk renaming

## Status

Accepted

## Context

当前工作区已经存在大量对外可见仓库名，文档、自动化、fork 关系、远端脚本和团队认知都依赖这些名称。若对所有仓库执行统一前缀化重命名，收益有限，但迁移成本和外部冲击很高。

## Decision

采用渐进式命名策略：

- 现有业务产品仓库保留产品语义名称
- 新增治理、基础设施、共享、Agent 支撑、工具类仓库使用前缀命名
- 仅在名称冲突、语义失真或组织归属变化时重命名存量仓库

## Consequences

- 仓库命名会逐步收敛，而不是一次性大迁移
- 新治理类仓库遵循统一模式，例如 `axi-workspace-governance`
- 现有产品仓库可保持稳定的外部地址和认知成本

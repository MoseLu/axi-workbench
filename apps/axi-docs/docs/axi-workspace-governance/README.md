---
id: reference-axi-workspace-governance-index
title: Axi Workspace Governance Index
type: reference
status: evergreen
tags: [workspace, governance, polyrepo]
created: 2026-09-16
modified: 2026-09-16
agent-readable: true
---

# Axi Workspace Governance Index

最后生成：2026-09-16

## 摘要

- 工作区容器：`/Volumes/code/workspace`（非 Git 仓库 / 非代码提交单元）
- 治理仓库根目录：`/Volumes/code/workspace/infra/axi-workspace-governance`
- 治理仓库远端：`https://github.com/axiomaticworld/axi-workspace-governance.git`
- 已登记条目：22
- canonical 条目：22
- active / active-* 条目：21
- 非项目孵化区：`/Volumes/code/workspace/incubator`（不计入登记条目）

## Section 统计

- `infra`: 2
- `projects`: 8
- `products`: 5
- `shared`: 4
- `tools`: 3
- `agent`: 0
- `references`: 0

## 索引文档

- [项目清单](project-catalog.md)
- [项目完成情况](project-completion.md)
- [项目接手状态](project-handoff.md)
- [仓库拓扑](repo-topology.md)
- [负责人矩阵](ownership-matrix.md)
- [集成地图](integration-map.md)
- [治理 ADR](adr/README.md)
- [ADR-003: Workspace root is a non-git container](adr/ADR-003-workspace-root-is-non-git-container.md)

## 工作区根目录契约

- `/Volumes/code/workspace` 只承载项目目录、参考目录、生成快照和 launcher shim。
- 不在 `/Volumes/code/workspace` 执行 `git init`，也不从根目录 commit / push / clean / reset。
- 代码修改进入拥有该代码的项目仓库；治理修改进入 `infra/axi-workspace-governance`。
- 根层 `WORKSPACE_INDEX.md`、`AGENTS.md`、`workspace.graph.json` 和 `.workspace/*.json` 是 agent 接手与路由表面，不是业务代码。
- `/Volumes/code/workspace/incubator` 承载未完成 idea / PRD / prototype；它不是项目、仓库、provider 或发布单元。

## 分发链路

- 权威文档目录：`/Volumes/code/workspace/infra/axi-workspace-governance/docs`
- `axi-workspace-governance-docs`: `../../projects/axi-docs/docs/axi-workspace-governance`
- Axi Docs Source：`axi-workspace-governance` -> `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance`

## 使用命令

```bash
pnpm workspace:docs:sync
pnpm workspace:incubator:check
pnpm workspace:registry:sync
pnpm workspace:audit
```

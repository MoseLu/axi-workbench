# Axi Docs PRD

## Problem

Axi Docs 是 Axi 项目的文档中心，基于 Vite React 阅读器、本地知识源适配器和 MCP 文档总线构建，供人类和 AI agent 检查相同的项目、技能和工作区文档。

项目需要完整的根文档套件，使人类和 agent 能够在编辑前理解范围、所有权、需求、测试和交付状态。

## Users

- 在 `/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs` 内工作的维护者
- 需要稳定阅读顺序、边界和验证命令的 Agent
- 依赖此根目录或从工作区索引引用它的下游项目

## Requirements

| ID | Requirement | Acceptance Criteria | Verification |
|----|-------------|---------------------|--------------|
| REQ-DOC-001 | 维护完整的根文档套件 | 所有必需文档存在且内部一致 | [TDD.md 最小检查命令](#docs-state-tddmd) |
| REQ-VERIFY-001 | 记录可运行的验证 | `TDD.md` 列出具体命令或精确阻塞点 | `pnpm --dir app docs:check` |
| REQ-BOUNDARY-001 | 保留所有权边界 | `AGENTS.md` 解释可写范围和跨项目限制 | [AGENTS.md 边界验证](#docs-state-agentsmd) |
| REQ-MILESTONE-001 | 跟踪交付状态 | `MILESTONE.md` 记录当前状态和退出标准 | [MILESTONE.md 状态检查](#docs-state-milestonemd) |
| REQ-PLAN-001 | 保持持久计划与任务执行分离 | 规范计划位于 `docs/content/{en,zh}/plans/`；任务状态和后续操作通过 Axi Todo 链接 | [计划库结构验证](#plans-library) |

## Non-Goals

- 不替代实现源文件和文档
- 不创建本地文件不支持的广泛架构声明
- 不在 Axi Todo 中存储长期决策（保持与 Axi Docs 的分离）

## Success Metrics

- 必需文档存在且位于正确位置
- P0/P1 TODO 条目包含需求 ID 和测试引用
- 验证命令足够具体，使未来 agent 无需重新发现即可运行

## 验证引用

### docs/state/TDD.md

文档验证命令：
```bash
pnpm --dir app docs:check
```

构建验证：
```bash
pnpm --dir app verify
```

### docs/state/MILESTONE.md

每个 REQ 的完成状态记录在本文件中，格式为：

| REQ ID | 状态 | 证据文件 | 待完成 |
|--------|------|----------|--------|

### docs/state/AGENTS.md

所有权边界定义于 `AGENTS.md` 中的可写范围部分，验证 agent 不超出授权边界。

### Plans Library

计划库位于 `docs/content/{en,zh}/plans/`，每个计划包含：
- frontmatter 元数据（id, title, type, status, tags, created, modified）
- graph-title 和 graph-tags 用于知识图谱链接
- 持久决策存储在 Axi Docs，执行状态在 Axi Todo

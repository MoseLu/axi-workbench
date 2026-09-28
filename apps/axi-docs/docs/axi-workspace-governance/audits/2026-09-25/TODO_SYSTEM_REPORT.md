# Axi 工作区 Todo 体系现状报告

> 生成日期: 2026-09-17
> 来源: 工作区调研

---

## 一、权威系统

| 维度 | 内容 |
|------|------|
| **位置** | `tools/axi-todo/` (位于 `/Volumes/code/workspace/agent-cluster/axi-agent/tools/axi-todo`) |
| **类型** | 本地持久化任务账本 + Codex 执行器 |
| **存储** | JSON 文件 (`~/.axi-todo/tasks.json`) 或 `AXI_TODO_HOME/tasks.json`；支持 SQLite/Postgres 扩展 |
| **运行时模型** | macOS WebView 桌面壳 + CLI + MCP server + LaunchAgent 守护进程 |

**核心功能**:
- 任务创建/编辑/删除/完成/重开
- 任务拆分 (`split`) 与调度 (`schedule`)
- 验证命令 (`verifyCommand`) 自动验证并写 `VERIFICATION.md`
- PRD 连续性模式 (设计稿阶段, 见 `docs/axi-todo-prd-continuity-design.md`)
- OMO 风格路由字段 (`agentRole`, `agentCategory`, `executionMode`, `parallelGroup` 等)

---

## 二、facade 分布

| 位置 | 类型 | 说明 |
|------|------|------|
| `agent-cluster/axi-agent/docs/state/TODO.md` | 项目级 TODO | Axi Agent Platform 自身的 P0/P1/P2 backlog，含 AXI-AP-* 编号 |
| `projects/axi-docs/docs/state/TODO.md` | facade 索引 | 链接到 `todo/` 分节文件，作为统一入口 |
| `projects/axi-docs/todo/01-current-architecture.md` | 当前架构 backlog | ZC-DOCS-001~006 执行队列，原子字段格式 |
| `projects/axi-docs/todo/02-legacy-audit.md` | 旧审计清单 | 2026-03 代码审计 P0/P1/P2/P3 复核 |
| `projects/axi-docs/todo/04-roadmap.md` | 路线图 | Axi Knowledge Hub 下一轮重点 |
| `docs/state/TODO.md` | 工作区级 facade | 工作区根级 TODO 聚合 |
| 各项目根级 `TODO.md` | 散落 facade | 如 `workbench/axi-workbench/TODO.md`, `workbench/axi-image-preview/TODO.md` 等 |
| `foundation/workspace-governance/contracts/todo-flow/v1/` | 治理契约 | Todo Flow v1 契约定义 |

**治理文件语义矩阵** (来源: `contracts/todo-flow/v1/file-semantics.md`):

| 文件/源 | 所属层 | 执行队列 | 可变 | 允许投影 |
|---------|--------|---------|------|---------|
| Axi Todo ledger (SQLite/JSON/Postgres) | `tools/axi-todo` 运行时 | **是(权威)** | n/a | n/a |
| 项目 `TODO.md` / `TASK.md` | 项目 | 否(事实/facade) | 仅作 facade 回链 | 是(facade) |
| `MILESTONE.md` | 项目 | 否(交付) | 否(只读镜像) | 是(镜像) |
| PRD/plan/RFC | 项目 | 否(意图) | 否(只读镜像) | 是(镜像) |
| `HANDOFF.md` | manifest 生成器 | 否(生成) | 否(生成) | 是(镜像) |
| Axi Docs dossier (per-project TODO) | `axi-docs` 投影 | 否(渲染) | 否(只读镜像) | 是(镜像) |
| 根 `docs/state/TODO.md` | workspace governance | 否(治理 facade) | 否(只读镜像) | 是(facade) |

---

## 三、治理契约

### 3.1 契约位置

| 契约 | 路径 |
|------|------|
| Todo Flow v1 任务架构 | `foundation/workspace-governance/contracts/todo-flow/v1/task.schema.json` |
| Todo Flow v1 事件日志 | `foundation/workspace-governance/contracts/todo-flow/v1/task-event.schema.json` |
| Todo Flow v1 文件语义矩阵 | `foundation/workspace-governance/contracts/todo-flow/v1/file-semantics.md` |
| Todo Flow v1 索引 | `foundation/workspace-governance/contracts/todo-flow/v1/INDEX.md` |
| Axi Todo 迁移契约 | `foundation/workspace-governance/contracts/axi-todo/axi-todo-contract.mjs` |
| 任务执行路由契约 | `foundation/workspace-governance/contracts/task-execution-routing/v1/` |

### 3.2 task.schema.json 核心字段

```json
{
  "taskId": "UUIDv4 稳定标识",
  "workspaceId": "工作区标识",
  "projectId": "项目标识(可为 null)",
  "canonicalPath": "/Volumes/code/workspace/...",
  "scope": "workspace|portfolio|project|module|document|initiative|task",
  "lifecycleStatus": "intake|planned|ready|in_progress|blocked|review|verified|done|cancelled|archived|superseded",
  "executionStatus": "idle|queued|running|succeeded|failed",
  "verificationStatus": "unverified|passed|failed|awaiting_audit",
  "deliveryStatus": "not_started|partial|delivered|released",
  "priority": "p0|p1|p2|p3",
  "riskLevel": "low|medium|high|critical",
  "sourceRef": { "sourceType": "task_file|milestone_file|handoff_file|..." }
}
```

### 3.3 变异策略

- **权威写入**: 仅 Axi Todo CLI/MCP/桌面端可变更任务状态
- **facade 变异**: Markdown 文件仅可由生成器更新
- **镜像变异**: 禁止; `docs/axi-workspace-governance/...` 须重新生成

---

## 四、问题

| 问题 | 影响 | 建议 |
|------|------|------|
| **PRD 连续性模式未实现** | 长周期 PRD 工作无法跨上下文安全恢复 | 按 `axi-todo-prd-continuity-design.md` 三阶段推进 |
| **散落 TODO facade 无统一聚合视图** | 工作区级 TODO 状态不可见 | 扩展根 `docs/state/TODO.md` 作为统一聚合点 |
| **旧审计项与当前 backlog 混存** | 新 Agent 难以区分历史与当前任务 | 维持 `todo/` 分节文件分离策略 |
| **Todo Flow v1 与实际 Axi Todo 实现存在 gap** | 治理契约与运行时数据模型未对齐 | 对齐 `task.schema.json` 与 `tools/axi-todo` 存储模型 |
| **workspace-level 任务缺少显式治理** | 工作区级任务缺乏验收/追踪机制 | 扩展 Todo Flow v1 覆盖 workspace scope |

---

## 五、建议行动

1. **[P0]** 对齐 Todo Flow v1 架构与 Axi Todo 运行时实现
2. **[P1]** 推进 Axi Todo PRD 连续性模式 Phase 1 (本地账本 + CLI)
3. **[P1]** 在根 `docs/state/TODO.md` 添加 workspace-level 任务聚合视图
4. **[P2]** 为散落项目 TODO.md 建立 `sourceRef` 回链规范
5. **[P2]** 审计并清理 workspace 中冗余/过期的 TODO facade

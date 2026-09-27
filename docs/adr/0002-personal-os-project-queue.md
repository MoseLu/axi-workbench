# ADR-0002: Personal OS v0.1 归属 Workbench 与项目队列优先

- **日期**: 2026-09-01
- **状态**: 已接受
- **决策者**: Axi Workbench Owner

## 背景

PRD-01 将 Personal OS 定义为个人工作系统的产品壳、对象模型和导航；PRD-02 将 Mac 工作区、项目队列、运行时和 AgentRun 定义为工作台的事实与行动平面。两份 PRD 的方向一致，但运行时协议、存储边界和宿主边界尚未冻结。

继续扩展 `resource-search` 或新建独立产品仓库，会在运行时和 UI 契约未稳定前扩大跨项目耦合。现有 `axi-workbench` 已拥有 Dashboard、control-plane、项目快照、Agent 任务、API client 和 shared/axi-ui，适合作为 Personal OS 的宿主。

## 决策

1. Personal OS v0.1 归属现有 `/Volumes/code/workspace/projects/axi-workbench`，不新建业务仓库，也不把旧 Dashboard 改名。
2. 第一条真实闭环是 Project Queue：展示注册项目、运行时、活动、AgentRun 摘要和人工 overlay，并支持焦点项目与 `finishLine` 编辑。
3. Personal OS 保持独立路由和视觉命名空间，第一批真实路由为 `/admin/personal-os/today` 和 `/admin/personal-os/workbench`。
4. control-plane 负责服务端组合投影；浏览器只消费 `ProjectQueueItem`，不得直接读取 workspace graph、扫描端口、调用资源 provider 或拼装跨项目数据。
5. 使用 control-plane 私有缓存目录下的 SQLite 保存 Personal OS 自己的可编辑元数据。SQLite 不迁移既有 jobs、audit、AgentRun 文件存储。
6. 继续使用各权威系统：workspace registry/graph 提供项目身份和依赖，DevSvc/control-plane 提供运行状态与 AgentRun 摘要；Personal OS 仅保存生命周期人工覆盖、`finishLine`、`usesAxiUi` 和焦点项目。
7. UI 以 shared/axi-ui 的 shell、tokens 和通用组件为基础，使用独立的 light-first Personal OS 视觉基线；仅在发现通用缺口时回补 shared/axi-ui。

## 数据与状态边界

权威顺序固定为：

1. workspace registry / graph：项目身份、路径、分区、角色、依赖关系。
2. DevSvc / control-plane：运行状态、健康状态、提交活动、AgentRun 摘要。
3. Personal OS SQLite：`lifecycle` 人工覆盖、`finishLine`、`usesAxiUi`、当前焦点项目。
4. UI：只消费组合后的 `ProjectQueueItem`。

`building` 必须有非空 `finishLine`；`stalled` 由 building 状态和 14 天无活动计算，人工覆盖优先；`usable`、`shipped`、`archived` 只能由用户明确设置。运行时状态不可被 overlay 覆盖，编辑通过 `revision` 乐观并发控制。

SQLite v1 包含 `schema_migrations`、`project_overrides` 和单例 `focus_state`。数据库路径由 `AXI_WORKSTATION_CONTROL_CACHE_DIR` 或 control-plane 默认缓存目录解析，不写入任何 `/Volumes/...` 业务路径。

## 接口边界

Personal OS 端点归入现有 control-plane，并由现有 Gateway/session 边界承载：

- `GET /api/v1/control-plane/personal-os/queue`
- `GET /api/v1/control-plane/personal-os/projects/:projectId`
- `PATCH /api/v1/control-plane/personal-os/projects/:projectId`
- `GET|PUT /api/v1/control-plane/personal-os/focus`

契约由 `@axi/workstation-contracts` 提供，所有 envelope 带 `contractVersion: 1`、`generatedAt` 和 `warnings`。投影只允许输出有限的 AgentRun 摘要，不输出 prompt、工作目录、标准输出、标准错误、provider secret 或认证信息。

## 暂不纳入

- 不继续扩展上一轮 `resource-search`；它属于后续 Library/Asset 能力。
- 不在 Flow、Library 页面使用假数据撑起真实产品页面。
- 不在本阶段接入 Agent 派发、任务提交或 AgentRun 回写；这些属于后续阶段。
- 不复制 `ai-resource-orchestration` 数据，不让 Soul 成为统一壳或 shared/axi-ui 来源。
- 不默认拉起 Soul、resource-search 或其他资源 provider。

## 结果与后续闸门

本决策先落地数据基础和 Project Queue，再评估 Agent、Flow、Library 与资源能力。Personal OS 默认入口保持旧 Dashboard 不变，待 Today/Workbench 完成真实数据、行为、响应式视觉和本地重启恢复验收后，再单独决定是否切换默认入口。

验收至少覆盖 SQLite 迁移与重启恢复、revision 冲突、队列/Inspector 行为、loading/empty/failure/unknown runtime/stale snapshot 状态，以及 1440×900、1024×768、768×1024 三种视口下的布局验证。

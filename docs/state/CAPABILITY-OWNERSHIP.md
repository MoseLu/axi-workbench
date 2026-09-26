# 能力台账：Web 管理控制中心 / Mobile 角色执行端 / 跨端交接

> 状态：P0 盘点完成 · 更新：2026-08-22
>
> 本台账是 [`docs/specs/2026-08-09-multi-surface-admin-positioning/CAPABILITY-INVENTORY.md`](../specs/2026-08-09-multi-surface-admin-positioning/CAPABILITY-INVENTORY.md) 的结构化摘要，聚焦当前已实现的端侧任务、能力归属和交接规则。机器可检查的完整记录见 `CAPABILITY-INVENTORY.json`。

## 记录规则

| 规则 | 说明 |
| --- | --- |
| 一能力一条记录 | 若双端存在，必须分别列出不同任务和允许动作 |
| 先定动作政策 | 动作政策由领域 API/服务端授权，前端只渲染被允许的路径 |
| 开发准入 | 新增能力必须先更新 `CAPABILITY-INVENTORY.json` 并通过 `pnpm check:capabilities` |

## 能力台账

### 1. Web 管理控制中心能力清单

| 能力域 | 端侧任务 | 动作等级 | 允许动作 | 服务端政策 | 审计 | 不支持端 / 交接 |
| --- | --- | --- | --- | --- | --- | --- |
| **登录与会话** | 邮箱验证码登录、管理员会话 | B | 发起登录、保持会话、登出 | Identity 验证、HttpOnly 会话 | `auth.login`, `auth.logout` | Mobile 登录走独立 Identity 流程 |
| **概览与运行状态** | 跨项目观察、分流 | A | 查看项目健康、运行环境、处理事项 | Control Plane 投影，无数据时显示不可用 | `view.overview` | 不伪造零值统计 |
| **项目组合管理** | 跨项目筛选、编辑、导出 | C | 创建、编辑、分派、批量调整、历史追溯 | 服务端重新鉴权，复杂编辑需要审批 | `project.crud`, `project.batch` | 需要移动端闭环的 B 级动作交接 |
| **工作项管理** | 受管工作项与审批队列 | C | 查看、编辑、分配、处理审批 | 服务端状态重验 | `workitem.crud` | 同上 |
| **组织与访问** | 团队、角色、菜单配置 | C | 完整 RBAC 管理、租户成员管理 | Platform Core 鉴权 + 审计 | `tenant.crud`, `rbac.assign` | Mobile 不做组织级配置 |
| **租户、系统设置** | 全局字典、审计配置 | C | 完整系统管理能力 | 管理员权限重新鉴权 | `system.configure` | Mobile 仅查看个人身份 |
| **资源与服务状态** | 状态汇总、受控入口 | A + 部分 B | 查看状态、提供受控入口 | 服务端状态重验 | `resource.view` | 实际启停在 Fleet |
| **审计与导出** | 全量查询、复盘 | A + C | 查询、过滤、导出 | 完整查询权限 | `audit.query`, `audit.export` | Mobile 不提供全量审计 |
| **通知与规则** | 全量收件箱、规则配置 | A + C | 查看历史、配置规则 | Notification 服务 | `notification.configure` | Mobile 仅个人通知 |
| **交接续办** | Mobile 交接的后续处理 | C | 继续对象、状态、执行 | Control Plane 读取/最终化 | `handoff.continue` | 源端交接 ID 贯穿全程 |

**Web 表面设计原则**：
- 主导航按"管理对象和控制动作"组织
- 高信息密度表格、可组合筛选、对象详情、明确影响范围
- 窄屏保持后台语义，不用移动底栏替代
- 未具备真实数据的菜单不新增空页面

### 2. Mobile 角色执行端能力清单

| 能力域 | 端侧任务 | 动作等级 | 允许动作 | 服务端政策 | 审计 | 不支持端 / 交接 |
| --- | --- | --- | --- | --- | --- | --- |
| **登录（身份确认）** | 一次性 QR transaction 确认 | B | 确认网页登录 | Identity QR transaction 验证 | `auth.confirm` | 不占用顶部 Scan |
| **概览（当班摘要）** | 告警、个人待办摘要 | A | 查看本人相关摘要、告警 | Control Plane 投影 | `view.summary` | 不伪造离线数据 |
| **项目（责任范围）** | 本人有关项目状态 | A | 查看负责项目状态 | Control Plane 投影（已配对设备） | `project.view` | 不替代 Web 项目管理 |
| **工作区（当前上下文）** | 当前工作项处理 | A + B | 查看本人待办、处理分配的工作 | 服务端状态重验、幂等确认 | `workspace.view`, `workspace.confirm` | 需要多条件筛选转 Web |
| **顶部 Scan（审批扫码）** | 受控二维码审批确认 | B | 解析审批二维码、提交确认 | Control Plane 动作解析、服务端重验 | `scan.approval` | 仅限审批确认；登录/配对走独立流程 |
| **个人中心** | 身份、会话、偏好 | B | 账户设置、会话查看、偏好调整 | Identity + Notification | `profile.update` | 组织级设置转 Web |
| **通知** | 个人告警、回执 | A | 查看个人告警、发送回执 | Notification 服务 | `notification.receipt` | 不提供全量通知配置 |

**Mobile 表面设计原则**：
- 4 个常驻导航项（Home / Projects / Workspace / Me）+ 顶部 Scan 动作
- 每个写操作必须呈现：对象、服务端状态、执行人责任、影响说明、确认结果
- 应用启动/提交后重新获取服务端状态
- C 级操作必须交接 Web

### 3. 跨端交接能力

| 场景 | 触发条件 | Correlation ID | 源端动作 | 目标端动作 | 状态机 |
| --- | --- | --- | --- | --- | --- |
| Mobile 无法闭环 → Web | C 级动作、批量、复杂编辑 | `HF-{timestamp}-{uuid}` | 携带对象、状态、筛选上下文 | 打开对象、继续同一流程 | `created → delivered → accepted → completed/failed` |
| Mobile 审批扫码 → 继续处理 | B 级确认后需进一步处理 | `HF-{timestamp}-{uuid}` | 记录扫码结果和上下文 | 读取交接上下文 | 同上 |
| Web 交接 Mobile 处理 | 需要现场确认 | `HF-{timestamp}-{uuid}` | 创建交接任务 | 接收、处理、回执 | 同上 |
| 交接超时/放弃 | 目标端未在 SLA 内处理 | 同上 | 记录超时 | 通知发起方 | `expired` |

**交接数据要素**：
- `handoff_id`: 唯一标识，格式 `HF-{unix_ms}-{short_uuid}`
- `source_surface`: `web` | `mobile`
- `target_surface`: `web` | `mobile`
- `business_object`: 对象类型 + ID
- `context`: 筛选条件、状态快照、动作说明
- `action_level`: B | C
- `created_at`: ISO 时间戳
- `expires_at`: SLA 超时时间（默认 24h）
- `status`: `created` | `delivered` | `accepted` | `completed` | `failed` | `expired`
- `final_action`: 最终执行的动作（若有）

## 动作等级快速参考

| 等级 | 特征 | Web | Mobile | 专业工具 |
| --- | --- | --- | --- | --- |
| A | 观察、提醒 | ✓ | ✓ | 各自上下文 |
| B | 受控单对象执行 | ✓ | 满足政策时 | — |
| C | 管理、治理、批量 | ✓ | 交接 Web | — |
| D | 专业/物理操作 | 受控入口 | 受控入口 | ✓ 实际执行 |

## 可追溯性

- 完整机器检查记录：[`CAPABILITY-INVENTORY.json`](../specs/2026-08-09-multi-surface-admin-positioning/CAPABILITY-INVENTORY.json)
- 能力归属规则：[`CAPABILITY-OWNERSHIP.md`（模板）](../specs/2026-08-09-multi-surface-admin-positioning/CAPABILITY-OWNERSHIP.md)
- 跨端交接协议：[`HANDOFF-PROTOCOL.md`](./HANDOFF-PROTOCOL.md)
- 开发准入检查：`pnpm check:capabilities` / `pnpm check:boundaries`

# 跨端交接协议草案

> 状态：Draft · 更新：2026-08-22
>
> 本协议定义 Mobile ↔ Web 之间的任务交接语义、Correlation ID 格式和状态机。正式版需经产品 Owner、领域 Owner 和两端维护者共同评审。

## 设计目标

1. **上下文不丢失**：交接时携带对象、状态、筛选条件、执行人责任和动作说明
2. **可追溯**：每次交接生成唯一 `handoff correlation id`，贯穿源端、目标端和最终动作
3. **幂等安全**：目标端重新鉴权、重新取数、产生审计事件
4. **SLA 可控**：交接有超时时间，防止悬空任务

## Handoff Correlation ID 格式

### 格式定义

```
HF-{unix_timestamp_ms}-{uuid_v4_short}

示例：HF-1724320000000-a1b2c3d4
```

| 组成部分 | 说明 |
| --- | --- |
| `HF` | 前缀，标识 Handoff Flow |
| `unix_timestamp_ms` | 创建时的 Unix 毫秒时间戳 |
| `uuid_v4_short` | UUID v4 的前 8 位（不含连字符） |

### 生成规则

- 源端（发起交接方）在创建交接时生成
- 必须唯一，服务端负责去重
- 不可预测（使用加密随机 UUID）
- 包含在所有相关审计事件中

### 使用场景

| 场景 | 源端 | 目标端 | 说明 |
| --- | --- | --- | --- |
| Mobile → Web | Mobile | Web | C 级无法闭环、复杂编辑、批量操作 |
| Mobile 扫码 → Web 续办 | Mobile | Web | B 级确认后需进一步处理 |
| Web → Mobile | Web | Mobile | 需要现场确认的任务（预留） |

## 交接数据模型

### HandoffPayload

```typescript
interface HandoffPayload {
  // 唯一标识
  handoff_id: string;           // 格式：HF-{timestamp}-{uuid}

  // 交接元数据
  source_surface: 'web' | 'mobile';
  target_surface: 'web' | 'mobile';
  action_level: 'B' | 'C';
  reason: string;                // 交接原因说明

  // 业务对象
  business_object: {
    type: 'project' | 'workitem' | 'approval' | 'resource';
    id: string;
    name?: string;
  };

  // 上下文
  context: {
    state_snapshot?: object;    // 状态快照
    filters?: object;           // 筛选条件
    action_description?: string; // 动作说明
    impact_description?: string; // 影响说明
  };

  // 责任信息
  assignee?: {
    id: string;
    name: string;
    role: string;
  };

  // 时间
  created_at: string;            // ISO 8601
  expires_at: string;           // ISO 8601，默认 created_at + 24h

  // 状态
  status: HandoffStatus;
}

type HandoffStatus =
  | 'created'      // 已创建，等待投递
  | 'delivered'    // 已投递到目标端
  | 'accepted'     // 目标端已接受处理
  | 'completed'    // 任务完成
  | 'failed'       // 执行失败
  | 'expired';     // 超时未处理
```

### 审计事件字段

```typescript
interface HandoffAuditEvent {
  event: string;                 // e.g., 'handoff.created', 'handoff.continued'
  handoff_id: string;
  source_surface: 'web' | 'mobile';
  target_surface: 'web' | 'mobile';
  actor_id: string;
  business_object: {
    type: string;
    id: string;
  };
  final_action?: string;         // 最终执行的动作（若有）
  result: 'success' | 'failure';
  timestamp: string;             // ISO 8601
}
```

## 交接状态机

```
                    created
                       │
                       ▼
                   delivered
                       │
                       ▼
                   accepted
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
      completed                 failed
           │                       │
           └───────────┬───────────┘
                       ▼
                   (end)

    超时检测：任何非 terminal 状态在 expires_at 后转为 expired
```

### 状态转换规则

| 当前状态 | 事件 | 下一状态 | 触发方 | 条件 |
| --- | --- | --- | --- | --- |
| — | 创建交接 | `created` | 源端 | 用户发起交接 |
| `created` | 目标端打开 | `delivered` | 目标端 | 用户在目标端打开交接任务 |
| `delivered` | 目标端接受处理 | `accepted` | 目标端 | 用户点击"接受并处理" |
| `accepted` | 任务完成 | `completed` | 目标端 | 最终动作成功执行 |
| `accepted` | 执行失败 | `failed` | 目标端 | 最终动作执行失败 |
| 任意非 terminal | 超时检测 | `expired` | 系统 | `now > expires_at` |

### 状态语义

| 状态 | 说明 | 用户可见性 |
| --- | --- | --- |
| `created` | 交接已创建，等待目标端打开 | 源端可见 |
| `delivered` | 目标端已收到通知/入口 | 双方可见 |
| `accepted` | 目标端正在处理 | 双方可见 |
| `completed` | 任务在目标端闭环 | 双方可见，可查询审计 |
| `failed` | 目标端执行失败，可重试或重新交接 | 双方可见 |
| `expired` | 超过 SLA 未处理 | 源端可见，通知发起方 |

## 交接流程

### Mobile → Web 交接流程

```
1. Mobile 用户遇到 C 级操作
   ↓
2. Mobile 展示交接原因和影响说明
   ↓
3. 用户点击"在 Web 继续"
   ↓
4. Mobile 创建 HandoffPayload（状态：created）
   ↓
5. Mobile 展示 Web 链接或深链接
   ↓
6. Web 打开交接页面，读取 handoff_id
   ↓
7. Web 验证会话、加载业务对象和上下文
   ↓
8. 状态更新为 delivered → accepted
   ↓
9. 用户在 Web 完成操作
   ↓
10. 状态更新为 completed
    ↓
11. 审计事件写入（包含 final_action）
```

### 关键约束

1. **数据新鲜度**：目标端加载时必须重新从服务端获取最新状态，不能使用交接快照代替
2. **鉴权不可跳过**：目标端必须重新验证用户权限
3. **幂等处理**：若交接已处理（completed/failed），再次打开应展示结果而非重复执行
4. **SLA 监控**：后台任务定期检测过期交接，发送通知

## 技术实现要点

### 服务端要求

- 交接数据存储在 Control Plane 或独立服务
- 交接记录保留 90 天（可配置）
- 提供查询接口：`GET /handoffs?actor={user_id}&status={status}`
- 提供状态更新接口：`PATCH /handoffs/{handoff_id}`

### 客户端要求

- Mobile 交接入口在 C 级操作场景明确展示
- Web `/handoff/:id` 页面必须登录后访问
- 两端都应展示交接状态和历史

### 深链接（预留）

```
axi-workbench://handoff/{handoff_id}
```

> 注意：P3 建设受认证保护的产品内交接入口，不要求操作系统级深链接。

## 开放问题

| 问题 | 状态 | 负责人 | 解决计划 |
| --- | --- | --- | --- |
| 交接超时 SLA 默认值 | Open | 产品 | 需确定不同场景的 SLA（P0 待定） |
| 交接拒绝场景 | Open | 产品 | 用户拒绝处理时的状态流转 |
| Web → Mobile 交接 | Reserved | 产品 | 当前聚焦 Mobile → Web，P3 再考虑反向 |
| 批量交接 | Open | 产品 | 多对象交接的打包语义 |

## 文档关系

- 能力台账：[`CAPABILITY-OWNERSHIP.md`](./CAPABILITY-OWNERSHIP.md)
- 能力完整记录：[`CAPABILITY-INVENTORY.json`](../specs/2026-08-09-multi-surface-admin-positioning/CAPABILITY-INVENTORY.json)
- PRD：[`PRD.md`](./PRD.md)
- TDD：[`TDD.md`](./TDD.md)

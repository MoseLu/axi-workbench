# Personal OS API

> 状态：当前基线 · 2026-09-25
>
> `services/control-plane/src/personal-os.mjs`。
>
> Base path：`/api/v1/personal-os/*`。
>
> 鉴权：session + tenant。Personal OS 只服务于登录主体个人；任何 tenant scope 自动等于当前主体所属租户。

---

## 1. 工作队列

### `GET /api/v1/personal-os/queue`

读取登录主体的工作队列（合并 Attention、待办任务、待审批）。

- **查询参数**：
  - `priority?: 'high' \| 'normal' \| 'low'`
  - `kind?: 'task' \| 'approval' \| 'handoff' \| 'note'`
  - `limit?: number (default 50, max 200)`
  - `afterEntryId?: string`（增量游标）
- **响应**：

```json
{
  "data": [
    {
      "entryId": "qe_xxx",
      "kind": "task",
      "priority": "high",
      "subject": "待审批交接：sample-app",
      "link": { "path": "/admin/handoff/handoff_xxx", "params": {} },
      "actorRef": "user_sub_yyy",
      "createdAt": "2026-09-25T00:00:00.000Z",
      "sla": { "expiresAt": "2026-09-26T00:00:00.000Z" }
    }
  ]
}
```

- **错误码**：`401` / `503`（控制面未启动）
- **Web 调用**：`usePersonalOsQueue()` (`packages/api-client/src/hooks/index.ts`)

---

## 2. Focus（专注态）

### `GET /api/v1/personal-os/focus`

读取当前主体的专注态配置（最大并发任务数、免打扰窗口、通知策略）。

- **响应**：

```json
{
  "data": {
    "maxConcurrentTasks": 3,
    "doNotDisturb": {
      "enabled": false,
      "windowStart": "22:00",
      "windowEnd": "08:00",
      "timezone": "Asia/Shanghai"
    },
    "notificationStrategy": "aggregated",
    "updatedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

### `PUT /api/v1/personal-os/focus`

更新专注态。

- **请求 body**：与 `GET` 响应同结构（任一字段可选）
- **响应** `200`：与 `GET` 响应同
- **错误码**：
  - `400`：`windowStart/windowEnd` 格式错（HH:mm）
  - `422`：`doNotDisturb` 时间窗为负

- **Web 调用**：`usePersonalOsFocus()` / `useUpdatePersonalOsFocus()`

---

## 3. 受管项目（个人视角）

### `GET /api/v1/personal-os/projects/:id`

读取当前主体对某个项目的个人视角（不是项目详情 — 不含审计 / 治理，仅含参与角色、最后活动、个人贡献统计）。

- **路径参数**：`id`
- **响应**：

```json
{
  "data": {
    "projectId": "axi-workbench",
    "subject": "user_sub_xxx",
    "role": "owner" | "maintainer" | "contributor" | "viewer",
    "lastActiveAt": "2026-09-25T00:00:00.000Z",
    "stats": {
      "commitsThisWeek": 7,
      "openTasks": 3,
      "pendingApprovals": 1
    }
  }
}
```

- **错误码**：`404` / `403`（当前主体未参与此项目）

### `PATCH /api/v1/personal-os/projects/:id`

更新主体对项目的角色（owner 权限）。

- **请求 body**：

```json
{
  "role": "owner" | "maintainer" | "contributor" | "viewer"
}
```

- **响应** `200`：与 `GET` 响应同
- **错误码**：
  - `403`：调用者不是 owner
  - `409`：降级到 viewer 时仍有 owner 占用

- **Web 调用**：`useUpdatePersonalOsProject()`

---

## 4. 与 Mobile 的关系

Personal OS 数据是 Mobile `HandoffPage` / `IncomingHandoffs` 的数据源；Mobile 直接消费同一组 endpoint，不需要单独的同步层。详见 [`mobile.md`](./mobile.md) §"Workspace"。
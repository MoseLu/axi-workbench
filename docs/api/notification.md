# Notification API

> 状态：当前基线 · 2026-09-25
>
> `services/notification-service/main.go`（Go + Kafka delivery worker）。
>
> Base path：`/api/v1/notifications/*`。
>
> 鉴权：session + tenant + RBAC。

---

## 1. 列表与计数

### `GET /api/v1/notifications`

列出当前主体在当前 tenant 的通知。

- **查询参数**：
  - `kind?: 'task' | 'approval' | 'handoff' | 'system' | 'policy'`
  - `read?: boolean`
  - `limit?: number (default 50, max 200)`
  - `afterNotificationId?: string`（增量游标）
- **响应**：

```json
{
  "data": [
    {
      "id": "nt_xxx",
      "kind": "approval",
      "subject": "待审批：发布到生产",
      "body": "...",
      "link": { "path": "/admin/approvals/apr_xxx", "params": {} },
      "priority": "high",
      "read": false,
      "occurredAt": "2026-09-25T00:00:00.000Z"
    }
  ]
}
```

- **Web 调用**：`useNotifications()` (`packages/workbench-foundation/src/notifications.ts`)

### `GET /api/v1/notifications/nav-badges`

读侧栏角标（每个路由段对应一个未读计数）。Web `MainLayout.tsx` 用。

- **响应**：

```json
{
  "data": {
    "unreadTotal": 7,
    "byRoute": {
      "/admin/me/notifications": 3,
      "/admin/handoff": 2,
      "/admin/dashboard": 2
    }
  }
}
```

- **Web 调用**：`apps/workbench/src/lib/navBadges.ts`

---

## 2. 标记已读

### `PUT /api/v1/notifications/:id/read`

标记单条已读。

- **路径参数**：`id`
- **响应** `204`
- **错误码**：`404` / `403`

### `PUT /api/v1/notifications/read-all`

标记当前主体所有未读为已读。

- **响应** `200`：

```json
{ "data": { "updatedCount": 7 } }
```

### `POST /api/v1/notifications/read-receipts`

批量提交已读回执（用于移动端同步）。

- **请求 body**：

```json
{ "notificationIds": ["nt_xxx", "nt_yyy"] }
```

- **响应** `200`：

```json
{ "data": { "updatedCount": 2 } }
```

---

## 3. 修改 / 删除

### `PATCH /api/v1/notifications/:id`

修改一条通知（kind 不可改；body / link / priority 可改）。

- **请求 body**：

```json
{
  "body"?: "string",
  "link"?: { "path": "...", "params": {} },
  "priority"?: "low" | "normal" | "high" | "critical"
}
```

- **响应** `200`：与 GET 单项响应同

### `DELETE /api/v1/notifications/:id`

删除通知。

- **响应** `204`
- **错误码**：`403`（非本人 / 非 owner）

---

## 4. 投递（内部）

### `POST /api/v1/notifications/internal/events`

Kafka consumer 端点。接受来自上游（control-plane / platform-core）的 notification 事件，落库后推到 WebSocket / mobile push 通道。

- **鉴权**：`X-Axi-Internal-Token`（仅 Gateway → notification-service）
- **请求 body**：Kafka envelope（subject、tenantId、kind、payload）

---

## 5. Web 接入

- `apps/workbench/src/pages/admin/me/Notifications.tsx` 用 `useNotifications()` + `markAllNotificationsRead` + `markNotificationRead`（`@axi/workbench-foundation`）。
- `apps/workbench/src/components/Layout/SystemSettingsPanel.tsx` 暴露通知偏好（muted 字段）。
- Mobile 见 [`mobile.md`](./mobile.md) §"Notifications"。
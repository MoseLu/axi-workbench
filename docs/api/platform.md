# Platform Core API

> 状态：当前基线 · 2026-09-25
>
> `services/platform-core/internal/httpapi/api.go`（Go + Gin）。
>
> Base path：`/api/v1/tenants/*`、`/api/v1/me/preferences`、`/api/v1/users/me`、`/api/v1/users/me/profile`。
>
> 鉴权：所有 endpoint 接受 Gateway 注入的 `X-Axi-Internal-Token` + `X-Axi-Subject`；tenant 隔离通过 `X-Axi-Tenant` 头；RBAC 在 handler 内调用 policy kernel。

---

## 1. Tenant 管理

### `GET /api/v1/tenants`

列出当前主体可见的 tenant（含 owner / admin 视角色）。

- **响应**：

```json
{
  "data": {
    "items": [
      {
        "id": "tenant_xxx",
        "name": "Axi Workbench",
        "slug": "axi-workbench",
        "createdAt": "2026-09-25T00:00:00.000Z"
      }
    ]
  }
}
```

- **Web 调用**：`useTenants()` (`packages/api-client/src/hooks/platform.ts`) — `RoleList.tsx` 用

### `POST /api/v1/tenants`

创建一个新 tenant（subject 自动成为 owner）。

- **请求 body**：

```json
{ "name": "string (required, max 64)", "slug": "string (required, [a-z0-9-]+)" }
```

- **响应** `201`：

```json
{ "data": { "id": "tenant_xxx", "name": "...", "slug": "...", "createdAt": "..." } }
```

- **错误码**：
  - `400`：name / slug 格式错
  - `409`：slug 已存在
  - `422`：slug 黑名单 / 保留词

- **Web 调用**：`useCreateTenant()`

---

## 2. 成员与 RBAC

### `GET /api/v1/tenants/:tenantID/members`

列出 tenant 内成员 + 角色。

- **路径参数**：`tenantID`
- **响应**：

```json
{
  "data": {
    "items": [
      {
        "tenantId": "tenant_xxx",
        "subject": "alice@example.com",
        "role": "owner" | "admin" | "editor" | "viewer",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

- **错误码**：`403`（当前主体不是 tenant 成员）/ `404`
- **Web 调用**：`useTenantMembers()`

### `PUT /api/v1/tenants/:tenantID/members/:memberSubject`

新增或覆盖成员角色。

- **路径参数**：`tenantID`、`memberSubject`
- **请求 body**：

```json
{ "role": "owner" | "admin" | "editor" | "viewer" }
```

- **响应** `200`：与 GET 单项响应同
- **错误码**：
  - `403`：调用者不是 owner
  - `409`：尝试将最后一个 owner 降级
  - `422`：role 非法

- **Web 调用**：`useSaveTenantMember()` — `RoleList.tsx` 用

---

## 3. 个人偏好

### `GET /api/v1/me/preferences`

读取当前主体的偏好（主题、语言、时区、通知免打扰）。

- **响应**：

```json
{
  "data": {
    "subject": "user_sub_xxx",
    "locale": "zh-CN" | "en-US",
    "theme": "light" | "dark" | "system",
    "timezone": "Asia/Shanghai",
    "notificationsMuted": false,
    "updatedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **Web 调用**：`usePreferences()` — `DesktopSettingsPage.tsx` / `SystemSettingsPanel` 用

### `PATCH /api/v1/me/preferences`

局部更新偏好。

- **请求 body**：

```json
{
  "locale"?: "zh-CN" | "en-US",
  "theme"?: "light" | "dark" | "system",
  "timezone"?: "IANA tz",
  "notificationsMuted"?: boolean
}
```

- **响应** `200`：与 GET 响应同
- **错误码**：
  - `400`：locale / timezone 格式错
  - `422`：timezone 未知

- **Web 调用**：`useSavePreferences()`

---

## 4. 字典

### `GET /api/v1/tenants/:tenantID/dictionaries/:key`

读取 tenant 级共享字典（key-value 配置）。

- **路径参数**：`tenantID`、`key`
- **响应**：

```json
{
  "data": {
    "tenantId": "tenant_xxx",
    "key": "axi.ui.tokens",
    "version": 7,
    "entries": { ... arbitrary JSON ... },
    "updatedAt": "..."
  }
}
```

- **错误码**：`404`（key 不存在）/ `403`（主体无字典读权限）

### `PUT /api/v1/tenants/:tenantID/dictionaries/:key`

整体替换字典内容。

- **请求 body**：

```json
{ "entries": { ... } }
```

- **响应** `200`：与 GET 响应同（version 自动 +1）
- **错误码**：
  - `403`：主体无字典写权限
  - `409`：版本号低于 base version（乐观锁）

---

## 5. 项目 / 任务（C 级管理）

### `GET /api/v1/tenants/:tenantID/projects`

列出 tenant 内受管项目。

- **查询参数**：`archived?: boolean`、`limit`
- **响应**：

```json
{
  "data": {
    "items": [
      {
        "id": "proj_xxx",
        "tenantId": "tenant_xxx",
        "name": "...",
        "description": "...",
        "createdBy": "user_sub_xxx",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

- **Web 调用**：`platformApi.listProjects()`

### `POST /api/v1/tenants/:tenantID/projects`

创建项目。

- **请求 body**：`{ name, description }`
- **响应** `201`
- **错误码**：`403`（非 owner/admin）/ `409`（同名项目）

- **Web 调用**：`platformApi.createProject()`

### `GET /api/v1/tenants/:tenantID/tasks`

列出 tenant 内任务。

### `POST /api/v1/tenants/:tenantID/tasks`

创建任务。

- **请求 body**：

```json
{
  "projectId": "proj_xxx",
  "title": "string",
  "status": "open" | "in_progress" | "blocked" | "done" | "cancelled"
}
```

- **响应** `201`
- **错误码**：`404`（projectId 不存在）/ `422`（status 非法）

- **Web 调用**：`platformApi.createTask()` / `platformApi.listTasks()`

---

## 6. Audit（Web `Dashboard` 治理态势聚合使用）

所有写操作（tenants / members / preferences / dictionaries / projects / tasks）都会发出 audit 记录：

```json
{
  "auditId": "aud_xxx",
  "tenantId": "tenant_xxx",
  "subject": "user_sub_xxx",
  "action": "tenant.member.update",
  "resourceRef": "tenant_xxx/members/alice@example.com",
  "before": { "role": "editor" },
  "after": { "role": "admin" },
  "occurredAt": "...",
  "correlationId": "..."
}
```

Audit 由 `services/platform-core/internal/audit/` 持久化；**Web 暂不暴露浏览 UI**，只能通过 `services/observability` 的 events 流看到摘要。
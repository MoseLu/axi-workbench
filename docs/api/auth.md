# Auth / Session API

> 状态：当前基线 · 2026-09-25
>
> `services/identity-adapter`（OIDC + Email + QR + ZITADEL）+ `services/api-gateway/handlers/` 的 session 处理。
>
> Base path：`/api/v1/auth/*`、`/api/v1/sessions/*`、`/api/v1/users/me/*`。
>
> 鉴权：本组 endpoint 的作用就是建立 / 维护 session；不需要 session cookie，但**必须**带 `credentials: 'include'` 以接收和发送 `axi.session` cookie。

---

## 1. Session 生命周期

### `GET /api/v1/auth/session`

读取当前 session 的有效性 + 用户身份。Web 启动时调用一次，确认是否已登录。

- **响应** `200`：

```json
{
  "data": {
    "authenticated": true,
    "subject": "user_sub_xxx",
    "tenantId": "tenant_xxx",
    "roles": ["admin"],
    "expiresAt": "2026-09-26T00:00:00.000Z"
  }
}
```

- **响应** `401`：未登录

### `POST /api/v1/sessions`

建立新 session（OIDC callback 完成后由 Gateway 触发）。

- **请求 body**：

```json
{
  "subject": "user_sub_xxx",
  "tenantId": "tenant_xxx",
  "idToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600
}
```

- **响应** `201`：

```json
{
  "data": {
    "subject": "user_sub_xxx",
    "expiresAt": "2026-09-26T00:00:00.000Z"
  }
}
```

- **Set-Cookie**：`axi.session=<opaque>; HttpOnly; Secure; SameSite=Lax; Path=/`
- **错误码**：
  - `400`：idToken 校验失败
  - `403`：subject 与 tenant 不匹配
  - `429`：登录频次超过 OIDC IdP 限制

### `POST /api/v1/auth/logout`

注销当前 session。Gateway 删除 cookie + 通知 IdP 注销（OIDC RP-Initiated Logout）。

- **响应** `204`
- **错误码**：`401`（已无 session）

### `GET /api/v1/sessions/current`

读取当前 session（与 `/auth/session` 同义；保留以兼容 Mobile API）。

### `DELETE /api/v1/sessions/current`

强制注销当前 session（设备主动撤销）。

### `GET /api/v1/sessions/resume`

会话续期。Web 在 session 即将过期时（≤ 5 min）调用，浏览器自动拿新 cookie。

- **查询参数**：`subject: string`
- **响应** `200`：

```json
{
  "data": { "expiresAt": "2026-09-26T12:00:00.000Z" }
}
```

- **错误码**：`401`（refresh token 已过期）/ `403`（subject mismatch）

### `POST /api/v1/sessions/email`

通过邮箱一次性码建立 session（适用于 Magic Link）。

- **请求 body**：

```json
{ "email": "alice@example.com", "code": "123456" }
```

- **响应** `201`：与 `POST /sessions` 同
- **错误码**：
  - `400`：邮箱格式 / code 格式错
  - `401`：code 已过期或失效
  - `429`：60 秒内重试超过 3 次

---

## 2. OIDC 流程

### `GET /api/v1/auth/oidc/start`

发起 OIDC 登录跳转。Gateway 生成 state + nonce，302 重定向到 Axi Identity。

- **查询参数**：`redirect_uri: string`、`state?: string`
- **响应** `302`

### `GET /api/v1/auth/oidc/callback`

OIDC IdP 回调。校验 state、交换 code、写入 session。

- **查询参数**：`code: string`、`state: string`
- **响应** `302` 重定向到 Web 主页 `/admin/dashboard`
- **错误码**：
  - `400`：state 不匹配 / code 校验失败
  - `403`：subject 不属于任何 tenant

### `GET /api/v1/auth/methods`

列出当前主体可用的登录方式（OIDC、Email、QR 等）。

- **响应** `200`：

```json
{
  "data": {
    "methods": [
      { "id": "oidc", "label": "ZITADEL OIDC", "enabled": true },
      { "id": "email", "label": "邮箱一次性码", "enabled": true },
      { "id": "qr", "label": "扫码登录（Web owner QR）", "enabled": true }
    ]
  }
}
```

---

## 3. 邮箱验证

### `POST /api/v1/auth/email-verifications`

请求发送一次性码（注册 / 登录 / 设备绑定共用）。

- **请求 body**：

```json
{ "email": "alice@example.com", "purpose": "login" | "register" | "bind_device" }
```

- **响应** `202`
- **错误码**：
  - `400`：邮箱格式错 / purpose 非法
  - `429`：60 秒内只能发 1 次；1 小时内最多 10 次

### `POST /api/v1/auth/login/email/confirm`

提交一次性码 + 邮箱完成登录。

- **请求 body**：

```json
{ "email": "alice@example.com", "code": "123456" }
```

- **响应** `200`：写入 session cookie，跳转到 Web 主页
- **错误码**：
  - `401`：code 错 / 过期 / 已用
  - `403`：邮箱已被其他 tenant 占用
  - `422`：邮箱黑名单

### `POST /api/v1/auth/email-verifications/:id/redemptions`

Mobile 端补录 code 兑换（兼容路径）。

---

## 4. 扫码登录（Web owner QR）

### `POST /api/v1/auth/device-login/qr`

Web 端发起：服务端生成一对 `webLogin_<id>`（短 id）和 `webLoginSecret_<secret>`，返回 QR payload（包含 `gatewayUrl + id`，不含 secret）。

- **请求 body**（可选）：

```json
{ "subjectHint": "user_sub_xxx" }
```

- **响应** `201`：

```json
{
  "data": {
    "id": "webLogin_abc123",
    "gatewayUrl": "https://api.axiomaticworld.com",
    "expiresAt": "2026-09-25T00:10:00.000Z"
  }
}
```

- **错误码**：`429`（当前主体 5 分钟内最多生成 3 个 QR）

### `GET /api/v1/auth/device-login/qr/:id`

Web 轮询扫码结果。Mobile 端 `POST /consume` 后这里返回 `200` + session payload。

- **响应**：
  - `200`：`{ data: { status: "consumed", subject, tenantId, roles, expiresAt } }`
  - `202`：`{ data: { status: "pending" } }`（Mobile 还未扫）
  - `410`：`{ data: { status: "expired" } }`

### `POST /api/v1/auth/device-login/qr/:id/consume`

Mobile 调用：把上一步拿到的 secret 一并提交；服务端校验成功后触发 session 建立。

- **请求 body**：

```json
{
  "secret": "webLoginSecret_xxx",
  "subject": "user_sub_xxx",
  "tenantId": "tenant_xxx"
}
```

- **响应** `204`
- **错误码**：
  - `401`：secret 错
  - `403`：subject 未授权（与 IdP 主体不匹配）
  - `410`：QR 已过期

### `POST /api/v1/internal/zitadel/qr/transactions/:id/complete`

ZITADEL webhook 回调（完成 QR 登录事务）。仅供 IdP 调用，不暴露给浏览器。

---

## 5. 用户资料

### `GET /api/v1/users/me`

读取当前主体的用户元数据。

- **响应** `200`：

```json
{
  "data": {
    "subject": "user_sub_xxx",
    "tenantId": "tenant_xxx",
    "displayName": "Alice",
    "email": "alice@example.com",
    "roles": ["admin"],
    "locale": "zh-CN"
  }
}
```

### `GET /api/v1/users/me/profile`

读取用户公开 profile（头像、昵称、个性签名等可编辑字段）。

- **响应** `200`：

```json
{
  "data": {
    "subject": "user_sub_xxx",
    "nickname": "Alice",
    "avatarUrl": "...",
    "bio": "...",
    "updatedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **Web 调用**：被 `apps/workbench/src/pages/admin/me/profileStore.ts` 包装，详见 `personal-os.md` §"我的"。

---

## 6. 移动端

详见 [`mobile.md`](./mobile.md) §"Auth"。
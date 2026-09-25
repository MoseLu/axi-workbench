# Mobile API（apps/workbench-mobile 调用的接口）

> 状态：当前基线 · 2026-09-25
>
> Mobile 端 (`apps/workbench-mobile/`) 走的是同一套 Gateway，但 base path 显式区分 `/api/v1/mobile/*`，便于后续 edge-gateway 做差异化限流（移动端流量更大、密钥生命周期更短）。
>
> 鉴权：Mobile session 走 `X-Axi-Device-Id` + `X-Axi-Internal-Token`；owner 操作仍需 `X-Axi-Subject`（来自 Pair 阶段的 owner binding）。
>
> 与 Web 共用的 endpoint（snapshot / handoff / events / commit-ledger 等）已在 [`control-plane.md`](./control-plane.md) / [`handoff.md`](./handoff.md) / [`commit-ledger.md`](./commit-ledger.md) 中记录；本节只列**Mobile 独有**或**Mobile 与 Web 语义不同**的 endpoint。

---

## 1. Pairing（设备配对）

### `POST /api/v1/mobile/pair/start`

Mobile 启动配对流程，提交设备指纹 + 短 token（Web QR 里的 `scanToken`）。

- **请求 body**：

```json
{
  "scanToken": "string (QR 内容)",
  "deviceId": "string",
  "deviceFingerprint": {
    "platform": "android" | "ios",
    "model": "string",
    "osVersion": "string",
    "appVersion": "string"
  }
}
```

- **响应** `201`：

```json
{
  "data": {
    "pairId": "pair_xxx",
    "status": "awaiting_owner_approval",
    "expiresAt": "..."
  }
}
```

- **错误码**：
  - `400`：scanToken 格式错
  - `410`：scanToken 已过期（> 2 min）

### `POST /api/v1/mobile/pair/qr/scan`

Mobile 扫到新的 owner QR 后投递扫描结果（与 web-login 不同：这是 device pairing 不是 web-login）。

- **请求 body**：`{ qrToken, deviceId, capturedAt }`
- **响应** `201`：`{ data: { pairId, status: "awaiting_owner_approval" } }`

### `GET /api/v1/mobile/pair/status`

轮询当前 device 的配对状态。

- **响应**：
  - `200`：`{ data: { status: "approved", ownerSubject, expiresAt, ... } }`
  - `202`：`{ data: { status: "awaiting_owner_approval" } }`

### `POST /api/v1/mobile/pair/confirm`

owner 在 Web 端批准后，Mobile 通过此 endpoint 拿到长生命周期的 device session。

- **请求 body**：`{ pairId }`
- **响应** `200`：

```json
{
  "data": {
    "deviceToken": "Bearer <opaque>",
    "ownerSubject": "user_sub_xxx",
    "tenantId": "tenant_xxx",
    "expiresAt": "..."
  }
}
```

### `POST /api/v1/mobile/pair/revoke`

撤销当前设备的配对（owner 或 self 主动撤销）。

- **响应** `204`
- **错误码**：`403`（非 owner / 非 self）

---

## 2. Auth（device session）

### `POST /api/v1/mobile/auth/token`

把 deviceToken 换成短期 access token（与 OIDC 类似，但 scoped 到 mobile session）。

- **请求 body**：`{ deviceToken }`
- **响应** `200`：`{ data: { accessToken, expiresIn: 3600 } }`

### `POST /api/v1/mobile/auth/nonce`

请求 nonce 用于下一次请求签名（防重放）。

- **响应** `200`：`{ data: { nonce, expiresAt } }`

---

## 3. Workspace

### `GET /api/v1/mobile/workspace`

读 Mobile Workspace 首页数据（合并 Personal OS queue + 当前主体项目 + 未读通知计数）。

- **响应** `200`：

```json
{
  "data": {
    "queue": [ ...Personal OS queue items... ],
    "projects": [
      { "projectId": "...", "role": "owner", "lastActiveAt": "..." }
    ],
    "unreadNotifications": 3
  }
}
```

### `GET /api/v1/mobile/workspace/projects/:id`

读项目 Mobile 视图（精简版，没有 governance / audit / full commands）。

- **响应** `200`
- **错误码**：`404` / `403`

---

## 4. Handoff

### `GET /api/v1/mobile/handoffs`

列出当前设备的 incoming handoff（同 [`handoff.md`](./handoff.md) §2，**但 targetSurface = mobile**）。

### `POST /api/v1/mobile/handoffs/:id/accept`

Mobile 接受 handoff。

### `POST /api/v1/mobile/handoffs/:id/complete`

Mobile 完成 handoff 终态（语义与 Web `POST /api/v1/handoffs/:id` 同，但 `targetSurface` 校验为 `mobile`）。

### `POST /api/v1/mobile/handoffs/:id/reject`

Mobile 拒绝 handoff（必填 `reason`）。

---

## 5. Jobs

### `GET /api/v1/mobile/jobs`

读当前设备的 jobs（assigned to me）。

### `GET /api/v1/mobile/jobs/:id`

读单条 job。

### `POST /api/v1/mobile/jobs/:id/cancel`

取消自己的 job。

---

## 6. Approvals

### `GET /api/v1/mobile/approvals`

读当前主体的待审批（assigned to me）。

### `POST /api/v1/mobile/approvals/:id/decision`

Mobile 端直接审批（语义与 [`control-plane.md`](./control-plane.md) §5 同）。

---

## 7. 与 Web API 的对照

| 用途 | Web | Mobile |
|------|-----|--------|
| 登录 | `/api/v1/auth/oidc/*` + `/api/v1/auth/email-verifications` | `/api/v1/mobile/pair/*` + `/api/v1/mobile/auth/token` |
| Session | `axi.session` cookie（HttpOnly） | `X-Axi-Device-Token` header |
| Handoff | `/api/v1/handoffs/*` | `/api/v1/mobile/handoffs/*`（targetSurface=mobile） |
| Workspace | `/api/v1/personal-os/*` | `/api/v1/mobile/workspace`（精简聚合） |
| 控制面查询 | `/api/v1/control-plane/query` + `/api/v1/control-plane/commands/:id/run` | Mobile 不直接调，**全部走 handoff/job/approval 流程** |
| Commit Ledger | `/api/v1/commit-ledger/*` | 不调（Mobile 不展示 commit 列表） |
| File | `/api/v1/files/upload` + presigned | 同（头像 / 附件共用 file-service） |

---

## 8. 与 PRD §6 动作等级矩阵的对齐

- Mobile 端**不允许**触发 C 级动作（PRD §6:214）；所有 C 级 handoff 在 `web → mobile` 方向必须由 policy kernel 拒绝，error code `403` + reason "C-level handoff disallowed for web→mobile"。
- B 级允许；A 级 / D 级允许但要求 `reason`。
- Mobile 端用户可以"拒绝"任意 handoff（写 `rejected` 终态），与 Web 端的 reject 语义一致。
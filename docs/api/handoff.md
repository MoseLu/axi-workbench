# Handoff API（跨端续办）

> 状态：当前基线 · 2026-09-25
>
> `services/control-plane/src/control-plane.mjs` 的 `createWebToMobileHandoff` / `createBatchHandoff` / `createApprovalScan` 系列 + `services/communication-gateway` 的 delivery 通道。
>
> Base path：`/api/v1/handoffs/*`（也保留 `/api/v1/internal/web/v1/handoffs/*` 兼容路径）。
>
> 鉴权：session + tenant + RBAC。**Web↔Mobile handoff 的动作等级 A/B/C/D 由 PRD §6 强约束**：
> - C 级（管理 / 治理）不允许 `web → mobile`
> - B 级允许
> - A 级（观察）和 D 级（专业）允许但需要附加 reason

---

## 1. 创建 handoff

### `POST /api/v1/handoffs`

Web 发起一条跨端续办。Web 端 `HandoffCreate.tsx`（`/admin/handoff/:id`）调用。

- **请求 body**：

```json
{
  "direction": "web" | "mobile",
  "targetSurface": "web" | "mobile",
  "actionLevel": "A" | "B" | "C" | "D",
  "object": {
    "type": "workitem" | "project" | "task" | "approval" | "handoff",
    "id": "string"
  },
  "context": {
    "reason": "string (max 500)",
    "correlationId": "string (optional)"
  },
  "idempotencyKey": "string (UUID v4)"
}
```

- **响应** `201`：

```json
{
  "data": {
    "id": "handoff_2026-09-25T00-00-00-abc123",
    "direction": "web",
    "targetSurface": "mobile",
    "actionLevel": "B",
    "object": { "type": "workitem", "id": "..." },
    "handoffCorrelationId": "handoff:...",
    "status": "pending",
    "createdAt": "2026-09-25T00:00:00.000Z",
    "expiresAt": "2026-09-26T00:00:00.000Z"
  }
}
```

- **错误码**：
  - `400`：字段缺失 / 格式错
  - `403`：动作等级与方向冲突（C 级 web→mobile）/ 主体无权限
  - `409`：同 `idempotencyKey` 已存在但 payload 不同
  - `422`：`reason` 缺失或仅空白
  - `503`：delivery channel（IM gateway）不可用

- **Web 调用**：`useCreateHandoff()` (`packages/api-client/src/hooks/handoff.ts`)

### `POST /api/v1/handoffs/batch`

批量创建（最多 50 条）。

- **请求 body**：

```json
{
  "items": [
    { "direction": "web", "targetSurface": "mobile", "actionLevel": "B", "object": { ... }, "context": { ... } }
  ],
  "idempotencyKey": "string"
}
```

- **响应** `201`：

```json
{
  "data": {
    "batchId": "batch_xxx",
    "items": [ ... 同 POST /handoffs 响应 ... ]
  }
}
```

- **错误码**：与单条相同；任一 item 校验失败整个 batch 失败。

---

## 2. 读取 handoff

### `GET /api/v1/handoffs/:id`

读取单条 handoff。Web `Handoff.tsx` `/admin/handoff/:id` 调用。

- **路径参数**：`id`
- **响应**：

```json
{
  "data": {
    "id": "...",
    "handoffCorrelationId": "...",
    "sourceSurface": "mobile",
    "targetSurface": "web",
    "status": "pending" | "opened" | "completed" | "failed" | "rejected" | "expired",
    "approvalId": "approval_xxx" | null,
    "sourceActorRef": "user_sub_xxx",
    "object": {
      "projectId": "axi-workbench" | null,
      "actionId": "..." | null,
      "actionType": "..." | null
    },
    "impact": "string",
    "riskLevel": "low" | "medium" | "high" | "critical",
    "createdAt": "...",
    "expiresAt": "...",
    "openedAt": "...",
    "openedBy": "...",
    "rejectedAt": "...",
    "rejectedBy": "...",
    "rejectionReason": "...",
    "finalAction": {
      "outcome": "completed_in_web_control_center" | "completed_in_mobile" | "rejected" | "expired",
      "performedBy": "...",
      "occurredAt": "..."
    }
  }
}
```

- **错误码**：`404`（id 错位 / 跨 tenant）/ `403`
- **Web 调用**：`useHandoff()`

### `GET /api/v1/handoffs`

列出当前主体的 handoff 历史（按时间倒序）。Web `Handoff.tsx` `/admin/handoff` 调用。

- **查询参数**：
  - `status?: 'pending' | 'opened' | 'completed' | 'failed' | 'rejected' | 'expired'`
  - `source?: 'web' | 'mobile'`
  - `target?: 'web' | 'mobile'`
  - `limit?: number (default 50, max 200)`
  - `afterCreatedAt?: string (ISO)`
- **响应**：

```json
{
  "data": { "handoffs": [ ... 与 GET /:id 响应数组 ... ] }
}
```

- **Web 调用**：`useHandoffs()`

---

## 3. 接受 / 完成 / 拒绝

### `POST /api/v1/handoffs/:id/accept`

Mobile 端接收：把状态从 `pending` → `opened`。

- **路径参数**：`id`
- **请求 body**：无
- **响应** `200`：与 `GET /:id` 响应同
- **错误码**：
  - `409`：状态不是 `pending`（已 opened / 已 final）
  - `410`：已过期

- **Web 调用**：`useAcceptHandoff()`

### `POST /api/v1/handoffs/:id`

Web 端最终动作：标记完成或拒绝（单 endpoint 多语义）。

- **路径参数**：`id`
- **请求 body**：

```json
{
  "action": "complete" | "reject",
  "outcome": "completed_in_web_control_center" | "rejected"（action=complete 时必填）,
  "reason": "string（action=reject 时必填，max 500）"
}
```

- **响应** `200`：与 `GET /:id` 响应同（包含 `finalAction`）
- **错误码**：
  - `403`：调用者不是 `targetSurface` 的主体
  - `409`：已 `completed` / `rejected` / `expired`
  - `422`：`action=reject` 但 `reason` 缺失

- **Web 调用**：`useRejectHandoff()`；Web `Handoff.tsx` 也直接 `fetch` 调（不通过 hook）

### `POST /api/v1/handoffs/:id/fail`

由源端发起：标记本方未能完成（如 Web 端发现资源消失、配置过期）。

- **请求 body**：

```json
{ "reason": "string (min 5, max 500)" }
```

- **响应** `200`

---

## 4. 审批扫描（Mobile Scan 流程）

### `POST /api/v1/mobile/approval-scans`

Mobile 扫到一条 owner QR 后投递扫描结果。

- **请求 body**：

```json
{
  "qrToken": "string（QR 内容里的 token）",
  "scanContext": {
    "deviceId": "string",
    "capturedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **响应** `201`：

```json
{
  "data": {
    "scanId": "scan_xxx",
    "status": "awaiting_owner_approval"
  }
}
```

### `GET /api/v1/mobile/approval-scans/:id`

Mobile 轮询 owner 审批结果。

- **响应**：
  - `200`：`{ data: { scanId, status: "approved" | "rejected" | "expired", approvedBy?, decidedAt? } }`
  - `202`：`{ data: { status: "awaiting_owner_approval" } }`

### `POST /api/v1/mobile/approval-scans/:id/approve`

Web owner 批准。Mobile 端能继续后续动作。

### `POST /api/v1/mobile/approval-scans/:id/reject`

Web owner 拒绝。Mobile 端收到 `200` + status=rejected。

---

## 5. SLA 与过期

- 默认 24h（环境变量 `AXI_HANDOFF_EXPIRY_MS` 覆盖，毫秒）。
- 过期由 `services/control-plane/src/control-plane.mjs` 的 `createHandoffExpiryScheduler` 自动扫描并标记 `expired`。
- 单条 handoff 可通过 `expiresAt` 覆盖默认值；服务端不接受 `expiresAt` 早于 `createdAt + 1min`。
- 移动端见 [`mobile.md`](./mobile.md) §"Handoff"。
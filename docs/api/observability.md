# Observability API

> 状态：当前基线 · 2026-09-25
>
> 真实后端：`services/observability/`（独立 Go 服务，独立 Postgres + 事件 ingestion）。Gateway 通过 `/api/v1/observability/*` 反代。
>
> 鉴权：所有 endpoint 接受 Gateway 注入的 `X-Axi-Subject` + `X-Axi-Tenant`；read-only。
>
> Web 调用：`apps/workbench/src/pages/admin/Observability.tsx` 直接 `fetch`，**未走 @axi/api-client hook**（这是已知的待补强点；待 `useObservability*` hook 在 packages/api-client 新增）。

---

## 1. Overview

### `GET /api/v1/observability/overview`

读全租户的观测性总览。

- **响应** `200`：

```json
{
  "data": {
    "totalEvents": 124,
    "projects": 5,
    "services": 9,
    "warnings": { "total": 2, "open": 1 },
    "chain": { "valid": true, "brokenAt": null },
    "generatedAt": "2026-09-25T00:00:00.000Z"
  }
}
```

- **Web 调用**：`Observability.tsx` 直接 fetch
- **错误码**：
  - `404`：observability 上游未部署（前端必须显式提示"未接入"，不显示伪造数据）
  - `503`：observability 服务不可用

---

## 2. 事件流

### `GET /api/v1/observability/events`

列出事件（按时间倒序）。

- **查询参数**：
  - `limit?: number (default 50, max 500)`
  - `afterEventId?: string`（增量游标）
  - `projectId?: string`
  - `severity?: 'info' | 'warning' | 'error' | 'critical'`
- **响应** `200`：

```json
{
  "data": {
    "events": [
      {
        "eventId": "evt_xxx",
        "eventType": "workspace.sync.completed",
        "occurredAt": "2026-09-25T00:00:00.000Z",
        "projectId": "axi-workbench",
        "severity": "info",
        "status": "completed",
        "actorRef": "service:axi-workbench-control-plane",
        "objectRef": "sync:job_xxx",
        "correlationId": "job_xxx",
        "details": { ... }
      }
    ]
  }
}
```

### `GET /api/v1/observability/events/:id`

读取单条事件详情。

- **路径参数**：`id`
- **响应** `200`：`{ data: { ... 完整事件 ... } }`

### `POST /api/v1/observability/events/:id/(acknowledge|resolve)`

管理类事件（warning）的人工 ack / resolve。

- **路径参数**：`id`
- **请求 body**：

```json
{ "reason": "string (min 10, max 500)" }
```

- **响应** `200`：`{ data: { ... 更新后事件 ... } }`
- **错误码**：
  - `403`：非 admin
  - `409`：已 ack / 已 resolve

---

## 3. 项目 / 服务维度

### `GET /api/v1/observability/projects`

列出有事件的项目。

- **响应** `200`：

```json
{
  "data": [
    { "projectId": "axi-workbench", "eventCount": 42, "lastEventAt": "...", "topSeverity": "warning" }
  ]
}
```

### `GET /api/v1/observability/projects/:projectId`

读取项目的观测聚合（事件分布、警告数、平均耗时等）。

- **响应** `200`：`{ data: { ... } }`
- **错误码**：`404`

### `GET /api/v1/observability/services`

列出有事件的服务。

### `GET /api/v1/observability/services/:serviceId`

读取服务的观测聚合。

---

## 4. 日志 / 链路 / 指标

### `GET /api/v1/observability/logs`

读取结构化日志。

- **查询参数**：
  - `serviceId?: string`
  - `level?: 'debug' | 'info' | 'warn' | 'error'`
  - `from?: string (ISO)`、`to?: string (ISO)`
  - `limit?: number (default 100, max 1000)`
- **响应** `200`：`{ data: { entries: [ ... ] } }`

### `GET /api/v1/observability/traces`

读分布式链路追踪。

- **查询参数**：`correlationId?: string`、`traceId?: string`、`limit`
- **响应** `200`：`{ data: { spans: [ ... ] } }`

### `GET /api/v1/observability/metrics`

读指标（counter / gauge / histogram）。

- **查询参数**：`name: string (required)`、`tags?: Record<string,string>`、`from`、`to`、`step?: '10s' | '1m' | '5m' | '1h'`
- **响应** `200`：`{ data: { name, points: [{ ts, value }] } }`

---

## 5. Warnings

### `GET /api/v1/observability/warnings`

列出未解决的 warning。

- **查询参数**：`severity`, `limit`
- **响应** `200`

### `POST /api/v1/observability/warnings/:id/(acknowledge|resolve)`

同 §2 单条 ack/resolve。

---

## 6. 与控制面 / Workspace Event 的关系

- 控制面 / platform-core / workflow-engine / notification-service 在写操作时发事件到 observability（`emitObservabilityEvent`）。
- Workspace Event 流（[`control-plane.md`](./control-plane.md) §10）与本节"事件流"是**两条**不同的数据平面：
  - `/api/v1/control-plane/events` 是控制面内存事件（短期、即时、不持久化）
  - `/api/v1/observability/events` 是持久化事件（长期、可聚合、可重建）
- Web `Observability.tsx` 当前只看 `/observability/overview` + `/observability/events?limit=50`。
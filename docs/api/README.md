# Axi Workbench API 接口规范

> 状态：当前基线 · 2026-09-25
>
> 本目录是 `apps/workbench`（Web 管理端）在浏览器内**实际调用**的 HTTP 接口契约集合。每一个 endpoint 都按 [REST](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm) 风格记录 — method / path / 鉴权 / 请求参数 / 响应 schema / 错误码 / curl 示例。所有 endpoint 路由的真实性以仓库中的 `services/api-gateway/config/routes.yaml` 与各服务源码为准；本文档**与代码同步维护**，新增 endpoint 时必须同步本目录对应文件并补全以下字段。

## 通用约定

### 协议基线
- 所有 endpoint 都暴露在 API Gateway 之后，**浏览器**永远通过 `/api/v1/...` 访问（开发环境 `/api` 由 Vite 反代到 `:8088`）。
- 所有 endpoint 都遵循 JSON over HTTP；`Content-Type: application/json; charset=utf-8`。
- 所有 endpoint 都接受 `credentials: 'include'`；浏览器侧 `fetch` 必须显式带上。

### 鉴权
- 所有受保护 endpoint 都依赖 `Axi Identity OIDC` HttpOnly session cookie：`axi.session`（生产）。
- Gateway 会在内部把 session 解析为 `X-Axi-Subject` + `X-Axi-Tenant` 头，下游服务用这两个头识别主体（参考 `services/api-gateway/middleware/identity/`）。
- 内部调用（control-plane ↔ platform-core / workflow-engine / notification-service / file-service）必须带 `X-Axi-Internal-Token`，由 Gateway 注入。

### 响应封装

成功响应统一格式：

```json
{
  "data": <T>,
  "meta": { "generatedAt": "2026-09-25T00:00:00.000Z" }
}
```

分页响应额外包含：

```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 123, "totalPages": 3 }
}
```

错误响应统一格式：

```json
{
  "error": {
    "code": "string (machine-readable)",
    "message": "string (human-readable, may be i18n key)",
    "details": { ... }
  }
}
```

### 错误码

| HTTP | 语义 | 常见原因 |
|------|------|----------|
| 200  | 成功 | — |
| 201  | 创建成功 | POST 资源创建 |
| 204  | 无内容成功 | DELETE / PUT 幂等完成 |
| 400  | 客户端参数错误 | 缺字段、字段格式错、body 不是 JSON |
| 401  | 未登录 / session 过期 | 浏览器侧需跳 `/login` |
| 403  | 鉴权拒绝 | RBAC 角色不足 / 动作等级越权（PRD §6 A/B/C/D） |
| 404  | 资源不存在 | id 错位、tenant 不匹配、跨端 surface 错位 |
| 409  | 状态冲突 | 幂等键复用但参数不同、状态机非法转换（如已过期的 handoff 又被 complete） |
| 422  | 业务校验失败 | 必填字段缺失后置校验、C 级 handoff 不允许 web→mobile（PRD §6） |
| 429  | 限流 | `X-RateLimit-*` 头附带配额 |
| 500  | 服务内部错误 | 服务崩溃 / 不可恢复的 dep 失败 |
| 502  | 上游网关失败 | upstream service 不可达 |
| 503  | 服务暂不可用 | 控制面未启动 / 数据库迁移未完成 |
| 504  | 上游超时 | upstream service 超时 |

### 幂等性
- 所有 `POST /jobs`、`POST /agent-tasks`、`POST /automations/:id/run`、`POST /commands/:id/run` 都接受 `Idempotency-Key` 头（UUID v4）。同一 key + 同一 payload 在 5 分钟内只执行一次。
- 浏览器侧 `@axi/api-client` 的 mutation hook 会自动生成并复用该 key；自定义调用必须显式带上。

### 路径编码
- 所有路径段中的 `tenantId`、`subject`、`handoffId`、`agentTaskId`、`projectId` 都必须 `encodeURIComponent`。

## endpoint 索引

| 服务 / 域 | 文档 | 主要 endpoint 数量 |
|-----------|------|---------------------|
| Auth / Session | [`auth.md`](./auth.md) | 9 |
| Control Plane (snapshot, jobs, agent-tasks, approvals, risks, governance, query, commands) | [`control-plane.md`](./control-plane.md) | 24 |
| Personal OS (queue, focus, projects) | [`personal-os.md`](./personal-os.md) | 5 |
| Handoff (Web↔Mobile) | [`handoff.md`](./handoff.md) | 6 |
| Workflow Engine | [`workflow.md`](./workflow.md) | 8 |
| Platform Core (tenants / members / preferences / dictionaries / projects / tasks) | [`platform.md`](./platform.md) | 12 |
| Notification | [`notification.md`](./notification.md) | 7 |
| File Service | [`file.md`](./file.md) | 6 |
| Observability | [`observability.md`](./observability.md) | 7 |
| Commit Ledger | [`commit-ledger.md`](./commit-ledger.md) | 7 |
| EPS (API 资产审计) | [`eps.md`](./eps.md) | 6 |
| Mobile (Pairing / Scan / Auth / Workspace / Handoffs / Jobs / Approvals) | [`mobile.md`](./mobile.md) | 18 |

## 新增 endpoint 的流程

1. **确定路径**：先查 [`auth.md`](./auth.md) / [`platform.md`](./platform.md) 找到 base path；新增 endpoint 必须落在现有 base 下，**不**新增 base path。
2. **确定鉴权**：复用 Gateway 现有的 session + RBAC 中间件；不要新建鉴权流程。
3. **写 schema**：在 `packages/schemas/src/requests.ts` 与 `responses.ts` 新增 Zod schema；先在 schema 层做字段校验，再写 handler。
4. **写 handler**：在对应 service 的 `internal/httpapi/` 或 `routers/` 下写 handler；handler 必须返回本文档约定的 `{ data, meta? }` 封装或 `{ error: { code, message, details? } }` 封装，**不**直接抛 HTTPException。
5. **挂路由**：Go 服务用 `routes.yaml` 注册到 `api-gateway`；Python 服务用 FastAPI `@router.{get,post,...}` 注册后由 `routes.yaml` 反代；Node 服务直接在 `server.mjs` 路由表中挂。
6. **写前端 hook**：在 `packages/api-client/src/hooks/` 新增 `useXxx`，并在 `index.ts` 重导出；浏览器侧只允许通过 `@axi/api-client` 调用，**不**直接 fetch。
7. **同步文档**：在本目录对应服务 md 中新增 endpoint 段；CI `pnpm docs:check` 会校验 endpoint 是否在文档里有匹配记录（详见 §"文档同步校验"）。
8. **写闭环测试**：参考 `apps/workbench/src/pages/admin/Dashboard.test.tsx` 的 vitest+RTL 模式；不允许只写 hook 单测就上 UI。
9. **挂 UI**：在 `apps/workbench/src/App.tsx` 与 `apps/workbench/src/lib/navigationRegistry.ts` 同步路由 + 侧栏入口；UI 上线必须满足 PRD §7.1:233 的"无伪造数据"约束。

## 文档同步校验

- 仓库根的 `pnpm docs:check` 会扫描：
  - `services/*/internal/httpapi/*.go` 中的 `r.GET/r.POST/...` 调用
  - `services/api-gateway/config/routes.yaml` 中的 path
  - `packages/api-client/src/hooks/*.ts` 中 fetch / apiClient.{get,post,...} 调用
  - `apps/workbench/src/**/*.tsx` 中 `resolveGatewayURL` + `fetch` 直接调用
  - 对照本目录 markdown 中 endpoint 列表，缺失则报错。
- 在 PR 中必须同步更新对应文档。

## 版本与契约

- 本目录维护 v1 契约；任何 breaking change（路径、请求字段、响应字段、错误码）必须：
  1. 在 `packages/schemas/` bump major 版本
  2. 在本目录对应 endpoint 段加 `> 变更记录：` 段落
  3. 通知所有 `@axi/api-client` 消费者同步
- 非破坏性变更（新增字段、可选字段、扩展错误码）允许直接更新。
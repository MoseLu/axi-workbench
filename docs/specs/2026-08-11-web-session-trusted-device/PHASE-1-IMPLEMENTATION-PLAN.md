# Web 持久会话第一阶段实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让测试环境的 Web 在 HMR、Vite 重启、关闭并重新打开浏览器以及 Gateway 重启后，仍能通过同一份 Redis 中的不透明会话恢复登录；只在会话真正失效时重新走邮箱验证码。

**Architecture:** 浏览器始终访问 `127.0.0.1:5173` 的相对 `/api`，由 Vite 代理到 `127.0.0.1:8088`，从而只有一个 first-party Cookie jar。Gateway 将浏览器 session 写入 Redis，并在 `GET /api/v1/auth/session` 上按闲置/绝对期限续期；达到续期阈值时原子轮换 opaque session ID。现有邮箱登录与 OIDC 回调继续只写 HttpOnly Cookie，前端不接触 token。

**Tech Stack:** Go 1.24、Gin、go-redis/v9、Vitest、React、Vite、pnpm。

**Scope boundary:** 本计划只交付 [DESIGN.md](DESIGN.md) 的第一阶段。`trusted_devices`、`axi_remember_device`、设备管理 API/UI 和 Passkey 保持在第二、三阶段，避免把“修复重启后掉登录”扩展成新的认证体系。

---

## 先决条件与回归基线

- [x] 在独立 worktree 安装锁定依赖：`pnpm install --frozen-lockfile`。
- [x] 记录当前基线：
  - `go test ./...`（cwd: `services/api-gateway`）
  - `pnpm --filter @axi/workbench test -- src/lib/authGateway.test.ts`
- [x] 不修改主 worktree 中已有的 i18n 与自动提交日志；所有变更仅落在 `codex/web-session-persistence` worktree。

## Task 1 — 先固化会话配置和本地 Redis 启动契约

**状态：** [x] 已完成（配置与启动契约）；session engine 保持待 Task 2。

**Files:**

- Modify: `services/api-gateway/config/config.go`
- Modify: `services/api-gateway/config/config_test.go`
- Modify: `services/api-gateway/scripts/dev-run.sh`
- Modify: `services/api-gateway/scripts/dev-run_test.sh`
- Modify: `services/api-gateway/package.json`
- Modify: `Makefile`
- Modify: `.env.example`

**TDD steps:**

1. 先为 `Config.Validate` 增加失败测试：`GATEWAY_REQUIRE_DURABLE_SESSION_STORE=true` 而 `GATEWAY_REDIS_URL` 为空时必须拒绝启动；`SESSION_IDLE_TTL`、`SESSION_ABSOLUTE_TTL` 必须为正数且 idle 不得超过 absolute；续期阈值不得为负数、且启用时必须小于 idle TTL。
2. 先为默认兼容性增加测试：只设置既有 `SESSION_TTL` 时，idle/absolute 均回退为它，且续期阈值关闭（或等同于不会在有效期内触发），保留现有生产 8h 语义。
3. 实现 `IdentityConfig` 的 `SessionIdleTTL`、`SessionAbsoluteTTL`、`SessionRenewAfter`、`RequireDurableSessionStore`；新会话时长和 durable 开关的非空无效值必须在 `Load` 中失败关闭，而遗留 `SESSION_TTL` 与既有 timeout 的宽松解析保持不变；`Validate` 执行上述不变量。
4. 修改本地启动脚本：默认并强制 `GATEWAY_REDIS_URL=redis://127.0.0.1:6379/0` 和 `GATEWAY_REQUIRE_DURABLE_SESSION_STORE=true`；DB 0 是 Gateway 专用 Redis DB（浏览器 session + Gateway rate-limit，键名前缀隔离），不能与 Identity 的 DB 1 或 Workflow 的 DB 2 共用。变量为空、含 query/fragment 或显式指定非 DB 0 时以不含敏感信息的中文错误退出；路径必须精确为 `/0`。脚本不回退到进程内存。
5. 更新 `.env.example`：使用同一 loopback Redis DB，给出 `720h`、`2160h`、`168h` 的测试环境示例和 `VITE_API_BASE_URL=`，不写任何真实邮箱或凭据。
6. 将 launcher 行为测试加入 `services/api-gateway/package.json` 的 `test` 与根 `Makefile` 的 `verify-go`，保证常规验证路径不会跳过启动契约。

**Acceptance checks:**

```bash
( cd services/api-gateway && go test ./config )
bash -n services/api-gateway/scripts/dev-run.sh
pnpm --dir services/api-gateway test
make verify-go
```

## Task 2 — 将 session 从单一 TTL 演进为持久、闲置续期、绝对过期和原子轮换

**状态：** [x] 已完成。

**Files:**

- Modify: `services/api-gateway/identity/store.go`
- Modify: `services/api-gateway/identity/service.go`
- Modify: `services/api-gateway/identity/service_test.go`

**TDD steps:**

1. 先写 `MemoryRecordStore.Rotate` 测试：旧键存在时创建新键并删除旧键；旧键已过期或不存在时返回 `ErrRecordNotFound`；整个过程在同一锁内完成。
2. 先写 Service 行为测试，使用可控 `now` 和同一个 `MemoryRecordStore` 模拟 Gateway 对象重建：
   - 邮箱首登后，新 Service 实例仍能恢复同一 session；
   - 有效 `/session` 恢复会更新 idle 期限，但不能越过 absolute 期限；
   - 到达 `SessionRenewAfter` 后返回新 session ID，旧 ID 立即不能认证；
   - 闲置过期、绝对过期和显式登出均返回 `ErrUnauthorized`；
   - 仅配置旧 `SessionTTL` 的测试继续保持既有时长。
3. 扩展 `RecordStore` 为包含原子 `Rotate` 操作。内存实现使用同一 mutex；Redis 实现用 Lua（检查旧键、SET 新键及 TTL、DEL 旧键）作为单个 Redis 原子操作，并将不存在映射为 `ErrRecordNotFound`。
4. 为 `browserSession` 增加 `IdleExpiresAt`、`LastSeenAt`、`RenewedAt`，保留 `ExpiresAt` 为绝对会话到期时间。旧序列化 session 缺少新字段时，将它们安全地退化为 `ExpiresAt`，而非延长旧会话。
5. 在 OIDC 与邮箱首登时使用同一个 session-policy helper 创建 session：absolute 为 `now + SessionAbsoluteTTL`；idle 为 `min(now + SessionIdleTTL, absolute)`；Redis TTL 与 idle 到期一致。不能再用短期 OIDC token expiry 意外截断已配置的浏览器 session policy。
6. 增加专用恢复方法（例如 `RestoreSession`）：只在 Cookie session 有效时刷新 idle；跨过续期阈值时通过 `Rotate` 产生新 session ID；Bearer 与开发 Header 认证保持当前语义且不生成 Cookie。`Authenticate` 保持现有中间件调用兼容。
7. `identity.New` 在 `RequireDurableSessionStore` 开启时拒绝空 Redis URL，并在创建 Redis store 后立即 `Ping`；不可用时关闭 client 并返回启动错误。测试注入的 `NewForTest` 仍可使用内存 store。
8. `SetCookie` 的寿命改为有效 idle TTL，仍保持 `HttpOnly`、`SameSite=Lax`、现有 `Secure`/Domain 策略；不要把 session ID、邮箱、验证码或 OAuth token 写日志或响应体。

**Acceptance checks:**

```bash
cd services/api-gateway && go test ./identity
```

## Task 3 — 让现有 `/auth/session` 路由承担无感续期

**状态：** [x] 已完成。

**Files:**

- Modify: `services/api-gateway/handlers/oidc.go`
- Add or Modify: `services/api-gateway/handlers/oidc_test.go`
- Modify only if needed for route coverage: `services/api-gateway/cmd/gateway/main_test.go`

**TDD steps:**

1. 建立 handler 测试：有效 Cookie 调用 `GET /api/v1/auth/session` 返回既有兼容 JSON（`authenticated: true` 与 `user`），并重写同名 HttpOnly Cookie；不泄露 session ID。
2. 建立续期阈值测试：Service 报告轮换后，handler 写入新 Cookie，旧 Cookie 的后续请求得到 401；没有轮换时仍可刷新 Cookie 的存活时间。
3. 建立失败测试：缺少、未知、闲置过期、绝对过期 Cookie 都只返回通用 `401 {"authenticated":false}`；存储故障使用非认证失败的 503，不将 Redis 细节暴露给浏览器。
4. 将 `handlers.Session` 改用 Task 2 的恢复方法，成功时调用 `SetCookie`（使用轮换后的或原 session ID）；OIDC callback 与邮箱确认继续通过同一 helper 设置 Cookie。
5. 若实现安全诊断，只能在开发配置开启时记录固定枚举 `missing_cookie`、`unknown_session`、`expired_idle`、`expired_absolute`；测试断言日志/响应中不存在 Cookie 值、邮箱、验证码或 token。若现有日志结构不支持安全测试，先不添加新的日志通道，并在 PR 说明中列为后续可观测性项，不能以裸 `fmt.Printf` 绕过审计。

**Acceptance checks:**

```bash
cd services/api-gateway && go test ./handlers ./cmd/gateway ./middleware
```

## Task 4 — 固定 Workbench 本地 Origin，并使所有 loopback Gateway 走 Vite 代理

**状态：** [x] 已完成。

**Files:**

- Modify: `apps/workbench/vite.config.ts`
- Modify: `packages/workbench-foundation/src/auth.tsx`
- Modify: `apps/workbench/src/lib/authGateway.test.ts`

**TDD steps:**

1. 先把 Vitest 扩展为表驱动：页面为任何 loopback 地址（`localhost`、`127.0.0.1`、IPv6 loopback）且配置 Gateway 也是任何 loopback 地址时，结果必须是空 base URL，即相对 `/api`；远程或部署 Gateway URL 必须原样保留。
2. 修改 `normalizeGatewayBaseURL`，不要只检查 hostname 是否不同；本机 loopback 对 loopback 一律强制 Vite 同源代理，保留无法解析 URL 的现有容错行为。
3. Vite server 改为 `host: '127.0.0.1'`、`strictPort: true`，`/api` 默认目标改为 `http://127.0.0.1:8088`。不改变生产构建的 API URL 行为。
4. 注释和测试名称明确说明：改动的目的不是信任“设备指纹”，而是避免 `localhost` / `127.0.0.1` Cookie jar 分裂。

**Acceptance checks:**

```bash
pnpm --filter @axi/workbench test -- src/lib/authGateway.test.ts
pnpm --filter @axi/workbench type-check
```

## Task 5 — 集成验证、回归检查与交接

**状态：** [x] 已完成（2026-08-12）。真实验证使用隔离的 Docker Redis
（AOF + 命名卷；宿主 `127.0.0.1:6380`，避免干扰既有 6379 原生 Redis）和
Mailpit SMTP。浏览器已完成邮箱验证码登录，并验证 HMR、Vite 重启、Gateway
重启、Docker Redis 重启、页面关闭重开及 Redis 短暂不可用后的会话行为。

2026-08-12 进一步完成了真实 QQ SMTP 验收：在已登录 QQ 邮箱的内置浏览器中读取
最新一次性验证码，身份服务确认该验证码后，浏览器进入本地管理台。随后同一浏览器会话
经 HMR、Vite 重启、Gateway 重启、Docker Redis 重启及关闭页面后重新打开均保持登录，
且恢复页面没有控制台错误。首次手动启动 Gateway 时遗漏了 `EMAIL_LOGIN_SUBJECT`，已按
`services/api-gateway/scripts/dev-run.sh` 的开发默认值 `audit-user` 重启；这属于手动启动
环境缺项，不是验证码或持久会话实现缺陷。控制面未在本次隔离环境启动。

**Files:**

- Modify if behavior/usage changes require clarification: `docs/specs/2026-08-11-web-session-trusted-device/DESIGN.md`
- No generated files or `.env` files are committed.

**Checks:**

1. 运行完整 Gateway 测试：`cd services/api-gateway && go test ./...`。
2. 运行 Workbench 的目标测试与类型检查；若类型检查暴露既有非相关失败，保留原始输出并清楚区分。
3. 用本地 Docker Redis（AOF + named volume）启动 Gateway，完成一次邮箱登录后依次验证：刷新、HMR、Vite 重启、浏览器重开、Gateway 重启。每一步调用 `/api/v1/auth/session` 必须保持 200，且只在首次或故意清理 Cookie 后出现邮箱验证码。
4. 手动验证 Redis 不可用：`dev-run.sh` 不得静默回退内存；启动失败信息不得包含配置秘密。
5. 审查 `git diff --check` 与受影响文件；提交前使用 Lore trailers 记录 `Tested`、`Not-tested`、`Confidence`、`Scope-risk`、`Directive`。不合并或推送到 `main`。

## 完成定义

- 单一的 `127.0.0.1` 开发 origin 和相对 `/api` 消除了 localhost/IPv4 Cookie 分裂。
- 开发 launcher 缺 Redis 时明确失败；Gateway 进程重启不丢失 Redis 中有效 session。
- session 的闲置、绝对、续期和轮换规则有可控时钟的单元测试，且现有 OIDC、邮箱登录、登出和 Bearer 路径保持兼容。
- 前端不保存或显示 session ID、OAuth token、验证码或设备指纹；Phase 2/3 的新认证凭据没有提前启用。

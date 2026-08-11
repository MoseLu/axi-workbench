# Web 会话持久化与受信设备 — 设计

## 来源与状态

- 来源：2026-08-11 用户反馈 Web 在 Vite 重启、关闭前端或 HMR 后反复要求 QQ 邮箱验证码，并要求本机测试环境首登后保持可用。
- 决策：测试环境先行；第一阶段交付持久会话与单一开发 Origin，第二阶段交付受信设备，Passkey 作为生产推广前的增强。
- 不在本轮范围：生产环境放宽现有会话策略、把浏览器原始指纹当作认证凭据、修改移动端设备配对协议。
- 状态：第一阶段配置与启动契约已实施；持久 session engine 尚待 Task 2。

## 设计命题

“同一台测试机不反复收邮箱验证码”首先是会话持久化问题，不是浏览器指纹问题。浏览器保留不透明 HttpOnly Cookie，Gateway 在 Redis 保存会话；Vite/HMR 只会重新请求会话，不应改变认证结果。会话确实过期或 Redis 数据丢失时，受信设备可恢复会话；生产环境再用 Passkey 为恢复增加密码学证明。

```mermaid
flowchart LR
  B["Web 浏览器\n127.0.0.1:5173"] -->|"/api + axi_session"| G["API Gateway"]
  G -->|"opaque session"| R["Redis\n会话与过期时间"]
  G -->|"首次邮箱验证"| I["Identity Adapter"]
  I --> P["PostgreSQL\n受信设备与 Passkey"]
  B -. "仅测试环境恢复" .->|"axi_remember_device"| G
```

## 第一阶段：测试环境会话持久化

1. **固定本机 Origin。** Web 开发服务器绑定 `127.0.0.1:5173` 并启用严格端口；开发浏览器请求一律使用相对 `/api`，由 Vite 代理到 `http://127.0.0.1:8088`。移除开发环境的直接 `VITE_API_BASE_URL`，避免 `localhost` 和 `127.0.0.1` 各自拥有一份 Cookie。
2. **强制 Redis 会话存储。** 本地 Gateway 启动脚本要求 `GATEWAY_REDIS_URL=redis://127.0.0.1:6379/0`，且 URL 不得包含 query 或 fragment、路径必须精确为 `/0`；DB 0 是 Gateway 专用 Redis DB（浏览器 session + Gateway rate-limit，键名前缀隔离），Identity 保持 DB 1、Workflow 保持 DB 2，不能共用键空间。Redis 不可用则启动失败，不回退到进程内存。现有 Docker Redis 的 AOF 与命名卷继续作为本地重启后的持久化基础。
3. **拆分会话时限。** 新增 `SESSION_IDLE_TTL=720h`、`SESSION_ABSOLUTE_TTL=2160h` 与 `SESSION_RENEW_AFTER=168h`。新变量未配置时，兼容使用现有 `SESSION_TTL`，不改变生产环境默认 8 小时策略。Go 时长使用 `h`，不使用不被 `time.ParseDuration` 支持的 `d`。
4. **滑动续期与轮换。** Gateway 在有效 `/api/v1/auth/session` 请求时更新闲置期限；达到续期阈值后原子地签发新 session ID、写入新 Redis 键并退休旧键。普通登出、绝对过期和服务端撤销始终立即失效。
5. **可诊断失败。** 仅测试环境记录 `missing_cookie`、`unknown_session`、`expired_idle`、`expired_absolute`；日志绝不包含 Cookie、验证码、邮箱原文或 OAuth token。

## 第二阶段：受信设备

1. Identity Adapter 的 PostgreSQL 增加 `trusted_devices`：设备 ID、主体、恢复凭据哈希、显示名称、创建/最近使用/到期/撤销时间、可选 WebAuthn 凭据引用。不得保存原始 Canvas、字体、音频或完整 UA 指纹。
2. 邮箱验证码首登成功后，测试环境自动签发 `axi_remember_device`。它是 HttpOnly、SameSite=Lax、随机且不透明的 Cookie；数据库只保存其哈希，闲置和绝对期限与第一阶段一致。
3. `/api/v1/auth/session` 的恢复顺序固定为：有效普通会话 → 测试环境有效受信设备 → 未认证。第二种路径签发新的普通会话、轮换恢复凭据并记录审计事件；无效、到期或撤销的设备回退邮箱验证码。
4. Gateway 提供已认证设备管理出口：`GET /api/v1/auth/devices` 与 `DELETE /api/v1/auth/devices/:id`。Web 的“设备管理”页展示设备标签、最近使用、到期时间与当前设备；撤销同时删除恢复能力。
5. 粗粒度设备信息只可作为审计风险信号。信号变化不能单独放行或拒绝认证；测试环境不因 IP 或浏览器小版本变化打断会话。

## 第三阶段：Passkey 与生产推广

1. 认证用户可注册 WebAuthn/Passkey；Identity Adapter 保存公钥凭据与短时 challenge，Gateway 只在验证成功后签发浏览器会话。
2. 生产环境中，受信设备 Cookie 只用于选择候选凭据；当普通会话过期、Cookie 被清理或进行敏感操作时，必须完成 Passkey 用户验证才可恢复会话。邮箱验证码保留为恢复路径。
3. 生产切换前必须完成换机、撤销、Passkey 丢失、Redis 故障、异常地点和会话劫持模拟演练；生产 Cookie 继续使用 HTTPS、`Secure`、精确 CORS Origin 与原有 OIDC 边界。

## 接口、审计与验收

| 类别 | 决定 |
| --- | --- |
| 既有接口 | `GET /api/v1/auth/session` 保持响应兼容；可在服务端静默续期或恢复，不返回 session ID。 |
| 新配置 | `GATEWAY_REDIS_URL`、`GATEWAY_REQUIRE_DURABLE_SESSION_STORE`、`SESSION_IDLE_TTL`、`SESSION_ABSOLUTE_TTL`、`SESSION_RENEW_AFTER`、`AUTH_TRUSTED_DEVICES_ENABLED`、`AUTH_PASSKEY_ENABLED`。 |
| 新接口 | 第二阶段增加 `GET/DELETE /api/v1/auth/devices`；设备恢复复用既有 session 检查入口。 |
| 新审计 | `session_created`、`session_restored`、`session_renewed`、`session_rejected`、`trusted_device_recovered`、`device_revoked`。 |

验收必须覆盖：

1. 邮箱首登后，连续 HMR、整页刷新、重启 Vite、关闭并重开浏览器都不再发送验证码。
2. Gateway 重启、Redis 容器重启后，未超过期限的会话仍可恢复。
3. 显式退出、撤销设备、闲置超过 720 小时或创建超过 2160 小时后，必须重新认证。
4. `localhost` 与 `127.0.0.1` 混用不能形成静默的第二会话；切换到规范 Origin 后只允许一次迁移性重新登录。
5. Redis 不可用时，Gateway 不创建内存会话；页面得到明确但不泄露安全细节的错误。
6. 运行 Gateway Go 测试、Workbench 类型检查与测试，并在真实浏览器中完成上述场景矩阵。

## 实施顺序

1. 先实现并验证第一阶段，完成后进行一轮邮箱重新认证作为迁移起点。
2. 第一阶段稳定后再启用受信设备 feature flag 和设备管理页。
3. 受信设备稳定并具备撤销审计后，才开始 Passkey 试点；生产开关默认保持关闭。

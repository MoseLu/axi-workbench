# Axi Workbench Kubernetes 部署

`axi-workbench-platform` Helm Chart 只部署 Axi 的业务 API 平面：唯一外部入口 `api-gateway`，以及仅集群内可达的 `identity-adapter` 和 `platform-core`。Web 和移动端都是独立应用，只共享同一个 OIDC/API 合同；它们不共用界面壳层。

```text
Web / Mobile (BFF + PKCE) / EPS (PKCE API token)
                    │ HTTPS
                    ▼
NGINX Ingress ──► api-gateway ──► identity-adapter ──► ZITADEL
                    │     ▲              │
                    │     └─ QR complete─┘ (webhook secret)
                    └──────────► platform-core ──► PostgreSQL / Redis
```

## 先决条件

- Kubernetes 1.30+、NGINX Ingress 和 cert-manager。
- PostgreSQL 14+ 共享实例：`axi_identity` 与 `axi_platform` 使用独立 schema / 账号；ZITADEL 使用其自己的数据库。
- Redis 用于网关 OIDC 会话、PKCE state 与限流，以及 identity-adapter 的短期二维码事务。
- 官方 ZITADEL Helm Chart。生产环境禁用其 bundled PostgreSQL，并将 `ZITADEL_DATABASE_POSTGRES_DSN` 指向受管 PostgreSQL 的 `postgres` maintenance database；ZITADEL 会创建和维护自己的身份数据。

ZITADEL 管理台必须具备端到端 HTTP/2（h2c）后端转发能力；在使用 NGINX Ingress 的集群先执行官方部署文档中的连通性验收。

## 运行时 Secret

Chart 默认引用 `axi-workbench-runtime`，由 External Secrets、Sealed Secrets 或集群运维创建。不得在 `values.yaml`、Git 或前端环境变量中放入真实值。

必需键：

- `GATEWAY_REDIS_URL`
- `GATEWAY_IDENTITY_INTERNAL_TOKEN`
- `GATEWAY_PLATFORM_INTERNAL_TOKEN`
- `OIDC_CLIENT_SECRET`
- `IDENTITY_DATABASE_URL`
- `IDENTITY_REDIS_URL`
- `IDENTITY_INTERNAL_SERVICE_TOKEN`（值必须与 gateway identity token 相同）
- `ZITADEL_WEBHOOK_SECRET`
- `SMTP_HOST`、`SMTP_PORT`、`SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_FROM`
- `PLATFORM_DATABASE_URL`（`axi_platform_app`，必须为 `NOBYPASSRLS`）
- `PLATFORM_MIGRATION_DATABASE_URL`（仅 Helm migration Job 使用的 `BYPASSRLS` 账号）
- `PLATFORM_INTERNAL_SERVICE_TOKEN`（值必须与 gateway platform token 相同）

可选键：`PLATFORM_OUTBOX_DELIVERY_AUTH_TOKEN`。

平台数据库迁移账号是唯一拥有 `BYPASSRLS` 的 Axi 平台账号，且只能注入 pre-install/pre-upgrade Job。`platform-core` Deployment 永远只得到 `axi_platform_app`。初始化开发数据库可用 [`scripts/init-db.sql`](../../scripts/init-db.sql)；生产角色/DSN 由数据库 IaC 或 DBA 预先创建。

## 安装顺序

1. 创建 DNS、cert-manager ClusterIssuer、PostgreSQL/Redis 和上述 Secret。
2. 基于 [`zitadel-values.example.yaml`](zitadel-values.example.yaml) 复制一份环境专用 values，安装官方 ZITADEL Chart。
3. 在 ZITADEL 注册两个明确的客户端边界：
   - axi-workbench-web 是浏览器 BFF client，Web 与移动端各自独立的 UI 都经它走 Authorization Code + PKCE；ZITADEL 只登记网关回调 https://api…/api/v1/auth/oidc/callback，应用侧回跳地址由 OIDC_ALLOWED_RETURN_URLS 精确白名单控制。
   - axi-workbench-eps 是 EPS 的独立 PKCE client；其 access token 必须以 gateway.oidc.apiAudience 为 aud，并具备 gateway.oidc.requiredAccessTokenScopes。
4. 复制 `axi-workbench-platform/values.yaml` 为环境 values，替换镜像 tag、域名、Issuer、client ID 和允许的返回 URL。
5. 部署业务 API：

```bash
helm upgrade --install axi-workbench ./infra/helm/axi-workbench-platform \
  --namespace axi-workbench --create-namespace \
  --values /secure/path/axi-workbench.production.yaml --wait
helm test axi-workbench --namespace axi-workbench
```

迁移 Job 在安装/升级前执行。它失败时 Helm 不会推进运行时 Deployment；不要以应用运行时账号手工重试迁移。

## 验收边界

- Ingress 只暴露 `/api` 到 gateway；identity/platform 的 Service 为 `ClusterIP`，NetworkPolicy 仅允许 gateway 访问。
- 网关通过 ZITADEL JWKS、API audience 与所需 scope 验证 Bearer access token，并为浏览器 BFF 会话发放 HttpOnly cookie；浏览器不保存 access/refresh token，也不会把 ID Token 当作业务 API token。
- QR 轮询只返回事务状态，审批和一次性 resume 均由内部身份边界处理，绝不返回 JWT。ZITADEL custom-login 完成请求必须打到 https://api…/api/v1/internal/zitadel/qr/transactions/{id}/complete；网关转发到 ClusterIP identity-adapter，适配器再校验 X-Axi-Zitadel-Webhook，不能绕过网关直接公开适配器。
- Outbox 是至少一次投递：记录有五分钟租约、指数退避和第十次失败后的死信标记；内部消费者必须使用 X-Axi-Event-ID 做幂等去重。

生产 Web 与移动端分别构建，但都必须在各自的构建环境注入同一 VITE_API_BASE_URL=https://api… 。网关仅对 gateway.cors.allowedOrigins 的精确 HTTPS Origin 发送携带 cookie 的 CORS 响应。
- 跨租户读写要同时被 gateway 身份注入、platform-core 成员检查和 PostgreSQL RLS 拒绝。
- 三项 Go 服务会在 `OTEL_EXPORTER_OTLP_ENDPOINT` 配置后通过 OTLP/HTTP 导出服务端 Span，并继续 W3C `traceparent`；部署前仍需接入环境的 Collector，并用真实 OIDC/SMTP/数据库故障演练完成上线验收。

本地 Mailpit 烟测使用 `make docker-up` 后的 1025 SMTP 端口：`make verify-identity-mailpit`。它显式设置 `IDENTITY_MAILPIT_SMTP_REQUIRED=1`，因此不会回退到 QQ/网易等真实邮箱；受控环境的真实 SMTP 冒烟只能由对应 Secret 注入后单独执行。

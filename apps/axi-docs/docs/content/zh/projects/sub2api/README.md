---
id: axi-docs-zh-projects-sub2api
title: Sub2API Reference
type: project
status: published
tags: [Axi Docs, 项目, references, reference, gateway, subscription]
created: 2026-10-07
modified: 2026-10-07
graph-title: Sub2API Reference
graph-tags: [Projects, references]
description: Third-party `Wei-Shaw/sub2api` (GitHub) reference checkout — production-grade AI API gateway that turns upstream vendor subscriptions into a redistributable, metered API key-as-a-service surface; Gin + Ent + Vite + Tailwind monorepo with PostgreSQL + Redis storage.
project:
  id: sub2api
  partition: references
  path: /Volumes/code/workspace/references/short-term/sub2api
  source-section: reference
---

# Sub2API Reference

> Reference checkout. Source of truth:
> [`/Volumes/code/workspace/references/short-term/sub2api`](/Volumes/code/workspace/references/short-term/sub2api).
> Upstream: `Wei-Shaw/sub2api` (GitHub). License: see upstream `LICENSE` + `CLA.md` (CLA-gated contributions).
> Partition: `references/`.

## Summary

Sub2API（`/Volumes/code/workspace/references/short-term/sub2api`）是一个第三方、生产级的 AI API gateway 平台，核心目的是把上游 AI 厂商订阅（Codex CLI、Anthropic Claude、Google Gemini、Antigravity、Kiro、Cursor、OpenAI 等）转化为可再分发、按用量计费的 **API key-as-a-service** 服务，交付给下游用户。每个上游账号在平台侧注册，平台生成 *自己* 的 `sk-...` key，下游使用者把它粘到 Claude Code、Codex 或任意 OpenAI/Anthropic/Gemini 兼容 SDK 中即可；gateway 鉴权入站调用，按 sticky-session + load-factor 调度器挑选上游账号，通过按协议分发的 handler（`/v1/messages`、`/v1/chat/completions`、`/v1/responses`、`/v1beta/...`）转发请求，捕获 token 用量，按 key/用户/账号施加账单与限速，把 usage log 写回 Postgres。对 Axi 而言，这是 *API-key subscription service* 模式最直接的参考：如何铸造内部 API key、如何挂载配额/限速/IP 白名单、如何分发下游兼容 API 表面，以及如何跨多个上游账号按 token 计费。

第二件事是这个 checkout 展示了 **relay-platform 商业模式**——Axi 也曾反复问过：平台在“上游订阅价 vs 下游收费”的价差中赚取毛利，可以是预付余额（通过 Stripe / EasyPay / Alipay / WeChat 充值），也可以是月费套餐带月度配额。内置的支付 provider、兑换码、优惠码、邀请/分销流程、监控与滥用处理的 admin 仪表盘都打包在同一个二进制里。从架构视角看，Axi 可以借鉴：(a) Gin + Ent + Wire 的依赖注入分层；(b) API-key auth 热路径上的 L1 ristretto + L2 Redis + L3 Postgres 三级缓存布局；(c) OAuth-first 账号引导流程，持久化 identity token，并由后台 refresher 轮换；(d) 在 schema 上强制软删除、IP 白/黑名单、滚动限速窗口（`5h`/`1d`/`7d`，见 `ent/schema/api_key.go`）。

checkout 上几乎没有 Axi 侧的源码层文档（上游 README/CLA/DEV_GUIDE 保留原样），但被标准的 Axi reference-overlay 包裹：`AGENTS.md`、`INDEX.md`、`PRD.md`、`TDD.md`、`MILESTONE.md`、`TODO.md`、`docs/project-docs.manifest.json`。Overlay 遵循 workspace reference-checkout 合约——只读、无 Axi 治理变更——只需要文档完备性校验。所以这个 dossier 的核心任务是总结 *源码实际内容* 与 Axi 可借鉴之处，而不是项目路线图。

## Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Backend language / runtime | Go 1.26.3 (module); upstream CI pins Go 1.25.7 | `go.mod` declares `go 1.26.3`; Dockerfile pins `golang:1.26.3-alpine`; backend test surface uses `testcontainers-go` modules (`postgres v0.40.0`, `redis v0.40.0`) |
| Backend framework | Gin (HTTP) + Ent ORM + Google Wire (DI) | `cmd/server/wire.go` + `wire_gen.go` centralise 200+ service graph; 33 source schemas in `ent/schema/` (api_key, account, group, …); 220+ generated entity dirs in `ent/` |
| Storage | PostgreSQL 15+ + Redis 7+ + file (`config.yaml`) | `backend/config.yaml` ~48 KB full default config (embedded); `migrations/` 172+ Atlas-managed files; per-account and per-API-key records live in Postgres |
| Auth hot-path cache | L1 ristretto (`ristretto.Cache`) + L2 Redis + L3 Postgres | `APIKeyService` (883 lines) maintains compiled auth entries (key + user + group + pre-parsed IP allowlist/blocklist); hits cost ~one `ristretto.Get`; `GenerateKey()` mints `crypto/rand` hex 32 bytes prefixed with `s.cfg.Default.APIKeyPrefix` (default `sk-`) |
| Upstream protocols | OpenAI (`/v1/chat/completions`, `/v1/responses`) + Anthropic (`/v1/messages`) + Gemini (`/v1beta/...`) + Codex / Antigravity / Kiro / Cursor | Per-protocol handlers in `internal/handler/gateway_handler*.go` (~30 files); failover loop in `handler/failover_loop.go` swaps accounts during active responses; chat-completions streams re-cast as Anthropic- or OpenAI-compatible depending on caller's group platform |
| Upstream account scheduler | Sticky session + load factor | `service/account_service.go` + 4,000-line `service/gateway_service.go` + `service/account_group.go`; sticky session via header `session_id` (Anthropic) or deterministic hash(model + per-user nonce) (OpenAI); Nginx requires `underscores_in_headers on;` because session_id headers carry underscores |
| Payment providers | EasyPay + Alipay (`smartwalle/alipay/v3`) + WeChatPay (`wechatpay-apiv3/wechatpay-go`) + Stripe (`stripe-go/v85`) + Airwallex | `internal/payment/provider/` adapters; `PaymentOrder` + `PromoCode` for top-up / redeem / promo; `SubscriptionPlan` + `UserSubscription` for recurring quota plans; `docs/ADMIN_PAYMENT_INTEGRATION_API.md` for onboarding |
| Frontend | Vue 3.4+ + Vite 5 + Tailwind + Pinia + Vue Router 4 + i18n + vitest | `frontend/src/{api,components,composables,constants,stores,utils,styles,i18n,types,views,router,__tests__}`; per-feature stores (auth, keys, channels, subscriptions); chart.js + vue-chartjs for quota/billing dashboards; embedded into Go binary via `-tags embed` (`backend/internal/web/dist`) |
| CLI tooling | Cobra-style flags on `backend/cmd/server/main.go` | `-setup` (first-run wizard), `-version` (prints embedded VERSION); `jwtgen` once-only one-shot JWT secret tool |
| Release pipeline | `Dockerfile` 4-stage build + `.goreleaser.yaml` + Homebrew tap + `deploy/install.sh` | Frontend-builder → backend-builder → pg-client (libpq/zstd-libs/lz4-libs for `pg_dump`/`psql`) → alpine; goreleaser produces deb/rpm/apk/dmg/zip + Docker + Homebrew; `deploy/docker-compose.local.yml` uses bind mounts (`./postgres_data`, `./redis_data`, `./data`) for trivial migration |
| CI / security | GitHub Actions (`backend-ci.yml`, `security-scan.yml`, `release.yml`) | Pins Go 1.25.7; runs `govulncheck`, `gosec`, `pnpm audit`; upstream `CLAUDE.md`/`AGENTS.md` overlay not consulted by upstream CI |
| Schema model | Ent (`backend/ent/schema/*.go`) | `api_keys` with `decimal(20,8)` quotas + `5h`/`1d`/`7d` rolling rate-limit windows + `ip_whitelist`/`blacklist` + `expires_at` + `status` + soft-delete via `mixins/`; `subscription_plan` + `redeem_code` + `payment_order` + `payment_audit_log` |
| Reference value for Axi | Gin → middleware → handlers → services → repositories → Ent → Postgres layering; 9,579-line `gateway_service.go`; 1,057-line `gateway_request.go`; 882-line `billing_service.go` (LiteLLM-compatible pricing tables + circuit breaker); `tlsfingerprint/` (uTLS mimicry — anti-pattern warning) | Three-tier API-key cache; OAuth onboarding + background refreshers; embed Vue SPA inside Go binary via `-tags embed` |

## Project Layout

```
sub2api/
├── AGENTS.md                        # Axi reference overlay
├── README.md / README.zh-CN.md      # upstream bilingual docs
├── README_CN.md / README_JA.md      # upstream extended translations
├── CLA.md                           # upstream CLA (contributor sign-off)
├── DEV_GUIDE.md                     # upstream fork dev notes
├── INDEX.md / PRD.md / TDD.md / TODO.md / MILESTONE.md / CHANGELOG.md
├── LICENSE / Makefile
├── Dockerfile / Dockerfile.goreleaser / .goreleaser.yaml
├── .goreleaser.simple.yaml          # release pipeline
├── assets/                          # sponsor logos etc.
├── backend/
│   ├── cmd/
│   │   ├── server/main.go           # binary entry, -setup/-version flags, embed VERSION
│   │   ├── server/wire.go + wire_gen.go
│   │   └── jwtgen/main.go           # one-shot JWT secret tool
│   ├── go.mod / go.sum
│   ├── .golangci.yml
│   ├── Makefile / Dockerfile
│   ├── config.yaml (~48 KB)         # full default config (embedded)
│   ├── ent/                         # generated ORM (220+ entity dirs)
│   │   ├── schema/                  # 33 source schemas (api_key, account, group, …)
│   │   └── (generated client per entity)
│   ├── internal/
│   │   ├── cmd/                     # unused, kept for future sub-commands
│   │   ├── config/                  # viper-based config loader
│   │   ├── domain/                  # cross-cutting domain constants
│   │   ├── handler/                 # HTTP/Gin handlers (user, admin, oauth, gateway)
│   │   │   └── admin/               # 50+ admin handlers (account, channel, payment, ops, …)
│   │   ├── integration/             # integration test fixtures
│   │   ├── middleware/              # request body limit, API key auth, rate limit
│   │   ├── model/                   # domain models mirror service structs
│   │   ├── payment/                 # provider-agnostic payment interface
│   │   │   └── provider/            # EasyPay, Alipay, WeChatPay, Stripe impls
│   │   ├── pkg/                     # cross-cutting utilities
│   │   │   ├── antigravity/ gemini/ geminicli/ googleapi/ claude/ openai/ openai_compat/
│   │   │   ├── oauth/ httpclient/ httputil/ proxyurl/ proxyutil/ tlsfingerprint/
│   │   │   ├── ctxkey/ errors/ ip/ logger/ pagination/ response/ timezone/ usagestats/ websearch/
│   │   ├── repository/              # Postgres repositories (Ent + raw SQL escape hatch)
│   │   ├── server/
│   │   │   ├── middleware/          # request id, ops error logger, inbound endpoint
│   │   │   └── routes/              # routes/{admin,auth,gateway,user,payment,common}.go
│   │   ├── service/                 # 271 non-test service files; core business logic
│   │   │   ├── prompts/             # codex_opencode_bridge.txt, tool_remap_message.txt
│   │   │   ├── openai_ws_v2/        # OpenAI realtime WS sub-package
│   │   ├── setup/                   # first-run wizard logic
│   │   ├── testutil/                # shared test helpers
│   │   ├── util/                    # logredact, responseheaders, urlvalidator
│   │   └── web/                     # embed.FS for compiled frontend dist
│   ├── data/                        # runtime data dir (logs, backups)
│   ├── resources/                   # embedded resources
│   └── migrations/                  # Atlas-managed Postgres schema migrations (172+ files)
├── frontend/                        # Vue 3.4 + Vite 5 + Tailwind
│   ├── src/
│   │   ├── api/                     # axios wrappers (admin/, public/, …)
│   │   ├── components/              # 14 component folders (admin/, auth/, charts/, common/, …)
│   │   ├── composables/             # reusable composition functions
│   │   ├── constants/ stores/ utils/ styles/ i18n/ types/
│   │   ├── views/                   # user/, admin/, auth/, public/, setup/
│   │   ├── router/                  # Vue Router 4
│   │   └── __tests__/               # vitest suites (unit + integration)
│   ├── audit.json / package.json / vite.config.ts / tailwind.config.js
│   ├── tsconfig*.json / vitest.config.ts
│   └── pnpm-lock.yaml
├── deploy/
│   ├── install.sh / docker-deploy.sh / build_image.sh
│   ├── docker-compose.yml / docker-compose.local.yml / docker-compose.dev.yml / docker-compose.standalone.yml
│   ├── docker-entrypoint.sh / config.example.yaml / Caddyfile
│   ├── *.service systemd units
│   └── sub2api.service
├── docs/
│   ├── PAYMENT.md / PAYMENT_CN.md / ADMIN_PAYMENT_INTEGRATION_API.md
│   ├── project-docs.manifest.json   # Axi overlay
│   └── logs/
└── tools/                           # (empty stub for future operator tooling)
```

## Build & Install

### Source build (upstream DEV_GUIDE.md §三)

```bash
# Backend (Go 1.25.7 per upstream CI; module declares 1.26.3)
cd backend
go test -tags=unit ./...            # unit tests
go test -tags=integration ./...     # integration tests (requires Postgres/Redis)
golangci-lint run ./...             # golangci-lint v2.7

# Frontend (pnpm only — npm breaks the lockfile)
cd ../frontend
pnpm install                        # populates pnpm-lock.yaml
pnpm run build                      # output to ../backend/internal/web/dist/
```

For a single-binary release that serves both UI and API:

```bash
cd backend
go build -tags embed -o sub2api ./cmd/server
./sub2api                           # listens on :8080 by default
./sub2api -setup                    # CLI setup wizard
./sub2api -version                  # prints embedded VERSION
```

The `-tags embed` flag is mandatory — without it the Vue dist tree is not bundled into the binary. The Dockerfile pins `golang:1.26.3-alpine`, `node:24-alpine`, and `postgres:18-alpine` for build-time parity.

### One-click install (deploy/install.sh, Linux only)

```bash
curl -sSL https://raw.githubusercontent.com/Wei-Shaw/sub2api/main/deploy/install.sh | sudo bash
# writes /opt/sub2api binary, systemd service, opens :8080 for the Setup Wizard
```

### Docker Compose (recommended in upstream README)

```bash
mkdir -p sub2api-deploy && cd sub2api-deploy
curl -sSL https://raw.githubusercontent.com/Wei-Shaw/sub2api/main/deploy/docker-deploy.sh | bash
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml logs sub2api | grep "admin password"
```

`docker-compose.local.yml` keeps Postgres/Redis data in bind-mounted host directories (`./postgres_data`, `./redis_data`, `./data`) so a single `tar czf` migrates a deployment.

### Reference-overlay verification (Axi)

```bash
for f in README.md README.zh-CN.md AGENTS.md CHANGELOG.md TODO.md MILESTONE.md INDEX.md PRD.md TDD.md; do
  test -f "/Volumes/code/workspace/references/short-term/sub2api/$f" || exit 1
done
rg -n "REQ-DOC-001|PRD|TDD|Milestone" \
  "/Volumes/code/workspace/references/short-term/sub2api/PRD.md" \
  "/Volumes/code/workspace/references/short-term/sub2api/TDD.md" \
  "/Volumes/code/workspace/references/short-term/sub2api/TODO.md" \
  "/Volumes/code/workspace/references/short-term/sub2api/MILESTONE.md" \
  "/Volumes/code/workspace/references/short-term/sub2api/INDEX.md"
```

## Verification

Reference overlay verification is documentation-only (see TDD.md §Verification Commands). The overlay does NOT mandate running the gateway; doing so requires live PostgreSQL 15+ and Redis 7+ which the workspace does not provide here.

Upstream unit/integration tests can be run inside `backend/`:

- `go test -tags=unit ./...` — does not require DB; tests pure service logic (account quota reset, sticky session, billing cache, etc.)
- `go test -tags=integration ./...` — pulls up Postgres and Redis via testcontainers-go modules; depends on `github.com/testcontainers/testcontainers-go/modules/postgres v0.40.0` and `…/redis v0.40.0` (declared in `backend/go.mod`).
- Frontend: `pnpm test` (vitest) covers `api/`, `composables/`, `i18n/`, `router/`, `stores/`, plus per-view `__tests__/integration/`.

CI surface (`backend-ci.yml`, `security-scan.yml`, `release.yml`) pins Go 1.25.7 and runs `govulncheck`, `gosec`, and `pnpm audit`; the upstream `CLAUDE.md`/`AGENTS.md` overlay is not consulted by upstream CI.

## Architecture Highlights

Sub2API is a **relay-platform monolith** organized as Gin → middleware → handlers → services → repositories → Ent → Postgres, with three background planes (Redis cache, cron jobs, OAuth token refreshers). The binary boots from `backend/cmd/server/main.go`: it parses `-setup`/`-version` flags, runs `setup.RunCLI()` or `setup.AutoSetupFromEnv()` on first launch, then enters `runMainServer()` which calls `setup.NeedsSetup()` to decide whether to spawn a temporary setup server. After setup completes, the main Gin engine binds to `:8080` and serves both the API and the embedded Vue SPA (`internal/web/dist`).

The **API-key authentication pipeline** is the single most important pattern for Axi to study. Every downstream-facing request — `/v1/messages`, `/v1/chat/completions`, `/v1/responses`, `/v1beta/...` — passes through `APIKeyAuthMiddleware` in `internal/server/middleware/`, which calls `APIKeyService.Authenticate`. `APIKeyService` (`backend/internal/service/api_key_service.go`, 883 lines) maintains a three-tier cache: an L1 `ristretto.Cache` of *compiled* auth entries (key, user, group, pre-parsed IP allowlist/blocklist), an L2 Redis cache for the same payload, and Postgres as the cold source. Hits skip almost all work because the IP rules are pre-compiled into `ip.CompiledIPRules`. Quota/rate-limit checks (`Quota`, `QuotaUsed`, `ExpiresAt`, `RateLimit5h`, `RateLimit1d`, `RateLimit7d`) are read from the cached `APIKey` struct so a hit costs roughly one ristretto `Get`. `GenerateKey()` produces 32 bytes of `crypto/rand` hex prefixed with `s.cfg.Default.APIKeyPrefix` (default `sk-`), making the keys indistinguishable from OpenAI/Anthropic conventions.

The **upstream account scheduler** (`service/account_service.go` + 4,000-line `service/gateway_service.go`, plus `service/account_group.go` for group bindings) implements sticky-session + load-factor account selection. Each `Account` row carries `Concurrency`, `Priority`, `RateMultiplier`, `LoadFactor`, status, schedulability, and a credentials blob keyed by platform (anthropic, openai, gemini, antigravity, codex, etc.). `gateway_service.go` exposes the public methods `Forward*` and the lower-level `selectAccount`, `isSchedulable`, and the per-protocol payload/stream transforms. Sticky sessions are anchored by either the request header `session_id` (Anthropic convention) or a deterministic hash of the model + a per-user nonce (OpenAI convention), and the Nginx docs explicitly call out `underscores_in_headers on;` because session_id headers carry underscores. When the active account fails, the **failover loop** in `handler/failover_loop.go` walks the candidate list, swapping accounts mid-stream if necessary; chat-completions streams are reconstructed as Anthropic-compatible or OpenAI-compatible depending on the caller's group platform.

The **billing layer** (`service/billing_service.go` plus `service/billing_cache_port.go`, `repository/billing_cache.go`) is a model-pricing-driven ledger. Each request records `prompt_tokens` / `completion_tokens` / cache creation / cache read, and billing translates them to USD using a `ModelPricing` table that supports the LiteLLM convention (per-token prices, priority tier prices, 5-minute vs 1-hour cache creation, long-context multipliers for `gpt-5.4` ≥ 272k tokens). `BillingCache` defines a single Redis-backed port (`GetUserBalance`/`DeductUserBalance`/`UpdateSubscriptionUsage`/`InvalidateAPIKeyRateLimit`), so the same service can be re-targeted to a different cache backend without touching call sites. `BillingCircuitBreaker` (`billing.circuit_breaker` config) deliberately fails closed on billing errors, which Axi should mirror to avoid token burn on broken quota tracking.

The **payment and subscription surface** shows the full subscription-as-a-service flow: `payment/` defines a generic provider interface, `payment/provider/` ships EasyPay, Alipay (`github.com/smartwalle/alipay/v3`), WeChatPay (`github.com/wechatpay-apiv3/wechatpay-go`), Stripe (`github.com/stripe/stripe-go/v85`), and Airwallex. `PaymentOrder` and `PromoCode` schemas support top-up, redeem codes, and promo discounts; `SubscriptionPlan` and `UserSubscription` schemas back recurring quota plans. The front-end `frontend/src/views/user/PaymentView.vue`, `StripePaymentView.vue`, `AirwallexPaymentView.vue`, and `WechatPaymentView.vue` (under `views/user/paymentUx.ts` / `paymentWechatResume.ts`) cover the user side, and `frontend/src/views/admin/orders/` plus `PromoCodesView.vue` cover the admin side. **`docs/ADMIN_PAYMENT_INTEGRATION_API.md`** documents the integration contract for new providers.

The **deployment and packaging story** is unusually thorough for an open-source project of this size: `Dockerfile` uses a four-stage build (frontend-builder → backend-builder → pg-client → alpine) with `libpq`/`zstd-libs`/`lz4-libs` so the runtime image can run `pg_dump`/`psql` for the bundled backup feature; `deploy/docker-compose.local.yml` uses bind mounts for trivial migration via `tar`; `.goreleaser.yaml` produces Homebrew tap formulae, Linux/Windows archives, deb/rpm/apk packages, and Docker images, with `publish_jobs` for an unattended release flow. The combination of an embed-everything binary, multi-arch goreleaser output, and a one-command Docker deploy makes the whole project a useful template for any Axi service that wants "one binary, multiple platforms, optional Docker".

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| 上游初次发布 | Pin | Pin: upstream `Wei-Shaw/sub2api` at (inferred from overlay) `01035c46 fix(runtime): require workspace lease for sub2api host port` |
| Axi reference-overlay 落地 | Shipped | `c8b87877 Normalize local reference milestone docs`, `6c81c308 Record reference milestone naming submit batch`, `e82440a0 Record submit log for sub2api batch`；overlay 文件 `AGENTS.md`、`INDEX.md`、`PRD.md`、`TDD.md`、`TODO.md`、`MILESTONE.md`、`CHANGELOG.md`、`docs/project-docs.manifest.json` 已就位 |
| Workspace governance provenance | Shipped | `dfbd0ec4 feat(governance): add relationship metadata declaration for provenance tracking` |
| Runtime lease guard | Shipped | `01035c46 fix(runtime): require workspace lease for sub2api host port` |
| 上游 CLA 引导 | Pin | `CLA.md`（上游 CLA 不含 moral-rights 条款）—— 上游贡献由 CLA 守门 |
| 本 checkout 上的 Axi 主动开发 | Not started | Checkout 为只读参考；除 overlay/文档规范化外（`f79c3998 Preserve milestone changes`、`180c0c42 Preserve todo changes`、`4110c7dd Preserve changelog changes`、`447fa87a Preserve readme zh cn changes`、`2e30e569 Preserve prd changes`、`ffbd6fac Preserve tdd changes`、`c6dd164a Preserve index changes`）无 Axi 主动 commit |

## Authoritative Documents

- `/Volumes/code/workspace/references/short-term/sub2api/README.md` — upstream product overview, demo URL, sponsor list, deployment matrix.
- `/Volumes/code/workspace/references/short-term/sub2api/README_CN.md` and `README_JA.md` — extended translations.
- `/Volumes/code/workspace/references/short-term/sub2api/DEV_GUIDE.md` — fork-specific dev notes: PostgreSQL config, pnpm vs npm gotchas, CI matrix.
- `/Volumes/code/workspace/references/short-term/sub2api/CLA.md` — upstream CLA (CLA-gated contributions).
- `/Volumes/code/workspace/references/short-term/sub2api/docs/PAYMENT.md` — payment provider integration manual.
- `/Volumes/code/workspace/references/short-term/sub2api/docs/ADMIN_PAYMENT_INTEGRATION_API.md` — payment admin API contract.
- Axi reference overlay: `AGENTS.md`, `INDEX.md`, `PRD.md`, `TDD.md`, `TODO.md`, `MILESTONE.md`, `docs/project-docs.manifest.json` — read in that order.

## Cross-References

- **Axi gateway/AI-bff 层（`foundation/axi-rules/rules/...` 与任何 `axi-gateway` 风格服务）** —— `internal/server/routes/gateway.go` 与 `service/gateway_service.go` 展示如何在单个 Gin engine 上注册 `/v1/messages`、`/v1/chat/completions`、`/v1/responses`、`/v1beta/...` 并按 group platform 派发。ADR-005（`agent-bff-ownership`）与 ADR-006（`gateway-taxonomy`）可与此布局直接对应。
- **Axi Spun-out Products / Dashboard Apps 的 API key 签发** —— `ent/schema/api_key.go`（`quota`、`quota_used`、`rate_limit_5h/1d/7d`、`ip_whitelist/blacklist`、`expires_at`、`status`、通过 `mixins/` 软删除）是最直接的 schema 参考，可用于任何铸造自有 `sk-...` style key 的 Axi 服务。
- **Subscription / quota ledger** —— `service/billing_service.go` + `ent/schema/{subscription_plan,user_subscription,redeem_code,payment_order,payment_audit_log}.go` 与 `payment/provider/` 适配器提供一套可运行的 subscription-as-a-service 蓝图（充值、兑换、月费、优惠）。这是对任何希望通过预付余额或月费套餐变现的 Axi 产品最可操作的参考。
- **多账号上游 relay（Codex / Claude / Gemini relay 服务）** —— `pkg/{claude,openai,gemini,antigravity,codex,geminicli}/`、`service/oauth_*`、`service/quota_*`、`service/{anthropic_session,gemini_session,openai_ws_v2}/` 记录如何在异构上游厂商间维护 sticky-session + failover + per-vendor OAuth refresh。Axi 不做第三方订阅 relay，但 per-vendor 抽象表面可复用于任何内部 vendor 集成。
- **OAuth onboarding + token refresh pattern** —— `service/auth_oauth_email_flow.go`、`service/auth_oauth_first_bind.go`、`service/auth_pending_identity_service.go` 与对应 `handler/auth_*_oauth.go` 记录 OAuth 状态机背后的“让用户登录一次，后台自动刷新”——可直接套用到 Axi 的第三方登录集成。
- **Tauri/Cockpit 风格桌面管理器（Cockpit Tools —— 兄弟参考）** —— 同样的 per-vendor-account 模式在 `cockpit-tools/src-tauri/src/modules/{codex_account,antigravity_*,windsurf_account,cursor_account,…}` 中实现；两份参考展示了同一概念问题（一个用户、多个第三方 AI 订阅、任一时刻只有一个活跃）的两种不同 *执行模型*（server-side relay vs client-side switcher）。
- **Docker / goreleaser 打包** —— `Dockerfile`（带 `libpq` 供内置 `pg_dump` 的 4 阶段构建）与 `.goreleaser.yaml` 是任何想要单二进制或带完整发布自动化的 Docker 镜像的 Axi 分发服务的清晰模板。
- **在 Go 二进制中内嵌 Vue SPA（`-tags embed`）** —— `internal/web/` embed 模式与 `embed.go` 胶水代码可复用于任何前端由后端 repo 拥有的 Axi 产品。
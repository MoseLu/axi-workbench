# Changelog

All notable local changes to Axi Workbench are tracked here.

## [Unreleased]

### Added

- 将 WorkBench 原生 Android 客户端收敛到 `apps/workbench-mobile/android`，纳入同一 monorepo 的 Kotlin/Compose 源码、Gradle 工程、测试、API 会话、扫码流程和统一六瓣十二色启动图标；Debug 构建固定对应 `com.workbench.mobile.debug`、版本 `1.0.8 (9)`。

- Added the Personal OS v0.1 Project Queue surface inside Workbench: a
  control-plane SQLite overlay, versioned queue/focus/project contracts,
  Today and Workbench routes, Inspector editing, explicit runtime/warning
  states, and a `personal-os-local` workspace profile. The first slice keeps
  resource-search, Agent dispatch, Flow and Library outside the active scope.

- Added the workflow-first `task-execution-routing/v1` execution boundary:
  typed `BOUNDED_AGENT` and `APPROVED_EFFECT` steps, durable digest-bound
  approvals, cancellation, route decisions and authenticated Agent lifecycle
  events. Generic HTTP steps and legacy Agent routes cannot bypass it.

- Added the machine-checked multi-surface capability inventory and `pnpm check:capabilities` admission gate. It requires every current/new user capability to state its allowed actions, data source/status, A/B/C/D level, Owner, server authorization/revalidation, idempotency, audit, handoff and unsupported surface.
- Added server-resolved domain approval scan contracts (`ApprovalScanPreview`, `MobileApprovalDecision`, `HandoffContext`), API-Gateway-only Mobile ingress, correlation-bound Web handoff continuation, schema/OpenAPI coverage, and audit/idempotency/revocation test coverage.
- Added DevSvc Hosted App execution-boundary metadata for Fleet, Coder and Verification Inbox so Host discovery exposes Owner, authorization, audit and fallback without duplicating D-level execution.

- Added ADR-0001 and the Go production API plane: ZITADEL-oriented Gin `api-gateway`, `identity-adapter`, modular `platform-core`, Dockerfiles, local role bootstrap, Helm chart, migration jobs, NetworkPolicy, PDB and ZITADEL values example.
- Added server-side Authorization Code + PKCE session handling, JWKS validation, Redis rate limiting, Redis-backed one-time QR transactions, SMTP verification adapters, EPS identity-link records, tenant/RBAC/preferences/dictionaries/projects/tasks/outbox modules and PostgreSQL RLS integration coverage.
- Added OTLP/HTTP trace export in gateway, identity-adapter and platform-core; an empty endpoint remains offline/no-op for local development while W3C trace context continues across services.
- Added tenant-scoped platform API client contracts; legacy Spring/H2 project endpoints are explicitly read-only compatibility hooks.

- Added a formal independent mobile application at `apps/workbench-mobile` with its own Vite entry, routes, header, tab bar, mobile pages, login surface, unit test, and UI boundary verifier.
- Added `@axi/workbench-foundation` to share only authentication session behavior and locale preference between the Web and mobile applications.
- Added the root documentation suite placeholders and governance entrypoints for README, AGENTS, INDEX, PRD, TDD, TODO, and milestone alignment.
- Added `docs/rules/axi-workbench-boundary-sop.md` and `pnpm check:boundaries` to block direct runtime coupling to neighboring project implementations.
- Added the read-only Axi Mobile project-intelligence projection: workspace health totals, attention items, project progress, capabilities, and allowlisted configuration groups.
- Expanded `docs/state/PRD.md` and `docs/state/TDD.md` with the v2 requirement set (`REQ-DOC-001/002`, `REQ-VERIFY-001/002`, `REQ-BOUNDARY-001/002`, `REQ-CONTROLPLANE-001`, `REQ-COMMUNICATION-001`, `REQ-WORKBENCH-001/002`, `REQ-MILESTONE-001`, `REQ-LOG-001`, `REQ-AXI-CODER-001`, `REQ-MOBILE-001`) and the matching TDD verification matrix.
- Linked every `REQ-*` row to the corresponding commands and tests captured in `docs/state/TODO.md` and `docs/state/TDD.md`.

### Changed

- 修正原生 Android 的启动链：移除旧的 Compose 蓝色方块 Loading，改用 `WorkBenchStartupGate` 统一绘制六瓣十二色 Logo、提示文案和 loading 动画；准备完成后移除不透明覆盖层进入已完成首帧的工作区。
- Android 12+ 系统 Splash 作为平台首帧预览，与 Compose Loading 的中心 Logo 对齐并无缝衔接；网关地址在 Compose Loading 内初始化，避免系统 Splash 停留过久或出现位置跳帧。

- `packages/ui` 的 Vitest 浏览器测试链统一到 `vitest` / `@vitest/browser-playwright` / `@vitest/coverage-v8` `4.1.11`，并将 Vite 更新到 `7.3.1`；移除失效的空 `eslint.config.js` 垫片，恢复 legacy ESLint 配置的可执行 lint 入口。`packages/ui` build、4 个测试文件共 13 个测试、lint 均通过；工作区 critical audit 为 0，仍有 10 个 `any` warnings。
- Replaced Mobile Home, Projects, Workspace and search showcase data with authenticated Control Plane projections. Unpaired, unauthorized and unavailable states now stay explicit rather than rendering static substitutes; Mobile keeps four persistent navigation items and the top Scan action.
- Revalidated the desktop workbench against official Ctrip eBooking, Jira, GitHub Projects, GitLab Operations and Shopify admin documentation. Removed the incorrectly added Web generic scanner from navigation, search and implementation; the legacy URL now safely returns to the dashboard. Web now exposes an actual Control Plane-backed “运行状态” work surface and a filterable “工作项” queue instead of a mobile-shaped scanner tool or fabricated metrics.
- Moved one-time OIDC QR confirmation to the separately named Mobile login-flow entry “确认网页登录”. The top Scan accepts only opaque `axi://approval/scan_*` domain approvals and sends only a decision, idempotency key and bound handoff correlation id.

- Reframed the multi-surface product contract from a simple Web/Mobile split into a role-oriented “control center / role-execution mobile / professional tool” architecture, grounded in bounded official public-product-shape research for 千牛、美团商家版、携程 eBooking and 飞猪商家中心. Added `REQ-ARCH-001`, `REQ-ACTION-001` and `REQ-REFERENCE-001`; all new user capabilities now require an A/B/C/D action policy, a target surface, service-side authorization/revalidation, audit and a fallback handoff. The research explicitly records observations, links and non-inferences rather than treating competitor features or internal architecture as Workbench facts.
- Set the product contract for Axi Workbench as a multi-surface admin system: Web is the complete backend-management primary surface; Mobile is the auxiliary management surface for personal context, alerts and constrained confirmations. The PRD records the actual four persistent Mobile navigation items plus top-level Scan action, keeps Identity login confirmation separate from Mobile approval scan, excludes generic Web scanning, and excludes the Host and vertical tools from the user-backend information architecture. Added `REQ-POSITION-001`, `REQ-SURFACE-001`, `REQ-WEB-001`, `REQ-WEB-002`, `REQ-MOBILE-001`, `REQ-MOBILE-002`, `REQ-CROSS-001`, `REQ-SCAN-001` and `REQ-DELIVERY-001` with a capability-ownership template and product-specific verification path.
- Added the canonical source catalog at `docs/architecture/source-catalog.md`, separating the two user workbench clients from the Host, hosted tools, vertical runtimes, nested CLI monorepo, and root pnpm workspace membership; root navigation now points to that catalog.
- Replaced browser local token/refresh handling with HttpOnly gateway sessions; apps use relative API paths in development and an explicit HTTPS gateway origin in production, while shared locale preference synchronizes with platform-core after authentication and retains a local offline cache.
- Reclassified `auth-service` and Spring/H2 `core-service` as migration compatibility only; the production Helm chart exposes only the Go gateway and its internal Go services.
- Hardened the Go API plane after independent review: access-token audience/scope checks, exact credentialed CORS origins, QR completion through the single gateway ingress, graceful server shutdown, SMTP TLS protection, migration-only configuration, protected Owner transitions, and leased/idempotent Outbox delivery.

- Restored the independent mobile application to the prior WeChat-inspired interaction system: centered title, search and plus menu, overview/project/workspace/scan/me navigation, green active state, badges, and a scan page. Web Axi Dashboard Chrome remains Web-only.
- Converted `apps/workbench` into the Web-admin-only application: the viewport-driven `MobileTopBar` / `MobileBottomNav` branch was removed, and the Web UI verifier now blocks its reintroduction.
- Replaced the previous single-SPA documentation policy with an explicit two-app policy: independent Web and mobile composition, shared foundation/API/contracts/tokens only.
- Documentation ownership is now explicit for `/Volumes/code/workspace/projects/axi-workbench`.
- Upgraded `docs/project-docs.manifest.json` to the verified v2 zero-context onboarding contract and added freshness governance to `TODO.md`.
- Replaced hard-coded Axi Notify mobile artifact paths in Axi Coder snapshots with environment-driven resolution and `workspace://` contract references.
- Mobile access-token issuance now requires a signed, single-use device nonce; pairing paths remain under `/mobile/v1` and existing response fields remain backward compatible.
- `docs/state/PRD.md` and `docs/state/TDD.md` updated on 2026-08-07 to reflect the current six-layer monorepo: workbench as the only user entrance, desktop host shell responsibilities, communication/control-plane contracts, and per-surface verification commands.

### Notes

- Product or implementation changes should add entries here when they affect users, operators, or downstream agents.
- The root `AGENTS.md` still describes the pre-v2 manifest as legacy; an authorized follow-up will reconcile that wording once the manifest refresh stabilizes.

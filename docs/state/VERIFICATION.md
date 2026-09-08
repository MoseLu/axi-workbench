# Axi Workbench Verification

## 2026-08-09 Web / mobile application split and PRD remediation

The user workbench is two independently runnable applications with an explicit ownership boundary:

- Web admin (`apps/workbench`, `http://127.0.0.1:5173`): `@axi/shell` Axi Dashboard Chrome, including sidebar, topbar actions, tabs, breadcrumbs, theme switch, and admin settings panel.
- Mobile app (`apps/workbench-mobile`, `http://127.0.0.1:5174`): its own Vite entry, header, tab bar, login surface, and mobile page composition. It does not import the Web application shell.
- Shared scope: `@axi/workbench-foundation` owns auth-session behavior and locale preference; API/contracts/tokens remain package contracts. No page, route, or layout is shared across the two applications.

### Commands

```bash
pnpm --filter @axi/workbench type-check
pnpm --filter @axi/workbench test
pnpm --filter @axi/workbench build
node apps/workbench/scripts/verify-ui-contracts.mjs
pnpm --filter @axi/workbench-foundation type-check
pnpm --filter @axi/workbench-mobile type-check
pnpm --filter @axi/workbench-mobile test
pnpm --filter @axi/workbench-mobile build
pnpm --filter @axi/workbench-mobile verify:contracts
pnpm check:boundaries
```

### Browser evidence

- At 1280×720 in the signed-in in-app browser, `:5173/admin/operations` rendered the desktop Axi Dashboard shell with grouped sidebar entries `概览 / 项目与工作 / 组织与访问 / 账号与设置`; the desktop child entries are `工作台概览 / 运行状态 / 项目组合 / 工作项`. No Mobile topbar or bottom navigation existed. The locally unavailable Control Plane rendered one explicit “运行状态暂不可用” state rather than zero-value metrics, a fake table or sample records.
- At the same desktop size, `:5173/admin/task` rendered the “工作项” table workspace with a task/project/approval search box and `全部 / 处理中 / 需处理 / 已结束` filters. With the Control Plane unavailable, it rendered one explicit unavailable state rather than placeholder rows. Browser checks found page content, no Vite error overlay and an empty captured console-error list.
- `:5173/admin/scan` now redirects to `:5173/admin/dashboard`; the redirected document contained no `video`, image-file input or canvas scanner nodes. The product navigation and global search do not expose a scanner entry.
- At a 390×844 mobile emulation, the unauthenticated Mobile workspace rendered “需要设备配对” rather than a static project sample or an endless loading state. Its persistent navigation contains only Home / Projects / Workspace / Me. The top “更多” menu exposes “扫一扫”, whose page is “审批扫码” and explicitly says it is not for web-login confirmation. `verify:contracts` separately asserts the four persistent items, the top Scan action, authenticated projection pages, and the independent Identity confirmation route; the request-timeout unit test covers an authenticated unavailable gateway becoming an explicit unavailable state.
- The Vite development proxy logged the expected Control Plane connection refusal while the UI converted it to the explicit unavailable state. The unavailable Control Plane is not replaced with a static substitute.

`node apps/workbench/scripts/verify-ui-contracts.mjs` remains blocked in this dirty checkout by the user-owned `packages/workbench-foundation/src/icons.ts` change from `logout: 'admin-logout'` to `logout: 'exit'`; its immutable baseline expects the former and this batch does not alter that file. The production build result for this remediation batch is recorded with its command output in the delivery commit; any existing non-blocking Rollup advisory remains distinct from functional acceptance.

## 2026-08 Go API plane

- API Gateway: go test -race ./... passed. Coverage includes single-use OIDC state, opaque HttpOnly sessions, access-token audience/scope enforcement, explicit credentialed CORS origins, rate limiting, spoofed-header removal, QR completion proxying, and W3C trace continuation.
- Identity adapter: go test -race ./... passed. QR ticket/poll/resume material is hashed; short-lived transactions use Redis with atomic replay prevention, email/EPS data remains PostgreSQL-backed, and a temporary local Mailpit instance accepted the required SMTP delivery smoke test.
- Platform Core: go test -race ./... passed. An isolated PostgreSQL test database was migrated with a dedicated BYPASSRLS account, queried through NOBYPASSRLS runtime credentials, and removed after the test. It proved API and direct-SQL denial of an admin downgrading another owner, plus zero visible cross-tenant rows.
- Helm strict lint and template passed, including the negative rendering check that an enabled Outbox worker without a delivery URL is rejected. The only lint note is Helm’s optional Chart icon recommendation.

Cluster-level acceptance is still pending an attached Kubernetes cluster, real ZITADEL issuer/client, SMTP credentials, and failure-injection environment; no production infrastructure was changed by this verification.

# Changelog

All notable local changes to Axi Workbench are tracked here.

## [Unreleased]

### Added

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

- Set the product contract for Axi Workbench as a multi-surface admin system: Web is the complete backend-management primary surface; Mobile is the auxiliary management surface for personal context, alerts and constrained confirmations. The PRD now separates Web's general scan/result handling from Mobile's approval scan confirmation, records the actual four persistent Mobile navigation items plus top-level Scan action, and excludes the Host and vertical tools from the user-backend information architecture. Added `REQ-POSITION-001`, `REQ-SURFACE-001`, `REQ-WEB-001`, `REQ-WEB-002`, `REQ-MOBILE-001`, `REQ-MOBILE-002`, `REQ-CROSS-001`, `REQ-SCAN-001` and `REQ-DELIVERY-001` with a capability-ownership template and product-specific verification path.
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

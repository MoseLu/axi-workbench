# Changelog

All notable local changes to Axi Workbench are tracked here.

## [Unreleased]

### Added

- Added a formal independent mobile application at `apps/workbench-mobile` with its own Vite entry, routes, header, tab bar, mobile pages, login surface, unit test, and UI boundary verifier.
- Added `@axi/workbench-foundation` to share only authentication session behavior and locale preference between the Web and mobile applications.
- Added the root documentation suite placeholders and governance entrypoints for README, AGENTS, INDEX, PRD, TDD, TODO, and milestone alignment.
- Added `docs/rules/axi-workbench-boundary-sop.md` and `pnpm check:boundaries` to block direct runtime coupling to neighboring project implementations.
- Added the read-only Axi Mobile project-intelligence projection: workspace health totals, attention items, project progress, capabilities, and allowlisted configuration groups.
- Expanded `docs/state/PRD.md` and `docs/state/TDD.md` with the v2 requirement set (`REQ-DOC-001/002`, `REQ-VERIFY-001/002`, `REQ-BOUNDARY-001/002`, `REQ-CONTROLPLANE-001`, `REQ-COMMUNICATION-001`, `REQ-WORKBENCH-001/002`, `REQ-MILESTONE-001`, `REQ-LOG-001`, `REQ-AXI-CODER-001`, `REQ-MOBILE-001`) and the matching TDD verification matrix.
- Linked every `REQ-*` row to the corresponding commands and tests captured in `docs/state/TODO.md` and `docs/state/TDD.md`.

### Changed

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

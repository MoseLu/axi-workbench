# Changelog

All notable local changes to Axi Workbench are tracked here.

## [Unreleased]

### Added

- Added the root documentation suite placeholders and governance entrypoints for README, AGENTS, INDEX, PRD, TDD, TODO, and milestone alignment.
- Added `docs/rules/axi-workbench-boundary-sop.md` and `pnpm check:boundaries` to block direct runtime coupling to neighboring project implementations.
- Added the read-only Axi Mobile project-intelligence projection: workspace health totals, attention items, project progress, capabilities, and allowlisted configuration groups.

### Changed

- Documentation ownership is now explicit for `/Volumes/code/workspace/projects/axi-workbench`.
- Upgraded `docs/project-docs.manifest.json` to the verified v2 zero-context onboarding contract and added freshness governance to `TODO.md`.
- Replaced hard-coded Axi Notify mobile artifact paths in Axi Coder snapshots with environment-driven resolution and `workspace://` contract references.
- Mobile access-token issuance now requires a signed, single-use device nonce; pairing paths remain under `/mobile/v1` and existing response fields remain backward compatible.

### Notes

- Product or implementation changes should add entries here when they affect users, operators, or downstream agents.

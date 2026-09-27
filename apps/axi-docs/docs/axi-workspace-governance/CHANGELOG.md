# Changelog

All notable changes to Axi Workspace Governance are documented here.
Format: [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- 2026-06-07: `docs/audits/workspace-i18n-audit-2026-06-07.md` 与 `workspace-docs-gap-audit-2026-06-07.md` 审计产物
- 2026-06-07: 8 个子代理 i18n 审计 (`/tmp/audit-{A..H}.md`) 完成
- 2026-06-07: 16 份 `docs/project-docs.manifest.json` 创建
- 2026-06-07: 根工作区 `CONTRIBUTING.md` / `SECURITY.md` 创建
- 2026-06-07: 治理侧 `CHANGELOG.md` / `RELEASING.md` / `CODEOWNERS` 创建（本文件）

### Changed
- 2026-05-27: Axi-owned active roots 已物理合并到 3 个 monorepos（`projects/axi-workbench` / `projects/axi-agent-platform` / `projects/axi-notify`），详见 `docs/axi/AXI_FUNCTION_MERGE_TODO.md`
- 2026-05-27: `references/archives` 清理（6.8G → 空目录），详见 `docs/inventory/ARCHIVES_PRUNE_2026-05-27.md`

### Deprecated
- 旧 Axi-owned standalone roots（`axi-devsvc-dashboard` / `axi-coder` / `axi-verification-inbox` / `app-search-system` / `axi-workstation` / `fleet-console` / `axi-agent-mcp` / `axi-agent-transport` / `codex-remote-bridge` / `axi-app-cli` / `axi-todo` / `android-workspace-app` / `feiyu-agentflow`）—— 已被合并到 Axi canonical projects

## [0.1.0] - 2026-05-22

### Added
- 初始治理仓库骨架：`workspace.json` + `docs/{README,project-catalog,project-completion,repo-topology,ownership-matrix,integration-map}.md`
- ADR-001 / ADR-002 占位

[Unreleased]: https://github.com/axiomaticworld/axi-workspace-governance/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/axiomaticworld/axi-workspace-governance/releases/tag/v0.1.0

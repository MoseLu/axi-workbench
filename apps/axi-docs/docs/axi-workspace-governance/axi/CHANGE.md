# axi-accounts Change Log

This file is a placeholder created by the workspace-remediation
2026-08-23 batch so handoff-check has a real anchor for
`documents.change` and `decisions.changelog`. The substantive
change history lives in the git commit log; this file should
be replaced by the project owner with a curated change log.

## 2026-09-08 — i18n Axi 公理化标识规则

### Added

- Added i18n Axi naming rule to `AXIOMATICWORLD_NAMING.md` and its zh-CN mirror.
  Rule: "Axi" as a brand prefix is **never translated** in any locale.
  User-facing strings must use i18n keys; the "Axi" portion stays as-is in both
  `zh-CN` and `en-US` locales (e.g., `nav.axiApps` maps to "Axi 应用" / "Axi Apps").

- Fixed hard-coded "Axi 应用" / "Axi 资源" in `axi-workbench/devsvc-dashboard`
  `navGroups` labels and `AxiResourcesPage` column titles.

- Fixed hard-coded "Axi 应用" breadcrumb in `axi-todo` `TodoDashboard`.

- Fixed hard-coded brand labels in `axi-workbench/fleet-console`
  `fleet-shell.tsx` and `App.tsx`.

- Fixed hard-coded legal document strings in `axi-workbench/workbench`
  `LegalDocument.tsx`.

- Fixed hard-coded `aria-label` in `axi-workbench/workbench-mobile`
  `LoginPage.tsx`.

- Added zh-CN locale to `axi-sports-management-app` (was `en-US` only).

- Created i18n infrastructure for `axi-todo` (new `app/i18n/` module with
  `zh-CN.json` / `en-US.json` locales and `t()` function).

- Created i18n infrastructure for `axi-workbench/fleet-console` (new `i18n/`
  module with `zh-CN.json` / `en-US.json`).

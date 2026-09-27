# `@epap/ui` — legacy layout stack

**Status:** legacy (retained for compatibility/reference; no active runtime consumer in
`apps/workbench` after the 2026-09-13 dead-consumer cleanup).

## Policy

- **Do not** start new dashboard apps on `@epap/ui`.
- **Do** use `shared/axi-ui` packages (`@axi/shell`, `@axi/core`, `@axi/tokens`, …) for new shell/host UI — same stack as `apps/devsvc-dashboard` and `apps/axi-coder`.
- Bugfixes and minimal styling for `apps/workbench` are allowed.
- Large feature work on AppLayout / TabBar / Topbar here should be rejected or re-homed to `@axi/*`.

## Consumers

- No active Web runtime consumer.
- Historical `Sidebar.tsx` / `TabBar.tsx` files were not part of the live
  `AxiDashboardShell` render chain and were removed from `apps/workbench`.
- Keep this package until the repository-wide compatibility/reference policy
  explicitly retires it; do not start new consumers here.

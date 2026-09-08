# `@epap/ui` — legacy layout stack

**Status:** legacy (still required by `apps/workbench` / `@axi/workbench` only).

## Policy

- **Do not** start new dashboard apps on `@epap/ui`.
- **Do** use `shared/axi-ui` packages (`@axi/shell`, `@axi/core`, `@axi/tokens`, …) for new shell/host UI — same stack as `apps/devsvc-dashboard` and `apps/axi-coder`.
- Bugfixes and minimal styling for `apps/workbench` are allowed.
- Large feature work on AppLayout / TabBar / Topbar here should be rejected or re-homed to `@axi/*`.

## Consumers (keep until migrated)

- `apps/workbench` (`@axi/workbench`) only.

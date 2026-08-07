# Archive — retired monorepo surfaces

These trees are **not** pnpm workspace members and must not be imported by
active apps/services.

| Path | Former path | Why archived (2026-08-06) |
|------|-------------|---------------------------|
| `legacy-packages-web/` | `packages/web` | Clone of the web portal; package name collided as `web-portal` with root turbo filters, so `pnpm dev:web` / `build:web` could target the clone instead of `apps/web-portal` (`@epap/web-portal`). Zero workspace consumers. |
| `legacy-packages-desktop/` | `packages/desktop` | Early Mini-Agent / xterm desktop shell on `@epap/ui`. Superseded by `apps/axi-coder` (hosted under DevSvc dashboard, `@axi/shell`). Zero workspace consumers. |

## Do not

- Re-add these folders under `packages/` without a deliberate migration plan.
- Wire them into `pnpm-workspace.yaml`.
- Use them as the target of root `dev:*` / `build:*` scripts.

## Active replacements

| Need | Use |
|------|-----|
| Browser portal | `apps/web-portal` (`@epap/web-portal`) |
| Dashboard host + local ops | `apps/devsvc-dashboard` + `@axi/*` from `shared/axi-ui` |
| Coding / terminal workbench | `apps/axi-coder` |
| Shared layout chrome (new work) | `shared/axi-ui` (`@axi/shell`, `@axi/core`, …) |
| Temporary EPAP layout (portal only) | `packages/ui` (`@epap/ui`) — **legacy**, freeze non-bugfix work |

Restore only by copying out of this archive for historical comparison.

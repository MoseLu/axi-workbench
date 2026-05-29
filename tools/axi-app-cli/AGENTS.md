# Axi App CLI Agent Notes
Last updated: 2026-04-03 16:20:58 +08:00

## Repo Summary

- Treat this repository as the scaffolder workspace, not as the generated application.
- The repo itself is a `pnpm workspace` monorepo centered on `apps/cli`, shared scaffold packages, foundation packages, and feature packages.
- Preserve the generated-project default contract: `Vite + React + TypeScript + Zod`, Flask, Style Dictionary, SCSS, feature-based layout, Git hooks, PRD/TDD docs, and 80% coverage gates.

## Workspace Map

- `apps/cli`: CLI shell and publish target.
- `packages/scaffold-kit`: shared contracts and helpers for workspace packages.
- `packages/scaffold-registry`: module registry and preset policy assembly.
- `packages/scaffold-runtime`: command runtime, sync/doctor/install pipeline, and file orchestration.
- `packages/foundation-web`: web shell and branding foundation modules.
- `packages/foundation-api`: Flask baseline and sample API foundation modules.
- `packages/foundation-design`: token package and Style Dictionary foundation modules.
- `packages/foundation-ops`: workspace bootstrap, governance, docs, and resource foundation modules.
- `packages/feature-*`: installable extension families split into dedicated workspace packages.

## Public CLI Surface

- Keep the public CLI surface centered on `axi init`, `create-axi-app <name>`, `axi add`, `axi sync`, `axi list`, and `axi doctor`.
- Keep `list --json`, `doctor --json`, and `doctor --fix` stable for automation and contract testing.

## Working Agreements

- Favor deterministic templates and thin orchestration code over hidden magic.
- Add or change generated files through the template layer so tests can assert the full project shape.
- Treat `.axi/modules.json` as the editable module policy and `.axi/scaffold.manifest.json` as the applied snapshot.
- Keep docs, runtime behavior, and preset policy aligned so the generated app stays explainable and repairable.
- Keep package seams strict: `foundation-*` and `feature-*` may depend only on `@axi/scaffold-kit`, `scaffold-registry` is the only assembly layer, `scaffold-runtime` is the only execution layer, and `apps/cli` must only depend on `@axi/scaffold-runtime`.
- Treat `docs/architecture/capability-package-standard.md`, `docs/architecture/package-boundaries.md`, `pnpm capabilities:check`, and `pnpm workspace:check` as hard constraints when adding or reshaping workspace packages.
- Bootstrap new workspace packages with `pnpm package:new -- --kind <...> --name <...>` instead of hand-copying old folders.
- This workspace sits under a parent governance repo that ignores `projects/*`, so repo-summary tooling must fall back to filesystem change detection unless this project gets its own git root.

## Current Focus

- Continue `v1.0 Hardening` work around runtime command classes, lifecycle phases, typed contributions, and CLI bootstrap boundaries.
- Keep the monorepo package split reflected consistently across product docs, architecture docs, and generated governance files.
- Use `docs/` for architecture/product/research material and `docs/todo/` for child TODO plans that roll up into the root task list.

## Latest Sync Notes

- Package-boundary work is now codified in `docs/architecture/package-boundaries.md` and enforced by `pnpm boundaries:check`.
- Capability-package authoring rules are now codified in `docs/architecture/capability-package-standard.md`, local package `README.md` files, and `pnpm capabilities:check`.
- `scripts/new-workspace-package.mjs` and `pnpm package:new` now provide a repo-native bootstrap path for new app, contract, orchestration, foundation, and feature packages.
- Recent scaffold work also expanded `feature-ui` with additional starter primitives such as `Alert`, `Modal`, `Drawer`, `Progress`, `Tabs`, `Tooltip`, `Skeleton`, and `FormField`.

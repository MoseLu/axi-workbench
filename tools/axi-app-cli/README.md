# Axi App CLI

`axi-app-cli` is now a `Git monorepo + pnpm workspace` for the Axi scaffolder itself. The repo contains:

This is the canonical workspace tool location at `/Volumes/code/workspace/projects/axi-workbench/tools/axi-app-cli`.
Generated React applications consume the published Axi runtime packages
`@axi/tokens`, `@axi/core`, and `@axi/shell` from the local `@axi` registry.
Generated web apps also include an `apps/web/src/app/axi.app.ts` manifest and
consume `AXI_APP_BASE` / `AXI_HOSTED_APP` so Axi Dashboard can host them without
asking users to pick a port.

- `apps/cli`: the publishable CLI entrypoint
- `packages/scaffold-kit`: shared feature contracts and helpers
- `packages/scaffold-registry`: layered module registry and preset policy assembly
- `packages/scaffold-runtime`: CLI runtime, sync/doctor/install orchestration, and file writes
- `packages/foundation-web`: web shell, branding, and frontend template generation
- `packages/foundation-api`: Flask baseline and sample API template generation
- `packages/foundation-design`: token package and Style Dictionary template generation
- `packages/foundation-ops`: workspace, docs, governance, and resource foundation modules
- `packages/feature-theme`: theme runtime and preset modules
- `packages/feature-ui`: UI and style-system modules
- `packages/feature-hooks`: shared hooks extension modules
- `packages/feature-experimental`: experimental module slots

The generated project is also a monorepo. It bootstraps:

- `Vite + React + TypeScript + Zod`
- `Flask + pytest`
- `Style Dictionary + SCSS`
- feature-based project layout
- PRD/TDD governance, Git hooks, and coverage gates

## Local Development

```bash
pnpm install
pnpm package:new -- --kind feature --name auth
pnpm capabilities:check
pnpm boundaries:check
pnpm workspace:check
pnpm check:file-lines
pnpm build
pnpm test
```

The line audit caps maintained source and style files at 600 lines. Generated
template sources under `src/templates/generated-*`, build output, and runtime
test fixtures are outside that guard.

Use the local CLI during development:

```bash
pnpm --filter axi-app-cli dev -- init --cwd C:\path\to\empty-folder --yes --no-install --no-verify
pnpm --filter axi-app-cli dev -- create demo --cwd C:\path\to\workspace --yes --no-install --no-verify
pnpm --filter axi-app-cli dev -- add ui-components hooks-pack --cwd C:\path\to\workspace\demo --no-install
pnpm --filter axi-app-cli dev -- sync --cwd C:\path\to\workspace\demo --no-install
pnpm --filter axi-app-cli dev -- list --cwd C:\path\to\workspace\demo
pnpm --filter axi-app-cli dev -- doctor --cwd C:\path\to\workspace\demo
```

The root script remains as a shortcut:

```bash
pnpm dev -- init --cwd C:\path\to\empty-folder --yes --no-install --no-verify
pnpm dev -- create demo --cwd C:\path\to\workspace --yes --no-install --no-verify
pnpm dev -- add ui-components hooks-pack --cwd C:\path\to\workspace\demo --no-install
pnpm dev -- sync --cwd C:\path\to\workspace\demo --no-install
pnpm dev -- list --cwd C:\path\to\workspace\demo
pnpm dev -- doctor --cwd C:\path\to\workspace\demo
pnpm dev -- list --json --cwd C:\path\to\workspace\demo
pnpm dev -- doctor --json --cwd C:\path\to\workspace\demo
pnpm dev -- doctor --fix --cwd C:\path\to\workspace\demo
```

## Scope

- `axi init`: scaffold the current directory
- `create-axi-app <name>`: scaffold a new directory
- `axi add <feature-id>`: append extension or experimental modules
- `axi sync`: re-apply the scaffold from `.axi/modules.json`
- `axi list`: inspect layered module status for the current scaffold
- `axi doctor`: validate module state, drift, and managed files
- `axi list --json`: emit machine-readable module inventory
- `axi doctor --json`: emit machine-readable diagnostics with exit code 1 on failure
- `axi doctor --fix`: normalize module policy and run a safe `sync` repair before reporting
- mode A: interactive confirmations for each key step
- mode B: `--yes` for the recommended defaults with install and verification
- `.axi/modules.json`: editable layered module policy
- `.axi/scaffold.manifest.json`: applied snapshot used for cleanup and reconciliation

The generated project intentionally stays minimal. It gives structure, guardrails, and starter tests without locking in business modules.

## Architecture At a Glance

Axi is not intended to be a one-shot template generator. The CLI keeps a generated project understandable and repairable by separating command entrypoints, runtime orchestration, registry assembly, capability packages, and persisted state.

```text
apps/cli
  -> @axi/scaffold-runtime
     -> @axi/scaffold-registry
        -> foundation-* and feature-* packages
           -> generated files + managed state in .axi/
```

- `apps/cli` is a thin binary wrapper that exposes `axi` and `create-axi-app`.
- `@axi/scaffold-runtime` owns command parsing, context resolution, planning, file writes, install/verify, and the `list` / `doctor` / `sync` control loop.
- `@axi/scaffold-registry` is the only assembly layer. It combines preset defaults, module manifests, dependency expansion, and final enabled module resolution.
- `foundation-*` packages provide the non-optional project base: workspace, docs, web, API, and design tokens.
- `feature-*` packages add optional extension and experimental capability without coupling those modules to the runtime core.

### State Model

Axi keeps project state explicit instead of hiding it in generated files:

- `.axi/modules.json`: desired module policy edited by the user or by safe repair flows
- `.axi/scaffold.manifest.json`: last applied snapshot used for drift detection, cleanup, and reconciliation
- `axi sync`: replays the desired policy into generated output
- `axi doctor`: explains drift, missing managed files, dependency problems, and safe next actions

### Design Direction

Current modules primarily contribute generated files, but the architecture is intentionally moving toward typed contributions so modules can add:

- templates and doc fragments
- doctor checks and sync transforms
- warmups and future command extensions

This keeps the CLI core small while allowing the scaffold surface to grow through modules.

## Workspace Layout

- `apps/cli`: thin binary wrapper around `@axi/scaffold-runtime`
- `packages/scaffold-kit`: shared types, feature factory, and serialization helpers
- `packages/scaffold-registry/src`: module registry assembly and preset defaults
- `packages/scaffold-runtime/src`: CLI orchestration, prompts, install pipeline, sync, doctor, and file IO
- `packages/foundation-web/src`: web shell and branding foundation modules
- `packages/foundation-api/src`: Flask app factory and sample API foundation modules
- `packages/foundation-design/src`: token package and Style Dictionary foundation modules
- `packages/foundation-ops/src`: workspace bootstrap, governance docs, hooks, and resource script generation
- `packages/feature-theme/src`: theme runtime and preset extension modules
- `packages/feature-ui/src`: UI and style-system extension modules
- `packages/feature-hooks/src`: hooks extension modules
- `packages/feature-experimental/src`: isolated experimental modules
- `packages/scaffold-runtime/tests`: scaffold contract tests

## Boundary Rules

This workspace is decoupled by direction:

- `foundation-*` and `feature-*` packages do not depend on each other
- those capability packages may depend only on `@axi/scaffold-kit`
- `@axi/scaffold-registry` is the only assembly layer for capability packages
- `@axi/scaffold-runtime` depends on `@axi/scaffold-registry` and `@axi/scaffold-kit`
- `apps/cli` depends only on `@axi/scaffold-runtime`

Run `pnpm boundaries:check` to validate package manifest dependencies and internal `@axi/*` imports against that rule set.
Run `pnpm capabilities:check` to enforce package README sections, required manifest fields, and allowed package-class dependency shapes.
Use `pnpm workspace:check` as the default architecture guard.
Use `pnpm package:new -- --kind <app|contract|registry|runtime|foundation|feature> --name <slug>` to bootstrap a new workspace package that already follows the package standard.

## Design Docs

- `docs/research/claude-code-sourcemap-analysis.md`
- `docs/product/axi-cli-v1-prd.md`
- `docs/product/cli-product-principles.md`
- `docs/product/command-ux-specification.md`
- `docs/architecture/axi-cli-v1-implementation-plan.md`
- `docs/architecture/axi-cli-v1-engineering-task-breakdown.md`
- `docs/architecture/module-contribution-schema.md`
- `docs/architecture/capability-package-standard.md`
- `docs/architecture/package-boundaries.md`
- `docs/architecture/runtime-lifecycle-specification.md`
- `docs/todo/`: child TODO plans that roll up into the root `TODO.md`

# Package Boundaries

This workspace is decoupled by **direction**, not by pretending every package has zero dependencies.

The hard rule is:

- capability packages do not depend on each other laterally
- orchestration packages depend downward on capability packages
- the CLI app depends only on the runtime package

That gives us clean package seams without lying about how the scaffold is assembled.

## Dependency Model

```text
apps/cli
  -> scaffold-runtime
      -> scaffold-registry
          -> foundation-*
          -> feature-*
      -> scaffold-kit

foundation-* -> scaffold-kit
feature-*    -> scaffold-kit
scaffold-kit -> no workspace package
```

## Allowed Workspace Dependencies

| Package | Responsibility | Allowed workspace deps |
| --- | --- | --- |
| `apps/cli` | Published binary and thin command entrypoint | `@axi/scaffold-runtime` |
| `packages/scaffold-kit` | Shared contracts, feature factory, shared helpers | none |
| `packages/foundation-web` | Web shell, branding, frontend scaffold files | `@axi/scaffold-kit` |
| `packages/foundation-api` | Flask shell and backend scaffold files | `@axi/scaffold-kit` |
| `packages/foundation-design` | Token source, Style Dictionary, SCSS output templates | `@axi/scaffold-kit` |
| `packages/foundation-ops` | Governance docs, hooks, resource scripts, workspace bootstrap | `@axi/scaffold-kit` |
| `packages/feature-theme` | Theme runtime and preset extensions | `@axi/scaffold-kit` |
| `packages/feature-ui` | Optional UI primitives and style-system extensions | `@axi/scaffold-kit` |
| `packages/feature-hooks` | Optional shared hooks extensions | `@axi/scaffold-kit` |
| `packages/feature-experimental` | Experimental module shells | `@axi/scaffold-kit` |
| `packages/scaffold-registry` | Registry assembly and preset policy | `@axi/scaffold-kit`, all `foundation-*`, all `feature-*` |
| `packages/scaffold-runtime` | CLI runtime, sync, doctor, install, rendering orchestration | `@axi/scaffold-kit`, `@axi/scaffold-registry` |

## Forbidden Couplings

- `foundation-*` packages must not import any other `foundation-*` package.
- `feature-*` packages must not import any other `feature-*` package.
- `feature-*` packages must not import `foundation-*` packages.
- capability packages must not import `scaffold-registry`, `scaffold-runtime`, or `apps/cli`.
- `apps/cli` must not import `foundation-*` or `feature-*` packages directly.
- `scaffold-runtime` must not bypass `scaffold-registry` to reach capability packages directly.

## Why This Boundary Exists

- `scaffold-kit` is the only shared contract layer.
- `foundation-*` and `feature-*` stay swappable because they contribute files and manifests, not direct code coupling.
- `scaffold-registry` is the only assembly point for capability packages.
- `scaffold-runtime` is the only execution layer for CLI behavior.
- `apps/cli` remains a publishable shell and can be replaced without rewriting the scaffold graph.

## Generated Project vs Workspace

Do not confuse the scaffold workspace with the generated project:

- this repository uses package boundaries to keep the scaffolder maintainable
- generated projects are free to have their own `apps/*` and `packages/*` dependency graph

Those are separate concerns. The workspace here enforces authoring boundaries for the scaffolder itself.

## Enforcement

Run:

```bash
pnpm boundaries:check
```

This checks:

- workspace package manifest dependencies
- internal `@axi/*` source imports

If a package starts importing across a forbidden seam, the check must fail before the boundary drift becomes architecture debt.

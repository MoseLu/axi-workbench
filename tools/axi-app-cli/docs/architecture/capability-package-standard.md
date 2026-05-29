# Capability Package Standard

This document defines the required shape for scaffold capability packages in this workspace.

It is not optional guidance. New packages must follow it before they can be treated as part of the scaffold platform.

## Package Classes

The workspace uses four package classes:

- `app`: publishable entrypoints such as `apps/cli`
- `contract`: shared contracts and helpers, currently `packages/scaffold-kit`
- `capability`: installable capability families, currently `packages/foundation-*` and `packages/feature-*`
- `orchestration`: assembly and execution layers, currently `packages/scaffold-registry` and `packages/scaffold-runtime`

## Required Files

Every workspace package must contain:

- `package.json`
- `README.md`
- `src/`

`README.md` is mandatory because package boundaries are owned locally, not only in root docs.

## Bootstrap Command

Use the repository bootstrap command when creating a new workspace package:

```bash
pnpm package:new -- --kind feature --name auth
pnpm package:new -- --kind foundation --name resource-runtime
pnpm package:new -- --kind app --name docs-cli
```

The command writes:

- `package.json`
- `README.md`
- `tsconfig.json`
- `src/index.ts` for non-app packages
- `src/cli.ts` and `tsup.config.ts` for app packages

Do not start new packages by copying old folders by hand unless you are intentionally preserving history.

## Required README Sections

Every package README must include:

- `## Role`
- `## Allowed Workspace Dependencies`
- `## Owns`
- `## Must Not Do`

These sections are intentionally short. The goal is local boundary clarity, not prose volume.

## Required Manifest Fields

Every workspace `package.json` must have:

- `name`
- `version`
- `description`
- `type: "module"`
- `files: ["dist"]`

Expected scripts:

- all packages: `build`, `typecheck`
- runtime package: also `test`
- CLI app: also `dev`

## Dependency Rules

### Contract Layer

- `@axi/scaffold-kit` must not depend on any workspace package

### Capability Layer

- `foundation-*` packages may depend only on `@axi/scaffold-kit`
- `feature-*` packages may depend only on `@axi/scaffold-kit`
- capability packages must not depend on each other
- capability packages must not depend on orchestration packages

### Orchestration Layer

- `@axi/scaffold-registry` assembles capability packages
- `@axi/scaffold-runtime` executes commands and may depend only on `@axi/scaffold-kit` and `@axi/scaffold-registry`

### App Layer

- `apps/cli` may depend only on `@axi/scaffold-runtime`

## Ownership Rules

Packages must own one clear responsibility:

- `foundation-*`: baseline scaffold families
- `feature-*`: optional extension families
- `scaffold-registry`: capability graph assembly
- `scaffold-runtime`: command runtime and file orchestration
- `scaffold-kit`: shared contracts only
- `apps/cli`: binary wrapper only

If a change needs two responsibilities, the seam is probably wrong.

## Decoupling Rule

The workspace is decoupled by **vertical composition**:

- capability packages are isolated from one another
- orchestration packages compose them
- the CLI shell stays thin

Do not claim “all packages are independent” if runtime assembly clearly requires directional dependencies. That would be false. The enforceable rule is: no forbidden lateral coupling.

## Enforcement

Run:

```bash
pnpm capabilities:check
pnpm boundaries:check
pnpm workspace:check
```

Use `workspace:check` as the default architecture guard before merges that touch package structure.

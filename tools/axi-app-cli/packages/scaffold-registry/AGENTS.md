# Package Notes
Last updated: 2026-04-03 16:33:20 +08:00
Parent: [AGENTS.md](../../AGENTS.md)
Scope: packages/scaffold-registry

## Role

- Assemble `foundation-*` and `feature-*` packages into a single capability graph.
- Own preset policy, dependency expansion, and default module selection.

## Local Constraints

- Depend only on `@axi/scaffold-kit` plus capability packages.
- Do not prompt users, install dependencies, or write project files.
- Keep module assembly deterministic; runtime decisions must stay in `@axi/scaffold-runtime`.
- Capability packages must remain swappable through this layer without lateral package coupling.

## Current Focus

- Keep registry composition clear while typed contribution work replaces module-specific runtime assumptions.
- Preserve a single assembly seam so future capability packages can be added without changing CLI code paths.

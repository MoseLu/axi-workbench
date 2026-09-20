# Axi Docs

Axi Docs is the workspace documentation hub for Axi projects. It combines a Vite React reader, local knowledge source adapters, and an MCP document bus so humans and agents can inspect the same project, skill, and workspace documentation surfaces.

## Scope

- `app/` owns the React/Vite app, MCP server, source adapters, tests, and build pipeline.
- `plans/` is the root-level planning entrypoint for agents inspecting the current directory.
- `docs/content/en/` and `docs/content/zh/` own the product documentation pages rendered by the app, including `guide/`, `plans/`, and `projects/`.
- `docs/content/{en,zh}/plans/` is the source of truth for durable idea-to-landing plans; Axi Todo owns execution state and next actions.
- `docs/axi-workspace-governance/` is a local mirror of workspace governance docs; treat the workspace governance repo as the source.
- `docs/project-docs.manifest.json` records the project documentation contract.
- `.claude/PARADIGM.md` and `.claude/ARCHITECTURE.md` define the project-level deep-init contract.

## Verification

```bash
pnpm --dir app docs:check
pnpm --dir app source:check
pnpm --dir app verify
```

Use `pnpm --dir app test:run` for targeted implementation changes and `pnpm --dir app build` before claiming UI or packaging readiness.

## Source Boundaries

Axi Skills is intentionally consumed through `docs/sources.lock.json`, not a git submodule. Workspace project metadata is consumed through `/Volumes/code/workspace/WORKSPACE_INDEX.md` and `/Volumes/code/workspace/workspace.graph.json`.

<!-- MANUAL: keep this README as the short project entrypoint; put implementation details in app/README.md and app/AGENTS.md. -->

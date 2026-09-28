# Workspace Scripts

Workspace-level CLIs and wrappers, organized by responsibility.

`/Volumes/code/workspace` is a container, not a git repository or code ownership
unit. Files under `scripts/` are root launcher shims and local coordination
entrypoints. Durable implementation changes should live in the owning project or
`foundation/workspace-governance`, then be exposed here only when a root-level
entrypoint is required.

## Layout

| Subdirectory | Purpose | Entry point |
| --- | --- | --- |
| `runtime/` | Node 22 wrapper and runtime setup | `runtime/run-node22-command.sh`, `runtime/setup-node22-runtime.sh` |
| `service/devsvc/` | PM2-backed dev service cluster (services, dashboard, alerts, topology) | `service/devsvc/devsvc` |
| `governance/` | Workspace graph queries and project catalog validation | `governance/workspace-project`, `governance/workspace-project-mcp` |
| `utility/` | Reserved for ad-hoc helpers (currently empty) | — |

## Quick Start

From the workspace root:

```bash
# List all projects registered in workspace.graph.json
node scripts/governance/workspace-project list

# Validate the workspace graph is consistent
node scripts/governance/workspace-project validate

# Doctor the core dev services
node scripts/service/devsvc/devsvc doctor core

# Open the dev service dashboard
node scripts/service/devsvc/devsvc dashboard

# Wrap an ad-hoc command with the stable Node 22 runtime
bash scripts/runtime/run-node22-command.sh <your-command>

# Run the workspace-pinned Corepack against the package manager declared by
# the current project (for example, its packageManager field)
scripts/runtime/corepack pnpm install
```

## When to Add a New Script Here

Add to `scripts/` (in the matching subdirectory) when:

- The script is a workspace-level entry point used by humans or agents from any
  project under `/Volumes/code/workspace`.
- The script reads or mutates `workspace.graph.json` or `dev-services.config.json`.
- The script is a runtime helper that any project under the workspace can
  reuse (e.g. the Node 22 wrapper or the Corepack launcher).

Do **not** add to `scripts/` when:

- The script is project-local (put it in the project's own `scripts/` or
  `bin/`).
- The script is a one-off debug command (use `tmp/` or the agent scratch
  area instead, and do not commit it).

## Editing Rules

See `AGENTS.md` next to this file for the full rule set. The short version:

- All Node cross-file imports are relative within their subdirectory.
- Do not introduce new hard-coded secrets. Read from
  `~/.local/share/axi-workspace/secrets/` (planned; see TODO.md).
- After structural changes, re-run `make doctor` at the workspace root.

## History

- **2026-06-10** — Reorganized from a flat 17-file layout into
  `runtime / service / governance / utility` subdirectories. All internal
  `import` paths were updated and verified. `workspace-project` was the
  only consumer of cross-directory imports and is now reachable at
  `scripts/governance/workspace-project`. `make doctor` (added in the
  same pass) calls each entry point with the new path.

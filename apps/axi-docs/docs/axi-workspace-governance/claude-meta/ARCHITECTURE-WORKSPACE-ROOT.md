---
source_of_truth: /Volumes/code/workspace/.claude/ARCHITECTURE.md
mirror_strategy: verbatim-passthrough
last_mirrored_at: 2026-09-28
---

<!-- Layer: 2 | Architecture | Parent: .claude/PARADIGM.md -->
<!-- Updated: 2026-06-07 -->

# Workspace Architecture

This file defines the architecture of `/Volumes/code/workspace` as a local
multi-project control plane. It is not a monorepo contract. Individual projects
keep their own repositories, docs, tests, and release cadence.

## Module Map

| Path | Responsibility | Stack / format | Verification |
| --- | --- | --- | --- |
| `WORKSPACE_INDEX.md` | Human project map, canonical paths, entrypoint docs, first verification commands. | Markdown | Path checks plus `scripts/workspace-project validate` |
| `workspace.graph.json` | Machine-readable providers, consumers, contracts, profiles, health checks, verification commands. | JSON | `scripts/workspace-project validate` |
| `dev-services.config.json` | PM2/dev service profiles, route targets, health and alert configuration. | JSON | `scripts/service/devsvc/devsvc doctor core` |
| `docs/` | Workspace-level operator docs, Axi contracts, audits, inventory, and service guides. | Markdown / JSON | `docs/AGENTS.md`; docs path validation |
| `scripts/` | Workspace CLIs for project lookup, service management, alerts, and runtime wrappers. | Node.js / shell | `scripts/AGENTS.md`; `node --check` or command-specific smoke tests |
| `foundation/` | Axi core projects (`foundation/axi-*`), shared libraries, skills, templates, governance, and reusable runtime foundations. | Mixed | Module/project-local docs |
| `workbench/` | Axi Workbench and workbench product repositories (`workbench/axi-*`). | Mixed | Project-local docs |
| `agent-cluster/` | Agent cluster project repositories (`agent-cluster/axi-*`). | Mixed | Project-local docs |
| `distributions/` | Distribution packages spun out from core projects. | Mixed | Project-local docs |
| `candidates/` | Independently bounded projects awaiting maturity review. | Mixed | Project-local docs |
| `tools/` | Independent local utilities that are not product owners. | Mixed | Tool-local README or package checks |
| `products/` | AxiomaticWorld spun-out product repositories. | Mixed | Product-local `AGENTS.md` and `WORKSPACE_INDEX.md` command |
| `references/` | External or read-only references, not Axi ownership surfaces. | Mixed | Existence checks only unless explicitly targeted |
| `archive/` | Archived projects. | Mixed | Existence checks only |

## Dependency Rules

- `WORKSPACE_INDEX.md` is the first human lookup surface.
- `workspace.graph.json` is the source of truth for contracts, providers,
  consumers, startup profiles, health checks, and verification commands.
- `foundation/workspace-governance/workspace.json` is the enterprise registry
  source of truth.
- `dev-services.config.json` owns local service profile configuration.
- Axi Docs may index workspace docs, but it does not own workspace truth.
- Business projects must not hard-code cross-project paths when a graph contract,
  environment variable, CLI, or profile can describe the dependency.
- Reference repositories must not be renamed into Axi ownership or treated as
  editable product roots unless the owner explicitly changes their status.

## Interface Standards

Workspace machine-readable files should use explicit ids, paths, and check
commands. Prefer stable, parseable shapes:

```ts
export interface WorkspaceProjectContract {
  id: string;
  path: string;
  provides?: string[];
  consumes?: string[];
  contracts?: string[];
  health?: string[];
  verify?: string[];
}
```

For docs manifests, references should point only to files or directories that
exist in the same repository. Optional historical placeholders belong in TODOs,
not active manifest fields.

## Security Constraints

- Never store secrets in the workspace.
- Do not echo credentials in docs, comments, chat, PR bodies, logs, or examples.
- Sensitive paths listed in `SECURITY.md` are not normal documentation sources.
- Axi Accounts documents may define credential refs and schemas, not live secret
  values.

## Performance And Scale Constraints

| Area | Constraint |
| --- | --- |
| Project lookup | Prefer indexed files and `workspace-project`; avoid broad recursive scans unless auditing. |
| Axi Docs indexing | Do not index generated outputs, caches, archives, `node_modules`, or build directories. |
| Dev services | Use PM2 profiles and `scripts/service/devsvc/devsvc`; do not create one-off unmanaged daemons. |
| Cross-project checks | Run provider checks before consumer checks. |

## Verification Commands

| Purpose | Command |
| --- | --- |
| Workspace graph | `/Volumes/code/workspace/scripts/workspace-project validate` |
| Dev services | `/Volumes/code/workspace/scripts/service/devsvc/devsvc doctor core` |
| Axi Docs ingestion/build | `pnpm --dir /Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/app governance:check` and `pnpm --dir /Volumes/code/workspace/workbench/axi-workbench/apps/axi-docs/app verify` |
| Module script syntax | `node --check <script>` for Node scripts; shell/Python checks per module docs |

## Documentation Layers

```text
L1 .claude/PARADIGM.md
  Defines workspace meta-rules and requirement/test binding.

L2 .claude/ARCHITECTURE.md
  Defines workspace modules, dependency rules, and verification surfaces.

L3 module docs
  docs/AGENTS.md, scripts/AGENTS.md, tools/AGENTS.md,
  plus project-local docs inside foundation/, workbench/, agent-cluster/, products/, candidates/, distributions/.
```

<!-- MANUAL: workspace-specific architecture notes preserved across updates -->

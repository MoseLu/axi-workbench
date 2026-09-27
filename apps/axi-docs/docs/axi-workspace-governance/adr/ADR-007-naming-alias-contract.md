# ADR-007: Project ID / physical path / package name alias contract

**Status:** Accepted on 2026-08-23.
**Decision driver:** CONVERGE-NAMING-004 in `docs/state/TODO.md`.
**Related ADRs:** ADR-002 (progressive repository naming policy), ADR-006
(gateway taxonomy).

## Context

`workspace-audit.mjs` and `inventory-classifications.md` revealed four cases
where the `workspace.graph.json` project ID, the physical directory name, or
the package name diverge:

| Project ID (graph) | Physical path | Package name | Divergence |
|---|---|---|---|
| `sports-management` | `projects/axi-sports-management-app/` | n/a | Graph ID is truncated; physical path uses full prefix. |
| `axi-pet` | `projects/axi-pet/` | `@proj-airi/root` | Package name is legacy from `moeru-ai/airi` upstream; ID is the canonical Axi name. |
| `axi-workspace-governance` | `infra/axi-workspace-governance/` | n/a | Control-plane project; no `workspace-project onboard` path resolves for it. |
| `axi-model-gateway` | `projects/axi-workbench/apps/axi-coder/...` | n/a | Contract alias inside Axi Coder, not a standalone project. |

## Decision

The three identifiers below are independent and may legitimately differ for
historical or pragmatic reasons. The alias contract is recorded here so
agents do not infer one identifier from another.

### Canonical roles

- **Project ID** — the registry key in `workspace.graph.json` `projects`. Used
  by `workspace-project list`, `workspace-project onboard`, `workspace-project
  deps/consumers/profile`. Must be stable across renames; a rename is a
  breaking registry change requiring this ADR to be amended.
- **Physical path** — the directory on disk under the workspace root. Used
  by filesystem tools and the audit. May change with monorepo migrations
  but should remain the same as the directory containing `AGENTS.md`,
  `package.json`, `pyproject.toml`, etc.
- **Package name** — the npm / pypi / go module identifier. Used by build
  tools. May diverge from the project ID when the package was originally
  imported from another project.

### Alias policy

1. New projects **must** set all three identifiers to a consistent value
   (project ID = directory basename = package scope basename) at admission
   time. See `project-admission-gate.md` and `AR-BOOTSTRAP-ADMISSION-*`.
2. Existing divergences are recorded in this ADR as **grandfathered**. They
   are exempt from rule (1) until either:
   - the upstream project is fully migrated off the legacy identifier, OR
   - the owner explicitly accepts a breaking rename with a migration plan.
3. Any new service file or document that references one of the three
   identifiers **must** use the canonical ID and link this ADR if the
   physical path or package name diverges.

### Specific grandfathered cases

#### `sports-management` → `axi-sports-management-app/`

- **Action:** None. The graph ID is the public CLI key; the directory name
  carries the Axi prefix and the descriptive suffix. Both are intentional.
- **Renaming would break:** `workspace-project consumers axi-workbench`
  command lines, DevSvc profile names, and downstream references in
  `workspace.graph.json`. Not justified.

#### `axi-pet` → `@proj-airi/root` package

- **Action:** None. The npm package name reflects the upstream
  `moeru-ai/airi` fork; renaming would break upstream sync and existing
  npm consumers. The graph ID `axi-pet` is the Axi canonical name.

#### `axi-workspace-governance` (control plane)

- **Action:** None. This is a registry / control-plane project, not an
  "owner" project. `workspace-project onboard` does not resolve it; that
  is by design. Governance writes go through direct file editing under
  `infra/axi-workspace-governance/` with explicit owner approval.

#### `axi-model-gateway` (contract alias)

- **Action:** None. This is a contract surface inside Axi Coder, not a
  project. It appears in `workspace.graph.json` as documentation of a
  provider capability; no separate path exists. See ADR-006.

## Consequences

- Agent prompts that say "the axi-XXX project" can resolve to the project
  ID even if the directory or package name differs, as long as the alias is
  recorded here.
- No directory or remote rename is performed solely for visual tidiness.
- This ADR is amended whenever a new grandfathered case appears.

## Acceptance criteria

- New agents can identify any project by either ID, path, or package name
  without confusion.
- `workspace.graph.json` and the audit cross-reference each grandfathered
  case in `inventory-classifications.md` §5.

# Axi Workbench Boundary SOP

## Purpose

This SOP keeps Axi Workbench as the workspace shell and control plane, not the implementation owner for every neighboring project.

## Ownership

| Surface | Workbench may own | Workbench must not own |
| --- | --- | --- |
| Dashboard shell | navigation, app hosting, status cards, local launch wiring | business implementation from hosted apps |
| Control plane | typed commands, resource snapshots, approvals, AgentTask lifecycle | direct agent runtime internals or task execution engines |
| Communication gateway | envelope normalization, pairing, idempotency, rendering | Codex execution, workspace discovery, memory lookup, project state |
| Shared contracts | `IMEnvelope`, `AgentTask`, control-plane schema | private schemas from neighboring repos |
| Capability integrations | registry entries, health checks, env-driven clients | provider SDK logic copied from capability owners |

## Coupling Rules

- Import shared UI through published/package contracts such as `@axi/*`; do not import source files from sibling projects.
- Call Axi Agent Platform through `AgentTask`, HTTP, MCP, or documented schema contracts; do not read its repository internals from Workbench runtime code.
- Call Axi Notify through relay/API contracts; do not depend on its Android implementation paths at runtime.
- Treat Axi Docs and workspace governance as registry/document sources; generated snapshots may be displayed, but Workbench must not become their generator owner.
- Runtime code must not contain absolute `/Volumes/code/workspace/...` paths. Use env vars, registry entries, package contracts, or `workspaceRoot` placeholders in config.
- Tests, scaffold templates, and screenshot/snapshot preview fixtures may contain example paths, but they must not be used as runtime dependency wiring.

## Verification

Run:

```bash
pnpm check:boundaries
```

The check fails when:

- a `package.json` links directly into another project implementation;
- implementation code embeds absolute workspace paths;
- implementation code reaches sibling projects through relative traversal;
- `services/communication-gateway` starts owning workspace discovery, agent execution, or memory persistence.

## Change Protocol

When a feature requires new cross-project behavior:

1. Add or update a contract file, schema, API, registry entry, or env variable.
2. Keep implementation in the owning project.
3. Add Workbench UI/control-plane wiring only after the contract exists.
4. Run `pnpm check:boundaries` and the smallest consumer/provider verification from the workspace graph.

# Axi Dashboard Consolidation

Date: 2026-05-26

## Decision

`/Volumes/code/workspace/workbench/axi-workbench/apps/devsvc-dashboard` is the
single local Axi Dashboard host. It owns the visible dashboard entrypoint for
Axi apps and Axi resources inside the Axi Workbench monorepo.

## Hosted Apps

Dashboard-hosted applications are declared in:

```text
/Volumes/code/workspace/workbench/axi-workbench/apps/devsvc-dashboard/config/axi-apps.json
```

Current hosted app ids:

- `axi-fleet-console`
- `axi-coder`
- `axi-verification-inbox`

Hosted app ids must use the `axi-` prefix. The host injects `AXI_APP_BASE`,
`AXI_APP_PORT`, and related `VITE_AXI_*` variables at runtime.

## Resource Index

Non-hosted Axi owners are declared in:

```text
/Volumes/code/workspace/workbench/axi-workbench/apps/devsvc-dashboard/config/axi-resources.json
```

This index covers Workstation, Agent, Agent MCP, Agent Transport, Accounts,
Model Gateway, Docs, Notify, Mobile, Todo, Axi UI, Axi Registry, Axi App CLI,
and native/local tools that cannot safely run as iframe-hosted web apps.

## Boundary

- Do not create a second local dashboard shell while this dashboard owns the app entry.
- Do not copy business API, permissions, routing, or data-loading code into the
  dashboard unless the capability is explicitly becoming a dashboard feature.
- Keep source modules under their current Axi monorepo owner; dashboard
  registers entrypoints and resource ownership only.
- `cockpit-tools` and `sub2api` remain references, not Axi applications.

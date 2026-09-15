# Axi Workbench Index

> This root file is a **builder-friendly stub**. The canonical index lives
> at [`INDEX.md`](./INDEX.md) (this file's parent). See that file for the
> full Top-Level Inventory, Document Map, and Source of Truth.

## Quick Map

- Canonical INDEX: [`INDEX.md`](./INDEX.md)
- Canonical PRD: [`docs/state/PRD.md`](./docs/state/PRD.md)
- Canonical TDD: [`docs/state/TDD.md`](./docs/state/TDD.md)
- Canonical TODO: [`docs/state/TODO.md`](./docs/state/TODO.md)
- Canonical MILESTONE: [`docs/state/MILESTONE.md`](./docs/state/MILESTONE.md)
- Canonical CHANGELOG: [`docs/state/CHANGELOG.md`](./docs/state/CHANGELOG.md)
- Canonical HANDOFF: [`docs/HANDOFF.md`](./docs/HANDOFF.md)
- Canonical AGENTS: [`AGENTS.md`](./AGENTS.md)
- Canonical README: [`README.md`](./README.md)
- Canonical source catalog: [`docs/architecture/source-catalog.md`](./docs/architecture/source-catalog.md)

The project ships **two independent workbench applications**:

- `apps/workbench` — Web Admin SPA (Axi Dashboard Chrome ≥ 768px).
- `apps/workbench-mobile` — Mobile Admin app (header + tab bar + mobile
  page composition; uses `@axi/workbench-foundation` for auth + locale).

`apps/devsvc-dashboard` is the local Host/operations shell. `axi-coder`,
`verification-inbox`, Fleet Console, App Search, and Ollama Menu Assistant are
vertical tools or hosted surfaces, not additional copies of the user portal.
Root pnpm membership is a separate fact from “directory exists” or “Host can
open it”; use the [source catalog](./docs/architecture/source-catalog.md) for
that distinction.

- Last refreshed: 2026-08-08

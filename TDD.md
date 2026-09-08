# Axi Workbench TDD

> This root file is a **builder-friendly stub**. The canonical TDD lives at
> [`docs/state/TDD.md`](./docs/state/TDD.md). See the canonical file for the
> full Architecture Assumptions, Test Surface Map, per-surface verification
> commands, Risk Cases, and Test Strategy.

## Quick Map (to canonical)

| Surface | Verification entry |
| --- | --- |
| Workbench Web UI | `pnpm --filter @axi/workbench type-check`, `test`, `build`, `node apps/workbench/scripts/verify-ui-contracts.mjs` |
| Workbench Mobile UI | `pnpm --filter @axi/workbench-mobile type-check`, `test`, `build`, `pnpm --filter @axi/workbench-mobile verify:contracts` |
| Control plane | `pnpm --filter @axi/workstation-control-plane test`, `smoke` |
| Communication gateway | `pnpm --filter @axi/workstation-communication-gateway test` |
| Boundaries | `pnpm check:boundaries` |

- Canonical source: [`docs/state/TDD.md`](./docs/state/TDD.md)
- Last refreshed: 2026-08-07

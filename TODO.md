# Axi Workbench TODO

> This root file is a **builder-friendly stub**. The canonical TODO lives at
> [`docs/state/TODO.md`](./docs/state/TODO.md). Every P0/P1 row there is
> anchored to a `REQ-*` row from the PRD and lists the concrete verification
> command or test case.

At a glance (see canonical TODO for the full list and evidence links):

- P0: documentation suite complete, workbench UI contract verifier green,
  control-plane smoke green, boundary SOP green, no second Web portal.
- P1: verify commands accurate, six-layer paths declared per service,
  communication-gateway stays above business logic, mobile shell persisted
  tokens auditable, manifest current, milestone/log discipline.

- Canonical source: [`docs/state/TODO.md`](./docs/state/TODO.md)
- Last refreshed: 2026-09-14

### Current verification evidence (2026-09-14)

| Surface | Command | Status |
|---------|---------|--------|
| Dashboard typecheck | `pnpm --filter @axi/workbench type-check` | ✅ PASS |
| Dashboard tests | `pnpm --filter @axi/workbench test` | ✅ 184/184 PASS |
| Control plane smoke | `pnpm --filter @axi/workstation-control-plane smoke` | ✅ PASS (35 resources) |
| Axi Coder smoke | `pnpm --filter @axi/workstation-control-plane smoke -F @axi/workstation-axi-coder` | ✅ PASS |
| Axi Skills verify | `cd .../axi-skills && python3 scripts/verify.py` | ✅ PASS (errors=0, 9 warnings) |
| Axi Skills i18n | `cd .../axi-skills && python3 scripts/verify_i18n.py --check-manifest-only --forbid-english-diff` | ✅ PASS |
| Boundary check | `pnpm check:boundaries` | ✅ PASS |
| Workspace validate | `workspace-project validate` | ✅ PASS |
| Axi UI typecheck | `pnpm --filter @axi/ui type-check` | ✅ PASS |
| Axi Registry health | `pnpm --filter @axi/registry health` | ✅ PASS |

See [`docs/state/TODO.md`](./docs/state/TODO.md) for P0/P1/P2 requirement traceability.

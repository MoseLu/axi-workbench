# TODO: Runtime Hardening
Last updated: 2026-04-03 16:08:50 +08:00
Parent: [TODO.md](../../TODO.md)
Status: 进行中

## Summary

- Decompose the runtime hardening track that spans command classes, lifecycle phases, typed contributions, JSON contracts, and CLI bootstrap boundaries.

## Tasks

- [x] Split the repository into CLI, scaffold, foundation, and feature workspace packages.
- [ ] Define runtime command-class responsibilities and lifecycle phases across `packages/scaffold-runtime`.
- [ ] Replace module-specific runtime helpers with typed contribution families.
- [ ] Thin `apps/cli/src/cli.ts` so fast-path handling stays outside the heavy runtime path.
- [ ] Add or update tests that lock orchestration behavior and machine-readable command output.

## Notes

- This child plan rolls up into the root TODO items for runtime lifecycle formalization, typed contributions, and CLI bootstrap slimming.
- Keep the parent tasks in `进行中` until the command model, contribution model, and contract tests land together.
- Current working-tree edits observed during the incremental sync are concentrated in `packages/feature-ui/src/ui-components.ts` and `packages/scaffold-runtime/tests/scaffold.spec.ts`.

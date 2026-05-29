# Package Notes
Last updated: 2026-04-03 16:33:20 +08:00
Parent: [AGENTS.md](../../AGENTS.md)
Scope: packages/scaffold-runtime

## Role

- Execute CLI commands, sync, doctor, install, and file orchestration.
- Consume the assembled registry and apply scaffold policy to real project trees.

## Local Constraints

- Depend only on `@axi/scaffold-kit` and `@axi/scaffold-registry`.
- Do not import capability packages directly.
- Keep machine-readable command contracts stable, especially `list --json` and `doctor --json`.
- Treat `.axi/modules.json` as desired state and `.axi/scaffold.manifest.json` as applied state.

## Current Focus

- Formalize command classes and lifecycle phases without bloating the thin CLI shell.
- Continue hardening sync, repair, and drift detection behavior around stable registry inputs.

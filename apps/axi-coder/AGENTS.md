# Axi Coder Agent Guide

## Scope

This guide governs the nested Axi Coder application at
`/Volumes/code/workspace/projects/axi-workbench/apps/axi-coder`. The parent
rules in `../../AGENTS.md` and `../AGENTS.md` still apply.

Axi Coder is the full development-workbench surface: Tauri 2 desktop shell,
hosted React app, provider/model routing, CLI orchestration, terminal sessions,
agent tasks, and artifact review. The graph also records the grandfathered
`axi-model-gateway` contract alias at this same physical path; that alias is
documented by ADR-007 and is not a second project.

## Read order

1. `/Volumes/code/workspace/AGENTS.md`
2. `../../AGENTS.md` and `../AGENTS.md`
3. `README.md`
4. `docs/project-docs.manifest.json`
5. The touched feature's source and test files

## Boundaries

- Keep implementation changes inside this app or its declared shared-package
  consumers (`@axi/core`, `@axi/shell`, and `@axi/tokens`).
- Do not edit `workspace.graph.json` or governance mirrors from this nested
  app; cross-project contracts are owned by the workspace governance source.
- Keep secrets in the system keychain or credential references. Never commit
  API keys, provider tokens, or local smoke-test material.
- Hosted mode must remain browser-safe: use `AXI_APP_BASE` / `AXI_APP_PORT`
  and do not assume native Tauri commands exist in the dashboard host.

## Verification

Run the smallest relevant checks for the touched surface:

```bash
pnpm typecheck
pnpm test
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml --offline
cargo test --manifest-path src-tauri/Cargo.toml --offline
```

Provider, proxy, CLI, terminal, and hosted-surface changes require the
matching Vitest tests; Rust command or persistence changes require the Cargo
checks. Documentation-only changes require the manifest and `VERIFICATION.md`
to remain consistent.

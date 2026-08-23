# Axi Coder Verification

Generated evidence is kept in the nested app manifest and this file. Run the
commands below from `apps/axi-coder` after changes to the corresponding
surface.

## TypeScript and hosted app

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Tauri and Rust runtime

```bash
cargo check --manifest-path src-tauri/Cargo.toml --offline
cargo test --manifest-path src-tauri/Cargo.toml --offline
```

## Contract surfaces

- Provider routing: `src/features/providers/axiProviderProfile.ts` and its
  Vitest coverage.
- Workbench product contract: `src/features/product/axiCoderProductSurface.ts`
  and `axiCoderWorkbench.ts` tests.
- Desktop runtime: `src-tauri/src/` and the Cargo checks above.
- Workspace snapshot consumer: `src/features/workbench/projectCompletion.ts`
  and its tests.

## Current evidence

- `workspace-project handoff-check axi-coder` passes with score 10 and no
  warnings.
- On 2026-08-23, `pnpm typecheck`, `pnpm test` (7 files, 14 tests), and
  `pnpm build` passed.
- On 2026-08-23, `cargo check --manifest-path src-tauri/Cargo.toml --offline`
  passed and `cargo test --manifest-path src-tauri/Cargo.toml --offline`
  passed with 19 unit tests.

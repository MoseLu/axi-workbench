# TODO
Last updated: 2026-04-03 16:20:58 +08:00

## 进行中

- [进行中] Formalize runtime command classes and lifecycle phases in code. Child plan: `docs/todo/runtime-hardening.md`
- [进行中] Introduce typed contribution families and remove module-specific runtime helpers. Child plan: `docs/todo/runtime-hardening.md`
- [进行中] Refactor `apps/cli/src/cli.ts` into a thinner bootstrap with fast-path handling. Child plan: `docs/todo/runtime-hardening.md`
- [进行中] Lock `list --json` and `doctor --json` output with contract tests. Child plan: `docs/todo/runtime-hardening.md`
- [进行中] Finish release checklist guidance and generated-app smoke expectations around the new capability package standard. Child plan: `docs/todo/release-governance.md`

## 待完成

- [待完成] Add richer smoke verification for the generated web app.
- [待完成] Add snapshot fixtures for future template variants.
- [待完成] Add preset extensibility once the default template is stable.
- [待完成] Move future auth and resource runtimes behind publishable package boundaries.

## 已完成

- [已完成] Convert the scaffolder repo into a `pnpm workspace` monorepo with dedicated CLI, scaffold, foundation, and feature packages.
- [已完成] Establish the initial summary-doc sync baseline and `docs/todo/` hierarchy support.
- [已完成] Codify package boundaries, per-package README contracts, and workspace checks for scaffold capability packages.
- [已完成] Add `pnpm package:new` to bootstrap new workspace packages from the shared package standard.

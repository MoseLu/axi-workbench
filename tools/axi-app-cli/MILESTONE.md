# Milestone
Last updated: 2026-04-03 16:20:58 +08:00

## Current Milestone

- `v1.0 Hardening`: formalize runtime command classes and lifecycle phases, upgrade modules toward typed contribution providers, thin the CLI bootstrap, lock JSON contracts and drift diagnostics, and keep generated docs aligned with the policy/snapshot/sync/doctor model.

## Completed

- Convert the scaffolder into a `pnpm workspace` monorepo with `apps/cli` plus dedicated scaffold, foundation, and feature packages.
- Preserve the default full-stack scaffold contract around `Vite + React + TypeScript + Zod`, Flask, Style Dictionary, SCSS, Git hooks, governance docs, and coverage gates.
- Establish the architecture, product, brand, and research document set under `docs/` to guide the CLI and module system.
- Codify package boundaries and capability-package rules with executable checks plus local `README.md` contracts for every workspace package.
- Add a repo-native package bootstrap command so new workspace packages start from the same standard instead of folder-copy drift.

## In Progress

- Runtime hardening across `packages/scaffold-runtime`, registry assembly, and CLI entrypoint boundaries.
- Contribution-model cleanup to move away from module-specific runtime helpers and toward clearer typed extension points.
- Contract hardening around `axi list`, `axi doctor`, `--json` output, and safe repair/sync behavior.
- Ongoing expansion of the opt-in UI starter layer in `packages/feature-ui`.

## Next

- Refactor `apps/cli/src/cli.ts` into a thinner bootstrap with fast-path handling.
- Add richer smoke verification and snapshot fixtures for future generated template variants.
- Finish release checklist guidance and generated-app smoke expectations to match the new package authoring standard.

## Risks

- Runtime and contribution work span multiple packages, so progress can fragment without child task plans and explicit roll-up.
- JSON contract hardening and final release-process guidance are still tracked as follow-up work, which leaves some automation expectations partly implicit.
- The parent enterprise workspace ignores `projects/*`, so local change-audit tooling cannot rely on parent git status alone.

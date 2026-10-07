---
id: axi-docs-en-projects-sports-management
title: Axi Sports Management App (Archived)
type: project
status: published
tags: [Axi Docs, Projects, archive, quasar, vue3, capacitor, typescript, sports-management, deprecated]
created: 2026-10-07
modified: 2026-10-07
graph-title: Axi Sports Management App (Archived)
graph-tags: [Projects, archive, deprecated]
description: Archived Quasar + Vue 3 + Capacitor sports management application skeleton. `status: archived` (archived 2026-09-17). Never progressed past scaffold; reference for "doc-code mismatch" lessons and branch-policy learnings. Stack: `Quasar 2` + `@quasar/app-vite ^2.1.0` + `Vue 3 ^3.4.18` + `Pinia ^3.0.1` + `Vue Router ^4.0.12` + `Vue I18n ^11.0.0` + `axios ^1.19.0` + `@capacitor/core ^7.0.0` + `@capacitor/android ^7.0.0` + `Vite 5` + `ESLint ^9.14.0` + `Prettier ^3.3.3` + `Vitest ^2.1.9` + `vue-tsc ^2.0.29`.
project:
  id: sports-management
  partition: archive
  path: /Volumes/code/workspace/archive/axi-sports-management-app
  status: archived
  archived-on: 2026-09-17
  source-section: archive
---

# Axi Sports Management App (Archived)

> Archived on 2026-09-17. Source of truth for archive status:
> [`ARCHIVE.md`](/Volumes/code/workspace/archive/axi-sports-management-app/ARCHIVE.md).
> Section: archive / Partition: `archive/`.

## Summary

Axi Sports Management App (`axi-sports-app`, `productName: "Axi Sports"`) was a `Quasar 2` + `Vue 3` + `TypeScript` multi-client skeleton for sports venue / course / member management. The primary product surface was the Web SPA; the Capacitor Android shell wrapped the same bundle; the backend was a placeholder. It shipped a full root documentation suite (PRD, TDD, TODO, MILESTONE, CHANGELOG, INDEX, AGENTS, project-docs manifest) but zero business logic — `ExampleComponent.vue` (a todo counter) was the only meaningful component, and `backend/`, `src-capacitor/android/app/`, and `frontend/public/` were empty or near-empty.

For Axi, this is a **failure-mode reference**, not a code or product reference. The lessons it returns to Axi are: (1) a doc-first scaffold without an MVP wedge produces "doc-code mismatch" — the README, PRD, TDD, and AGENTS all promised a sports venue management product, but the code was a bare Quasar skeleton, so the docs described a product that did not exist; (2) "skeleton" stage + "private" + "0.0.1" is correct as a bootstrap state, but it must transition into MVP within a bounded window or it must be archived — this repo shipped `0.0.1` for 1.5 years and was archived on 2026-09-17 with no shipped feature; (3) the `docs/state/` split (PRD, TDD, TODO, MILESTONE, CHANGELOG in a subdirectory, with `INDEX.md` and `AGENTS.md` at the root) is a usable template for future Quasar/Vue/Capacitor projects but only when there is real code behind it; (4) the `docs/project-docs.manifest.json` v2 manifest is a workable machine-readable contract even for an archived project, and it is what made the 2026-09-25 audit passable; (5) the Quasar + Capacitor + Pinia + Vue I18n + `vue-i18n` + `@intlify/unplugin-vue-i18n` + flat-ESLint stack chosen here remains a reasonable starting point if Axi ever needs to revive it (the captured versions and config in `quasar.config.ts` and `eslint.config.js` are not stale).

**Stage**: archived. **Lifecycle**: skeleton-active in `docs/project-docs.manifest.json` (last verified 2026-09-25), but `ARCHIVE.md` overrides to archived as of 2026-09-17 and is the authoritative notice. **Canonical path**: `/Volumes/code/workspace/archive/axi-sports-management-app`. **Branch policy**: working branch is `dev`, syncing against `origin/dev`; last local commit `4e05816 ci(workspace): use private governance remote`; clean working tree except for 2 untracked submit-log files (`docs/logs/submit/20260928-121723-auto-submit.md`, `docs/logs/submit/20260930-082807-auto-submit.md`).

## Stack

`Quasar 2`, `@quasar/app-vite ^2.1.0`, `TypeScript ~5.4.5`, `Vue 3 ^3.4.18`, `Pinia ^3.0.1`, `Vue Router ^4.0.12`, `Vue I18n ^11.0.0`, `@intlify/unplugin-vue-i18n ^4.0.0`, `axios ^1.19.0`, `@quasar/extras ^1.16.4`, `@capacitor/core ^7.0.0`, `@capacitor/android ^7.0.0`, `Vite 5`, `ESLint ^9.14.0`, `Prettier ^3.3.3`, `Vitest ^2.1.9`, `happy-dom ^20.14.5`, `@vue/test-utils`, `vue-tsc ^2.0.29`, `Node >=22.10.0`, `pnpm@10.33.2`

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 — Quasar 2 + Vue 3 + TypeScript scaffold | shipped | `package.json` (`name: axi-sports-app`, `version: 0.0.1`, `productName: Axi Sports`); `src/App.vue` (`<router-view />`) |
| M2 — Pinia store + SPA router + i18n boot | shipped | `src/stores/{index.ts, example-store.ts}` (`useCounterStore` with HMR); `src/router/{index.ts, routes.ts}` (`/` + `/:catchAll(.*)*`); `src/boot/i18n.ts` (`createI18n`, `MessageLanguages`, `MessageSchema`, `legacy: false`) |
| M3 — en-US + zh-CN i18n registry | shipped | `src/i18n/index.ts` (7 LOC) + `src/i18n/en-US/index.ts` + `src/i18n/zh-CN/index.ts` |
| M4 — axios boot module | shipped | `src/boot/axios.ts` (Quasar default) |
| M5 — Vitest + happy-dom test scaffolding | shipped | `vitest.config.mts`; `pnpm test` exits 0 with no specs |
| M6 — Capacitor Android shell + custom Cordova plugins | shipped | `src-capacitor/package.json` (`@capacitor/{core,android,app,haptics,keyboard,splash-screen,status-bar}@^7.0.0`); `src-capacitor/android/` generated Android Studio project |
| M7 — ESLint flat config (Quasar recommended + Vue + TS + Prettier skip) | shipped | `eslint.config.js`; ESLint `^9.14.0` |
| M8 — Full root docs suite | shipped | `README.md` + `README.zh-CN.md` + `AGENTS.md` + `INDEX.md` + `CHANGE.md` + `CHANGELOG.md` (stub) + `TODO.md` + `MILESTONE.md` + `PRD.md` + `TDD.md` + `SECURITY.md` + `VERIFICATION.md` |
| M9 — `docs/state/` split + project-docs v2 manifest | shipped | `docs/state/{PRD,TDD,CHANGELOG,MILESTONE,TODO}.md`; `docs/project-docs.manifest.json` v2 (`status: verified`, `lifecycle: skeleton-active`) |
| M10 — Sports venue / class / member management features | **never shipped** | only `ExampleComponent.vue` (todo counter, 37 LOC) exists; `backend/` empty; `src-capacitor/android/app/` is generated boilerplate only |
| M11 — Project admission gate revisited | **never shipped** | `ARCHIVE.md` records 1.5 years of inactivity; the archive notice explicitly recommends a fresh `workspace-project route-intent` admission rather than in-place revival |
| M12 — Archive decision | **shipped** | `ARCHIVE.md` (54 LOC) — 2026-09-17: zero business logic + empty backend + doc-code mismatch + 1.5 years inactive |

## Build & Install (preserved for revive)

```bash
cd /Volumes/code/workspace/archive/axi-sports-management-app
pnpm install            # pnpm@10.33.2; engines: node>=22
pnpm dev                # quasar dev  (default port 9000, NOT 5173)
pnpm build              # quasar build
pnpm lint               # eslint -c ./eslint.config.js "./src*/**/*.{ts,js,cjs,mjs,vue}"
pnpm format             # prettier --write ...
pnpm test               # vitest run (placeholder; no specs yet)
pnpm exec vue-tsc --noEmit   # optional typecheck

# Capacitor Android shell (needs Android SDK + toolchain)
cd src-capacitor && pnpm install
# then: npx cap sync android ; npx cap open android
```

The `docs/HANDOFF.md` health command is `curl -fsS http://127.0.0.1:9000/` (Quasar dev server default, not the Vite default of 5173); `pnpm dev` opens the browser automatically per `quasar.config.ts#devServer.open: true`.

## Architecture Highlights (or Lack Thereof)

**What this project is.** A Quasar 2 + Vue 3 + TypeScript SPA scaffold with Pinia, Vue Router, Vue I18n (en-US + zh-CN locale folders, but `zh-CN` registers a near-empty stub alongside the actual `en-US` default), and a Capacitor 7 Android wrapper. Boot modules in `src/boot/` are `i18n.ts` (33 lines: `createI18n`, `MessageLanguages`, `MessageSchema`, `legacy: false`, `app.use(i18n)`) and `axios.ts` (Quasar default). The router is two routes — `/` and `/:catchAll(.*)*` — registered in `src/router/routes.ts`. Pinia has a single `useCounterStore` (`src/stores/example-store.ts`, 21 lines) with HMR via `acceptHMRUpdate`. The only "feature" component is `src/components/ExampleComponent.vue` (37 lines), a todo counter that demonstrates `<script setup lang="ts">` + `defineProps` + `withDefaults` + `ref` + `computed`. There is no API client, no auth, no domain models, no router guards, no tests.

**What this project is not.** It is not a sports venue / class / member management application. It never implemented the four personas the PRD names (Sports venue operator, Coach, Member, Admin). The `backend/` directory has no Go / Node / Python code; the `src-capacitor/android/app/` directory only contains the Capacitor generated shell; `frontend/public/` is empty. The `package.json` test script `pnpm test` is a placeholder. The CHANGELOG root file is a stub ("暂无新增条目；由项目 owner 在每次提交后补充"). This is the canonical "doc-code mismatch" failure: the docs describe a product that does not exist.

**The `docs/state/` split is the cleanest pattern to salvage.** Putting PRD / TDD / TODO / MILESTONE / CHANGELOG under `docs/state/` rather than the project root keeps the root for human-facing narrative (README, AGENTS, INDEX, CHANGE.md) and the state directory for machine-checked requirements traceability. The PRD's REQ ids (`REQ-SPORTS-P0-001`, `REQ-SPORTS-P0-002`, `REQ-SPORTS-P1-001`, etc.) are referenced from TODO and CHANGELOG and verified by the doc integrity loop in `TDD.md`. This pattern is reusable for any future Quasar/Vue project, but only when there is real code behind it.

**The `project-docs.manifest.json` v2 schema is the right machine-readable contract even for an archived project.** The `docs/project-docs.manifest.json` here is the canonical example of the v2 workspace manifest: it declares `kind: quasar-vue-capacitor-application`, `lifecycle: skeleton-active`, `contracts.provides`, `contracts.consumes`, `environment.runtimes`, `currentWork.knownFailures`, `troubleshooting[]` items, `verification.evidence[]` strings, and a `startup_profile` block. The manifest kept the project auditable on 2026-09-25 even after the human-visible archive notice. Future projects should keep the manifest in sync with reality rather than over-promise in the README.

**Branch policy and CI hooks were wired but produced no real signal.** `docs/logs/submit/` holds 11 auto-submit and grouped-commit log files dated 2026-09-21 → 2026-09-30, mostly generated by the workspace governance automation. There is no actual CI/CD that builds or tests the project — the `verification.evidence` entries in the manifest are the result of one-shot operator runs, not of a recurring pipeline. This is the lesson: a project whose only "evidence" is hand-run shell commands is one operator absence away from being unverifiable, and "verified: 2026-09-25" with no recurring check is exactly the failure mode that produced the archive decision.

**Why archived, exactly (per `ARCHIVE.md`).** Four reasons, in order: (1) zero business logic — no sports management features whatsoever; (2) empty backend — `backend/` never received any implementation; (3) doc-code mismatch — documentation claimed a "sports management app" but the code was a bare skeleton; (4) inactive for 1.5 years — no meaningful feature development since the initial scaffold. The `ARCHIVE.md` advice for revival is also clear: route a fresh `workspace-project route-intent` admission, implement MVP sports management features *before* writing documentation, and keep docs lean and in sync with code. The current branch is `dev` and is not expected to receive further merges.

## Notes

- **Status: archived** (archived on 2026-09-17; `ARCHIVE.md` is the authoritative notice; `docs/project-docs.manifest.json` `lastVerifiedAt` 2026-09-25 still showed "verified" before the archive notice was authoritative).
- Skeleton stack: `Quasar 2` (`@quasar/app-vite ^2.1.0`) + `TypeScript ~5.4.5` + `Vue 3 ^3.4.18` + `Pinia ^3.0.1` + `Vue Router ^4.0.12` + `Vue I18n ^11.0.0` + `@intlify/unplugin-vue-i18n ^4.0.0` + `axios ^1.19.0` + `@quasar/extras ^1.16.4` + `@capacitor/core ^7.0.0` + `@capacitor/android ^7.0.0` + `Vite 5` + `ESLint ^9.14.0` + `Prettier ^3.3.3` + `Vitest ^2.1.9` + `happy-dom ^20.14.5` + `@vue/test-utils` + `vue-tsc ^2.0.29`; `engines: node>=22`, `packageManager: pnpm@10.33.2`.
- Only "feature" component: `src/components/ExampleComponent.vue` (37 LOC todo counter demonstrating `<script setup lang="ts">` + `defineProps` + `withDefaults` + `ref` + `computed`).
- Pinia: single `useCounterStore` (`src/stores/example-store.ts`, 21 LOC) with HMR via `acceptHMRUpdate`; no API client, no auth, no domain models, no router guards.
- Vue I18n: `src/boot/i18n.ts` (33 LOC: `createI18n`, `MessageLanguages`, `MessageSchema`, `legacy: false`, `app.use(i18n)`); locale folders `src/i18n/en-US/index.ts` + `src/i18n/zh-CN/index.ts` (`zh-CN` registers a near-empty stub alongside the actual `en-US` default).
- Router: two routes `/` and `/:catchAll(.*)*` registered in `src/router/routes.ts` (18 LOC); no guards.
- Quasar dev server defaults to port 9000, NOT 5173 (`quasar.config.ts#devServer.open: true` opens the browser automatically).
- `vitest.config.mts` is a placeholder; `pnpm test` exits 0 with no specs yet.
- ESLint flat config (`eslint.config.js`): Quasar recommended + Vue + TS + Prettier skip; ESLint `^9.14.0`.
- `docs/state/` split: `docs/state/{PRD,TDD,CHANGELOG,MILESTONE,TODO}.md`; PRD uses REQ ids `REQ-SPORTS-P0-001` / `REQ-SPORTS-P0-002` / `REQ-SPORTS-P1-001` etc.; TODO and CHANGELOG cross-reference the REQ ids; `TDD.md` runs a doc-existence loop.
- `docs/project-docs.manifest.json` v2: `kind: quasar-vue-capacitor-application`, `lifecycle: skeleton-active`, `status: verified`, `lastVerifiedAt: 2026-09-25` (verified once, never re-run).
- `backend/` is empty (no Go / Node / Python code); `src-capacitor/android/app/` is generated Capacitor boilerplate only; `frontend/public/` is empty.
- `docs/logs/submit/` holds 11 auto-submit + grouped-commit log files (2026-09-21 → 2026-09-30) generated by the workspace governance automation; no actual CI/CD builds or tests the project.
- Root `CHANGELOG.md` is a stub ("暂无新增条目；由项目 owner 在每次提交后补充"); `CHANGE.md` (8 LOC) points to `docs/state/CHANGELOG.md` (do not hand-edit).
- Branch policy: working branch `dev`, syncing against `origin/dev`; last local commit `4e05816 ci(workspace): use private governance remote`; clean working tree except for 2 untracked submit-log files (`docs/logs/submit/20260928-121723-auto-submit.md`, `docs/logs/submit/20260930-082807-auto-submit.md`).

## Cross-References

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Axi Sports Management App (Archived)".
- Project root: `/Volumes/code/workspace/archive/axi-sports-management-app`
- Project `ARCHIVE.md`: `/Volumes/code/workspace/archive/axi-sports-management-app/ARCHIVE.md` (authoritative archive notice)
- Project `AGENTS.md`: `/Volumes/code/workspace/archive/axi-sports-management-app/AGENTS.md`
- Project `README.md`: `/Volumes/code/workspace/archive/axi-sports-management-app/README.md`
- Workspace registry entry: `/Volumes/code/workspace/foundation/workspace-governance/workspace.json` under `archive.axi-sports-management-app`
- Workspace graph node: `/Volumes/code/workspace/workspace.graph.json` → `.projects.axi-sports-management-app` (or `.archive.axi-sports-management-app`)
- ADR sources referenced from `AGENTS.md`: ADR-001 through ADR-010 (under `/Volumes/code/workspace/foundation/workspace-governance/docs/adr/`)
- Workspace governance audit trail: `/Volumes/code/workspace/foundation/workspace-governance/docs/audits/workspace-docs-completeness-audit-2026-06-18.md`
- Workspace admission gate for any revival: `workspace-project route-intent --intent <intent> --domain <domain> --json` (`ARCHIVE.md` explicitly recommends a fresh admission rather than in-place revival)
- Other archived projects: under `/Volumes/code/workspace/archive/`
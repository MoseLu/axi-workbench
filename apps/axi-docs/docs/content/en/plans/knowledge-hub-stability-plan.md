---
id: axi-docs-en-plans-knowledge-hub-stability
title: Knowledge Hub Stability Plan
type: plan
status: draft
tags: [Axi Docs, plan, knowledge-hub, stability, owner-action, mcp, vite, security]
created: 2026-06-13
modified: 2026-06-13
graph-title: Knowledge Hub Stability Plan
graph-tags: [Axi Docs, Plan, Stability]
description: Stabilize the Axi Knowledge Hub runtime by removing sync I/O, enforcing CORS, and extracting duplicated Vite/MCP helpers. Sources from todo/04-roadmap.md "下一轮重点" and todo/02-legacy-audit.md owner-action table.
---

# Knowledge Hub Stability Plan

## Outcome

When this plan lands, three facts must be true:

1. `app/src/mcp/server.ts` performs no `readFileSync` / `writeFileSync` / `readdirSync` on hot paths (HTTP request handling, MCP tool dispatch, knowledge-source indexing) — all file access goes through `fs.promises`.
2. CORS for both the MCP server and the Vite plugin honors `ALLOWED_ORIGINS` as a strict allow-list. An empty/unset `ALLOWED_ORIGINS` denies all cross-origin requests instead of silently reflecting the request origin.
3. The helper layer used by `vite.config.plugin.ts` and `app/src/mcp/server.ts` (file scanning, tag extraction, search, graph build, Blinko proxy, CORS allow-list) lives in a single `app/src/lib/` module tree with tests. The two callers shrink to thin adapters.

## Context

Source documents:

- `todo/04-roadmap.md` — "下一轮重点" lists three owner actions: sync I/O rewrite, CORS allow-list enforcement, and Vite/MCP duplication extraction. The 2026-06-04 update marked this block as the next iteration after ZC-DOCS-001~005.
- `todo/02-legacy-audit.md` — 2026-03 audit P0 PERF and P1 SECURITY/CORS/PERF entries track the same three items as owner actions.

What the code shows today (verified 2026-06-13):

- `app/src/mcp/server.ts` is 2096 lines, `app/vite.config.plugin.ts` is 423 lines (the "~2000 line duplication" claim in `04-roadmap.md` overstates the file-level overlap; the real duplication is helper-level inside `server.ts` plus three hand-written CORS branches in the Vite plugin).
- Sync I/O in `server.ts` exists in 4 spots: `.env` read on startup (line 19–20), token file read (line 1353–1354), token file write (line 1360), and `dist/index.html` existence check (line 1680). All four are cold paths (startup / one-shot / preflight) except the `dist/index.html` check, which runs per request when no static file matches.
- CORS is already correctly resolved in `server.ts` via `getAllowedOrigin()` at line 1375 and used in three response branches (1487, 1532, 1663). The Vite plugin still has three hard-coded `*` headers (line 223, 286, 340). The default `ALLOWED_ORIGINS` is empty; when empty, `getAllowedOrigin` reflects the request origin (line 1380) — that is the gap.

## Grill Findings

- Assumption: the production deployment serves from a stable, finite allow-list (e.g. `https://docs.axi.local`). An empty allow-list is a misconfiguration, not a "trust everyone" fallback.
- Constraint: we must not change the public MCP tool surface (`axi_docs_*` JSON shapes) or the Vite dev-server URL routing. The refactor is internal to `app/src/`.
- Constraint: `app/vite.config.plugin.ts` runs in the Vite Node context, not the Vite browser context; it cannot import browser-only code from `app/src/`. Shared helpers must stay Node-safe.
- Rejected: rewriting the file scanner in Rust / native addon. Cost-to-benefit is wrong; the existing `fs.promises` path is enough.
- Rejected: removing the CORS layer entirely (same-origin only). The MCP server is intended to be reachable from a separate docs site and from local agents via `http://localhost:3005`.
- Open risk: the duplicate helper layer is partly untested. Extraction must add tests before the cutover, or we lose behavior coverage.
- Open risk: the Vite plugin imports `node:fs` and `node:path` directly. If we move CORS into a shared module, we need to confirm Vite's dev server still bundles / resolves the shared path the same way the production server does.

## Landing Plan

Three phases. Each phase is a stable stopping point — landing phase N must not regress phase N-1.

### Phase 1 — CORS hardening (smallest, highest security value)

1. Move `getAllowedOrigin` and `ALLOWED_ORIGINS` parsing from `app/src/mcp/server.ts` into a new `app/src/lib/cors.ts` module. Strict semantics: empty list means deny (return empty string or a sentinel that the response layer turns into no header).
2. Update the three response branches in `server.ts` to use the shared module.
3. Update the three response branches in `app/vite.config.plugin.ts` to use the same module. Add `VITE_AXI_ALLOWED_ORIGINS` (Vite-side env var) for the dev server, falling back to `ALLOWED_ORIGINS`.
4. Update `.env.example` to ship a non-empty default allow-list for local dev (e.g. `http://localhost:3005`).
5. Add tests:
   - empty allow-list → no `Access-Control-Allow-Origin` header on the response.
   - matching origin → header echoes the origin.
   - non-matching origin → header is empty (or absent) and the response is still 200/4xx as before (do not 403 the preflight, because the route may still need to answer).
6. Verification: `pnpm --dir app verify`; manual `curl -H "Origin: https://evil.example" -i` against a running dev server returns no `Access-Control-Allow-Origin: https://evil.example`.

### Phase 2 — Sync → async I/O (medium scope, performance + reliability)

1. Add `app/src/lib/fsAsync.ts` wrapping `fs.promises` with project-standard error logging.
2. Replace the four sync call sites in `server.ts`:
   - `.env` read on startup → keep sync (this is a one-time startup read; not on a hot path). Document the choice with a one-line comment.
   - Token file read → async with `fs.promises.readFile`. Wrap in a `loadOrCreateToken` async version; the sync version becomes a thin wrapper that calls the async one in a `readFile` event-loop tick (acceptable because token load is once at boot).
   - Token file write → async with `fs.promises.writeFile`. Use `mode: 0o600`.
   - `dist/index.html` existence check per request → cache the boolean at startup (the `dist/` directory does not change during a server's lifetime). Document the cache invalidation contract: server restart required if `dist/` is replaced.
3. Add a single test that loads a token file, deletes it, and verifies the next call regenerates it (covering the read-then-create branch).
4. Verification: `pnpm --dir app test:run`; `pnpm --dir app verify`; smoke the dev server with a large Obsidian vault and confirm tool dispatch latency does not spike (no formal benchmark in MVP).

### Phase 3 — Shared helper extraction (largest, depends on phases 1 + 2)

1. Identify the duplicated helpers in `app/src/mcp/server.ts`: tag extraction (`extractTagsFromContent`), frontmatter builder (`buildFrontmatter`), label extraction (`extractLabel`), source scanner (the `excludePatterns` / `supportedExtensions` / `isExcluded` / `isHiddenDir` / `isSupported` block), the `resolveSource` lookup, and the Blinko proxy wrapper.
2. Move them into `app/src/lib/knowledgeBase/` (or extend the existing module) with one test file per helper. Keep their public signatures stable for this phase.
3. Update both `server.ts` and `vite.config.plugin.ts` to import the shared helpers. Both files should become thin request routers: parse → call shared helper → respond.
4. Add an integration test that runs the same query through both the MCP tool entry point and the Vite dev `/api/*` endpoint, asserting identical response payloads (modulo CORS headers).
5. Verification: `pnpm --dir app test:run`; `pnpm --dir app verify`; line count of `server.ts` should drop by at least 30%, line count of `vite.config.plugin.ts` should drop by at least 20%.

## Out of scope (deferred to other plans)

- Web reader polish (left tree, TOC, knowledge catalog folding, mobile responsive) → `reader-experience-plan.md`.
- Legacy audit P0/P1 owner-action review workflow → `legacy-audit-revisit-plan.md`.
- React performance memoization, TypeScript `as` cleanup, test coverage CI threshold, `react-i18next`, structured logging, Sentry — all tracked in `todo/02-legacy-audit.md`, not duplicated here.

## Execution Links

- Axi Todo: not yet created. The plan is in `draft`; Axi Todo items will be opened per phase when this plan is promoted to `active`.
- Related docs:
  - `todo/04-roadmap.md` — source of "下一轮重点" scope.
  - `todo/02-legacy-audit.md` — source of owner-action table and audit history.
  - `docs/state/MILESTONE.md` M2/M4 — source governance and registry delivery gates this plan supports.
  - `docs/state/PRD.md` REQ-BOUNDARY-001 / REQ-VERIFY-001 — owner scope and verification.
  - `app/src/mcp/server.ts` — primary file under change.
  - `app/vite.config.plugin.ts` — secondary file under change.
- Verification:
  - `pnpm --dir app test:run`
  - `pnpm --dir app verify` (tsc + vite build)
  - `pnpm --dir app docs:check`
  - Manual `curl` preflight against the dev server (CORS check).

---
id: axi-docs-en-projects-axi-soul-world-milestone
title: "Axi Soul World — Milestone"
type: project
status: published
tags: [Axi Docs, Projects, products, milestone]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Milestone tracker for the Axi Soul World product.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
---

# Axi Soul World — Milestone

> Mirror of `/Volumes/code/workspace/products/axi-soul-world/IMPLEMENTATION_PLAN.md`.
> Source of truth: the project root plan.

## Active Milestone

**M1 — Three-surface split + `axi-soul-api` skeleton + Todo v3 (in flight, 2026-08-24).**

- Phone surface renamed from the never-admitted `axi-mood-app/` to `apps/android/`.
- Product core `axi-soul-api/` initialised: CMake presets, layered
  domain/application/platform/infrastructure/transport, loopback
  `/healthz` and `/readyz`, null storage adapters, contract tests. Drogon is
  Conan-gated and not the default transport yet.
- Admin Web (`apps/web-admin/`) and Web BFF (`apps/web-bff/`) carved out;
  v1 BFF is inlined into the core process.
- Android Todo redesigned: Today card, Today/Active/Done filters, overdue /
  upcoming / no-date sections, progress feedback, compact rows, Material
  date / time pickers, v3 lifecycle history (open-due = Today, all open
  grouped by date = Active, dated history = Done), activity events,
  completion timestamps, one-shot reminders, 15-minute snooze.

## Next

- **M2 — `axi-soul-api` runnable service**: wire Drogon transport, adopt
  PostgreSQL with versioned migrations, and lift the in-memory storage
  adapters out of `null_adapters`.
- **M3 — Admin Web QR login + Android scan-to-approve**: deliver the
  WeChat-style login flow; phone no longer shows a QR.
- **M4 — Check-in domain history**: migrate check-ins from
  "project + last date" to a per-day `occurrence` history with streak
  calculation in the domain layer.
- **M5 — Sync opt-in**: explicit `syncEnabled` flag, outbox/inbox, cursor
  sync, conflict UI; default remains local-authority.

## Verification

- [x] `axi-soul-api` CMake presets build (debug) and contract tests pass
      on the host.
- [x] Android `:app:checkDesignTokens` audit passes; `:app:testDebugUnitTest`
      passes on the latest Todo module changes.
- [x] Android install + UI smoke passed on device `m7lru45xu4mjcq7x`
      (Todo Today/Active/Done, secondary editor, Material date/time picker).
- [ ] Admin Web QR login and Android scan-to-approve end-to-end smoke.
- [ ] PostgreSQL migration up and down; OpenAPI contract test passes
      against `axi-soul-api`.
- [ ] Owner accepts the `BACKEND_CONTRACT.md` boundary.
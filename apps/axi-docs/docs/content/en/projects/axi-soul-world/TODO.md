---
id: axi-docs-en-projects-axi-soul-world-todo
title: "Axi Soul World — TODO"
type: project
status: published
tags: [Axi Docs, Projects, products, todo]
created: 2026-08-23
modified: 2026-08-24
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: Dossier view of the Axi Soul World product task tracker.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
---

# Axi Soul World — TODO

> Mirror pointer to the project task tracker at
> [`/Volumes/code/workspace/products/axi-soul-world/TODO.md`](/Volumes/code/workspace/products/axi-soul-world/TODO.md).
> The project root file is the source of truth and is updated as the work
> progresses.

## Highlights from the project TODO

- Done: Phase 0 product boundary, data semantics, and backend admission
  check; Phase 1 Android local SQLite base, JSON/RKStorage migration; MVP
  entries for diary, memo, todo, check-in; C++20 prototype admission
  re-evaluation.
- Done: unified Android Todo Today/Active/Done view, completion history,
  activity events, one-shot reminders (with the device install limit
  pending).
- Done: three-surface split landed in this repo (`axi-soul-api`,
  `apps/web-bff`, `apps/web-admin`, phone under `apps/android`); the
  never-admitted `axi-mood-app/` folder was folded into `apps/android/`.
- Done: `axi-soul-api` C++20 layered skeleton, loopback `/healthz`
  `/readyz`, null storage adapters.

## Next (current project TODO)

- C++20 API Drogon transport adoption; PostgreSQL migrations; explicit
  sync runtime.
- Admin Web login QR + Android scan-to-approve page; the local
  unlock page keeps showing no QR.
- Check-in domain history and timezone calculation; attachment scope
  expansion; full device flow.
- Backend route-intent / admission must clear before any hosted
  service is published.

See [`BACKEND_CONTRACT.md`](/Volumes/code/workspace/products/axi-soul-world/BACKEND_CONTRACT.md)
and [`docs/architecture/three-surface-bff.md`](/Volumes/code/workspace/products/axi-soul-world/docs/architecture/three-surface-bff.md)
for the contractual boundaries.
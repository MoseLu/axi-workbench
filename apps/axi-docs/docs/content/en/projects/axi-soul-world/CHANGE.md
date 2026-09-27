---
id: axi-docs-en-projects-axi-soul-world
title: Axi Soul World
type: project
status: draft
tags: [Axi Docs, Projects, products, reference]
created: 2026-08-23
modified: 2026-08-23
graph-title: Axi Soul World
graph-tags: [Projects, products]
description: A multi-surface local-first product: core backend in this repo, Axi Mood on Android, and an admin Web (later Mac) that logs in by phone QR scan.
project:
  id: axi-soul-world
  partition: products
  path: /Volumes/code/workspace/products/axi-soul-world
  source-section: reference
---

# Change Log

## Unreleased

- Initialized the C++20 `axi-soul-api` modular skeleton: CMake presets,
  domain/application/platform/infrastructure/transport layers, loopback
  `/healthz` and `/readyz`, null storage adapters, and contract tests.
  Drogon remains Conan-gated and is not the default transport yet.
- Split the product into a core backend and two access surfaces inside this
  repository: `axi-soul-api`, admin Web (`apps/web-admin`, later the Mac
  shell), Web BFF (`apps/web-bff`, inlined into the core process for v1),
  and the phone client. Admin login is WeChat-style: the computer
  shows a QR code, the phone scans and approves. See
  `docs/architecture/three-surface-bff.md`.
- Moved the Android client from the never-admitted `axi-mood-app/` folder
  to `apps/android/`. The product remains `axi-soul-world`; `com.axi.mood`
  is only the historical applicationId.
- Promoted Axi Soul World from the non-project incubation checkout to the
  canonical product path `products/axi-soul-world`.
- Established the production `main` and development `dev` branch model.
- Added the project handoff, verification, and workspace admission surfaces.
- Redesigned the Android Todo module with a focused Today card, Today/Active/
  Done filters, overdue/upcoming/no-date sections, progress feedback, and
  compact task rows with completion state and reminder metadata.
- Added `TodoListRules` unit coverage for the Todo filters and section ordering.
- Refined the Todo visual language after device review: removed the oversized
  hero/icon treatment, capsule filters, rounded task cards, and full-width CTA;
  replaced them with a flat list, text tabs, subtle progress, and an inline add
  action.
- Refined the Todo secondary editor as well: removed the oversized save pill,
  rounded input panel, and empty media tile; added a compact Todo input,
  lightweight attachment action, and preserved date/reminder entry flows.
- Replaced the legacy system Todo date/time dialogs with Material date and
  time pickers, including Material 24-hour clock mode and keyboard fallbacks.
- Added Todo v3 lifecycle history: Today now means open tasks due today or
  overdue, Active groups all open tasks by due date, and Done is a dated
  history view with restore and activity details.
- Added local Todo activity events, completion timestamps, one-shot reminders,
  and a 15-minute snooze action while preserving the existing SQLite/JSON
  migration path.

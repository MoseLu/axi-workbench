---
id: axi-docs-en-plans-root
title: Plans Library
type: index
status: active
tags: [Axi Docs, plans, idea-to-landing, execution]
created: 2026-06-13
modified: 2026-06-13
graph-title: Plans Library
graph-tags: [Axi Docs, Plans]
description: Durable idea-to-landing plans that remain searchable after execution tasks move to Axi Todo.
---

# Plans Library

This directory is the source of truth for durable idea-to-landing plans.

Use it for material that must survive beyond a task card:

- the original idea and the problem it targets
- assumptions challenged during a grill-me session
- rejected alternatives and decision criteria
- landing phases, acceptance checks, and verification evidence
- links to execution tasks in Axi Todo

Do not use this directory as a task queue. Axi Todo owns task status, scheduling, and next actions. A plan page may link to Axi Todo items, but the plan text should stay stable enough for future readers and agents to reconstruct why the work exists.

## Current documents

- [Idea-to-Landing Plan Contract](idea-to-landing.md)
- [Knowledge Hub Stability Plan](knowledge-hub-stability-plan.md) — draft, owner actions for sync I/O / CORS / Vite-MCP helper extraction (sourced from `todo/04-roadmap.md` and `todo/02-legacy-audit.md`)

## Plan status legend

- `draft` — idea is captured, grill-me in progress, no execution tasks yet.
- `active` — grill-me closed, execution tasks live in Axi Todo, plan body stable.
- `landed` — acceptance criteria have evidence, docs still explain the final shape.
- `superseded` — replaced by a later plan; link to the successor from the body.

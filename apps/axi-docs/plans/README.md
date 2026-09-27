# Axi Docs Planning Index

This directory is the current-repository planning entrypoint.

Use it to find the right planning category before writing or updating work:

| Category | Canonical location | Purpose |
| --- | --- | --- |
| Durable plans | `docs/content/{en,zh}/plans/` | Idea-to-landing plans, grill-me findings, decisions, non-goals, acceptance criteria, and verification evidence. |
| Execution queue | `todo/` and Axi Todo | Task slices, status, priority, owner, ordering, and next actions. |
| Delivery Log | `docs/state/MILESTONE.md` | Delivery goals and evidence-backed stage status. |
| Requirements | `docs/state/PRD.md` | Product/project requirements and non-goals. |
| Technical design and tests | `docs/state/TDD.md` | Implementation shape, test design, and verification commands. |
| Verification contract | `docs/state/VERIFICATION.md` | Which checks prove each changed surface. |

## Rule

Do not store long-lived plan bodies in `todo/`. Put durable plan records in `docs/content/{en,zh}/plans/`, then link executable items from `todo/` or Axi Todo back to the plan.

## Current Durable Plan Sources

- `docs/content/zh/plans/README.md`
- `docs/content/zh/plans/idea-to-landing.md`
- `docs/content/en/plans/README.md`
- `docs/content/en/plans/idea-to-landing.md`

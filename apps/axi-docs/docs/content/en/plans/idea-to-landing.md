---
id: axi-docs-en-plans-idea-to-landing
title: Idea-to-Landing Plan Contract
type: plan-contract
status: published
tags: [Axi Docs, plans, grill-me, todo, execution]
created: 2026-06-13
modified: 2026-06-13
graph-title: Idea-to-Landing Plan Contract
graph-tags: [Axi Docs, Plans, Execution]
description: Defines where grill-me outputs, durable plan records, and Axi Todo execution tasks belong.
---

# Idea-to-Landing Plan Contract

## Placement rule

Axi Docs owns the durable plan. Axi Todo owns the execution queue.

If a grill-me session produces a bundle of ideas, tradeoffs, constraints, phases, and acceptance criteria, write the canonical plan in `docs/content/{locale}/plans/`. Then create or link Axi Todo tasks for the concrete execution steps.

## What belongs in Axi Docs

- problem statement and target outcome
- audience, owner, and affected projects
- assumptions surfaced by the interview
- decisions, non-goals, and rejected alternatives
- phase plan from idea to landing
- acceptance criteria and verification evidence
- links to Axi Todo task records
- links to ADRs, PRDs, project dossiers, or source documents

## What belongs in Axi Todo

- task title and current status
- priority, owner, due date, and dependency order
- next action the agent or owner should take
- links back to the canonical plan page
- completion notes that should not become long-term design history

## Plan page template

```markdown
# <Plan Name>

## Outcome

What should be true when this lands?

## Context

What prompted the idea? What existing docs, tasks, or code paths matter?

## Grill Findings

- Assumption:
- Constraint:
- Rejected:
- Open risk:

## Landing Plan

1. Stabilize the contract.
2. Implement or document the smallest useful slice.
3. Verify with the narrowest command or review that proves the claim.
4. Link the execution task back to this plan.

## Execution Links

- Axi Todo:
- Related docs:
- Verification:
```

## Completion rule

Do not mark a plan landed only because the Axi Todo item is closed. A plan is landed when the acceptance criteria have evidence and the docs still explain the final shape.

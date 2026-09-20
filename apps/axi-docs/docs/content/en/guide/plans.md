---
id: axi-docs-en-guide-plans
title: Plans Library
type: guide
status: published
tags: [Axi Docs, plans, ideas, execution, English]
created: 2026-06-13
modified: 2026-06-13
graph-title: Plans Library
graph-tags: [Axi Docs, Plans]
description: Use Axi Docs for durable idea-to-landing plans and Axi Todo for execution tracking.
---

## Purpose

The plans library keeps idea-to-landing material out of the task queue. It is for durable plan records that future humans and agents need to search, cite, and revise.

## Source of truth

Write canonical plans under `docs/content/{locale}/plans/`. Keep matching paths across English and Simplified Chinese when a translation exists.

Axi Todo remains the execution queue. A Todo item should link back to the plan page instead of copying the plan body.

## Recommended flow

1. Capture or grill the idea until the outcome, constraints, and rejected alternatives are clear.
2. Write the plan in Axi Docs with frontmatter, acceptance criteria, and verification notes.
3. Create Axi Todo tasks only for executable slices.
4. Link each task back to the plan page.
5. Update the plan when the final shape changes, not for every task-state transition.

## Start here

- [Plans Library](/docs/axi-docs-en/plans/README)
- [Idea-to-Landing Plan Contract](/docs/axi-docs-en/plans/idea-to-landing)

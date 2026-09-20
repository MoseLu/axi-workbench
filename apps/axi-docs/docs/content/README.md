---
id: axi-docs-content-root
title: Axi Docs Content Root
type: index
status: active
tags: [Axi Docs, i18n, content, plans]
created: 2026-06-06
modified: 2026-06-06
graph-title: Axi Docs Content Root
graph-tags: [Axi Docs, i18n]
description: Locale-organized Markdown content for the Axi Docs site.
---

# Axi Docs Content Root

This directory is the Markdown content plane for Axi Docs.

## Locale Layout

- `en/` is the source-language documentation tree.
- `zh/` is the Simplified Chinese translation tree.

Keep matching pages at the same relative path across locales. For example:

- `en/guide/getting-started.md`
- `zh/guide/getting-started.md`
- `en/plans/idea-to-landing.md`
- `zh/plans/idea-to-landing.md`

The React app routes localized guide pages as `/en/guide/*` and `/zh/guide/*`, while the knowledge index reads the locale-specific sources `axi-docs-en` and `axi-docs-zh`.

## Content Roles

- `guide/` explains how Axi Docs works.
- `plans/` stores durable idea-to-landing plans and plan contracts.
- `projects/` stores generated or curated project dossiers.

Execution status, scheduling, and next actions belong in Axi Todo. A plan page may link to Axi Todo tasks, but the plan body remains the durable source of truth.

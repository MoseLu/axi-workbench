---
id: axi-docs-en-guide-document-sources
title: Document Sources
type: guide
status: published
tags: [Axi Docs, sources, documents, English]
created: 2026-06-07
modified: 2026-06-13
graph-title: Document Sources
graph-tags: [Axi Docs, Sources]
description: Learn how Axi Docs registers, distinguishes, and reads local document sources.
---

## Source registry

`app/src/config/documentSources.ts` is the source registry. Each entry defines a unique `id`, label, root path, adapter, source kind, locale, and read-only state.

## Built-in sources

- `axi-docs-zh` and `axi-docs-en` contain this site's Markdown: guides, plans, and project dossiers.
- `axi-skills` and `axi-skills-zh` index the shared skills library.
- `workspace` connects workspace governance and project indexes.
- `dbskill`, `obsidian`, and `blinko` are additional configured knowledge sources.

## Paths and environment variables

Default paths resolve relative to the workspace. Environment variables such as `AXI_DOCS_CONTENT_PATH`, `AXI_SKILLS_PATH`, and `AXI_WORKSPACE_GOVERNANCE_PATH` can override them. Never place credentials in Markdown or commit them to the repository.

## Add a source

Prefer an existing adapter: `markdown`, `skills`, `workspace`, or `api`. After registration, run tests and a production build, then verify catalog loading, search, and document reading against the source.

For idea-to-landing work, add durable plan pages under `docs/content/{locale}/plans/` and link execution tasks from Axi Todo back to those pages.

---
id: axi-docs-en-guide-what-is-axi-docs
title: What is Axi Docs?
type: guide
status: published
tags: [Axi Docs, guide, English]
created: 2026-06-06
modified: 2026-06-13
graph-title: What is Axi Docs?
graph-tags: [Axi Docs, Guide]
description: Learn how Axi Docs organizes guides, skills, and workspace knowledge.
---

## A documentation hub for reading and retrieval

Axi Docs is a React, Vite, and Markdown documentation application. It provides a stable reading surface for workspace material, shared skills, and project documents while retaining full-text search, tags, and knowledge relationships.

## Three top-level document sets

- **Guide** explains site structure, authoring rules, search, and maintenance.
- **Skills** indexes reusable agent capabilities and workflows from Axi Skills.
- **Workspace** presents project indexes, governance documents, and durable workspace knowledge.

Top navigation selects the document set, the left sidebar moves between pages, and the right outline moves within the current page.

## How content enters the site

Sources are registered in `app/src/config/documentSources.ts`. Axi Docs-owned content lives under `docs/content/{locale}/guide`, `docs/content/{locale}/plans`, and `docs/content/{locale}/projects`; Skills and Workspace read from their own local repositories. The server indexes these sources and exposes catalogs, content, search results, and relationship data to the UI.

## Where to begin

Start with [Getting Started](/en/guide/getting-started). For content maintenance, continue with [Document Sources](/en/guide/document-sources), [Plans Library](/en/guide/plans), [Writing Markdown](/en/guide/markdown), and [Frontmatter](/en/guide/frontmatter).

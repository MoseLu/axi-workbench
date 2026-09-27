---
id: axi-docs-en-guide-markdown
title: Writing Markdown
type: guide
status: published
tags: [Axi Docs, Markdown, writing, English]
created: 2026-06-07
modified: 2026-06-07
graph-title: Writing Markdown
graph-tags: [Axi Docs, Markdown]
description: Write clear, searchable technical documentation with the Markdown structures supported by Axi Docs.
---

## Headings and page structure

The page title comes from frontmatter `title`, so body headings begin at `##`. H2 headings populate the page outline, while H3 headings split longer sections. Use descriptive task or concept names.

## Links and emphasis

Use standard Markdown links for internal pages and external references. Keep internal links on the correct locale prefix. Use inline code for filenames, commands, configuration keys, and routes.

## Code blocks

Declare a language on fenced code blocks:

```bash
pnpm --dir app verify
```

Language declarations enable highlighting, a language label, and the copy control. Use `text` for unformatted output.

## Lists, quotes, and tables

Use lists for steps, tables for field comparisons, and blockquotes for constraints:

> Guide pages must describe current behavior rather than planned capabilities.

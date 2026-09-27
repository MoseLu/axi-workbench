---
id: axi-docs-en-guide-knowledge-graph
title: Knowledge Graph
type: guide
status: published
tags: [Axi Docs, knowledge graph, relationships, English]
created: 2026-06-07
modified: 2026-06-07
graph-title: Knowledge Graph
graph-tags: [Axi Docs, Knowledge Graph]
description: Understand how documents, tags, and wiki links create navigable knowledge relationships.
---

## Relationship sources

Axi Docs reads paths, tags, and wiki links from indexed documents. Shared tags and `[[Wiki Link]]` references create relationships; unconnected documents remain visible as orphan nodes.

## Graph metadata

`graph-title` provides a shorter graph label and `graph-tags` adds relationship topics. When absent, ordinary titles and tags are used as fallbacks.

## Document relationships

Document pages can expose outgoing links, incoming links, tag nodes, and related pages. Selecting a relationship opens the target document or searches for the topic.

## Authoring guidance

Link stable concepts and document names rather than every ordinary word. Use tags for broad topic grouping and body links for explicit knowledge dependencies.

# Axi Docs Paradigm

<!-- deep-init:layer=L1 -->

Axi Docs is a documentation control plane, not a static mirror. Its job is to make the same canonical knowledge available through the web UI, MCP tools, local source adapters, and workspace governance checks.

## Mental Model

- The project is a hub. It indexes source systems without taking ownership of all source content.
- The app is a reader and adapter runtime. `app/src/lib/knowledgeBase.ts` is the central local indexing contract.
- The workspace source is read-only. It points at `/Volumes/code/workspace/WORKSPACE_INDEX.md`, `/Volumes/code/workspace/workspace.graph.json`, and operator docs under the workspace root.
- Axi Skills is a locked external source. `docs/sources.lock.json` records the exact upstream revision used by CI and local checks.
- Product docs live under `docs/content/{en,zh}` and should remain locale-aligned.

## Decision Rules

- Prefer adapter-generated virtual documents over copying upstream workspace files into this repo.
- Keep root docs short and directive; put implementation rules in `app/AGENTS.md`.
- Any new indexed source must have a checkable contract in docs, tests, or `docs/sources.lock.json`.
- UI alignment work should be verified with tests and a browser smoke check when rendering changes.

## Stop Conditions

A documentation change is complete only when the source file exists, the adapter can expose it if expected, and the relevant check script proves the contract.

<!-- MANUAL: preserve human project intent above generated details when regenerating. -->

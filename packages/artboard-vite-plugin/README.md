# @axi/artboard-vite-plugin

Workspace-internal Vite plugin for the **Axi Artboard** overlay (formerly a standalone product at `products/axi-artboard`).

## What it provides

1. **AST source stamper** (`sourceAttrsAstPlugin`) — walks the `@babel/parser` AST of every `.ts`/`.tsx`/`.js`/`.jsx` file and injects `Name.__axi_source__ = { file, line, column }` statements into each JSX-derived function component. Runs in both dev and production.
2. **Dev-only perception endpoint** (`perceptionEndpointPlugin`) — Vite middleware exposing three HTTP routes so MCP / curl / SSE consumers can read the browser's picker state without a browser:
   - `GET  /@axi-artboard/perception` — JSON snapshot
   - `GET  /@axi-artboard/perception/stream` — SSE event stream
   - `POST /@axi-artboard/perception/publish` — receive a packet from the browser

## Consumer entry point

```ts
// apps/axi-artboard/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { artboardVitePlugin } from '@axi/artboard-vite-plugin'

export default defineConfig({
  plugins: [react(), artboardVitePlugin()],
  // ...
})
```

Or import the two plugins individually:

```ts
import { sourceAttrsAstPlugin, perceptionEndpointPlugin } from '@axi/artboard-vite-plugin'
```

## Why @babel (not Vite 8 `parseAst`)

The workbench runs on Vite 5.4, which does not expose the rolldown AST. `@babel/parser` is the canonical TypeScript + JSX parser used by babel / eslint, and matches the semantic intent of the original plugin (walk top-level statements, splice into body offsets, record file/line metadata).

## Tests

```
pnpm --filter @axi/artboard-vite-plugin test
pnpm --filter @axi/artboard-vite-plugin typecheck
pnpm --filter @axi/artboard-vite-plugin build
```

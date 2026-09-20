# Axi Artboard

AxiomaticWorld spun-out product under `products/`. **Agent node-picker: right-click pins, left-drag sweeps — say "this" or "these" and the agent knows.**

The product is a text-editor-style selector for React components. Right-click any element to pin it (chartreuse solid). Left-click + drag to sweep a region (chartreuse dashed). Both selections live in the same `targets` array, exposed on `window.__artboard.targets()` so the agent can read exactly which nodes the human meant when they say "this" / "these" / "the empty area here is too tall" — no file:line, no component name, no screenshot required.

## Status
- Lifecycle: **feature-stage** (promoted from manifest-stage on 2026-07-17; first real feature shipped: agent-node-picker)
- Stack: **React 19 + Vite 8 + TypeScript** + a tiny custom Vite plugin (`src/overlay/vite-plugin-source-attrs.ts`) that stamps every JSX-derived component with its source location.
- Workspace registration: `infra/axi-workspace-governance/workspace.json` (`axi-artboard` entry) + `workspace.graph.json` (`axi-artboard` node)
- Owner: libu
- Group brand: **AxiomaticWorld** (公理世界) — `axiomaticworld.com`
- Product line brand: **TBD**

## Quick start
```sh
pnpm install      # if node_modules/ is missing
pnpm dev          # → http://127.0.0.1:5173
```

```sh
pnpm build        # tsc -b && vite build (typecheck + bundle)
pnpm preview      # serve the built bundle
pnpm lint         # oxlint
```

The dev server is the loop. The picker is **always on by default**: the page is clean, no outlines.

## How to use

1. Look at the running app. It looks normal — no hint outlines, no overlay chrome.
2. **Right-click** any element to pin it. That one element gets a chartreuse solid ring + label. The rest of the page is untouched.
3. **Left-click + drag** to sweep a region. A chartreuse dashed rectangle follows the cursor; on release, every React component under the rectangle is added to the selection as a `marquee` pick.
4. **Right-click** adds a single pin on top of any existing selection (it does NOT clear). **Drag** adds more region picks. **Esc** clears everything. Click `clear` in the toolbar for the same.
5. Now say in chat: *"this one's too narrow"*, *"make these red"*, *"the empty area here is too tall"*. The agent reads `window.__artboard.targets()` and knows exactly which nodes you mean — and whether each one is a pin or a sweep.

```js
window.__artboard.targets()
//   [
//     {
//       id: 'button#div#root>...>button.task-add',
//       tag: 'button',
//       componentName: 'TaskForm',
//       source: '…/ui/TaskForm.tsx:5',
//       domPath: ['div#root', 'div.app-root', 'main.main', 'form.task-form', 'button.task-add'],
//       props: { onAdd: '[fn addTask]' },
//       rect: { x, y, w, h },
//       pickedAt: 1782844353922,
//       source$: 'single',   // right-click
//     },
//     {
//       id: 'li#div#root>...>li.task',
//       tag: 'li',
//       componentName: 'TaskList',
//       source: '…/ui/TaskList.tsx:3',
//       domPath: [...],
//       props: { ... },
//       rect: { ... },
//       pickedAt: 1782844396254,
//       source$: 'marquee',  // left-drag
//     },
//     ...
//   ]
```

Other API:
```js
window.__artboard.pickAt(x, y)           // programmatic right-click (replaces set)
window.__artboard.marqueePick(rect)      // programmatic left-drag (adds to set)
window.__artboard.clearTargets()         // release all + strip highlights
window.__artboard.getDebugState()        // count + targets + timestamp

// Live perception API — structured data for MCP / agent loops (fully implemented)
window.__artboard.getLivePerception()    // PerceptionPacket (targets + annotations + implicit)
window.__artboard.getAnnotations()       // Annotation[]
window.__artboard.addAnnotation(ref, "your comment here")
```

HTTP (dev):
`GET http://127.0.0.1:5173/@axi-artboard/perception` → current PerceptionPacket JSON (for direct MCP fetch or curl). No screenshot needed. Page annotations appear here immediately with source locations.

## What is in `src/` right now
- `src/main.tsx` — React 19 root, `<StrictMode>`.
- `src/App.tsx` — a real working task manager. The interesting part for agents is the `OverlayCanvas` mounted at the end of the tree.
- `src/ui/Sidebar.tsx`, `TaskForm.tsx`, `TaskList.tsx`, `MetricsTable.tsx` — the canary UI the picker has something to bind to. Not the product.
- `src/overlay/OverlayCanvas.tsx` — **the actual product**. Right-click + left-drag → `targets` array. Exposes the debug API.
- `src/overlay/inspect.ts` — DOM + fiber walk utilities. Resolves a DOM element to its React component.
- `src/overlay/source-map.ts` — resolves a React component (function) to its source location via the `__axi_source__` property the Vite plugin stamps.
- `src/overlay/vite-plugin-source-attrs.ts` — Vite plugin that injects `__axi_source__` into every function component. Dev mode only.
- `src/index.css` + `src/App.css` + `src/overlay/OverlayCanvas.css` — dark theme + picker styling.
- `public/favicon.svg` + `public/icons.svg` — product identity.

## Implementation notes

- **Two gestures, one set.** Right-click replaces the set with a single NodeRef (`source$: 'single'`); left-drag appends every intersected component (`source$: 'marquee'`). They coexist in `targets`. The toolbar readout summarizes as `N pinned + M in region`.
- **Two outlines, one color family.** Both are `#7fff00` (CSS `chartreuse`) — the same hue as the brand accent `#22ff88` family but distinctly brighter and more saturated. The right-click pin uses a solid ring; the marquee hit uses a thinner dashed ring. They don't read as the same channel as the brand green.
- **No double-click.** Double-clicking a checkbox toggles it, double-clicking text selects a word, etc. — every common UI element has built-in double-click behavior. Right-click and left-drag are universally available gestures that don't conflict.
- **DOM highlight is applied synchronously in the event handler**, not in a React useEffect. useEffect races with the same handler's setState + StrictMode's dev-mode double-invoke: the effect sees the new `targets` value React just committed, then re-resolves the DOM by domPath, but the path may not have settled yet. Applying `targetEl.classList.add('axi-artboard-selected')` in the handler with the live DOM ref the handler just resolved removes the race entirely. The useEffect is kept as an add-only fallback.
- **`pointer-events: none` on the canvas** so `elementFromPoint` and pointer events see the real UI, not the canvas. All interaction is bound to `document` in capture phase.
- **Climb-to-clickable on right-click.** Right-clicking the icon inside a button binds to the **button**, not the inner span. (Marquee picks every component the rect intersects, no climbing — that's the whole point of the gesture.)
- **`domPath` is relative to `document.body`.** `buildDomPath` does NOT include `'body'` itself; `findByDomPath` starts at `document.body` and walks children.
- **`mergeTargets` keeps single-picks stable.** When a marquee re-sweeps the same area, existing single-picks keep their `source$: 'single'` label.

## Local rules
See `AGENTS.md` for the authoritative local read order, scope, verification, and decision log.

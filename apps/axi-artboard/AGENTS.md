# Axi Artboard — Local Agent Guide

## Scope
This file governs work under `/Volumes/code/workspace/projects/axi-workbench/apps/axi-artboard`. It overrides the workspace-level `AGENTS.md` only inside this project directory. Read it before editing any file under this path.

## Read order
1. This `AGENTS.md`.
2. `README.md` (one-page status snapshot).
3. `/Volumes/code/workspace/projects/axi-workbench/AGENTS.md` for the workbench-wide contract.
4. `/Volumes/code/workspace/AGENTS.md` and `/Volumes/code/workspace/WORKSPACE_INDEX.md` for workspace-wide rules.
5. The AxiomaticWorld naming contract at `/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md` — this product is **not** part of the `Axi` product line, so it must keep its own product brand and only inherit AxiomaticWorld as the group brand.

## Project boundary
- Canonical path: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-artboard` (do not move, do not symlink, do not create parallel roots).
- Hosted sub-app under `apps/devsvc-dashboard`; the devsvc host injects `AXI_APP_BASE`, `AXI_APP_PORT`, `VITE_AXI_APP_BASE`, `VITE_AXI_HOSTED_APP`, `VITE_AXI_APP_ID`. Standalone `pnpm dev` still works (port 5173 fallback).
- This project is its own git repository. Do not run `git init` at `/Volumes/code/workspace`.
- Do not import or re-export any code from `projects/axi-*` / `shared/axi-*` / `tools/axi-*` / `references/*` unless the stack and the consumer/provider contract are explicitly chosen. A skeleton has no consumes yet.
- The `.computer-use-mcp/` subdirectory is a runtime cache for the local computer-use MCP server. Treat it as generated state, not as project content. It is already covered by `.gitignore` once that file lands.

## Lifecycle
- Current stage: **feature-stage** — promoted 2026-07-17. First real feature shipped: **agent-node-picker** (right-click pin + left-drag marquee + ambient-language anchoring via `window.__artboard.targets()`).
- The next stage is **alpha** — second real feature beyond the picker (owner scope). Do not start a feature without a one-paragraph spec.
- The demo task manager (`src/ui/*.tsx`) is a canary, not a product. Treat the OverlayCanvas + Vite plugin + debug API as the actual product surface.

## Stack (feature-stage, locked 2026-06-30, promotion 2026-07-17)
- **React 19.2 + Vite 8.1 + TypeScript ~6.0** — chosen for the tightest HMR → agent visual-observation loop (Vite ESM HMR ~50-100ms, React Refresh preserves component state).
- **No router, no state library, no UI kit, no test runner yet.** Add only when the first feature requires it; do not preinstall speculative deps.
- Dev server: `pnpm dev` → http://127.0.0.1:5173 (port is `strictPort: true`, do not silently move it).
- Build: `pnpm build` (runs `tsc -b && vite build`); `pnpm preview` for the built bundle.
- Lint: `pnpm lint` (oxlint; deliberately minimal — no eslint stack until needed).
- Typecheck: `pnpm exec tsc -b` (no dedicated script; add one only if a non-build typecheck pass becomes common).

## Open decision log
- [x] **Stack** — React 19 + Vite + TypeScript. Chosen for HMR speed + agent visual-observation loop via Chrome DevTools MCP / peekaboo. See "Agent visual feedback" below.
- [x] **Overlay architecture** — right-click single pick + left-drag marquee select, sharing one `targets` set. Earlier versions (multi-pick with shift+click, double-click single-lock, faint hint outlines) added noise or collided with built-in browser behavior. The current design: right-click = single pin (chartreuse solid), left-drag = region sweep (chartreuse dashed), both colors form one family distinct from the brand accent. Right-click was chosen over double-click because double-click toggles checkboxes, selects words, etc. Default-on is implicit; `pointer-events: none` on the canvas (see implementation notes).
- [ ] **Product brand** — `Axi Artboard` is the workspace id. The user-facing product name and any package/app identifiers are not chosen yet. AxiomaticWorld stays the group brand only.
- [ ] **Repo remote** — `remote_required: false` in `workspace.json`. Promote to `true` and set a `remote` URL only when the owner asks to push to GitHub.
- [ ] **First real product feature** — none defined. The current `src/ui/*.tsx` is a canary only.

## Agent visual feedback (the whole point of this project)
The product is `src/overlay/OverlayCanvas.tsx`. The shape is **right-click single pick + left-drag marquee select** — two complementary gestures that share one `targets` set, exactly like a text editor's caret + drag-to-select:

- The page is **clean by default** — no outlines, no hint strokes, no chrome competing for attention.
- **Right-click** any element to lock it. The element gets a solid chartreuse ring + label. Right-click replaces the set with a single NodeRef. Subsequent marquees add to the set without dropping the right-clicked one.
- **Left-click + drag** anywhere to marquee select. A chartreuse dashed rectangle follows the cursor; on release every React component whose bounding rect intersects the marquee is added to `targets`.
- **Esc** or click `clear` in the toolbar to release everything.
- The agent reads `window.__artboard.targets()` and gets a `NodeRef[]`. Each ref has `source$: 'single' | 'marquee'` so the agent can tell which picks were pinned vs swept.

The two outlines read as **two intentions**: solid chartreuse = "I pinned this one", dashed chartreuse = "everything in this region". Both colors are `#7fff00` (CSS `chartreuse`) so they form a single visual family but are still distinguishable from each other and from the brand accent `#22ff88`.

Why these two gestures (and not double-click):
- The owner dropped double-click because it collides with built-in form / button behavior (double-clicking a checkbox toggles, double-clicking text selects a word, etc.). Right-click and left-drag are universally available gestures that don't conflict with anything else.
- Right-click is the "this is special" gesture. Browsers show a context menu on it by default, but we `preventDefault()` so the menu doesn't appear.
- Left-drag is the "select a region" gesture. The same muscle memory that selects a paragraph in a text editor selects a region of components here.

### Debug surface
```js
window.__artboard.targets()              // NodeRef[]
window.__artboard.pickAt(x, y)           // programmatic single pick (replaces set)
window.__artboard.marqueePick(rect)      // programmatic marquee (adds to set)
window.__artboard.clearTargets()         // empty the set + strip DOM highlights
window.__artboard.getDebugState()        // { count, targets, timestamp }
```

### Live perception API (fully implemented)
```js
window.__artboard.getLivePerception()    // PerceptionPacket (explicitTargets + primary + recentInteractions + annotations)
window.__artboard.getAnnotations()        // Annotation[]
window.__artboard.addAnnotation(ref, text)  // attach a page comment to a node
```
See `src/overlay/perception.ts` for `PerceptionPacket`, `NodeRef`, `Annotation`, and `Interaction` types. HTTP endpoint: `GET /@axi-artboard/perception` (dev only) returns the current packet as JSON.

### NodeRef shape
```ts
{
  id:           string                       // tag + domPath joined by '>'
  tag:          string                       // 'button', 'div', etc.
  componentName: string                      // React function name
  source:        string | null               // '…/ui/TaskForm.tsx:5'
  domPath:       string[]                    // ['div#root', 'div.app-root', ..., 'button.task-add']
  props:         Record<string, unknown> | null   // shallow, fns summarized
  rect:          { x, y, w, h }              // viewport-space
  pickedAt:      number                      // epoch ms
  source$:       'single' | 'marquee'       // which gesture added it
}
```

### Key implementation notes
- **Two handlers, one set.** `contextmenu` (right-click) replaces the
  set with a single NodeRef. `pointerdown / pointermove /
  pointerup` (left-drag) appends a hit list via `mergeTargets()`.
  The set is a single `NodeRef[]`; per-node `source$` lets the agent
  filter.
- **No hint outlines.** The page is clean until you actually pick.
  Earlier versions drew a faint outline on every component, but
  that just made the page busy. The human looks at the running app
  and uses the right gesture.
- **DOM highlight is applied synchronously in the event handler**,
  not in a React useEffect. useEffect runs after React commits,
  which races with the same handler's setState + StrictMode's
  dev-mode double-invoke: the effect sees the new `targets` value
  React just committed, then re-resolves the DOM by domPath, but
  the path may not have settled yet. Applying
  `targetEl.classList.add('axi-artboard-selected')` in the handler
  with the live DOM ref the handler just resolved removes the race
  entirely. The useEffect is kept as an add-only fallback that
  fills in any classes the handler missed (e.g. after React
  unmounts and remounts a node).
- **`pointer-events: none` on the canvas** so `elementFromPoint`
  and pointer events see the real UI, not the canvas. All
  interaction is bound to `document` in capture phase.
- **Climb-to-clickable on right-click.** Right-clicking the icon
  inside a button binds to the **button** (`<button>` / `<a>` /
  `<input>` / `<label>` / `[role=button]`), not the inner `<span>`.
  See `climbToClickable` in `OverlayCanvas.tsx`. (Marquee picks
  every component the rect intersects, no climbing — that's the
  whole point of the gesture.)
- **`domPath` is relative to `document.body`.** The first segment
  is always a direct child of body. `buildDomPath` does NOT
  include `'body'` itself. `findByDomPath` starts at `document.body`
  and walks children for each segment.
- **`mergeTargets` keeps single-picks stable.** When a marquee
  re-sweeps the same area, existing single-picks keep their
  `source$: 'single'` label and only update coords / pickedAt
  when the same `domPath` is hit.

### How source locations are resolved
The Vite plugin `src/overlay/vite-plugin-source-attrs.ts` stamps every
JSX-derived function component with `__axi_source__ = { file, line, column }`
at transform time. `src/overlay/source-map.ts` reads it back, unwrapping
`forwardRef` / `memo` first. `src/overlay/inspect.ts` walks the React
fiber tree to resolve a DOM element to the nearest composite component.

## Verification
The smallest meaningful verification is now `verify` from the graph:

```sh
/Volumes/code/workspace/scripts/workspace-project verify axi-artboard
# internally runs:
#   1. /Volumes/code/workspace/scripts/workspace-project validate
#   2. pnpm --filter @axi/axi-artboard build   (tsc -b && vite build)
#   3. pnpm --filter @axi/axi-artboard test:run   (vitest, TDD-gated)
```

**TDD 硬约束 (2026-07-02 起)**: Any change to a Success Criterion, an
Acceptance row, a pure helper, hook, or component under `src/overlay/**`
must follow the red-then-green flow defined in
[`docs/process/tdd-driven-prd.md`](./docs/process/tdd-driven-prd.md).
A merge to `dev` whose machine-verifiable suite is not green — or whose
new behavior was not preceded by a failing test — is reversed per the
Lockdown policy below.

Plus the health probes (run `workspace-project health axi-artboard`):

```
test -f AGENTS.md / README.md / package.json
test -d .git
curl http://127.0.0.1:5173/  → 200
```

The dev-server HTTP probe is the live signal that the agent loop is ready. If it fails, the dev server is not running — start it with `pnpm dev` (use `run_in_background: true` so the loop stays alive across tool calls).

## Solo owner governance
Inherited from the workspace `AGENTS.md`:
- The owner (`libu`) has final authority for `main`, production, secrets, and releases.
- Agents may edit, test, commit, and push ordinary local work on `dev` or task branches after verification. Use `agent/<task>` branches for cross-project, shared-package, or high-risk changes.
- Keep `main` stable. Do not merge to `main` without an explicit owner request.
- No remote is configured yet; pushing is not available.

## Anti-patterns (do not do these)
- Do not introduce a router, state library, UI kit, or test runner before the first feature needs it. Stack is intentionally minimal — speculative deps slow HMR and add surface area.
- Do not add `prettier` / `eslint` config files; `oxlint` via `pnpm lint` is the entire lint story. Adding prettier would create a second formatter with no agreed config.
- Do not move the dev server off port 5173 without updating `workspace.graph.json` `health[]` and the README; the agent loop hardcodes `http://127.0.0.1:5173/`.
- Do not write a `provides` / `consumes` business contract in `workspace.graph.json` that the product does not actually expose or consume. The graph is a contract, not aspiration.
- Do not hand-edit `workspace.json` / `workspace.graph.json` outside the `axi-artboard` entry while working in this project. Touch only the new block.
- Do not move the directory under `projects/axi-*` or `tools/axi-*` — it is a `products/*` AxiomaticWorld spun-out product by registration.
- **No red test, no feature** — never land an implementation commit whose
  matching vitest case was not already on `dev` in a failing state. Reverse
  TDD (impl first, then a passing test) is a hard reject. See
  [`docs/process/tdd-driven-prd.md`](./docs/process/tdd-driven-prd.md) §6.

# Axi Artboard — Product Requirements Document

> **Status**: Active (feature-stage)
> **Last updated**: 2026-09-17
> **Owner**: libu
> **Group brand**: [AxiomaticWorld](https://axiomaticworld.com) (公理世界)

---

## 1. Project Overview

### 1.1 What is Axi Artboard

Axi Artboard is a real-time visual feedback surface that enables a human to point at React components on a running page and communicate "this one" or "these" to an AI agent with zero ambiguity — no `file:line` citation, no component name lookup, no screenshot diff, no copy-pasted DOM path.

The product looks like a normal running app. The human looks at it, right-clicks an element to pin it, or left-drags to sweep a region, and the agent reads the selection through a stable, scriptable API (`window.__artboard.*`). The same API exposes a live perception stream — including any annotation the human types while pointing — so an agent loop can drive the page forward without round-tripping through vision.

**The agent loop is the primary user.** Axi Artboard is a target of communication between a human and a coding agent working on a real React app.

### 1.2 AxiomaticWorld Product Line

Axi Artboard is a spun-out product under `products/` within the AxiomaticWorld product line. AxiomaticWorld focuses on tooling that enhances the human-agent collaboration loop in software development.

```
AxiomaticWorld (Group Brand)
└── Axi Artboard (Product — brand TBD)
    └── Agent Node Picker: right-click pins, left-drag sweeps
```

### 1.3 Workspace Role

In the `/Volumes/code/workspace` monorepo, Axi Artboard is:

- **Canonical path**: `/Volumes/code/workspace/projects/axi-workbench/apps/axi-artboard`
- **Vite plugin package**: `@axi/artboard-vite-plugin` at `/Volumes/code/workspace/projects/axi-workbench/packages/artboard-vite-plugin`
- **Registration**: `workspace.graph.json` (under `axi-workbench.provides`), `apps/devsvc-dashboard/config/axi-apps.json`
- **Owns**: Agent interaction tooling, visual feedback overlay, source location stamping
- **Consumes**: `@axi/artboard-vite-plugin` (workspace); otherwise standalone
- **Provides**: `window.__artboard` API, `artboard-vite-plugin`, perception packet

---

## 2. Problem Statement

Coding agents working on real UIs have three concrete problems when receiving visual instructions from a human:

| Problem | Description | Impact |
|---------|-------------|--------|
| **Reference ambiguity** | Phrases like "that one's too narrow" or "the empty area here is too tall" leave the agent guessing which DOM node the human means | Agent acts on wrong targets |
| **Round-trip cost** | Screenshotting, uploading, asking the human to draw on it, and re-asking adds seconds to every visual iteration | Slowest loop in agent-driven development |
| **State opacity** | Agent has no cheap way to read the page's current state — what is hovered, what just changed, what the human is looking at | Agent re-derives state repeatedly |

**Axi Artboard exists to make visual references between a human and an agent as cheap and unambiguous as typing a `file:line` for non-visual work.**

---

## 3. Core Features

### 3.1 Agent Node Picker (Feature-Stage, shipped 2026-07-17)

The primary shipped feature. Two complementary gestures share one selection set:

| Gesture | Action | Visual | Source |
|---------|--------|--------|--------|
| **Right-click** | Replaces selection with single node (`source$: 'single'`) | Solid chartreuse ring + label | Pinned |
| **Left-drag** | Appends all intersected components (`source$: 'marquee'`) | Dashed chartreuse rectangle | Swept |
| **Esc / Clear** | Empties selection, strips DOM highlights | — | — |
| **⌘P / Ctrl+P** | Toggles picker on/off globally | Status indicator | — |

### 3.2 Annotation System

Human can attach short comments to selected nodes:

- Floating textarea appears when nodes are selected
- Comments attached to `domPath` with source location
- Available via `window.__artboard.getAnnotations()` and `addAnnotation()`
- Part of the live perception packet

### 3.3 Live Perception API

Structured data stream for MCP / agent loops:

```typescript
interface PerceptionPacket {
  explicitTargets: NodeRef[]      // Current selection
  primary: NodeRef | null         // First selected or last interaction
  recentInteractions: Interaction[] // Last 8 interactions
  annotations: Annotation[]        // Human comments
  timestamp: number
  version: string
  capabilities: string[]
}
```

Dev server endpoints:
- `GET /@axi-artboard/perception` — JSON snapshot
- `GET /@axi-artboard/perception/stream` — SSE event stream (25s heartbeat)
- `POST /@axi-artboard/perception/publish` — Browser → server sync

### 3.4 Vite Development Server Plugin

AST-based source location stamper (`vite-plugin-source-attrs-ast.ts`):

- Runs in both dev and production builds
- Catches `React.memo` / `forwardRef` / `styled.*` wrappers
- Handles re-exports via scope binding lookup
- Stamps `__axi_source__ = { file, line, column }` on every JSX-derived function component

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Technology | Rationale |
|-------|------------|------------|
| Framework | React 19.2 | Tightest HMR loop for agent visual-observation |
| Build tool | Vite 8.1 | ESM HMR ~50-100ms, AST parsing built-in |
| Language | TypeScript ~6.0 | Type safety for API contracts |
| Styling | Tailwind CSS 4 + SCSS | Dual-token system (design tokens + Tailwind utilities) |
| Testing | Vitest + Testing Library | TDD-driven PRD process |
| Linting | oxlint | Minimal lint until complexity warrants full stack |

### 4.2 Module Map

```
src/
├── main.tsx                          # React 19 root, StrictMode
├── App.tsx                           # Canary UI (task manager)
├── overlay/
│   ├── OverlayCanvas.tsx             # THE PRODUCT — picker UI + event handlers
│   ├── inspect.ts                    # DOM + fiber walk utilities
│   ├── source-map.ts                 # __axi_source__ resolution
│   ├── perception.ts                # Live perception store
│   ├── server-perception.ts         # Dev server bridge
│   ├── vite-plugin-source-attrs-ast.ts  # AST source stamper
│   ├── __pure__/                    # Pure helpers (100% test coverage required)
│   │   ├── mergeTargets.ts          # Selection merge logic
│   │   ├── buildDomPath.ts          # DOM path construction
│   │   ├── domPathLookup.ts         # Path → element resolution
│   │   ├── climbToClickable.ts      # Clickable ancestor walk
│   │   ├── geometry.ts              # intersects, toXYWH
│   │   ├── summary.ts               # countSummary
│   │   ├── props.ts                 # summarizeProps
│   │   └── ref.ts                   # toRef, publicNode
│   ├── hooks/                       # React hooks (TDD-tested)
│   │   ├── usePickerOn.ts           # Picker toggle state
│   │   ├── useAnnotationDraft.ts    # Annotation input state
│   │   ├── useTargets.ts            # Selection state
│   │   └── useCrosshair.ts          # Crosshair position state
│   └── canvas/
│       └── paint.ts                 # Canvas 2D rendering
├── ui/                               # Canary UI components (NOT the product)
│   ├── Sidebar.tsx
│   ├── TaskForm.tsx
│   ├── TaskList.tsx
│   └── MetricsTable.tsx
├── styles/
│   ├── tokens.scss                  # Design token definitions
│   ├── mixins.scss                  # SCSS mixins
│   └── tailwind.css                 # Tailwind CSS 4 config (@theme block)
└── overlay/
    └── *.scss                        # SCSS partials for overlay styling
```

### 4.3 API Contract

**Global object**: `window.__artboard`

```typescript
// Selection
window.__artboard.targets()              // NodeRef[]
window.__artboard.pickAt(x, y)           // programmatic single pick
window.__artboard.marqueePick(rect)      // programmatic marquee
window.__artboard.clearTargets()         // empty selection

// Perception
window.__artboard.getLivePerception()    // PerceptionPacket
window.__artboard.getAnnotations()       // Annotation[]
window.__artboard.addAnnotation(ref, text)
window.__artboard.clearAnnotations()
window.__artboard.clearAll()

// Debug
window.__artboard.getDebugState()        // { count, targets, timestamp }

// Picker control
window.__artboard.setPickerOn(on: boolean)
window.__artboard.getPickerOn()          // boolean

// Metadata
window.__artboard.perceptionVersion      // "1.0-perception-mvp"
window.__artboard.perceptionCapabilities // ['picker', 'annotations', ...]
```

### 4.4 NodeRef Shape

```typescript
interface NodeRef {
  id: string                        // tag + domPath joined by '>'
  tag: string                       // 'button', 'div', etc.
  componentName: string             // React function name
  source: string | null             // '…/ui/TaskForm.tsx:5'
  domPath: string[]                 // relative to document.body
  props: Record<string, unknown> | null
  rect: { x: number; y: number; w: number; h: number }  // viewport-space
  pickedAt: number                  // epoch ms
  source$: 'single' | 'marquee'     // which gesture produced it
}
```

---

## 5. Key Implementation Decisions

### 5.1 Why Right-Click + Left-Drag (Not Double-Click)

Double-click collides with built-in form/button behavior:
- Double-clicking a checkbox toggles it
- Double-clicking text selects a word
- Every common UI element has built-in double-click behavior

**Right-click** = "this is special" gesture (pinned)
**Left-drag** = "select a region" gesture (swept)

Both are universally available gestures that don't conflict with anything else.

### 5.2 Why `pointer-events: none` on Canvas

The overlay canvas stays at `pointer-events: none` so:
- `elementFromPoint` and pointer events see the real UI, not the canvas
- All interaction is bound to `document` in capture phase
- The picker never blocks the host app's interactions

### 5.3 Synchronous DOM Highlights (No useEffect Race)

DOM highlights are applied **synchronously in the event handler** with the live DOM ref, not in a React `useEffect`. This eliminates the race condition where:
1. Handler sets state
2. StrictMode double-invokes the handler
3. useEffect runs after React commits
4. DOM path may not have settled yet

The `useEffect` is kept as an **add-only fallback** for unmount/remount cycles.

### 5.4 Blueprint Cartography Visual Language

The canvas paints four layers:
1. Rulers (top + left) with pixel-coord labels
2. Crosshair (horizontal + vertical hairlines + coord badge)
3. Live marquee rectangle during drag
4. Selection tags for picked nodes

The DOM highlight classes (`.axi-artboard-selected` / `.axi-artboard-marqueed`) carry the actual box outlines; the canvas only paints "drafting chrome."

---

## 6. Lifecycle & Stage

| Stage | Date | Milestone |
|-------|------|-----------|
| **manifest-stage** | 2026-06-30 | Project scaffolded, stack chosen |
| **feature-stage** | 2026-07-17 | First real feature shipped: agent-node-picker |
| **alpha** | TBD | Second real feature beyond the picker (owner scope) |

**Current stage**: feature-stage (first feature shipped)

### Next Stage Gate

The transition to alpha requires:
- A one-paragraph spec for the next feature (owner-defined)
- All TDD matrix rows green
- `workspace-project verify axi-artboard` passing

---

## 7. Acceptance Criteria

### 7.1 Build & Dev Server

| Criterion | Verification |
|-----------|--------------|
| `pnpm build` exits 0 with no warnings | `tsc -b && vite build` clean |
| `pnpm dev` boots in under 2s on warm machine | Port 5173 responds with 200 |
| `pnpm test:run` all passing | `vitest run` exit 0 |

### 7.2 Picker Behavior

| Criterion | Verification |
|-----------|--------------|
| Right-click shows solid chartreuse ring within 1 frame | Manual: right-click any element |
| Left-drag shows dashed chartreuse rectangle | Manual: drag over components |
| Marquee yields precise leaf-node set (not nested parents) | DOM tree inspection |
| `source$: 'single'` preserved after marquee overlaps it | `mergeTargets` contract test |
| `Esc` clears selection and DOM highlights | `targets() === []` |
| No React re-render on `pointermove` | Perf: zero `setState` per move |

### 7.3 API Contract

| Criterion | Verification |
|-----------|--------------|
| `targets()` returns `NodeRef[]` with all fields populated | `getDebugState()` inspection |
| Every `NodeRef` has non-null `source` (file:line) | Vite plugin stamping verified |
| `domPath` resolves back to same element after re-render | `findByDomPath` test |
| `GET /@axi-artboard/perception` returns valid JSON | `curl :5173/@axi-artboard/perception` |
| SSE stream emits `change` event within 1 frame of gesture | SSE consumer test |
| Annotation survives selection clear (annotation list persists) | Manual + test |

### 7.4 TDD Coverage Requirements

| Surface | Line Coverage | Branch Coverage |
|---------|--------------|-----------------|
| `src/overlay/__pure__/**` | 100% | 100% |
| Hooks in `src/overlay/**` (no DOM mount) | 100% | n/a |
| Components / mount-heavy code | 80% | n/a |
| `vite-plugin-source-attrs-ast.ts` | excluded | — |

---

## 8. Non-Goals (Out of Scope)

| Exclusion | Rationale |
|-----------|-----------|
| Visual regression / screenshot diff | Host agent loop has vision; Axi Artboard's job is to name the target |
| Design / editing tools | Axi Artboard names targets; the agent does the editing |
| Router, state library, UI kit, test runner | Intentional minimalism keeps HMR under 100ms |
| Multi-tab / multi-frame / cross-origin | Single page, one tab, same-origin baseline |
| Production telemetry | HTTP surface is dev-only by design |
| Hosted SaaS / cloud component | Dev-time overlay only |
| Styling-target awareness | Reads React component, not CSS rule |
| Natural language replacement | Yields `NodeRef`; agent still reads source code |

---

## 9. Open Decisions (Owner-Required)

| Decision | Status | Notes |
|----------|--------|-------|
| **Product brand** | Open | "Axi Artboard" is the workspace ID; user-facing name TBD |
| **Repo remote** | Open | `remote_required: false` in workspace.json; promote when owner asks |
| **First real product feature** | Open | Canary UI retired; OverlayCanvas is the surface; owner owns feature scope |

---

## 10. Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| Local agent guide | `AGENTS.md` | Scope, read order, verification, TDD policy |
| Status snapshot | `README.md` | Quick start, API reference, implementation notes |
| Detailed planning | `docs/planning/product-requirements-document.md` | Extended PRD with TDD matrix |
| TDD process | `docs/process/tdd-driven-prd.md` | Red-green-refactor workflow, coverage thresholds |
| Governance registration | `infra/axi-workspace-governance/workspace.json` | Workspace graph entry |
| Workspace graph | `workspace.graph.json` | Provider/consumer contracts |
| AxiomaticWorld naming | `/Volumes/code/workspace/docs/axi/AXIOMATICWORLD_NAMING.md` | Brand rules |

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-09-17 | PRD.md created as main product entry point; updated lifecycle from manifest-stage to feature-stage; added workspace role, module map, and acceptance criteria |
| 2026-07-02 | Initial detailed PRD with TDD matrix in `docs/planning/product-requirements-document.md` |
| 2026-07-17 | Promoted to feature-stage; agent-node-picker shipped |
| 2026-06-30 | Project scaffolded; stack chosen: React 19 + Vite 8 + TypeScript |

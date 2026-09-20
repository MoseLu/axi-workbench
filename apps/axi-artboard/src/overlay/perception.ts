/**
 * perception.ts — Live Structured Perception store for real-time MCP consumption.
 *
 * Provides:
 * - PerceptionPacket with explicit targets + implicit context + annotations
 * - EventTarget for change notifications (in-page + bridgeable)
 * - getLivePerception(), addAnnotation(), etc.
 *
 * This is the bridge that makes "human comments on page → AI immediately knows"
 * possible via structured (no-screenshot) data + source locations.
 *
 * The OverlayCanvas keeps this in sync. Dev server endpoints and MCP tools
 * read from here (via window or /__axi/perception).
 */

export interface NodeRef {
  id: string
  tag: string
  componentName: string
  source: string | null
  domPath: string[]
  props: Record<string, unknown> | null
  rect: { x: number; y: number; w: number; h: number }
  pickedAt: number
  /** 'single' (right-click) or 'marquee' (left-drag hit). */
  source$: 'single' | 'marquee'
}

export interface Annotation {
  id: string
  /** Reference to the node(s) this comment is attached to. */
  ref: {
    domPath: string[]
    componentName: string
    source: string | null
    tag: string
  }
  text: string
  rect: { x: number; y: number; w: number; h: number }
  createdAt: number
}

export interface Interaction {
  type: 'click' | 'pin' | 'marquee' | 'hover'
  ref: Pick<NodeRef, 'domPath' | 'componentName' | 'source' | 'tag' | 'rect'>
  at: number
}

export interface PerceptionPacket {
  /** Current explicit selection from picker (right-click + marquee). */
  explicitTargets: NodeRef[]
  /** Strongest single signal (first explicit, else lastInteraction). */
  primary: NodeRef | null
  /** Recent interactions (clicks, pins, etc.) for implicit context. */
  recentInteractions: Interaction[]
  annotations: Annotation[]
  /** Lightweight viewport hints (optional, start minimal). */
  viewportSummary?: {
    mainComponentNames: string[]
  }
  timestamp: number
  version: string
  capabilities: string[]
}

type PerceptionEvent = 'change' | 'selectionchange' | 'annotationadd' | 'annotationremove'

const VERSION = '1.0-perception-mvp'
const CAPABILITIES = ['picker', 'annotations', 'live-packet', 'implicit-context']

// Module-level latest snapshot (for dev-server HTTP + quick MCP reads).
// The React component keeps this updated.
let latestPacket: PerceptionPacket = {
  explicitTargets: [],
  primary: null,
  recentInteractions: [],
  annotations: [],
  timestamp: Date.now(),
  version: VERSION,
  capabilities: CAPABILITIES,
}

const listeners = new Set<(type: PerceptionEvent, packet: PerceptionPacket) => void>()

/** Internal: update the live packet and notify. */
function setLatest(next: Partial<PerceptionPacket>, event: PerceptionEvent = 'change') {
  latestPacket = {
    ...latestPacket,
    ...next,
    timestamp: Date.now(),
    version: VERSION,
    capabilities: CAPABILITIES,
  }
  listeners.forEach((fn) => {
    try { fn(event, latestPacket) } catch {}
  })
  // Mirror to the dev server so SSE/curl consumers see the same
  // packet. We fire-and-forget; failures are logged but never block.
  // The dev endpoint only exists when running `pnpm dev`, so a
  // missing endpoint (production / no dev server) is harmless.
  void publishToDevServer(latestPacket)
}

/**
 * Best-effort POST to the dev server's perception endpoint. Errors
 * are swallowed — the in-browser store is the source of truth.
 */
function publishToDevServer(packet: PerceptionPacket) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  try {
    fetch('/@axi-artboard/perception/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
      keepalive: true,
    }).catch(() => {
      // Swallow — endpoint may not exist in production.
    })
  } catch {
    // ignore
  }
}

/** Get a fresh snapshot. Safe for MCP / fetch. */
export function getLivePerception(): PerceptionPacket {
  // Return a shallow clone so callers can't mutate internal state.
  return {
    ...latestPacket,
    explicitTargets: latestPacket.explicitTargets.map((t) => ({ ...t })),
    recentInteractions: latestPacket.recentInteractions.map((i) => ({ ...i })),
    annotations: latestPacket.annotations.map((a) => ({ ...a })),
  }
}

export function getAnnotations(): Annotation[] {
  return latestPacket.annotations.map((a) => ({ ...a }))
}

/** Called by OverlayCanvas on every targets change. */
export function syncExplicitTargets(targets: NodeRef[]) {
  const primary = targets.length > 0 ? { ...targets[0] } : latestPacket.primary
  const nextRecent = [...latestPacket.recentInteractions]
  if (targets.length > 0) {
    const top = targets[0]
    nextRecent.unshift({
      type: top.source$ === 'single' ? 'pin' : 'marquee',
      ref: {
        domPath: top.domPath,
        componentName: top.componentName,
        source: top.source,
        tag: top.tag,
        rect: top.rect,
      },
      at: Date.now(),
    })
    // Keep ring buffer small
    if (nextRecent.length > 8) nextRecent.length = 8
  }
  setLatest({
    explicitTargets: targets.map((t) => ({ ...t })),
    primary: primary ? { ...primary } : null,
    recentInteractions: nextRecent,
  }, 'selectionchange')
}

/** Record a natural interaction (used for implicit context). */
export function recordInteraction(type: Interaction['type'], ref: NodeRef) {
  const inter: Interaction = {
    type,
    ref: {
      domPath: ref.domPath,
      componentName: ref.componentName,
      source: ref.source,
      tag: ref.tag,
      rect: ref.rect,
    },
    at: Date.now(),
  }
  const next = [inter, ...latestPacket.recentInteractions].slice(0, 8)
  const primary = latestPacket.primary ?? { ...ref }
  setLatest({ recentInteractions: next, primary }, 'change')
}

/** Add a page comment/annotation attached to a node. */
export function addAnnotation(
  refLike: Pick<NodeRef, 'domPath' | 'componentName' | 'source' | 'tag' | 'rect'>,
  text: string
): Annotation {
  const ann: Annotation = {
    id: 'ann_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    ref: {
      domPath: [...refLike.domPath],
      componentName: refLike.componentName,
      source: refLike.source,
      tag: refLike.tag,
    },
    text: text.trim().slice(0, 500),
    rect: { ...refLike.rect },
    createdAt: Date.now(),
  }
  const nextAnns = [...latestPacket.annotations, ann]
  setLatest({ annotations: nextAnns }, 'annotationadd')
  return ann
}

export function removeAnnotation(id: string) {
  const next = latestPacket.annotations.filter((a) => a.id !== id)
  if (next.length !== latestPacket.annotations.length) {
    setLatest({ annotations: next }, 'annotationremove')
  }
}

export function clearAnnotations() {
  if (latestPacket.annotations.length > 0) {
    setLatest({ annotations: [] }, 'annotationremove')
  }
}

export function clearAll() {
  setLatest({
    explicitTargets: [],
    primary: null,
    recentInteractions: [],
    annotations: [],
  }, 'change')
}

/** Subscribe to perception changes. Returns unsubscribe. */
export function onPerceptionEvent(
  cb: (type: PerceptionEvent, packet: PerceptionPacket) => void
): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** For dev server / external readers to get the raw latest without clone overhead. */
export function getRawLatestForBridge() {
  return latestPacket
}

// Expose a tiny marker so MCPs / agents can detect the capability fast.
const w: any = (globalThis as any).window ?? (globalThis as any)
if (w) {
  w.__artboard = w.__artboard || {}
  w.__artboard.perceptionVersion = VERSION
  w.__artboard.perceptionCapabilities = CAPABILITIES
}

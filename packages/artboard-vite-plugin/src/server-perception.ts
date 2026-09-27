/**
 * server-perception.ts — Dev-server-side perception store.
 *
 * The browser-side `perception.ts` keeps state in the page's JS heap.
 * For MCP / curl / SSE consumers that need to read state without a
 * browser, we mirror it server-side:
 *
 *   1. Browser calls `window.__artboard.publish(packet)` (which we
 *      will add below) → POSTs the current packet to
 *      `/@axi-artboard/perception/publish`.
 *   2. Vite middleware (configureServer in `perception-endpoint.ts`)
 *      writes the packet into the in-memory store defined here.
 *   3. SSE consumers (`GET /@axi-artboard/perception/stream`) get an
 *      `event: change` line every time the store updates.
 *
 * Why a separate file: we need this code to be importable from
 * `vite.config.ts` (which is loaded by the dev server, NOT by the
 * browser). If we put it in `perception.ts`, importing it into the
 * Vite config would pull the browser-side module into the server
 * process and break (it touches `window`).
 */

export interface ServerPerceptionPacket {
  explicitTargets: any[]
  primary: any | null
  recentInteractions: any[]
  annotations: any[]
  timestamp: number
  version: string
  capabilities: string[]
  [k: string]: unknown
}

const VERSION = '1.0-perception-mvp'
const CAPABILITIES = ['picker', 'annotations', 'live-packet', 'implicit-context']

let latest: ServerPerceptionPacket = {
  explicitTargets: [],
  primary: null,
  recentInteractions: [],
  annotations: [],
  timestamp: 0,
  version: VERSION,
  capabilities: CAPABILITIES,
}

type Subscriber = (packet: ServerPerceptionPacket) => void
const subscribers = new Set<Subscriber>()

export function getLatest(): ServerPerceptionPacket {
  return latest
}

export function setLatest(packet: ServerPerceptionPacket): void {
  latest = {
    ...packet,
    version: VERSION,
    capabilities: CAPABILITIES,
    timestamp: Date.now(),
  }
  for (const fn of subscribers) {
    try {
      fn(latest)
    } catch {
      /* subscriber error — ignore */
    }
  }
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

/**
 * Merge a published packet into the store. We accept any partial
 * and shallow-merge into the latest snapshot, so the client can
 * publish just the changed slice.
 */
export function mergePublished(partial: Partial<ServerPerceptionPacket>): ServerPerceptionPacket {
  const next: ServerPerceptionPacket = {
    ...latest,
    ...partial,
    version: VERSION,
    capabilities: CAPABILITIES,
    timestamp: Date.now(),
  }
  setLatest(next)
  return next
}

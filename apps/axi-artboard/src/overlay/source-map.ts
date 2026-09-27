/**
 * source-map.ts — resolve a React component (function) to its source
 * location (file:line:column).
 *
 * Strategy:
 * 1. If the function reference has a `__axi_source__` property attached
 *    by the Vite plugin (see `vite-plugin-source-attrs-ast.ts`), use that.
 * 2. Otherwise, fall back to a best-effort `Function.prototype.toString()`
 *    parse — works only for components defined at the top level of a
 *    module file, where the function source contains a comment marker
 *    injected by our plugin (`/* @axiSource file:line *\/`).
 *
 * The Vite plugin path is the supported one. The fallback covers the
 * edge case where the plugin was not loaded (e.g. production build).
 */

interface SourceLocation {
  file: string
  line: number
  column: number
}

const cache = new WeakMap<object, SourceLocation | null>()

/** Attached by the Vite plugin to every JSX-derived function component. */
declare global {
  interface Function {
    __axi_source__?: SourceLocation
  }
}

const FALLBACK_RE = /\/\*\s*@axiSource\s+([^\s*]+):(\d+):(\d+)\s*\*\//

export function getComponentSource(fn: unknown): SourceLocation | null {
  if (typeof fn !== 'function' && (typeof fn !== 'object' || fn === null)) {
    return null
  }
  // Some components are wrapped (forwardRef, memo). Unwrap to find the
  // function reference that the plugin stamped.
  const f = unwrap(fn)
  if (!f) return null

  if (cache.has(f)) return cache.get(f) ?? null

  let result: SourceLocation | null = null

  // 1. Direct __axi_source__ property
  if (typeof (f as any).__axi_source__ === 'object' && (f as any).__axi_source__) {
    const s = (f as any).__axi_source__ as SourceLocation
    result = { file: s.file, line: s.line, column: s.column }
  } else {
    // 2. Fallback: parse from toString()
    try {
      const src = Function.prototype.toString.call(f)
      const m = src.match(FALLBACK_RE)
      if (m) {
        result = { file: m[1], line: Number(m[2]), column: Number(m[3]) }
      }
    } catch {
      // toString may throw on native functions
    }
  }

  cache.set(f, result)
  return result
}

function unwrap(t: unknown): Function | null {
  if (typeof t === 'function') return t as Function
  if (typeof t === 'object' && t !== null) {
    const o = t as { type?: unknown; render?: unknown }
    if (typeof o.type === 'function') return o.type
    if (typeof o.render === 'function') return o.render
  }
  return null
}

/** Format a source location for display. */
export function formatSource(loc: SourceLocation | null): string {
  if (!loc) return 'unknown'
  // Trim long paths to the last 2 segments for readability
  const parts = loc.file.split('/')
  const short = parts.length > 2 ? '…/' + parts.slice(-2).join('/') : loc.file
  // The Vite plugin emits 0-based lines; humans expect 1-based.
  return `${short}:${loc.line + 1}`
}

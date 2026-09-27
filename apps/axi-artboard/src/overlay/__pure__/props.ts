/**
 * props — summarize React props for the public NodeRef shape.
 * Extracted from OverlayCanvas.tsx for TDD testability.
 *
 * Pair tests: src/overlay/__pure__/props.test.ts
 * PRD row:    M-19
 */

export function summarizeProps(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) {
    if (k === 'children') continue
    if (typeof v === 'function') {
      out[k] = `[fn ${(v as Function).name || 'anonymous'}]`
    } else if (v instanceof HTMLElement || v instanceof Element) {
      out[k] = `[${v.tagName.toLowerCase()}]`
    } else if (typeof v === 'string' && v.length > 80) {
      out[k] = v.slice(0, 80) + '…'
    } else {
      out[k] = v
    }
  }
  return out
}
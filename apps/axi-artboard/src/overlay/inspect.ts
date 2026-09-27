/**
 * Inspect — fiber + DOM utilities for the agent visual feedback layer.
 *
 * Walks the React fiber tree to map any DOM element to its component
 * (function name) and source location (file:line). All functions are
 * pure reads; they never mutate the React tree.
 */

import { getComponentSource } from './source-map'

export interface ComponentInfo {
  /** DOM node that represents this component in the rendered tree. */
  dom: HTMLElement
  /** React component display name, function name, or "host(tag)" for DOM. */
  componentName: string
  /** fiber.elementType — usually the function reference itself. */
  componentType: unknown
  /** Component's props (the ones the React instance last received). */
  props: Record<string, unknown> | null
  /** Source file:line if available, else null. */
  source: { file: string; line: number; column: number } | null
  /** Component's bounding rect in viewport coordinates. */
  rect: DOMRect
}

/**
 * Get the fiber attached to a DOM node.
 * React 19 exposes the fiber via a property keyed like `__reactFiber$xyz`.
 */
export function getFiber(dom: HTMLElement): any | null {
  const key = Object.keys(dom).find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  )
  if (!key) return null
  // @ts-expect-error — non-standard prop
  return dom[key]
}

/**
 * Walk up the fiber tree to the nearest composite component fiber.
 * A composite component has `type` as a function (or an object that
 * wraps one, e.g. forwardRef / memo).
 */
export function getCompositeFiber(fiber: any | null): any | null {
  let cur = fiber
  let depth = 0
  while (cur && depth < 64) {
    const t = cur.type
    if (typeof t === 'function' || (typeof t === 'object' && t !== null && '$$typeof' in t)) {
      return cur
    }
    cur = cur.return
    depth++
  }
  return null
}

/** Component name (function name, displayName, or memo/forwardRef unwrap). */
export function getComponentName(fiber: any): string {
  if (!fiber) return 'unknown'
  const t = fiber.type
  if (typeof t === 'string') return `host(${t})`
  if (!t) return 'unknown'
  // forwardRef / memo unwrap
  const inner = t.type ?? t.render ?? t
  if (typeof inner === 'function') {
    return inner.displayName || inner.name || 'Anonymous'
  }
  if (typeof t === 'object') {
    return t.displayName || t.name || 'Unknown'
  }
  return String(t)
}

/**
 * For a DOM element, resolve its bounding rect and React component info.
 * Returns null when no fiber can be resolved.
 */
export function inspect(dom: HTMLElement): ComponentInfo | null {
  const fiber = getFiber(dom)
  const composite = getCompositeFiber(fiber)
  const componentType = composite?.type ?? null
  const componentName = getComponentName(composite ?? fiber)
  const props = composite?.memoizedProps
    ? { ...composite.memoizedProps }
    : null
  const source = componentType ? getComponentSource(componentType) : null
  const rect = dom.getBoundingClientRect()
  return { dom, componentName, componentType, props, source, rect }
}

/**
 * Reverse lookup: given a viewport coordinate, find the topmost React
 * component under that point.
 */
export function inspectAt(x: number, y: number): ComponentInfo | null {
  // elementFromPoint ignores pointer-events: none, so the overlay canvas
  // (which is set to none) won't shadow the real UI.
  const el = document.elementFromPoint(x, y)
  if (!el || !(el instanceof HTMLElement)) return null
  return inspect(el)
}

/**
 * Walk the rendered DOM and return one ComponentInfo per element that
 * has a React fiber. Skips elements with no fiber and elements with
 * zero size. Optionally throttled to a max count for very large pages.
 */
export function indexAllElements(opts: { max?: number; root?: HTMLElement } = {}): ComponentInfo[] {
  const max = opts.max ?? 2000
  const root = opts.root ?? document.body
  const out: ComponentInfo[] = []
  const stack: Element[] = [root]
  while (stack.length && out.length < max) {
    const el = stack.pop()!
    if (el instanceof HTMLElement) {
      const fiber = getFiber(el)
      if (fiber) {
        const rect = el.getBoundingClientRect()
        // Skip zero-size or off-screen elements
        if (rect.width > 0 && rect.height > 0) {
          const info = inspect(el)
          if (info) out.push(info)
        }
      }
      // Recurse into shadow DOM via children iteration
      let child = el.firstElementChild
      // Push in reverse so traversal is document order
      const kids: Element[] = []
      while (child) { kids.push(child); child = child.nextElementSibling }
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i])
    }
  }
  return out
}

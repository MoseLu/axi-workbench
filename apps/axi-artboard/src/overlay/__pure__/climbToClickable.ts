/**
 * climbToClickable — pure DOM walk. Returns the closest ancestor of `el`
 * (including `el` itself) that the browser will recognize as clickable,
 * OR null if no such ancestor is found within a depth of 8.
 *
 * "Clickable" matches the production rules in OverlayCanvas.tsx:
 *   - Tag is BUTTON / A / INPUT / SELECT / TEXTAREA / SUMMARY / LABEL
 *   - role attribute matches /button|link|checkbox|menuitem|tab|option/i
 *   - inline onclick handler OR data-on-click attribute is present
 *
 * Extracted from OverlayCanvas.tsx for unit testability. See
 * docs/process/tdd-driven-prd.md.
 */

const CLICKABLE_TAGS = new Set([
  'BUTTON',
  'A',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'SUMMARY',
  'LABEL',
])
const CLICKABLE_ROLES = /button|link|checkbox|menuitem|tab|option/i
const MAX_DEPTH = 8

export function climbToClickable(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el
  let depth = 0
  while (cur && depth < MAX_DEPTH) {
    if (CLICKABLE_TAGS.has(cur.tagName)) return cur
    const role = cur.getAttribute('role')
    if (role && CLICKABLE_ROLES.test(role)) return cur
    if (cur.onclick || (cur.dataset as DOMStringMap | undefined)?.onClick) return cur
    cur = cur.parentElement
    depth++
  }
  return null
}

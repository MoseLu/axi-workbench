/**
 * buildDomPath — pure function over the DOM tree. Walks parents and returns
 * a relative segment list for the given element.
 *
 * Contract (verified by src/overlay/__pure__/buildDomPath.test.ts):
 * 1. The first segment is always a direct child of document.body; 'body' itself
 *    is NEVER included in the returned array (the path is relative to body).
 * 2. The walk stops before the documentElement (html); the path never
 *    contains 'html'.
 * 3. Each segment is `tag` + optional `#id`, or `tag.className` when no id
 *    is set (first class only).
 *
 * Extracted from OverlayCanvas.tsx for unit testability. See
 * docs/process/tdd-driven-prd.md.
 */

export function buildDomPath(el: HTMLElement): string[] {
  // Path is rooted at document.body, so the first segment is always
  // a direct child of body. Do NOT include 'body' in the path —
  // findByDomPath starts at document.body and walks children, so
  // including 'body' would cause the first lookup to fail.
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur.parentElement && cur.parentElement !== document.documentElement) {
    const tag = cur.tagName.toLowerCase()
    let segment = tag
    if (cur.id) segment += `#${cur.id}`
    else if (cur instanceof HTMLElement && cur.className && typeof cur.className === 'string') {
      const first = cur.className.trim().split(/\s+/)[0]
      if (first) segment += `.${first}`
    }
    parts.unshift(segment)
    cur = cur.parentElement
  }
  return parts
}

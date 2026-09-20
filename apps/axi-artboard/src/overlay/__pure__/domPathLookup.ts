/**
 * domPathLookup — inverse of buildDomPath. Walks document.body children
 * using the segment rules (tag / #id / .class) to find the element
 * whose path matches.
 *
 * Pair tests: src/overlay/__pure__/domPathLookup.test.ts
 * PRD row:    M-22
 *
 * NOTE: this function reads document.body at call time. It is a
 * "pure-ish" DOM reader — same input shape + same DOM state = same
 * output. Tests must reset document.body between cases.
 */

export function findByDomPath(path: string[]): HTMLElement | null {
  // Path is relative to document.body (buildDomPath does not include
  // 'body' itself). Start at body and walk children for each segment.
  let cur: Element | null = document.body
  for (const segment of path) {
    if (!cur) return null
    const tag = segment.split(/[#.]/)[0]
    const wantId = segment.includes('#') ? segment.split('#')[1].split('.')[0] : null
    const wantClass = segment.includes('.') ? segment.split('.').slice(1).join(' ') : null
    let found: Element | null = null
    for (const child of Array.from(cur.children)) {
      if (child.tagName.toLowerCase() !== tag) continue
      if (wantId && child.id !== wantId) continue
      if (wantClass) {
        const cls = (child as HTMLElement).className || ''
        const have = cls.trim().split(/\s+/)
        if (!wantClass.split(/\s+/).every((c) => have.includes(c))) continue
      }
      found = child
      break
    }
    cur = found
  }
  return cur as HTMLElement | null
}
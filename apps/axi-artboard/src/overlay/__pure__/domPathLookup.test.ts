/**
 * RED-then-GREEN test for domPathLookup.ts. Pins the M-22 row of the PRD.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { findByDomPath } from './domPathLookup'

const build = (html: string) => {
  document.body.innerHTML = html
}

describe('findByDomPath', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null for an empty path', () => {
    build('<div></div>')
    expect(findByDomPath([])).toBe(document.body)
  })

  it('finds a direct child of body by tag name', () => {
    build('<div id="root"></div>')
    const el = findByDomPath(['div#root'])
    expect(el).not.toBeNull()
    expect(el!.id).toBe('root')
  })

  it('finds a tag without id by walking children', () => {
    build('<main><section><p>hi</p></section></main>')
    const el = findByDomPath(['main', 'section', 'p'])
    expect(el).not.toBeNull()
    expect(el!.textContent).toBe('hi')
  })

  it('matches a class segment', () => {
    build('<div class="container"><span class="x"></span></div>')
    const el = findByDomPath(['div.container', 'span.x'])
    expect(el).not.toBeNull()
    expect(el!.tagName.toLowerCase()).toBe('span')
  })

  it('returns null when a path segment has no matching child', () => {
    build('<div></div>')
    expect(findByDomPath(['section'])).toBeNull()
  })

  it('returns null mid-path when an intermediate element does not exist', () => {
    build('<main><p>only child</p></main>')
    expect(findByDomPath(['main', 'section', 'p'])).toBeNull()
  })
})
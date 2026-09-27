/**
 * RED-then-GREEN test for geometry.ts. Pins the M-16 (intersects) and
 * M-17 (toXYWH) rows of the PRD Machine-Verifiable matrix.
 */

import { describe, it, expect } from 'vitest'
import { intersects, toXYWH } from './geometry'

describe('intersects', () => {
  it('returns true when rects overlap on any pixel (the default marquee rule)', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
  })

  it('returns true when one rect is fully inside the other', () => {
    expect(intersects({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(true)
  })

  it('returns true when rects share a single edge (x + w == other.x)', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(true)
  })

  it('returns false when rects are completely disjoint on the x axis', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 0, w: 10, h: 10 })).toBe(false)
  })

  it('returns false when rects are completely disjoint on the y axis', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 100, w: 10, h: 10 })).toBe(false)
  })
})

describe('toXYWH', () => {
  it('passes through a fully populated XYWH', () => {
    expect(toXYWH({ x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('normalizes a DOMRect-style {x, y, width, height} into XYWH', () => {
    expect(toXYWH({ x: 1, y: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('normalizes a left/top/right/bottom rect into XYWH', () => {
    expect(toXYWH({ left: 10, top: 20, right: 30, bottom: 50 })).toEqual({
      x: 10,
      y: 20,
      w: 20,
      h: 30,
    })
  })

  it('falls back to 0 / 0 origin when nothing is provided', () => {
    expect(toXYWH({})).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})
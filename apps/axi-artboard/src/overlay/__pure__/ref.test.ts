/**
 * RED-then-GREEN test for ref.ts. Pins M-20 (toRef) and M-21 (publicNode).
 */

import { describe, it, expect } from 'vitest'
import { toRef, publicNode } from './ref'
import type { NodeRef } from '../perception'

type Overrides = {
  componentName?: string
  source?: unknown
  props?: Record<string, unknown> | null
  rect?: { x: number; y: number; width: number; height: number }
}

const fakeInfo = (overrides: Overrides = {}) => {
  const dom = document.createElement('div')
  document.body.appendChild(dom)
  const o = overrides as Overrides
  return {
    dom,
    componentName: o.componentName ?? 'X',
    source: 'source' in o ? o.source : { file: 'src/X.tsx', line: 5, column: 3 },
    props: 'props' in o ? (o.props ?? null) : { onClick: () => {}, label: 'hi' },
    rect: o.rect ?? { x: 10.4, y: 20.6, width: 30.7, height: 40.2 },
  }
}

describe('toRef', () => {
  it('builds a NodeRef from ComponentInfo with rounded coords', () => {
    const ref = toRef(fakeInfo(), 'single')
    expect(ref.tag).toBe('div')
    expect(ref.componentName).toBe('X')
    expect(ref.source).toBe('src/X.tsx:5:3')
    expect(ref.rect).toEqual({ x: 10, y: 21, w: 31, h: 40 })
    expect(ref.source$).toBe('single')
    expect(ref.domPath).toEqual(['div']) // direct child of body
    // pickedAt is stamped; just check it's a positive number.
    expect(typeof ref.pickedAt).toBe('number')
    expect(ref.pickedAt).toBeGreaterThan(0)
  })

  it('summarizes function props into "[fn name]" form', () => {
    const ref = toRef(fakeInfo({
      props: { onClick: function handler() {}, label: 'btn' },
    }), 'single')
    expect(ref.props).toEqual({ onClick: '[fn handler]', label: 'btn' })
  })

  it('returns null props when info.props is null', () => {
    const ref = toRef(fakeInfo({ props: null }), 'single')
    expect(ref.props).toBeNull()
  })

  it('returns null source when info.source is null', () => {
    const ref = toRef(fakeInfo({ source: null }), 'single')
    expect(ref.source).toBeNull()
  })

  it('tags source$ as "marquee" when called for a marquee hit', () => {
    const ref = toRef(fakeInfo(), 'marquee')
    expect(ref.source$).toBe('marquee')
  })
})

describe('publicNode', () => {
  it('returns a structurally identical NodeRef (no private fields dropped today)', () => {
    const ref: NodeRef = {
      id: 'i',
      tag: 'div',
      componentName: 'C',
      source: 'x.ts:1',
      domPath: ['a'],
      props: { foo: 1 },
      rect: { x: 0, y: 0, w: 0, h: 0 },
      pickedAt: 0,
      source$: 'single',
    }
    expect(publicNode(ref)).toEqual(ref)
  })
})
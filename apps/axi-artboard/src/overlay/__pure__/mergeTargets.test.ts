import { describe, it, expect } from 'vitest'
import { mergeTargets } from './mergeTargets'
import type { NodeRef } from '../perception'

/**
 * RED-GREEN tests for mergeTargets. Each `it` pins one slice of the
 * contract documented at the top of mergeTargets.ts. Together they
 * cover the four behaviors the OverlayCanvas relies on during a
 * marquee sweep.
 */

const ref = (
  domPath: string[],
  source$: 'single' | 'marquee' = 'single',
  pickedAt = 0,
  rect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 },
): NodeRef => ({
  id: `${domPath[domPath.length - 1] ?? 'div'}#${domPath.join('>')}`,
  tag: (domPath[domPath.length - 1] ?? 'div').split(/[#.]/)[0],
  componentName: 'X',
  source: null,
  domPath,
  props: null,
  rect,
  pickedAt,
  source$,
})

describe('mergeTargets', () => {
  it('keeps an existing single pick when a marquee adds new nodes', () => {
    const prev = [ref(['main', 'button.add'], 'single', 100)]
    const next = [ref(['main', 'div.list'], 'marquee', 200)]
    const out = mergeTargets(prev, next)
    expect(out.map((t) => t.domPath.join('>'))).toEqual([
      'main>button.add',
      'main>div.list',
    ])
  })

  it('preserves source$ = single when the same domPath is re-hit by a marquee', () => {
    const prev = [ref(['main', 'button.add'], 'single', 100)]
    const next = [ref(['main', 'button.add'], 'marquee', 200)]
    const out = mergeTargets(prev, next)
    expect(out).toHaveLength(1)
    expect(out[0].source$).toBe('single')
    // coords / pickedAt ARE refreshed from the latest hit
    expect(out[0].pickedAt).toBe(200)
  })

  it('refreshes rect and pickedAt from the latest hit', () => {
    const prev = [
      ref(['main', 'button.add'], 'single', 100, { x: 1, y: 1, w: 1, h: 1 }),
    ]
    const next = [
      ref(['main', 'button.add'], 'marquee', 999, { x: 10, y: 20, w: 30, h: 40 }),
    ]
    const out = mergeTargets(prev, next)
    expect(out[0].rect).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    expect(out[0].pickedAt).toBe(999)
    expect(out[0].source$).toBe('single')
  })

  it('appends unseen nodes from `next` even when `prev` is empty', () => {
    const next = [
      ref(['main', 'div.a'], 'marquee', 1),
      ref(['main', 'div.b'], 'marquee', 2),
    ]
    expect(mergeTargets([], next)).toEqual(next)
  })

  it('dedups by domPath joined with >', () => {
    const a = ref(['main', 'button.add'], 'marquee', 1)
    const b = ref(['main', 'button.add'], 'marquee', 2)
    const c = ref(['main', 'button.del'], 'marquee', 3)
    const out = mergeTargets([a, c], [b])
    expect(out.map((t) => t.domPath.join('>'))).toEqual([
      'main>button.add',
      'main>button.del',
    ])
  })

  it('returns an empty array when both inputs are empty', () => {
    expect(mergeTargets([], [])).toEqual([])
  })
})
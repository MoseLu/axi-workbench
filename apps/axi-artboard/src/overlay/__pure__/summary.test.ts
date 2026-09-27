/**
 * RED-then-GREEN test for summary.ts. Pins the M-18 row of the PRD.
 */

import { describe, it, expect } from 'vitest'
import { countSummary } from './summary'
import type { NodeRef } from '../perception'

const ref = (
  domPath: string[],
  source$: 'single' | 'marquee',
): NodeRef => ({
  id: domPath.join('>'),
  tag: 'div',
  componentName: 'X',
  source: null,
  domPath,
  props: null,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  pickedAt: 0,
  source$,
})

describe('countSummary', () => {
  it('returns "1 pin" for a single single-pick', () => {
    expect(countSummary([ref(['a'], 'single')])).toBe('1 pin')
  })

  it('returns "N in region" for a single-pass marquee only', () => {
    expect(countSummary([ref(['a'], 'marquee'), ref(['b'], 'marquee')])).toBe(
      '2 in region',
    )
  })

  it('singular "1 in region" when exactly one marquee hit', () => {
    expect(countSummary([ref(['a'], 'marquee')])).toBe('1 in region')
  })

  it('uses "pins" (plural) for 2+ single picks', () => {
    expect(
      countSummary([ref(['a'], 'single'), ref(['b'], 'single')]),
    ).toBe('2 pins')
  })

  it('combines pins and marquee hits with " + "', () => {
    expect(
      countSummary([
        ref(['a'], 'single'),
        ref(['b'], 'marquee'),
        ref(['c'], 'marquee'),
      ]),
    ).toBe('1 pin + 2 in region')
  })

  it('returns an empty string for no targets', () => {
    // Function does not special-case empty; parts.join(' + ') → "".
    // Pin this so a future change has to think about it explicitly.
    expect(countSummary([])).toBe('')
  })
})
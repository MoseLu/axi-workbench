/**
 * RED-then-GREEN test for useTargets. Pins the M-34 row of the PRD.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTargets } from './useTargets'
import type { NodeRef } from '../perception'

const ref = (
  path: string[],
  source$: 'single' | 'marquee' = 'single',
): NodeRef => ({
  id: path.join('>'),
  tag: 'div',
  componentName: 'X',
  source: null,
  domPath: path,
  props: null,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  pickedAt: 0,
  source$,
})

describe('useTargets', () => {
  it('starts with an empty array', () => {
    const { result } = renderHook(() => useTargets())
    expect(result.current.targets).toEqual([])
    expect(result.current.targetsRef.current).toEqual([])
  })

  it('setSingle replaces the array with a single ref', () => {
    const { result } = renderHook(() => useTargets())
    act(() => result.current.setSingle(ref(['main', 'button.add'])))
    expect(result.current.targets).toHaveLength(1)
    expect(result.current.targets[0].domPath).toEqual(['main', 'button.add'])
  })

  it('appendMany merges new refs into the existing array', () => {
    const { result } = renderHook(() => useTargets())
    act(() => result.current.setSingle(ref(['main', 'button.add'], 'single')))
    act(() =>
      result.current.appendMany([
        ref(['main', 'div.list'], 'marquee'),
        ref(['main', 'li.item'], 'marquee'),
      ]),
    )
    expect(result.current.targets.map((t) => t.domPath.join('>'))).toEqual([
      'main>button.add',
      'main>div.list',
      'main>li.item',
    ])
  })

  it('appendMany keeps single-pick labels when re-hitting the same path', () => {
    const { result } = renderHook(() => useTargets())
    act(() => result.current.setSingle(ref(['main', 'btn'], 'single')))
    act(() => result.current.appendMany([ref(['main', 'btn'], 'marquee')]))
    const t = result.current.targets.find((x) => x.domPath.join('>') === 'main>btn')
    expect(t?.source$).toBe('single')
  })

  it('appendMany with an empty array is a no-op', () => {
    const { result } = renderHook(() => useTargets())
    act(() => result.current.setSingle(ref(['main', 'btn'])))
    const before = result.current.targets
    act(() => result.current.appendMany([]))
    expect(result.current.targets).toBe(before)
  })

  it('clear empties the array', () => {
    const { result } = renderHook(() => useTargets())
    act(() => result.current.setSingle(ref(['main', 'btn'])))
    act(() => result.current.clear())
    expect(result.current.targets).toEqual([])
    expect(result.current.targetsRef.current).toEqual([])
  })

  it('targetsRef mirrors the latest state after each update', () => {
    const { result } = renderHook(() => useTargets())
    act(() => result.current.setSingle(ref(['a'])))
    expect(result.current.targetsRef.current).toHaveLength(1)
    act(() => result.current.clear())
    expect(result.current.targetsRef.current).toEqual([])
  })
})
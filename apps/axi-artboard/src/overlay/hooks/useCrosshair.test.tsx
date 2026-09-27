/**
 * RED-then-GREEN test for useCrosshair. Pins the M-35 row of the PRD.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCrosshair } from './useCrosshair'

describe('useCrosshair', () => {
  it('starts as null', () => {
    const { result } = renderHook(() => useCrosshair())
    expect(result.current.crosshair).toBeNull()
  })

  it('set(x, y) updates to the given point', () => {
    const { result } = renderHook(() => useCrosshair())
    act(() => result.current.set(100, 200))
    expect(result.current.crosshair).toEqual({ x: 100, y: 200 })
    act(() => result.current.set(300, 400))
    expect(result.current.crosshair).toEqual({ x: 300, y: 400 })
  })

  it('clear() resets to null', () => {
    const { result } = renderHook(() => useCrosshair())
    act(() => result.current.set(1, 2))
    act(() => result.current.clear())
    expect(result.current.crosshair).toBeNull()
  })

  it('coerces numeric inputs (does not throw on NaN — caller is responsible)', () => {
    const { result } = renderHook(() => useCrosshair())
    act(() => result.current.set(NaN, NaN))
    // The hook itself does not guard; the consumer (OverlayCanvas) is
    // expected to pass finite numbers. We just assert it stores
    // whatever was passed.
    expect(result.current.crosshair).toEqual({ x: NaN, y: NaN })
  })
})
/**
 * useCrosshair — pointer coordinate state for the live overlay.
 *
 * Behavior (pinned by useCrosshair.test.tsx):
 *   - starts as `null`
 *   - `set(x, y)` updates to `{ x, y }`
 *   - `clear()` resets to `null`
 *
 * PRD rows: M-35
 */

import { useCallback, useState } from 'react'

export type CrosshairPoint = { x: number; y: number }
export type UseCrosshairReturn = {
  crosshair: CrosshairPoint | null
  set: (x: number, y: number) => void
  clear: () => void
}

export function useCrosshair(): UseCrosshairReturn {
  const [crosshair, setCrosshair] = useState<CrosshairPoint | null>(null)
  const set = useCallback((x: number, y: number) => {
    setCrosshair({ x, y })
  }, [])
  const clear = useCallback(() => setCrosshair(null), [])
  return { crosshair, set, clear }
}
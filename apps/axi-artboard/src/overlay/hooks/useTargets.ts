/**
 * useTargets — manages the picked NodeRef[] plus its ref-mirror and
 * the common mutation ops (single-pick replace, marquee append, clear).
 *
 * Behavior (pinned by useTargets.test.tsx):
 *   - `targets` is a React state NodeRef[]
 *   - `targetsRef.current` mirrors the state so hot-path handlers can
 *     read it without re-rendering
 *   - `setSingle(ref)` REPLACES the array with `[ref]`
 *   - `appendMany(refs)` MERGES the refs with the existing array (via
 *     `mergeTargets` so single-picks keep their `source$` label)
 *   - `clear()` empties the array
 *
 * The DOM-highlight side-effect (add/remove CSS classes on real DOM
 * elements) is NOT part of this hook — it lives in OverlayCanvas's
 * useEffect because it depends on `findByDomPath` resolution timing.
 * This hook is the pure state + ref + op API.
 *
 * PRD rows: M-34
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeRef } from '../perception'
import { mergeTargets } from '../__pure__/mergeTargets'

export type UseTargetsReturn = {
  targets: NodeRef[]
  targetsRef: React.MutableRefObject<NodeRef[]>
  setSingle: (ref: NodeRef) => void
  appendMany: (refs: NodeRef[]) => void
  clear: () => void
}

export function useTargets(): UseTargetsReturn {
  const [targets, setTargets] = useState<NodeRef[]>([])
  const targetsRef = useRef<NodeRef[]>([])

  useEffect(() => {
    targetsRef.current = targets
  }, [targets])

  const setSingle = useCallback((ref: NodeRef) => {
    setTargets([ref])
  }, [])

  const appendMany = useCallback((refs: NodeRef[]) => {
    if (refs.length === 0) return
    setTargets((prev) => mergeTargets(prev, refs))
  }, [])

  const clear = useCallback(() => {
    setTargets([])
  }, [])

  return { targets, targetsRef, setSingle, appendMany, clear }
}
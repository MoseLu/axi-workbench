/**
 * useAnnotationDraft — textarea state + commit action for the
 * in-toolbar annotation editor.
 *
 * Behavior (pinned by useAnnotationDraft.test.tsx):
 *   - `draft` reflects the current textarea content
 *   - `setDraft(value)` updates the textarea content
 *   - `commit()` looks at the *first* current target and a `targetRef`,
 *     calls the consumer's `onCommit(ref, text)` callback when both
 *     targetRef.current is non-null AND text is non-empty after trim
 *   - `commit()` clears the draft on success
 *   - `reset()` clears the draft unconditionally
 *
 * PRD rows: M-33
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeRef } from '../perception'

export type UseAnnotationDraftOptions = {
  /** Called when the user successfully commits an annotation. The
   * caller owns the perception-store side-effect (addAnnotation). */
  onCommit: (ref: NodeRef, text: string) => void
}

export type UseAnnotationDraftReturn = {
  draft: string
  setDraft: (next: string) => void
  /** Ref-mirror of the current draft. Hot-path handlers can read
   * it without subscribing to re-renders. */
  draftRef: React.MutableRefObject<string>
  /** Commits the current draft against the given target ref. Returns
   * true if the commit went through, false otherwise. */
  commit: (targetRef: { current: NodeRef | null | undefined }) => boolean
  reset: () => void
}

export function useAnnotationDraft(
  options: UseAnnotationDraftOptions,
): UseAnnotationDraftReturn {
  const [draft, setDraft] = useState('')
  const draftRef = useRef('')

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const commit = useCallback(
    (targetRef: { current: NodeRef | null | undefined }): boolean => {
      const ref = targetRef.current
      if (!ref) return false
      const text = draftRef.current.trim()
      if (!text) return false
      options.onCommit(ref, text)
      setDraft('')
      return true
    },
    [options],
  )

  const reset = useCallback(() => setDraft(''), [])

  return { draft, setDraft, draftRef, commit, reset }
}
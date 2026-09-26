/**
 * RED-then-GREEN test for useAnnotationDraft. Pins the M-33 row.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnnotationDraft } from './useAnnotationDraft'
import type { NodeRef } from '../perception'

const fakeRef = (): NodeRef => ({
  id: 'i',
  tag: 'div',
  componentName: 'X',
  source: null,
  domPath: ['main'],
  props: null,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  pickedAt: 0,
  source$: 'single',
})

describe('useAnnotationDraft', () => {
  it('starts with an empty draft', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useAnnotationDraft({ onCommit }))
    expect(result.current.draft).toBe('')
    expect(result.current.draftRef.current).toBe('')
  })

  it('setDraft updates both state and the ref mirror', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useAnnotationDraft({ onCommit }))
    act(() => result.current.setDraft('hello'))
    expect(result.current.draft).toBe('hello')
    expect(result.current.draftRef.current).toBe('hello')
  })

  it('commit() returns false when targetRef is null', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useAnnotationDraft({ onCommit }))
    act(() => result.current.setDraft('  something  '))
    const ok = result.current.commit({ current: null })
    expect(ok).toBe(false)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commit() trims the text and clears the draft on success', () => {
    const onCommit = vi.fn()
    const ref = fakeRef()
    const targetRef = { current: ref }
    const { result } = renderHook(() => useAnnotationDraft({ onCommit }))
    act(() => result.current.setDraft('  too tall  '))
    let ok = false
    act(() => {
      ok = result.current.commit(targetRef)
    })
    expect(ok).toBe(true)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(ref, 'too tall')
    expect(result.current.draft).toBe('')
  })

  it('commit() returns false on whitespace-only text without clearing', () => {
    const onCommit = vi.fn()
    const ref = fakeRef()
    const { result } = renderHook(() => useAnnotationDraft({ onCommit }))
    act(() => result.current.setDraft('   '))
    let ok = true
    act(() => {
      ok = result.current.commit({ current: ref })
    })
    expect(ok).toBe(false)
    expect(onCommit).not.toHaveBeenCalled()
    // draft stays put so the user doesn't lose their typing
    expect(result.current.draft).toBe('   ')
  })

  it('reset() clears the draft unconditionally', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useAnnotationDraft({ onCommit }))
    act(() => result.current.setDraft('work in progress'))
    act(() => result.current.reset())
    expect(result.current.draft).toBe('')
  })
})
/**
 * usePickerOn — toggles the overlay's "picker-on" mode.
 *
 * Behavior (pinned by usePickerOn.test.tsx):
 *   - default value is `true` (picker is on at mount)
 *   - `toggle()` flips the boolean
 *   - `setOn(boolean)` accepts an explicit value (coerced)
 *   - consumers can read either the state value OR a ref-stable
 *     snapshot (`pickerOnRef.current`) for hot paths (event handlers)
 *   - when toggled off, a `onTurnOff` callback fires so the consumer
 *     can drop transient state (marquee, highlights) — defaults to no-op
 *
 * PRD rows: M-32
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type UsePickerOnOptions = {
  onTurnOff?: () => void
}

export type UsePickerOnReturn = {
  pickerOn: boolean
  pickerOnRef: React.MutableRefObject<boolean>
  setOn: (on: boolean) => void
  toggle: () => void
}

export function usePickerOn(options: UsePickerOnOptions = {}): UsePickerOnReturn {
  const [pickerOn, setPickerOn] = useState(true)
  const pickerOnRef = useRef(true)

  // Keep the ref synced so handlers reading ref.current always see
  // the latest value without re-binding.
  useEffect(() => {
    pickerOnRef.current = pickerOn
  }, [pickerOn])

  const setOn = useCallback(
    (on: boolean) => {
      const next = !!on
      pickerOnRef.current = next
      setPickerOn(next)
      if (!next) options.onTurnOff?.()
    },
    [options],
  )

  const toggle = useCallback(() => {
    setOn(!pickerOnRef.current)
  }, [setOn])

  return { pickerOn, pickerOnRef, setOn, toggle }
}
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

const MIN_THUMB_SIZE = 24
const INACTIVE_DELAY_MS = 720

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function measureScrollbarSize() {
  if (typeof document === 'undefined') return 0

  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.top = '-9999px'
  probe.style.width = '120px'
  probe.style.height = '120px'
  probe.style.overflow = 'scroll'
  document.body.appendChild(probe)
  const size = probe.offsetWidth - probe.clientWidth
  probe.remove()

  if (size > 0) return size

  if (typeof navigator !== 'undefined') {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      || navigator.platform
      || navigator.userAgent
      || ''
    if (/win/i.test(platform)) {
      return 17
    }
  }

  return 0
}

interface OverlayScrollbarProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  viewClassName?: string
  wrapClassName?: string
}

export function OverlayScrollbar({
  ariaLabel,
  children,
  className,
  viewClassName,
  wrapClassName,
}: OverlayScrollbarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const inactiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStateRef = useRef<{ startClientY: number; startScrollTop: number } | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  const [isActive, setIsActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isScrollable, setIsScrollable] = useState(false)
  const [scrollbarSize, setScrollbarSize] = useState(0)

  const clearInactiveTimer = () => {
    if (inactiveTimerRef.current !== null) {
      clearTimeout(inactiveTimerRef.current)
      inactiveTimerRef.current = null
    }
  }

  const markActive = (autoHide = true) => {
    setIsActive(true)
    clearInactiveTimer()
    if (!autoHide) return
    inactiveTimerRef.current = setTimeout(() => {
      setIsActive(false)
      inactiveTimerRef.current = null
    }, INACTIVE_DELAY_MS)
  }

  const syncThumb = () => {
    const wrap = wrapRef.current
    const bar = barRef.current
    const thumb = thumbRef.current
    if (!wrap || !bar || !thumb) return

    const maxScrollTop = wrap.scrollHeight - wrap.clientHeight
    const trackHeight = bar.clientHeight
    const nextScrollable = maxScrollTop > 1 && trackHeight > 0

    setIsScrollable((current) => (current === nextScrollable ? current : nextScrollable))

    if (!nextScrollable) {
      thumb.style.height = '0px'
      thumb.style.transform = 'translateY(0px)'
      return
    }

    const thumbHeight = Math.max((wrap.clientHeight / wrap.scrollHeight) * trackHeight, MIN_THUMB_SIZE)
    const maxThumbOffset = Math.max(trackHeight - thumbHeight, 0)
    const thumbOffset = maxScrollTop <= 0 ? 0 : (wrap.scrollTop / maxScrollTop) * maxThumbOffset

    thumb.style.height = `${thumbHeight}px`
    thumb.style.transform = `translateY(${thumbOffset}px)`
  }

  const scheduleSync = () => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      syncThumb()
    })
  }

  useEffect(() => {
    const wrap = wrapRef.current
    const view = viewRef.current
    if (!wrap) return

    setScrollbarSize(measureScrollbarSize())

    const handleResize = () => scheduleSync()
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleSync())
      : null

    resizeObserver?.observe(wrap)
    if (view) resizeObserver?.observe(view)
    window.addEventListener('resize', handleResize)
    scheduleSync()

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
      clearInactiveTimer()
      dragCleanupRef.current?.()
    }
  }, [])

  const handleScroll = () => {
    scheduleSync()
    markActive()
  }

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wrap = wrapRef.current
    const thumb = thumbRef.current
    const bar = barRef.current
    if (!wrap || !thumb || !bar) return

    event.preventDefault()
    event.stopPropagation()

    dragStateRef.current = {
      startClientY: event.clientY,
      startScrollTop: wrap.scrollTop,
    }

    setIsDragging(true)
    markActive(false)
    thumb.setPointerCapture?.(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return

      const trackHeight = bar.clientHeight
      const thumbHeight = thumb.getBoundingClientRect().height
      const maxThumbOffset = Math.max(trackHeight - thumbHeight, 1)
      const maxScrollTop = Math.max(wrap.scrollHeight - wrap.clientHeight, 0)
      const delta = moveEvent.clientY - dragState.startClientY
      const scrollDelta = (delta / maxThumbOffset) * maxScrollTop

      wrap.scrollTop = dragState.startScrollTop + scrollDelta
      scheduleSync()
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
      setIsDragging(false)
      markActive()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      dragCleanupRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }

  const handleBarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target === thumbRef.current) return

    const wrap = wrapRef.current
    const bar = barRef.current
    const thumb = thumbRef.current
    if (!wrap || !bar || !thumb) return

    event.preventDefault()

    const trackRect = bar.getBoundingClientRect()
    const thumbHeight = thumb.getBoundingClientRect().height
    const nextOffset = clamp(
      event.clientY - trackRect.top - (thumbHeight / 2),
      0,
      Math.max(trackRect.height - thumbHeight, 0),
    )
    const maxScrollTop = Math.max(wrap.scrollHeight - wrap.clientHeight, 0)
    const maxThumbOffset = Math.max(trackRect.height - thumbHeight, 1)

    wrap.scrollTop = (nextOffset / maxThumbOffset) * maxScrollTop
    scheduleSync()
    markActive()
  }

  const wrapStyle: CSSProperties | undefined = scrollbarSize > 0
    ? {
        marginRight: `${-scrollbarSize}px`,
        marginBottom: `${-scrollbarSize}px`,
      }
    : undefined

  return (
    <div
      className={joinClassNames(
        'overlay-scrollbar',
        className,
        isScrollable && 'is-scrollable',
        isActive && 'is-active',
        isDragging && 'is-dragging',
      )}
      onPointerEnter={() => markActive(false)}
      onPointerLeave={() => {
        if (isDragging) return
        clearInactiveTimer()
        setIsActive(false)
      }}
    >
      <div
        aria-label={ariaLabel}
        className={joinClassNames('overlay-scrollbar__wrap', wrapClassName)}
        onScroll={handleScroll}
        ref={wrapRef}
        style={wrapStyle}
      >
        <div className={joinClassNames('overlay-scrollbar__view', viewClassName)} ref={viewRef}>
          {children}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="overlay-scrollbar__bar overlay-scrollbar__bar--vertical"
        onPointerDown={handleBarPointerDown}
        ref={barRef}
      >
        <div
          className="overlay-scrollbar__thumb"
          onPointerDown={handleThumbPointerDown}
          ref={thumbRef}
        />
      </div>
    </div>
  )
}

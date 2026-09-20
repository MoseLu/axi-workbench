import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { inspect, inspectAt } from './inspect'
import {
  syncExplicitTargets,
  getLivePerception,
  getAnnotations,
  addAnnotation,
  removeAnnotation,
  clearAnnotations,
  clearAll as clearPerceptionAll,
  onPerceptionEvent,
  type NodeRef,
} from './perception'
// Pure helpers extracted for TDD testability — see docs/process/tdd-driven-prd.md.
import {
  climbToClickable,
  intersects,
  toXYWH,
  countSummary,
  toRef,
  publicNode,
  findByDomPath,
} from './__pure__'
// Canvas paint helpers — see src/overlay/canvas/paint.ts.
import {
  paintRulers,
  paintCrosshair,
  paintMarquee,
  paintSelectionTags,
} from './canvas/paint'
// React hooks extracted for TDD testability — see docs/process/tdd-driven-prd.md.
import { usePickerOn } from './hooks/usePickerOn'
import { useAnnotationDraft } from './hooks/useAnnotationDraft'
import { useTargets } from './hooks/useTargets'
import { useCrosshair } from './hooks/useCrosshair'

/**
 * OverlayCanvas — agent node-picker.
 *
 * Operates in two modes that the user toggles explicitly:
 *
 *   - **picker-on** (default on dev mount): right-click pins; left-drag
 *     sweeps. Global capture-phase listeners on `document` swallow the
 *     usual click semantics so the picker never conflicts with form /
 *     button / link interactions ONLY while it is on.
 *   - **picker-off**: no listeners; the page is fully interactive as if
 *     nothing was mounted. Toolbar collapses to a small "P off · ⌘P"
 *     indicator so the user always knows how to get back. The agent
 *     can still call `window.__artboard.setPickerOn(true)` from the
 *     outside.
 *
 * Toggle:
 *   - FAB button (top-right, always visible)
 *   - ⌘P on Mac, Ctrl+P elsewhere
 *
 * Visual language: Blueprint Cartography. The overlay draws rulers,
 * a crosshair, and architectural-drawing-style selection tags on top
 * of the real UI. The actual outlines are CSS classes on the real
 * DOM, so they survive mutation and are visible in chrome-devtools.
 *
 * Exposes (window.__artboard):
 *   targets() / pickAt() / marqueePick() / clearTargets()
 *   getDebugState()
 *   getLivePerception() / getAnnotations() / addAnnotation()
 *   setPickerOn(bool) / getPickerOn()   ← NEW
 */

export default function OverlayCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // --- State machines pulled into TDD-tested hooks ---
  // Each hook owns its state + ref mirror + ops; the component
  // below just wires the values together.
  const {
    targets,
    targetsRef,
    setSingle,
    appendMany,
    clear: clearTargets,
  } = useTargets()
  const { pickerOn, pickerOnRef, setOn, toggle: togglePicker } = usePickerOn({
    // When the user turns the picker off, drop transient state
    // (marquee, DOM highlights) so we don't leave anything stuck.
    onTurnOff: () => {
      dragStateRef.current = null
      marqueeRef.current = null
      for (const el of highlightedDomRef.current) {
        el.classList.remove('axi-artboard-selected')
        el.classList.remove('axi-artboard-marqueed')
      }
      highlightedDomRef.current = new Set()
      clearTargets()
      clearPerceptionAll()
    },
  })
  const { crosshair, set: setCrosshair, clear: clearCrosshair } = useCrosshair()

  const highlightedDomRef = useRef<Set<HTMLElement>>(new Set())
  const rafRef = useRef<number | null>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  // Annotation editor state.
  const {
    draft: annotationDraft,
    setDraft: setAnnotationDraft,
    draftRef: annotationDraftRef,
    commit: commitAnnotationRef,
  } = useAnnotationDraft({
    onCommit: (ref, text) => addAnnotation(ref, text),
  })

  // Live annotation list. We subscribe to the perception event bus
  // so any addAnnotation / removeAnnotation / clearAnnotations call
  // (including ones made by the agent via window.__artboard) shows
  // up immediately in the toolbar.
  const [annotations, setAnnotations] = useState(getAnnotations())
  useEffect(() => {
    const off = onPerceptionEvent((_type, packet) => {
      setAnnotations(packet.annotations.map((a) => ({ ...a })))
    })
    return off
  }, [])

  // Stable callback used by the toolbar buttons / textarea ⌘Enter
  // shortcut. Delegates to useAnnotationDraft.commit().
  function commitAnnotation() {
    commitAnnotationRef({ current: targetsRef.current[0] ?? null })
  }

  // Live marquee rect in viewport coords, drawn each frame.
  const marqueeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number } | null>(null)

  // Keep ref + DOM highlight classes in sync with state.
  // The single-pick handler applies the highlight synchronously; this
  // effect reconciles after React commits and also handles the
  // marquee path (which sets many refs at once).
  useEffect(() => {
    targetsRef.current = targets
    // Sync to live perception store so MCP tools (and /__axi/perception) see it immediately.
    syncExplicitTargets(targets)
    // When the user clears the selection (Esc, clear button, picker
    // toggle off), drop the unsent annotation draft so the next
    // pick starts from a clean textarea.
    if (targets.length === 0 && annotationDraftRef.current !== '') {
      setAnnotationDraft('')
    }

    // Both pointer-handlers (contextmenu and pointerup) apply the
    // correct highlight classes synchronously and clean up old
    // highlights. This effect only ADDS classes that are missing
    // and never REMOVES — it must not race the handlers and strip
    // classes they just applied. Stripping happens in the handlers
    // when they have the live `highlightedDomRef` set in scope.
    for (const t of targets) {
      const el = findByDomPath(t.domPath)
      if (!el) continue
      const cls = t.source$ === 'marquee' ? 'axi-artboard-marqueed' : 'axi-artboard-selected'
      if (!el.classList.contains(cls)) el.classList.add(cls)
    }
    // Mirror the targets into highlightedDomRef for the handlers
    // to use on the next selection change.
    const nextHighlighted = new Set<HTMLElement>()
    for (const t of targets) {
      const el = findByDomPath(t.domPath)
      if (el) nextHighlighted.add(el)
    }
    highlightedDomRef.current = nextHighlighted
  }, [targets])

  // Global debug API + Live Perception (real-time MCP surface)
  useEffect(() => {
    const api = {
      getDebugState: () => ({
        count: targetsRef.current.length,
        targets: targetsRef.current.map(publicNode),
        timestamp: Date.now(),
      }),
      targets: () => targetsRef.current.map(publicNode),
      // --- NEW real-time perception API (MCP primary path) ---
      getLivePerception: () => getLivePerception(),
      getAnnotations: () => getAnnotations(),
      addAnnotation: (domPathOrPoint: any, text: string) => {
        // Minimal support: if called with a NodeRef-like or we can resolve current primary
        const ref = targetsRef.current[0] || (domPathOrPoint && typeof domPathOrPoint === 'object' ? domPathOrPoint : null)
        if (!ref) return null
        return addAnnotation(ref, text)
      },
      clearAnnotations: () => clearAnnotations(),
      clearAll: () => {
        clearTargets()
        clearPerceptionAll()
      },
      // --- existing ---
      pickAt: (x: number, y: number) => {
        const info = inspectAt(x, y)
        if (!info) return null
        const ref = toRef(info, 'single')
        setSingle(ref)
        return publicNode(ref)
      },
      marqueePick: (rect: { x: number; y: number; w: number; h: number }) => {
        const hits = collectHits(rect)
        if (hits.length === 0) return []
        const stamped = hits.map((r) => ({ ...r, source$: 'marquee' as const }))
        appendMany(stamped)
        return stamped.map(publicNode)
      },
      clearTargets: () => clearTargets(),
      // --- NEW picker-mode toggle ---
      setPickerOn: (on: boolean) => setOn(!!on),
      getPickerOn: () => pickerOnRef.current,
    }
    ;(window as any).__artboard = api
  }, [])

  // Backstore resize
  useEffect(() => {
    const onResize = () => {
      const c = canvasRef.current
      if (!c) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.floor(window.innerWidth * dpr)
      c.height = Math.floor(window.innerHeight * dpr)
      const ctx = c.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight, dpr }
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Repaint loop, ~30fps. Draws the marquee rectangle + ruler ticks
  // + crosshair + selection labels each frame.
  useEffect(() => {
    let lastPaint = 0
    const tick = (t: number) => {
      if (t - lastPaint > 32) {
        paint(canvasRef.current, targetsRef.current, marqueeRef.current, sizeRef.current, crosshair)
        lastPaint = t
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      const c = canvasRef.current
      if (c) {
        const ctx = c.getContext('2d')
        ctx?.clearRect(0, 0, c.width, c.height)
      }
    }
  }, [crosshair])

  // Document-level pointer wiring:
  //   - pointerdown with button 0 (left)  → start a marquee
  //   - pointermove during a marquee       → update marquee rect
  //   - pointerup during a marquee         → commit hit list, end marquee
  //   - contextmenu (button 2 / right)     → single-pick
  //   - Esc                                → clear all
  //   - ⌘P / Ctrl+P / Ctrl+Shift+P         → toggle picker-on
  //
  // All handlers early-return when `pickerOnRef.current === false`.
  // The effect mounts once; toggling the ref avoids re-binding listeners
  // in StrictMode / HMR.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!pickerOnRef.current) return
      // e.target in some scripted paths (e.g. dispatched on
      // document) is null. Use composedPath / elementFromPoint
      // fallback so the picker still works in tests.
      const tgt = (e.target ?? null) as HTMLElement | null
      if (tgt && tgt.closest?.('.overlay-chrome')) return
      if (e.button !== 0) return
      e.preventDefault()
      dragStateRef.current = { startX: e.clientX, startY: e.clientY }
      marqueeRef.current = { x: e.clientX, y: e.clientY, w: 0, h: 0 }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pickerOnRef.current) return
      const start = dragStateRef.current
      if (start) {
        const x = Math.min(start.startX, e.clientX)
        const y = Math.min(start.startY, e.clientY)
        const w = Math.abs(e.clientX - start.startX)
        const h = Math.abs(e.clientY - start.startY)
        marqueeRef.current = { x, y, w, h }
      }
      // Always update the crosshair so the ruler reads live.
      setCrosshair(e.clientX, e.clientY)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!pickerOnRef.current) return
      const start = dragStateRef.current
      if (!start) return
      dragStateRef.current = null
      const x = Math.min(start.startX, e.clientX)
      const y = Math.min(start.startY, e.clientY)
      const w = Math.abs(e.clientX - start.startX)
      const h = Math.abs(e.clientY - start.startY)
      marqueeRef.current = null

      const isTiny = w < 3 && h < 3
      if (isTiny) {
        // Left-click (no drag) → single pin the element under cursor (replace set).
        // This makes "点选" natural with left click in addition to right-click.
        // Fixes "no reaction" when users left-click to select after having something pinned.
        dragStateRef.current = null
        const topEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        if (!topEl || topEl.closest?.('.overlay-chrome')) return
        const targetEl = climbToClickable(topEl) ?? topEl
        const info = inspect(targetEl)
        if (info) {
          const ref = toRef(info, 'single')
          for (const old of highlightedDomRef.current) {
            old.classList.remove('axi-artboard-selected')
            old.classList.remove('axi-artboard-marqueed')
          }
          targetEl.classList.add('axi-artboard-selected')
          highlightedDomRef.current = new Set([targetEl])
          setSingle(ref)
        }
        return
      }

      // Real drag → marquee select (add to set)
      const rect = { x, y, w, h }
      const hits = collectHits(rect)
      if (hits.length === 0) return
      // Resolve each hit to a live DOM node and apply the highlight
      // class synchronously. Same rationale as the contextmenu
      // handler: React 19 + StrictMode commit may swap the node,
      // so the useEffect fallback isn't reliable enough on its own.
      const stamped: NodeRef[] = []
      const newHighlighted = new Set<HTMLElement>()
      for (const hit of hits) {
        const el = findByDomPath(hit.domPath)
        stamped.push({ ...hit, source$: 'marquee' })
        if (el) {
          el.classList.add('axi-artboard-marqueed')
          newHighlighted.add(el)
        }
      }
      for (const old of highlightedDomRef.current) {
        if (!newHighlighted.has(old)) {
          old.classList.remove('axi-artboard-selected')
          old.classList.remove('axi-artboard-marqueed')
        }
      }
      highlightedDomRef.current = newHighlighted
      appendMany(stamped)
    }

    const onContextMenu = (e: MouseEvent) => {
      if (!pickerOnRef.current) return
      // Same null-target tolerance — see onPointerDown.
      const tgt = (e.target ?? null) as HTMLElement | null
      if (tgt && tgt.closest?.('.overlay-chrome')) return
      e.preventDefault()
      const topEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (!topEl || topEl.closest('.overlay-chrome')) return
      const targetEl = climbToClickable(topEl) ?? topEl
      // Use direct inspect on the (possibly climbed) target element.
      // Previously inspectAtFromElement re-did elementFromPoint at center,
      // which often landed on a child and caused mis-selection or no visible reaction
      // when switching panels.
      const info = inspect(targetEl)
      if (!info) return
      const ref = toRef(info, 'single')
      const cls = 'axi-artboard-selected'
      for (const old of highlightedDomRef.current) {
        old.classList.remove('axi-artboard-selected')
        old.classList.remove('axi-artboard-marqueed')
      }
      targetEl.classList.add(cls)
      highlightedDomRef.current = new Set([targetEl])
      setSingle(ref)
    }

    const onKey = (e: KeyboardEvent) => {
      // ⌘P (mac) / Ctrl+P (win/linux): toggle picker-on. We
      // intentionally do NOT early-return when picker is off so the
      // user can turn it back on from any focused input.
      const isToggle =
        (e.key === 'p' || e.key === 'P') &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey
      if (isToggle) {
        e.preventDefault()
        e.stopPropagation()
        // usePickerOn handles the ref + state + onTurnOff cleanup.
        togglePicker()
        return
      }
      if (e.key === 'Escape') {
        clearTargets()
        clearPerceptionAll()
      }
    }

    const onLeave = () => clearCrosshair()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerleave', onLeave)
      for (const el of highlightedDomRef.current) {
        el.classList.remove('axi-artboard-selected')
        el.classList.remove('axi-artboard-marqueed')
      }
      highlightedDomRef.current = new Set()
    }
  }, [])

  return (
    <>
      {/* Canvas: paints rulers + crosshair + selection labels + live marquee.
          Stays at pointer-events: none so the real UI stays clickable. */}
      <canvas
        ref={canvasRef}
        className={clsx(
          // Pure layout: full-viewport fixed surface that paints rulers/
          // crosshair/selection. The picker-on toggle flips display from
          // 'hidden' to 'block' inline — see PR-D-7.
          'fixed inset-0 w-screen h-screen z-[9999] pointer-events-none',
          pickerOn ? 'block' : 'hidden',
        )}
        aria-hidden="true"
      />

      {/* Bottom-right legend / status card. The only interactive chrome
          in the overlay: shows the current selection (if any) plus
          gesture hints. Collapses to a single hint line when picker is off. */}
      <div
        className={clsx(
          'overlay-chrome',
          'fixed right-5 bottom-5 z-[10000] pointer-events-auto text-ink-text overflow-hidden transition-[width] duration-220',
          'w-[304px] bg-[rgba(17,22,31,0.86)] backdrop-blur-md border border-rule-2 rounded',
          'shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.02)]',
          // collapsed: shrinks width when picker is off
          !pickerOn && 'w-[248px]',
        )}
        role="region"
        aria-live="polite"
        aria-label="Axi Artboard picker status"
      >
        <div className={clsx(
          'overlay-legend-head',
          'grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-[11px] px-3.5 border-b border-rule-1 bg-[linear-gradient(90deg,var(--color-pin-ghost),transparent_70%)]',
          // collapsed variant: drop the border-bottom when picker is off
          !pickerOn && 'border-b-0',
        )}>
          <span className="font-mono text-[10px] tracking-[0.12em] text-ink-dim">§ 00.{pickerOn ? '1' : '0'}</span>
          <span className={clsx(
            'font-mono text-[10px] font-bold tracking-[0.16em] uppercase',
            pickerOn ? 'text-ink-text' : 'text-ink-mute',
          )}>
            {pickerOn ? 'Picker — armed' : 'Picker — disarmed'}
          </span>
          <button
            className={clsx(
              'inline-flex items-center gap-1.5 bg-transparent border rounded-sm cursor-pointer font-mono text-[9px] font-bold tracking-[0.16em] transition-colors duration-140',
              // State-carrier colors. data-[state=on]:  / data-[state=off]:
              // are Tailwind 4 variants that fire when the data-state
              // attribute equals "on" / "off". Hover for the off-state is
              // chased to the chartreuse so the FAB feels alive.
              pickerOn
                ? 'border-pin text-pin bg-pin-ghost data-[state=on]:hover:bg-pin-ghost/80'
                : 'border-rule-2 text-ink-mute data-[state=off]:hover:border-pin data-[state=off]:hover:text-pin',
            )}
            data-state={pickerOn ? 'on' : 'off'}
            onClick={() => togglePicker()}
            title={pickerOn ? 'Picker is on. Click or ⌘P to turn off.' : 'Picker is off. Click or ⌘P to turn on.'}
            aria-pressed={pickerOn}
          >
            <span
              className={clsx(
                'w-1.5 h-1.5 rounded-full transition-[background-color,box-shadow] duration-140',
                pickerOn
                  ? 'bg-pin shadow-[0_0_8px_var(--color-pin)]'
                  : 'bg-ink-dim data-[state=off]:hover:bg-pin data-[state=off]:hover:shadow-[0_0_6px_var(--color-pin)]',
              )}
            />
            {pickerOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {targets.length > 0 ? (
          <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 font-mono text-[10px] tracking-[0.04em]">
              <span className="text-ink-dim lowercase tracking-[0.08em]">selection</span>
              <span className="text-pin font-bold tracking-[0.12em] uppercase">{countSummary(targets)}</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2.5 p-2.5 bg-ink-2 border border-rule-1 rounded-sm items-center">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] p-1 px-1.5 bg-pin text-ink-0 rounded-sm text-center min-w-[36px]">
                {targets[0].source$ === 'single' ? 'PIN' : 'HIT'}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <strong className="font-display font-semibold text-[13px] text-ink-text tracking-[-0.005em] whitespace-nowrap overflow-hidden text-ellipsis">{targets[0].componentName}</strong>
                <code className="font-mono text-[10px] text-ink-mute bg-transparent whitespace-nowrap overflow-hidden text-ellipsis">{targets[0].source ?? 'unknown source'}</code>
              </div>
            </div>
            {targets.length > 1 && (
              <div className="font-mono text-[10px] text-ink-mute tracking-[0.04em] pl-0.5">
                <span className="border-l-2 border-pin pl-2">+{targets.length - 1} additional {targets.length - 1 === 1 ? 'node' : 'nodes'} in region</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-rule-1">
                <label className="font-mono text-[9px] tracking-[0.12em] uppercase text-ink-mute [&>strong]:font-display [&>strong]:font-semibold [&>strong]:text-[11px] [&>strong]:text-pin [&>strong]:tracking-[-0.005em] [&>strong]:normal-case [&>strong]:ml-1" htmlFor="axi-annotate-input">
                  comment on <strong>{targets[0].componentName}</strong>
                </label>
                <textarea
                  id="axi-annotate-input"
                  className="font-mono text-[11px] leading-[1.5] bg-ink-2 text-ink-text border border-rule-2 rounded-sm p-2 resize-y min-h-[36px] max-h-[200px] placeholder:italic placeholder:text-ink-dim focus:outline-none focus:border-pin focus:shadow-[0_0_0_1px_var(--color-pin)]"
                  value={annotationDraft}
                  onChange={(e) => setAnnotationDraft(e.target.value)}
                  placeholder="e.g. spacing feels too tight / this should be a Button not a div"
                  rows={2}
                  onKeyDown={(e) => {
                    // ⌘/Ctrl+Enter commits without leaving the field.
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      commitAnnotation()
                    }
                  }}
                />
                <div className="flex gap-1 items-center">
                  <button
                    className="inline-flex items-center gap-1.5 bg-ink-2 border border-rule-2 text-ink-text p-2 px-2.5 rounded-sm cursor-pointer font-mono text-[10px] font-medium tracking-[0.12em] uppercase transition-colors duration-120 hover:border-pin hover:text-pin disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={commitAnnotation}
                    title="Save this comment. It becomes part of the live perception packet immediately."
                    disabled={!annotationDraft.trim()}
                  >
                    <span className="inline-grid place-items-center min-w-[14px] h-[14px] px-1 bg-ink-3 border border-rule-3 rounded-sm text-[9px] font-bold text-ink-mute group-hover:border-current">⌘↵</span>
                    save
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 bg-ink-2 border border-transparent text-ink-mute p-2 px-2.5 rounded-sm cursor-pointer font-mono text-[10px] font-medium tracking-[0.12em] uppercase transition-colors duration-120 hover:border-rule-3 hover:text-ink-text disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => setAnnotationDraft('')}
                    disabled={!annotationDraft}
                  >
                    clear text
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 bg-ink-2 border border-rule-2 text-ink-text p-2 px-2.5 rounded-sm cursor-pointer font-mono text-[10px] font-medium tracking-[0.12em] uppercase transition-colors duration-120 hover:border-coral hover:text-coral disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => {
                      clearTargets()
                      clearPerceptionAll()
                    }}
                    title="Clear all selections (also Esc)"
                  >
                    <span className="inline-grid place-items-center min-w-[14px] h-[14px] px-1 bg-ink-3 border border-rule-3 rounded-sm text-[9px] font-bold text-ink-mute group-hover:border-current">⌫</span>
                    clear picks
                  </button>
                </div>
              </div>
            </div>
            {annotations.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-rule-1" aria-label="annotations">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 font-mono text-[10px] tracking-[0.04em]">
              <span className="text-ink-dim lowercase tracking-[0.08em]">annotations</span>
              <span className="text-ink-text font-medium">{annotations.length}</span>
            </div>
                <ul className="list-none p-0 m-0 flex flex-col gap-1 max-h-[160px] overflow-y-auto">
                  {annotations.map((a) => (
                    <li key={a.id} className="grid grid-cols-[auto_1fr_auto] gap-1.5 items-start p-1 px-1.5 bg-ink-2 border border-rule-1 rounded-sm font-mono text-[10px] text-ink-text">
                      <code className="bg-pin text-ink-0 py-0.5 px-1 rounded-sm text-[9px] font-bold tracking-[0.06em] uppercase self-start whitespace-nowrap">
                        {a.ref.componentName}
                      </code>
                      <span className="whitespace-pre-wrap break-words text-ink-text">{a.text}</span>
                      <button
                        className="bg-transparent border border-transparent text-ink-dim font-mono text-[14px] leading-none px-1 cursor-pointer rounded-sm self-start hover:border-coral hover:text-coral"
                        onClick={() => removeAnnotation(a.id)}
                        title={`Delete annotation on ${a.ref.componentName}`}
                        aria-label={`Delete annotation on ${a.ref.componentName}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5 [&>div+div]:pt-1.5 [&>div+div]:mt-0.5 [&>div+div]:border-t [&>div+div]:border-dashed [&>div+div]:border-rule-1">
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 font-mono text-[10px] tracking-[0.04em]">
              <span className="text-ink-dim lowercase tracking-[0.08em]">gesture · pin</span>
              <code className="font-mono text-[10px] tracking-[0.04em] text-ink-text bg-transparent p-0">right-click</code>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 font-mono text-[10px] tracking-[0.04em]">
              <span className="text-ink-dim lowercase tracking-[0.08em]">gesture · sweep</span>
              <code className="font-mono text-[10px] tracking-[0.04em] text-ink-text bg-transparent p-0">left-drag</code>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 font-mono text-[10px] tracking-[0.04em]">
              <span className="text-ink-dim lowercase tracking-[0.08em]">gesture · toggle</span>
              <code className="font-mono text-[10px] tracking-[0.04em] text-ink-text bg-transparent p-0">⌘ P</code>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 font-mono text-[10px] tracking-[0.04em]">
              <span className="text-ink-dim lowercase tracking-[0.08em]">gesture · clear</span>
              <code className="font-mono text-[10px] tracking-[0.04em] text-ink-text bg-transparent p-0">esc</code>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/** countSummary — pure helper, lives in src/overlay/__pure__/summary.ts
 * for TDD testability. Imported via the barrel at the top of this file. */

/**
 * Walk every DOM node with a React fiber, return one NodeRef per
 * LEAF node whose bounding rect intersects the marquee rect. Hit
 * detection uses a "any intersection" rule — any pixel of the DOM
 * box inside the marquee is enough — but a node is only counted if
 * none of its React-bearing children also intersects.
 *
 * Two reasons this is the default behavior:
 *   1. A naive "every intersected fiber" hit list gives the agent a
 *      noisy mixed set (main → section → ul → li → button → span),
 *      which is exactly what the README promises to avoid.
 *   2. The single-pick (right-click / left-click) path already
 *      climbs to clickable ancestors via `climbToClickable`; doing
 *      the same here keeps the user's mental model consistent.
 *
 * Climbing: for each leaf we run `climbToClickable`. If the leaf is
 * inside a clickable ancestor (e.g. an `<icon>` inside a `<button>`),
 * the ancestor is picked instead of the leaf.
 */
function collectHits(rect: { x: number; y: number; w: number; h: number }): NodeRef[] {
  // 1) Find every element whose rect intersects the marquee and
  //    whose fiber resolves to a component.
  const hits = new Set<HTMLElement>()
  const stack: Element[] = [document.body]
  while (stack.length) {
    const el = stack.pop()!
    if (!(el instanceof HTMLElement)) continue
    const r = el.getBoundingClientRect()
    if (r.width >= 2 && r.height >= 2 && intersects(toXYWH(r), rect)) {
      if (inspect(el)) hits.add(el)
    }
    let child = el.firstElementChild
    const kids: Element[] = []
    while (child) { kids.push(child); child = child.nextElementSibling }
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i])
  }
  // 2) Reduce to LEAF hits: a hit is a leaf if none of its children
  //    is also a hit. This naturally drops main / section / ul and
  //    keeps the deepest component under the marquee.
  const leaves: HTMLElement[] = []
  for (const el of hits) {
    let anyChildHit = false
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (hits.has(c as HTMLElement)) { anyChildHit = true; break }
    }
    if (!anyChildHit) leaves.push(el)
  }
  // 3) Climb each leaf to its clickable ancestor so the result
  //    matches the single-pick path.
  const climbed = new Set<HTMLElement>()
  for (const el of leaves) {
    climbed.add(climbToClickable(el) ?? el)
  }
  // 4) De-dup by domPath and convert to NodeRefs.
  const out: NodeRef[] = []
  const seen = new Set<string>()
  for (const el of climbed) {
    const info = inspect(el)
    if (!info) continue
    const ref = toRef(info, 'marquee')
    if (seen.has(ref.id)) continue
    seen.add(ref.id)
    out.push(ref)
  }
  return out
}

/** intersects + toXYWH — pure helpers, live in
 * src/overlay/__pure__/geometry.ts for TDD testability. Imported via
 * the barrel at the top of this file. */

/** Merge a new marquee hit list with the existing set. Pure; lives in
 * src/overlay/__pure__/mergeTargets.ts so it can be TDD-tested without
 * mounting OverlayCanvas. Imported via the barrel at the top of this file. */

// --- helpers ---

/** toRef + publicNode — pure helpers, live in src/overlay/__pure__/ref.ts
 * for TDD testability. Imported via the barrel at the top of this file. */

/** buildDomPath — pure helper, lives in src/overlay/__pure__/buildDomPath.ts
 * for TDD testability. The returned path is RELATIVE to document.body and
 * never contains 'body' or 'html' itself. */

/** findByDomPath — pure-ish DOM walker, lives in
 * src/overlay/__pure__/domPathLookup.ts for TDD testability. Reads
 * document.body at call time. */

/** summarizeProps — pure helper, lives in src/overlay/__pure__/props.ts
 * for TDD testability. */

/** climbToClickable — pure DOM walk helper, lives in
 * src/overlay/__pure__/climbToClickable.ts for TDD testability.
 * Returns the closest clickable ancestor (button / a / role=button /
 * onclick) of `el` within 8 levels, or null. */

// --- paint ---
//
// The canvas paints four layers, all in chartreuse / blueprint blue:
//   1. Rulers (top + left), with pixel-coord labels at major ticks.
//   2. The crosshair (horizontal + vertical hairlines + coord badge).
//   3. The live marquee rectangle (during a drag).
//   4. Selection tags for picked nodes (single-pick gets a label,
//      marquee hits get corner brackets only so the page stays calm).
//
// The DOM highlight classes (.axi-artboard-selected / -marqueed)
// carry the actual box outlines; the canvas only paints "drafting"
// chrome so the canvas and DOM stay in sync visually.

/** paint — Canvas 2D rendering entry point. All paint helpers live
 * in src/overlay/canvas/paint.ts (TDD-tested). This wrapper resolves
 * the context, clears, and fans the work out to the layer. */
function paint(
  canvas: HTMLCanvasElement | null,
  targets: NodeRef[],
  marquee: { x: number; y: number; w: number; h: number } | null,
  size: { w: number; h: number },
  crosshair: { x: number; y: number } | null
) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, size.w, size.h)

  paintRulers(ctx, size, crosshair)
  if (crosshair) paintCrosshair(ctx, crosshair, size)
  if (marquee && (marquee.w > 2 || marquee.h > 2)) paintMarquee(ctx, marquee)
  paintSelectionTags(ctx, targets, size)
}


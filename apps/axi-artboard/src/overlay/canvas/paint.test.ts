/**
 * RED-then-GREEN tests for paint.ts. Pins M-26..M-31 of the PRD.
 *
 * jsdom does not ship CanvasRenderingContext2D, so each test builds
 * a hand-rolled mock context that records every ctx method call. The
 * assertions check call shapes (count, first arg) — not pixel output,
 * which would be the role of a real canvas + Playwright visual diff.
 */

import { describe, it, expect } from 'vitest'
import {
  paintRulers,
  paintCrosshair,
  paintMarquee,
  paintSelectionTags,
  paintSingleTag,
  paintMarqueeCornerBrackets,
  RULER_SIZE,
  RULER_LEFT_BOUNDARY,
  COLOR_CHARTREUSE,
  type Rect,
} from './paint'

/** Build a recording mock CanvasRenderingContext2D.
 *
 * Returns { ctx, calls } where `calls` is a flat list of every method
 * invocation in the order they happened. Methods are passthroughs that
 * return this so chains like ctx.beginPath()..moveTo()..stroke() work. */
const mockCtx = () => {
  const calls: { method: string; args: unknown[] }[] = []
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'measureText') {
        return (text: string) => ({
          width: (typeof text === 'string' ? text.length : 0) * 6,
        })
      }
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args })
        return proxy
      }
    },
    set(_t, prop, value) {
      calls.push({ method: `set:${String(prop)}`, args: [value] })
      return true
    },
  }
  const proxy = new Proxy({}, handler) as unknown as CanvasRenderingContext2D
  return { ctx: proxy, calls }
}

type Call = { method: string; args: unknown[] }
const findCalls = (calls: Call[], method: string) =>
  calls.filter((c) => c.method === method)

describe('paintRulers', () => {
  it('draws the corner square at the L-corner of the rulers', () => {
    const { ctx, calls } = mockCtx()
    paintRulers(ctx, { w: 1024, h: 768 }, null)
    // The corner square is a fillRect at (RULER_LEFT_BOUNDARY, 0) with
    // the ruler size. Several other fillRects run before it (top +
    // left ruler backgrounds) so we search the whole call log.
    const cornerFill = calls.find(
      (c) =>
        c.method === 'fillRect' &&
        c.args[0] === RULER_LEFT_BOUNDARY &&
        c.args[1] === 0 &&
        c.args[2] === RULER_SIZE &&
        c.args[3] === RULER_SIZE,
    )
    expect(cornerFill).toBeDefined()
  })

  it('does not paint a crosshair label when crosshair is null', () => {
    const { ctx, calls } = mockCtx()
    paintRulers(ctx, { w: 1024, h: 768 }, null)
    // The crosshair branch writes numeric labels using Math.round, so
    // a "500" or coordinate-shaped string indicates the branch ran.
    // The tick-mark labels (every 100px) DO write numbers — that's
    // fine — but their args are the original pixel coords (e.g. "248",
    // "200") all ≤ RULER_RIGHT * 1.0. The crosshair branch text only
    // appears when crosshair is in range — when crosshair is null,
    // NO crosshair-branch text should appear.
    //
    // We detect it by the absence of any "you are here" badge rect:
    // when crosshair is non-null inside range, paintRulers calls
    // fillRect(...,2,...) for each label box; with no crosshair those
    // are absent.
    const badgeFills = calls.filter(
      (c) =>
        c.method === 'fillRect' &&
        // Crosshair label boxes are 28×11 (top-right) or (RULER-4)×11 (left)
        ((c.args[2] === 28 && c.args[3] === 11) ||
          (c.args[2] === RULER_SIZE - 4 && c.args[3] === 11)),
    )
    expect(badgeFills).toEqual([])
  })

  it('paints the crosshair label box when crosshair is inside the main pane', () => {
    const { ctx, calls } = mockCtx()
    paintRulers(ctx, { w: 1024, h: 768 }, { x: 500, y: 400 })
    // Crosshair branch writes a coord; assert at least one fillText
    // contains a numeric string ("500" or "400").
    const textCalls = findCalls(calls, 'fillText')
    const hasCoord = textCalls.some((c) =>
      (c.args[0] as string).match(/^(500|400)$/),
    )
    expect(hasCoord).toBe(true)
  })
})

describe('paintCrosshair', () => {
  it('uses dashed line style for the hairline', () => {
    const { ctx, calls } = mockCtx()
    paintCrosshair(ctx, { x: 500, y: 400 }, { w: 1024, h: 768 })
    // setLineDash should be called with a pattern
    expect(findCalls(calls, 'setLineDash').length).toBeGreaterThan(0)
  })

  it('fills a center dot at the crosshair point with chartreuse', () => {
    const { ctx, calls } = mockCtx()
    paintCrosshair(ctx, { x: 500, y: 400 }, { w: 1024, h: 768 })
    // set:fillStyle → '#7fff00' for the center dot.
    const styleSets = calls
      .filter((c) => c.method === 'set:fillStyle')
      .map((c) => c.args[0])
    expect(styleSets).toContain(COLOR_CHARTREUSE)
  })

  it('does not draw a coord badge when the cursor is too close to the top-left ruler', () => {
    const { ctx, calls } = mockCtx()
    paintCrosshair(ctx, { x: 260, y: 30 }, { w: 1024, h: 768 })
    // The badge branch is gated on x > RULER_LEFT + RULER + 60.
    // No fillText with a coord pattern here.
    const textCalls = findCalls(calls, 'fillText')
    expect(textCalls).toEqual([])
  })
})

describe('paintMarquee', () => {
  it('fills a translucent chartreuse rect and strokes a dashed border', () => {
    const { ctx, calls } = mockCtx()
    const m: Rect = { x: 100, y: 100, w: 200, h: 120 }
    paintMarquee(ctx, m)
    // 2 fillRect calls (the fill + the dimension badge bg),
    // and strokeRect (border) + setLineDash.
    expect(findCalls(calls, 'fillRect').length).toBeGreaterThanOrEqual(2)
    expect(findCalls(calls, 'strokeRect').length).toBeGreaterThanOrEqual(1)
    expect(findCalls(calls, 'setLineDash').length).toBeGreaterThanOrEqual(1)
  })

  it('writes the dimension badge as "WIDTH × HEIGHT"', () => {
    const { ctx, calls } = mockCtx()
    paintMarquee(ctx, { x: 0, y: 0, w: 240, h: 168 })
    const textCalls = findCalls(calls, 'fillText')
    const hasDim = textCalls.some(
      (c) => (c.args[0] as string) === '240 × 168',
    )
    expect(hasDim).toBe(true)
  })
})

describe('paintSelectionTags', () => {
  it('is a no-op for an empty target list', () => {
    const { ctx, calls } = mockCtx()
    paintSelectionTags(ctx, [], { w: 1024, h: 768 })
    expect(findCalls(calls, 'fillRect')).toEqual([])
    expect(findCalls(calls, 'fillText')).toEqual([])
  })

  it('skips targets whose rect is fully off-screen', () => {
    const { ctx, calls } = mockCtx()
    paintSelectionTags(
      ctx,
      [
        { rect: { x: -1000, y: -1000, w: 50, h: 50 }, source$: 'single' },
      ],
      { w: 1024, h: 768 },
    )
    expect(findCalls(calls, 'fillText')).toEqual([])
  })

  it('routes single-pick targets through paintSingleTag (writes "PIN")', () => {
    const { ctx, calls } = mockCtx()
    paintSelectionTags(
      ctx,
      [{ rect: { x: 100, y: 100, w: 50, h: 30 }, source$: 'single', componentName: 'X', source: null }],
      { w: 1024, h: 768 },
    )
    const textCalls = findCalls(calls, 'fillText').map((c) => c.args[0])
    expect(textCalls).toContain('◉ PIN')
  })
})

describe('paintSingleTag', () => {
  it('writes the component name into the tag body', () => {
    const { ctx, calls } = mockCtx()
    paintSingleTag(ctx, {
      rect: { x: 100, y: 100, w: 80, h: 30 },
      componentName: 'TaskForm',
      source: 'src/ui/TaskForm.tsx:5',
    })
    const textCalls = findCalls(calls, 'fillText').map((c) => c.args[0])
    expect(textCalls).toContain('TaskForm')
    expect(textCalls).toContain('src/ui/TaskForm.tsx:5')
  })
})

describe('paintMarqueeCornerBrackets', () => {
  it('draws 4 corner L-brackets each composed of 1 moveTo + 2 lineTo', () => {
    const { ctx, calls } = mockCtx()
    paintMarqueeCornerBrackets(ctx, { x: 100, y: 100, w: 200, h: 120 })
    // Each of the 4 corner L-brackets uses 1 moveTo (starting point)
    // followed by 2 lineTo (the two arms). Total: 4 moveTo, 8 lineTo,
    // then 1 stroke.
    expect(findCalls(calls, 'moveTo').length).toBe(4)
    expect(findCalls(calls, 'lineTo').length).toBe(8)
    expect(findCalls(calls, 'stroke').length).toBeGreaterThanOrEqual(1)
  })
})
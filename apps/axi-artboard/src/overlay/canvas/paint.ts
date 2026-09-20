/**
 * paint — Canvas 2D drawing helpers extracted from OverlayCanvas.tsx
 * for TDD testability. Each paint function consumes a CanvasRenderingContext2D
 * plus a small typed input and pushes draw calls into the context; no
 * React, no DOM trees beyond a size rect.
 *
 * Pair tests: src/overlay/canvas/paint.test.ts
 * PRD rows:   M-26 (paintRulers), M-27 (paintCrosshair),
 *             M-28 (paintMarquee), M-29 (paintSelectionTags),
 *             M-30 (paintSingleTag), M-31 (paintMarqueeCornerBrackets)
 *
 * The functions are pure with respect to the canvas context (only
 * side-effect is calling ctx methods). Tests stub the context and
 * assert the call shape.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
// All constants shared by the paint functions live here so a
// future visual tweak only edits one file.
export const COLOR_CHARTREUSE = '#7fff00'
export const COLOR_RULE = 'rgba(127, 255, 0, 0.35)'
export const COLOR_TICK = 'rgba(127, 255, 0, 0.6)'
export const COLOR_TEXT = 'rgba(127, 255, 0, 0.85)'
export const COLOR_PAPER = '#f4ede0'
export const COLOR_INK = '#0a0e14'
export const COLOR_INK_SOFT = 'rgba(10, 14, 20, 0.7)'

export const RULER_SIZE = 18
export const RULER_LEFT_BOUNDARY = 248
export const FONT_MONO = 'JetBrains Mono, ui-monospace, monospace'

export type Size = { w: number; h: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type Crosshair = { x: number; y: number }

// Stub — the real implementations land in the GREEN commit.
export function paintRulers(
  ctx: CanvasRenderingContext2D,
  size: Size,
  crosshair: Crosshair | null,
): void {
  // Local copies of the constants that the ruler drawing needs.
  // Pulled from the module header so a future visual tweak only
  // edits one file, but kept local here so the per-pixel code reads
  // identically to the original OverlayCanvas.tsx implementation.
  const RULER = RULER_SIZE
  const RULER_LEFT = RULER_LEFT_BOUNDARY
  const RULER_TOP = 0
  const RULER_RIGHT = size.w
  const RULER_BOTTOM = size.h
  const COLOR_RULE_LOCAL = 'rgba(58, 77, 106, 0.65)'
  const COLOR_TICK_LOCAL = 'rgba(79, 124, 255, 0.55)'
  const COLOR_TEXT_LOCAL = 'rgba(136, 150, 168, 0.85)'

  ctx.save()

  // Top ruler background — a thin slab restricted to the main pane.
  ctx.fillStyle = 'rgba(17, 22, 31, 0.65)'
  ctx.fillRect(RULER_LEFT, RULER_TOP, RULER_RIGHT - RULER_LEFT, RULER)
  // Top ruler baseline.
  ctx.strokeStyle = COLOR_RULE_LOCAL
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(RULER_LEFT, RULER + 0.5)
  ctx.lineTo(RULER_RIGHT, RULER + 0.5)
  ctx.stroke()

  // Left ruler background.
  ctx.fillStyle = 'rgba(17, 22, 31, 0.65)'
  ctx.fillRect(RULER_LEFT, RULER_TOP, RULER, RULER_BOTTOM)
  // Left ruler baseline.
  ctx.beginPath()
  ctx.moveTo(RULER_LEFT + RULER + 0.5, RULER_TOP)
  ctx.lineTo(RULER_LEFT + RULER + 0.5, RULER_BOTTOM)
  ctx.stroke()

  // Top tick marks.
  ctx.font = `9px ${FONT_MONO}`
  ctx.textBaseline = 'top'
  for (let x = RULER_LEFT; x <= RULER_RIGHT; x += 25) {
    const isMajor = x % 100 === 0
    ctx.strokeStyle = isMajor ? COLOR_TICK_LOCAL : COLOR_RULE_LOCAL
    ctx.beginPath()
    ctx.moveTo(x + 0.5, isMajor ? RULER - 8 : RULER - 4)
    ctx.lineTo(x + 0.5, RULER)
    ctx.stroke()
    if (isMajor) {
      ctx.fillStyle = COLOR_TEXT_LOCAL
      ctx.fillText(String(x), x + 3, 3)
    }
  }
  // Left tick marks.
  ctx.textAlign = 'left'
  for (let y = RULER_TOP; y <= RULER_BOTTOM; y += 25) {
    const isMajor = y % 100 === 0
    ctx.strokeStyle = isMajor ? COLOR_TICK_LOCAL : COLOR_RULE_LOCAL
    ctx.beginPath()
    ctx.moveTo(RULER_LEFT + (isMajor ? RULER - 8 : RULER - 4), y + 0.5)
    ctx.lineTo(RULER_LEFT + RULER, y + 0.5)
    ctx.stroke()
    if (isMajor) {
      ctx.save()
      ctx.translate(RULER_LEFT + 3, y + 2)
      ctx.fillStyle = COLOR_TEXT_LOCAL
      ctx.fillText(String(y), 0, 0)
      ctx.restore()
    }
  }

  // Corner square at the L-corner of the rulers. The PRD test pins
  // its exact rect so we keep the same args.
  ctx.fillStyle = 'rgba(17, 22, 31, 0.85)'
  ctx.fillRect(RULER_LEFT, RULER_TOP, RULER, RULER)
  ctx.strokeStyle = COLOR_RULE_LOCAL
  ctx.strokeRect(RULER_LEFT + 0.5, RULER_TOP + 0.5, RULER - 1, RULER - 1)

  // Crosshair "you are here" indicator on each ruler.
  if (crosshair) {
    ctx.strokeStyle = 'rgba(127, 255, 0, 0.85)'
    ctx.lineWidth = 1
    if (crosshair.x >= RULER_LEFT && crosshair.x <= RULER_RIGHT) {
      ctx.beginPath()
      ctx.moveTo(crosshair.x + 0.5, RULER_TOP)
      ctx.lineTo(crosshair.x + 0.5, RULER)
      ctx.stroke()
    }
    if (crosshair.y >= RULER_TOP && crosshair.y <= RULER_BOTTOM) {
      ctx.beginPath()
      ctx.moveTo(RULER_LEFT, crosshair.y + 0.5)
      ctx.lineTo(RULER_LEFT + RULER, crosshair.y + 0.5)
      ctx.stroke()
    }

    if (crosshair.y >= RULER_TOP && crosshair.y <= RULER_BOTTOM) {
      ctx.fillStyle = COLOR_INK
      ctx.fillRect(RULER_LEFT + 2, crosshair.y - 8, RULER - 4, 11)
      ctx.fillStyle = COLOR_CHARTREUSE
      ctx.font = `9px ${FONT_MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(Math.round(crosshair.y)), RULER_LEFT + 4, crosshair.y - 2)
    }

    if (crosshair.x >= RULER_LEFT && crosshair.x <= RULER_RIGHT) {
      ctx.textBaseline = 'top'
      ctx.fillStyle = COLOR_INK
      ctx.fillRect(crosshair.x - 14, 2, 28, 11)
      ctx.textAlign = 'center'
      ctx.fillStyle = COLOR_CHARTREUSE
      ctx.fillText(String(Math.round(crosshair.x)), crosshair.x, 4)
    }
  }

  ctx.restore()
}

export function paintCrosshair(
  ctx: CanvasRenderingContext2D,
  c: Crosshair,
  size: Size,
): void {
  const RULER = RULER_SIZE
  const RULER_LEFT = RULER_LEFT_BOUNDARY
  ctx.save()
  ctx.strokeStyle = COLOR_RULE
  ctx.setLineDash([2, 3])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(RULER_LEFT + RULER, c.y + 0.5)
  ctx.lineTo(size.w, c.y + 0.5)
  ctx.moveTo(c.x + 0.5, RULER)
  ctx.lineTo(c.x + 0.5, size.h)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = COLOR_CHARTREUSE
  ctx.beginPath()
  ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2)
  ctx.fill()

  if (
    c.x > RULER_LEFT + RULER + 60 &&
    c.y > RULER + 32 &&
    c.x < size.w - 80 &&
    c.y < size.h - 32
  ) {
    const label = `${Math.round(c.x)}, ${Math.round(c.y)}`
    ctx.font = `700 10px ${FONT_MONO}`
    const tw = ctx.measureText(label).width
    const bx = c.x + 10
    const by = c.y + 10
    ctx.fillStyle = COLOR_CHARTREUSE
    ctx.fillRect(bx, by, tw + 12, 18)
    ctx.strokeStyle = COLOR_INK
    ctx.lineWidth = 1
    ctx.strokeRect(bx + 0.5, by + 0.5, tw + 12 - 1, 17)
    ctx.fillStyle = COLOR_INK
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(label, bx + 6, by + 9)
  }

  ctx.restore()
}

export function paintMarquee(
  ctx: CanvasRenderingContext2D,
  m: Rect,
): void {
  ctx.save()
  ctx.fillStyle = 'rgba(127, 255, 0, 0.06)'
  ctx.fillRect(m.x, m.y, m.w, m.h)

  ctx.strokeStyle = COLOR_CHARTREUSE
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  ctx.strokeRect(m.x + 0.5, m.y + 0.5, m.w - 1, m.h - 1)
  ctx.setLineDash([])

  // Corner brackets — architectural-drawing convention. Sit just
  // outside the rectangle so the outline reads as "marked", not "boxed".
  const BL = 10
  ctx.beginPath()
  // top-left
  ctx.moveTo(m.x - 4, m.y - 4); ctx.lineTo(m.x - 4 + BL, m.y - 4)
  ctx.moveTo(m.x - 4, m.y - 4); ctx.lineTo(m.x - 4, m.y - 4 + BL)
  // top-right
  ctx.moveTo(m.x + m.w + 4, m.y - 4); ctx.lineTo(m.x + m.w + 4 - BL, m.y - 4)
  ctx.moveTo(m.x + m.w + 4, m.y - 4); ctx.lineTo(m.x + m.w + 4, m.y - 4 + BL)
  // bottom-left
  ctx.moveTo(m.x - 4, m.y + m.h + 4); ctx.lineTo(m.x - 4 + BL, m.y + m.h + 4)
  ctx.moveTo(m.x - 4, m.y + m.h + 4); ctx.lineTo(m.x - 4, m.y + m.h + 4 - BL)
  // bottom-right
  ctx.moveTo(m.x + m.w + 4, m.y + m.h + 4); ctx.lineTo(m.x + m.w + 4 - BL, m.y + m.h + 4)
  ctx.moveTo(m.x + m.w + 4, m.y + m.h + 4); ctx.lineTo(m.x + m.w + 4, m.y + m.h + 4 - BL)
  ctx.stroke()

  // Dimension badge in the bottom-right corner.
  const dim = `${Math.round(m.w)} × ${Math.round(m.h)}`
  ctx.font = `10px ${FONT_MONO}`
  const tw = ctx.measureText(dim).width
  const bx = m.x + m.w - tw - 14
  const by = m.y + m.h + 6
  ctx.fillStyle = COLOR_INK
  ctx.fillRect(bx, by, tw + 12, 16)
  ctx.strokeStyle = COLOR_CHARTREUSE
  ctx.strokeRect(bx + 0.5, by + 0.5, tw + 12 - 1, 15)
  ctx.fillStyle = COLOR_CHARTREUSE
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(dim, bx + 6, by + 8)

  ctx.restore()
}

export function paintSelectionTags(
  ctx: CanvasRenderingContext2D,
  targets: { rect: Rect; source$: 'single' | 'marquee'; componentName?: string; source?: string | null }[],
  size: Size,
): void {
  if (targets.length === 0) return
  for (const t of targets) {
    const r = t.rect
    if (
      r.x + r.w < 0 || r.y + r.h < 0 ||
      r.x > size.w || r.y > size.h ||
      r.w < 2 || r.h < 2
    ) {
      continue
    }

    if (t.source$ === 'single') {
      paintSingleTag(ctx, {
        rect: r,
        componentName: t.componentName ?? '',
        source: t.source ?? null,
      })
    } else {
      paintMarqueeCornerBrackets(ctx, r)
    }
  }
}

export function paintSingleTag(
  ctx: CanvasRenderingContext2D,
  t: { rect: Rect; componentName: string; source: string | null },
): void {
  ctx.save()
  const r = t.rect

  // Corner brackets on the bounding box.
  const BL = 12
  ctx.strokeStyle = COLOR_CHARTREUSE
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(r.x - 3, r.y); ctx.lineTo(r.x - 3, r.y + BL)
  ctx.moveTo(r.x - 3, r.y); ctx.lineTo(r.x - 3 + BL, r.y)
  ctx.moveTo(r.x + r.w + 3, r.y); ctx.lineTo(r.x + r.w + 3, r.y + BL)
  ctx.moveTo(r.x + r.w + 3, r.y); ctx.lineTo(r.x + r.w + 3 - BL, r.y)
  ctx.moveTo(r.x - 3, r.y + r.h); ctx.lineTo(r.x - 3, r.y + r.h - BL)
  ctx.moveTo(r.x - 3, r.y + r.h); ctx.lineTo(r.x - 3 + BL, r.y + r.h)
  ctx.moveTo(r.x + r.w + 3, r.y + r.h); ctx.lineTo(r.x + r.w + 3, r.y + r.h - BL)
  ctx.moveTo(r.x + r.w + 3, r.y + r.h); ctx.lineTo(r.x + r.w + 3 - BL, r.y + r.h)
  ctx.stroke()

  // Measure tag content.
  const name = t.componentName
  const src = t.source ?? 'unknown'
  ctx.font = `700 9px ${FONT_MONO}`
  const pinW = ctx.measureText('◉ PIN').width
  ctx.font = `700 11px ${FONT_MONO}`
  const nameW = ctx.measureText(name).width
  ctx.font = `9px ${FONT_MONO}`
  const srcW = ctx.measureText(src).width
  const tagW = Math.max(srcW, nameW, pinW) + 24
  const tagH = 38
  const GAP = 56

  const VIEW_W = typeof window !== 'undefined' ? window.innerWidth : 1024
  const VIEW_H = typeof window !== 'undefined' ? window.innerHeight : 768
  const RULER = RULER_SIZE
  const LEGEND_W = 320
  const LEGEND_H = 220

  type Anchor = { x: number; y: number }
  const candidates: Anchor[] = [
    { x: r.x + r.w + GAP,  y: r.y - tagH - GAP },
    { x: r.x - tagW - GAP, y: r.y - tagH - GAP },
    { x: r.x + r.w + GAP,  y: r.y + r.h + GAP },
    { x: r.x - tagW - GAP, y: r.y + r.h + GAP },
  ]

  const fits = (c: Anchor): boolean => {
    if (c.x < RULER + 8) return false
    if (c.x + tagW > VIEW_W - 8) return false
    if (c.y < RULER + 8) return false
    if (c.y + tagH > VIEW_H - 8) return false
    const underLegend =
      c.x + tagW > VIEW_W - LEGEND_W - 8 && c.y + tagH > VIEW_H - LEGEND_H - 8
    if (underLegend) return false
    return true
  }

  let tagX = 0
  let tagY = 0
  let chosen = -1
  for (let i = 0; i < candidates.length; i++) {
    if (fits(candidates[i])) {
      tagX = candidates[i].x
      tagY = candidates[i].y
      chosen = i
      break
    }
  }
  if (chosen === -1) {
    tagX = Math.min(Math.max(RULER + 8, r.x), VIEW_W - tagW - 8)
    tagY = Math.min(Math.max(RULER + 8, r.y - tagH - GAP), VIEW_H - tagH - 8)
    chosen = 0
  }

  const leaderFromBox = (() => {
    switch (chosen) {
      case 0: return { x: r.x + r.w, y: r.y }
      case 1: return { x: r.x,       y: r.y }
      case 2: return { x: r.x + r.w, y: r.y + r.h }
      case 3: return { x: r.x,       y: r.y + r.h }
      default: return { x: r.x + r.w, y: r.y }
    }
  })()

  const leaderToTag = (() => {
    if (chosen === 0 || chosen === 1) {
      return { x: tagX + tagW / 2, y: tagY + tagH }
    }
    return { x: tagX + tagW / 2, y: tagY }
  })()

  ctx.strokeStyle = 'rgba(127, 255, 0, 0.9)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leaderFromBox.x, leaderFromBox.y)
  ctx.lineTo(leaderToTag.x, leaderFromBox.y)
  ctx.lineTo(leaderToTag.x, leaderToTag.y)
  ctx.stroke()
  ctx.fillStyle = COLOR_CHARTREUSE
  ctx.beginPath()
  ctx.arc(leaderFromBox.x, leaderFromBox.y, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  const ah = 4
  if (chosen === 0 || chosen === 1) {
    ctx.moveTo(leaderToTag.x - ah, leaderToTag.y - ah)
    ctx.lineTo(leaderToTag.x, leaderToTag.y)
    ctx.lineTo(leaderToTag.x + ah, leaderToTag.y - ah)
  } else {
    ctx.moveTo(leaderToTag.x - ah, leaderToTag.y + ah)
    ctx.lineTo(leaderToTag.x, leaderToTag.y)
    ctx.lineTo(leaderToTag.x + ah, leaderToTag.y + ah)
  }
  ctx.stroke()

  ctx.fillStyle = COLOR_PAPER
  ctx.fillRect(tagX, tagY, tagW, tagH)
  ctx.strokeStyle = COLOR_CHARTREUSE
  ctx.lineWidth = 1
  ctx.strokeRect(tagX + 0.5, tagY + 0.5, tagW - 1, tagH - 1)
  ctx.fillStyle = COLOR_CHARTREUSE
  ctx.fillRect(tagX, tagY, 3, tagH)

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = COLOR_INK
  ctx.font = `700 9px ${FONT_MONO}`
  ctx.fillText('◉ PIN', tagX + 12, tagY + 6)

  ctx.fillStyle = COLOR_INK
  ctx.font = `700 11px ${FONT_MONO}`
  ctx.fillText(name, tagX + 12, tagY + 17)

  ctx.fillStyle = COLOR_INK_SOFT
  ctx.font = `9px ${FONT_MONO}`
  ctx.fillText(src, tagX + 12, tagY + 17 + 12)

  ctx.restore()
}

export function paintMarqueeCornerBrackets(
  ctx: CanvasRenderingContext2D,
  r: Rect,
): void {
  ctx.save()
  const BL = 8
  ctx.strokeStyle = 'rgba(127, 255, 0, 0.7)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(r.x - 2, r.y + BL); ctx.lineTo(r.x - 2, r.y - 2); ctx.lineTo(r.x + BL, r.y - 2)
  ctx.moveTo(r.x + r.w - BL, r.y - 2); ctx.lineTo(r.x + r.w + 2, r.y - 2); ctx.lineTo(r.x + r.w + 2, r.y + BL)
  ctx.moveTo(r.x + r.w + 2, r.y + r.h - BL); ctx.lineTo(r.x + r.w + 2, r.y + r.h + 2); ctx.lineTo(r.x + r.w - BL, r.y + r.h + 2)
  ctx.moveTo(r.x + BL, r.y + r.h + 2); ctx.lineTo(r.x - 2, r.y + r.h + 2); ctx.lineTo(r.x - 2, r.y + r.h - BL)
  ctx.stroke()
  ctx.restore()
}
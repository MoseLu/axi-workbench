/**
 * geometry — pure rect helpers extracted from OverlayCanvas.tsx for TDD
 * testability. Pure functions only: no DOM, no React, no side effects.
 *
 * Pair tests: src/overlay/__pure__/geometry.test.ts
 * PRD row:    M-16 (intersects) / M-17 (toXYWH)
 */

export type XYWH = { x: number; y: number; w: number; h: number }

/** AABB intersection: any pixel of A touching B is enough. */
export function intersects(a: XYWH, b: XYWH): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

/** Normalize any rect-ish shape (DOMRect, our own XYWH, or {left,top,width,height})
 * to the canonical {x,y,w,h} form `intersects` and the picker consume. */
export function toXYWH(
  r: {
    x?: number
    y?: number
    left?: number
    top?: number
    width?: number
    height?: number
    right?: number
    bottom?: number
    w?: number
    h?: number
  },
): XYWH {
  if (typeof r.w === 'number' && typeof r.h === 'number') {
    return { x: r.x ?? 0, y: r.y ?? 0, w: r.w, h: r.h }
  }
  const x = r.x ?? r.left ?? 0
  const y = r.y ?? r.top ?? 0
  const w = r.width ?? (r.right != null ? r.right - x : 0)
  const h = r.height ?? (r.bottom != null ? r.bottom - y : 0)
  return { x, y, w, h }
}
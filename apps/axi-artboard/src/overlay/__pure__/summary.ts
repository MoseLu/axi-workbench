/**
 * summary — pure helper to format a NodeRef[] count for the toolbar
 * pill. Extracted from OverlayCanvas.tsx for TDD testability.
 *
 * Pair tests: src/overlay/__pure__/summary.test.ts
 * PRD row:    M-18
 */

import type { NodeRef } from '../perception'

export function countSummary(t: NodeRef[]): string {
  const single = t.filter((x) => x.source$ === 'single').length
  const marquee = t.filter((x) => x.source$ === 'marquee').length
  if (single === 1 && marquee === 0) return '1 pin'
  if (single === 0 && marquee >= 1) return `${marquee} in region`
  // Mixed
  const parts: string[] = []
  if (single) parts.push(`${single} pin${single > 1 ? 's' : ''}`)
  if (marquee) parts.push(`${marquee} in region`)
  return parts.join(' + ')
}
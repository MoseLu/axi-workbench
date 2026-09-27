/**
 * mergeTargets — pure function: merge a previous NodeRef[] with a fresh
 * NodeRef[] batch (produced by a marquee sweep or a single-pin replace).
 *
 * Contract (verified by src/overlay/__pure__/mergeTargets.test.ts):
 * 1. Single-picks always win the source$ label — re-hitting a single-pinned
 *    domPath from a marquee never demotes source$ to 'marquee'.
 * 2. Coords / pickedAt ARE refreshed from the latest hit (so the live
 *    rect reflects where the element is right now).
 * 3. Unseen entries from `next` are appended, even if no `prev` existed.
 * 4. Dedup is by domPath joined with '>'.
 *
 * Extracted from OverlayCanvas.tsx into the __pure__ sub-module so it can
 * be tested without React/jsdom-heavy mount overhead. See the TDD-driven
 * PRD process at docs/process/tdd-driven-prd.md.
 */

import type { NodeRef } from '../perception'

export function mergeTargets(prev: NodeRef[], next: NodeRef[]): NodeRef[] {
  const byPath = new Map<string, NodeRef>()
  for (const t of prev) byPath.set(t.domPath.join('>'), t)
  for (const t of next) {
    const key = t.domPath.join('>')
    const existing = byPath.get(key)
    if (existing) {
      // Update coords / pickedAt from the fresh marquee hit, but
      // preserve the existing source label (don't demote 'single').
      byPath.set(key, { ...existing, ...t, source$: existing.source$ })
    } else {
      byPath.set(key, t)
    }
  }
  return Array.from(byPath.values())
}

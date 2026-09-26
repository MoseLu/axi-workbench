/**
 * Barrel export for the __pure__ sub-module. Functions here have ZERO
 * runtime dependency on React, jsdom mount, or any closure over the
 * OverlayCanvas component — they are pure functions of their arguments
 * and may be tested with vitest in isolation.
 *
 * Adding to this directory:
 *  1. Create a single-purpose .ts file exporting only pure functions.
 *  2. Re-export from this file.
 *  3. Add a sibling .test.ts that pins the contract via red-then-green.
 *  4. Update OverlayCanvas.tsx imports to use this barrel.
 *
 * See docs/process/tdd-driven-prd.md.
 */

export { mergeTargets } from './mergeTargets'
export { buildDomPath } from './buildDomPath'
export { climbToClickable } from './climbToClickable'
export { intersects, toXYWH } from './geometry'
export type { XYWH } from './geometry'
export { countSummary } from './summary'
export { toRef, publicNode } from './ref'
export { findByDomPath } from './domPathLookup'

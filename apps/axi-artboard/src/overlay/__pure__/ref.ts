/**
 * ref — build NodeRef from a ComponentInfo and project NodeRef → public shape.
 * Pure helpers extracted from OverlayCanvas.tsx for TDD testability.
 *
 * Pair tests: src/overlay/__pure__/ref.test.ts
 * PRD rows:   M-20 (toRef) / M-21 (publicNode)
 */

import type { NodeRef } from '../perception'
import { buildDomPath } from './buildDomPath'
import { summarizeProps } from './props'

/** `info` is the component-info shape produced by inspect.ts; the
 * caller passes source$ to tag which gesture produced this hit. */
export function toRef(
  info: {
    dom: HTMLElement
    componentName: string
    source: unknown
    props: Record<string, unknown> | null
    rect: { x: number; y: number; width: number; height: number }
  },
  source$: 'single' | 'marquee',
): NodeRef {
  const domPath = buildDomPath(info.dom)
  return {
    id: `${info.dom.tagName.toLowerCase()}#${domPath.join('>')}`,
    tag: info.dom.tagName.toLowerCase(),
    componentName: info.componentName,
    source: formatSource(info.source),
    domPath,
    props: info.props ? summarizeProps(info.props) : null,
    rect: {
      x: Math.round(info.rect.x),
      y: Math.round(info.rect.y),
      w: Math.round(info.rect.width),
      h: Math.round(info.rect.height),
    },
    pickedAt: Date.now(),
    source$,
  }
}

/** Mirror of the public NodeRef fields. Used to drop any private
 * fields before exposing on window.__artboard. */
export function publicNode(t: NodeRef): NodeRef {
  return {
    id: t.id,
    tag: t.tag,
    componentName: t.componentName,
    source: t.source,
    domPath: t.domPath,
    props: t.props,
    rect: t.rect,
    pickedAt: t.pickedAt,
    source$: t.source$,
  }
}

/** Format source location: {file,line,column} → 'file:line' or 'file:line:col'.
 * Kept private to this module since the format is the inspector's
 * concern, not the ref builder's. */
function formatSource(s: unknown): string | null {
  if (!s || typeof s !== 'object') return null
  const o = s as { file?: unknown; line?: unknown; column?: unknown }
  if (typeof o.file !== 'string') return null
  const file = o.file
  const line = typeof o.line === 'number' ? `:${o.line}` : ''
  const col = typeof o.column === 'number' ? `:${o.column}` : ''
  return `${file}${line}${col}`
}
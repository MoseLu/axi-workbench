/**
 * LocalSourceIndex module-level cache + invalidation primitives.
 *
 * Mirrors the original `indexer.ts` behavior: a single Map keyed by source
 * id, a static-mode switch for build-time freshness, and the shared cache
 * clear used by tests.
 */

import { gitRootCache, gitUpdatedCache, gitPrefilledRoots } from '../utils'
import { normalizeSlashes } from '../utils'
import type { LocalSourceIndex } from '../types'

export const localSourceIndexCache = new Map<string, LocalSourceIndex>()

let localSourceIndexStaticMode = false

export function setLocalSourceIndexStaticMode(enabled: boolean): void {
  localSourceIndexStaticMode = enabled
}

export function isLocalSourceIndexStaticMode(): boolean {
  return localSourceIndexStaticMode
}

export function invalidateLocalSourceIndex(sourceId: string, relativePath?: string): void {
  if (!relativePath) {
    localSourceIndexCache.delete(sourceId)
    return
  }

  const cachedIndex = localSourceIndexCache.get(sourceId)
  if (!cachedIndex) return
  cachedIndex.files.delete(normalizeSlashes(relativePath))
}

export function __clearKnowledgeBaseCacheForTests(): void {
  localSourceIndexCache.clear()
  gitRootCache.clear()
  gitUpdatedCache.clear()
  gitPrefilledRoots.clear()
}
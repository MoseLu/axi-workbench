/**
 * server-perception.test.ts — TDD-hard test for the dev-server
 * perception store.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  getLatest,
  mergePublished,
  setLatest,
  subscribe,
} from '../src/server-perception.js'

describe('server-perception store', () => {
  beforeEach(() => {
    // Reset between tests by publishing a known sentinel.
    setLatest({
      explicitTargets: [],
      primary: null,
      recentInteractions: [],
      annotations: [],
      timestamp: 0,
      version: 'reset',
      capabilities: [],
    })
  })

  it('returns the initial sentinel packet on first read', () => {
    // server-perception.setLatest always enforces its own VERSION +
    // CAPABILITIES, so even after a beforeEach reset the visible
    // version is the store-defined "1.0-perception-mvp".
    const latest = getLatest()
    expect(latest.version).toBe('1.0-perception-mvp')
    expect(latest.capabilities).toContain('picker')
  })

  it('shallow-merges partial published packets', () => {
    mergePublished({ explicitTargets: [{ id: 'a' }] })
    const latest = getLatest()
    expect(latest.explicitTargets).toEqual([{ id: 'a' }])
    // Untouched fields keep their prior value.
    expect(latest.primary).toBeNull()
  })

  it('notifies subscribers on every setLatest / mergePublished', () => {
    const seen: number[] = []
    const off = subscribe(() => {
      seen.push(Date.now())
    })
    mergePublished({ primary: { id: 'x' } })
    mergePublished({ primary: { id: 'y' } })
    off()
    mergePublished({ primary: { id: 'z' } })
    expect(seen.length).toBeGreaterThanOrEqual(2)
  })

  it('overrides version + capabilities + timestamp with the store-defined values', () => {
    mergePublished({
      version: 'spoofed',
      capabilities: ['spoofed'],
      explicitTargets: [{ id: 'b' }],
    } as any)
    const latest = getLatest()
    expect(latest.version).toBe('1.0-perception-mvp')
    expect(latest.capabilities).toContain('picker')
    expect(latest.timestamp).toBeGreaterThan(0)
  })
})

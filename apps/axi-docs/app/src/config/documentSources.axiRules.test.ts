import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { getDocumentSourceRegistry, validateDocumentSourceRegistry } from './documentSources'

describe('documentSourceRegistry axi-rules', () => {
  it('registers axi-rules as an enabled, local, read-only source (T1)', () => {
    const sources = getDocumentSourceRegistry()
    const axiRules = sources.find((s) => s.id === 'axi-rules')
    expect(axiRules).toBeDefined()
    expect(axiRules?.enabled).toBe(true)
    expect(axiRules?.type).toBe('local')
    expect(axiRules?.kind).toBe('markdown-vault')
    expect(axiRules?.adapter).toBe('markdown')
    expect(axiRules?.readOnly).toBe(true)
    expect(axiRules?.audience).toEqual(['agent', 'human'])
  })

  it('resolves axi-rules path from AXI_RULES_PATH or workspace default (T2)', () => {
    const previous = process.env.AXI_RULES_PATH
    try {
      delete process.env.AXI_RULES_PATH
      const sources = getDocumentSourceRegistry()
      const axiRules = sources.find((s) => s.id === 'axi-rules')
      // The default path is computed by detectWorkspaceRoot();
      // verify the suffix rather than the absolute path so the
      // test stays portable across machines.
      expect(axiRules?.path?.endsWith(`${path.sep}foundation${path.sep}axi-rules`)).toBe(true)

      process.env.AXI_RULES_PATH = '/custom/axi-rules'
      const sources2 = getDocumentSourceRegistry()
      const axiRules2 = sources2.find((s) => s.id === 'axi-rules')
      expect(axiRules2?.path).toBe('/custom/axi-rules')
    } finally {
      if (previous === undefined) {
        delete process.env.AXI_RULES_PATH
      } else {
        process.env.AXI_RULES_PATH = previous
      }
    }
  })

  it('keeps the 8 original sources intact (T3)', () => {
    const sources = getDocumentSourceRegistry()
    const ids = new Set(sources.map((s) => s.id))
    for (const expected of [
      'workspace', 'axi-skills', 'axi-skills-zh', 'axi-docs-en',
      'axi-docs-zh', 'dbskill', 'obsidian', 'blinko',
    ]) {
      expect(ids.has(expected)).toBe(true)
    }
    // skill-registry and axi-rules were added on top of the 8 originals;
    // workspace mirror sources (workspace-root-docs / workspace-state-docs /
    // workspace-audit-docs / workspace-architecture-docs / workspace-prd-docs /
    // workspace-axi-docs / axi-workspace-governance-docs /
    // axi-workspace-rules-docs / workspace-incubator-docs) are added
    // separately. The registry must always include both add-ons and grow
    // monotonically.
    expect(ids.has('skill-registry')).toBe(true)
    expect(ids.has('axi-rules')).toBe(true)
    expect(sources.length).toBeGreaterThanOrEqual(10)
  })

  it('passes registry validation with axi-rules enabled', () => {
    const errors = validateDocumentSourceRegistry(getDocumentSourceRegistry())
    expect(errors).toEqual([])
  })
})

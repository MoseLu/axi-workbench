import { describe, expect, it } from 'vitest'
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
      expect(axiRules?.path).toBe('/Volumes/code/workspace/projects/axi-rules')

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
    // 8 original + 1 new = 9 total.
    expect(sources.length).toBe(9)
  })

  it('passes registry validation with axi-rules enabled', () => {
    const errors = validateDocumentSourceRegistry(getDocumentSourceRegistry())
    expect(errors).toEqual([])
  })
})

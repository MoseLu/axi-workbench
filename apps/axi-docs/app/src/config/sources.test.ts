import { describe, it, expect } from 'vitest'
import { docSources, excludePatterns, supportedExtensions } from './sources'

describe('sources configuration', () => {
  describe('docSources', () => {
    it('should have at least one enabled source', () => {
      const enabledSources = docSources.filter(s => s.enabled)
      expect(enabledSources.length).toBeGreaterThan(0)
    })

    it('should have unique IDs for all sources', () => {
      const ids = docSources.map(s => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have required properties for each source', () => {
      docSources.forEach(source => {
        expect(source).toHaveProperty('id')
        expect(source).toHaveProperty('name')
        expect(source).toHaveProperty('path')
        expect(source).toHaveProperty('enabled')
        expect(source).toHaveProperty('type')
        expect(['local', 'api']).toContain(source.type)
      })
    })

    it('should have obsidian source configured', () => {
      const obsidian = docSources.find(s => s.id === 'obsidian')
      expect(obsidian).toBeDefined()
      expect(obsidian?.enabled).toBe(true)
      expect(obsidian?.type).toBe('local')
    })

    it('should have blinko-notes source configured', () => {
      const blinko = docSources.find(s => s.id === 'blinko-notes')
      expect(blinko).toBeDefined()
      expect(blinko?.enabled).toBe(true)
      expect(blinko?.type).toBe('local')
    })

    it('should have axi-workspace-governance source configured', () => {
      const workspace = docSources.find(s => s.id === 'axi-workspace-governance')
      expect(workspace).toBeDefined()
      expect(workspace?.enabled).toBe(true)
      expect(workspace?.type).toBe('local')
    })
  })

  describe('excludePatterns', () => {
    it('should exclude .git folder', () => {
      expect(excludePatterns).toContain('.git')
    })

    it('should exclude node_modules', () => {
      expect(excludePatterns).toContain('node_modules')
    })

    it('should exclude .obsidian folder', () => {
      expect(excludePatterns).toContain('.obsidian')
    })

    it('should exclude .trash folder', () => {
      expect(excludePatterns).toContain('.trash')
    })

    it('should not contain duplicates', () => {
      const unique = new Set(excludePatterns)
      expect(unique.size).toBe(excludePatterns.length)
    })
  })

  describe('supportedExtensions', () => {
    it('should support .md files', () => {
      expect(supportedExtensions).toContain('.md')
    })

    it('should support .markdown files', () => {
      expect(supportedExtensions).toContain('.markdown')
    })

    it('should have all extensions in lowercase', () => {
      supportedExtensions.forEach(ext => {
        expect(ext).toBe(ext.toLowerCase())
      })
    })
  })
})

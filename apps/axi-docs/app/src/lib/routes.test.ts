import { describe, expect, it } from 'vitest'
import {
  buildCategoryRoute,
  buildDocumentRoute,
  buildSearchRoute,
  decodeDocumentRoute,
  normalizeRouterBasename,
} from './routes'

describe('route helpers', () => {
  it('builds application routes without hash fragments', () => {
    expect(buildSearchRoute('axi', 'workspace')).toBe('/zh/guide/search?q=axi&source=workspace')
    expect(buildSearchRoute('axi', 'workspace', 'en')).toBe('/en/guide/search?q=axi&source=workspace')
    expect(buildCategoryRoute('guide')).toBe('/nodes/guide')
    expect(buildDocumentRoute({ sourceId: 'workspace', path: 'projects/axi-docs.md' })).toBe('/docs/workspace/projects/axi-docs')
  })

  it('round trips readable document routes', () => {
    const route = buildDocumentRoute({ sourceId: 'workspace', path: 'projects/快速开始.md' })
    expect(route).toBe('/docs/workspace/projects/%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B')

    expect(decodeDocumentRoute('workspace', 'projects/%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B')).toEqual({
      sourceId: 'workspace',
      path: 'projects/快速开始.md',
    })
  })

  it('normalizes router basenames for browser history routing', () => {
    expect(normalizeRouterBasename('/')).toBeUndefined()
    expect(normalizeRouterBasename('./')).toBeUndefined()
    expect(normalizeRouterBasename('/docs/')).toBe('/docs')
    expect(normalizeRouterBasename('https://example.com/docs/')).toBe('/docs')
  })
})

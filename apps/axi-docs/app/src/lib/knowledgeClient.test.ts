import { describe, expect, it } from 'vitest'
import { resolveStaticKnowledgeAssetUrl } from './knowledgeClient'

describe('resolveStaticKnowledgeAssetUrl', () => {
  it('loads generated knowledge from the site root when Vite uses a relative base', () => {
    expect(resolveStaticKnowledgeAssetUrl('generated/knowledge/manifest.json', './'))
      .toBe('/generated/knowledge/manifest.json')
    expect(resolveStaticKnowledgeAssetUrl('/generated/knowledge/manifest.json', '.'))
      .toBe('/generated/knowledge/manifest.json')
  })

  it('keeps an explicit hosted base for subpath deployments', () => {
    expect(resolveStaticKnowledgeAssetUrl('generated/knowledge/manifest.json', '/docs/'))
      .toBe('/docs/generated/knowledge/manifest.json')
  })
})

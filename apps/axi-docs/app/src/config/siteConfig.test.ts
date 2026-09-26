import { describe, expect, it } from 'vitest'
import {
  buildDocSetRoute,
  buildGuideRoute,
  getDocSetSourceId,
  getLocaleOptions,
  getSiteLocaleConfig,
  isDocSetId,
  isGuidePageId,
  isSiteLocale,
} from './siteConfig'
import type { DocSource } from '../types'

describe('siteConfig', () => {
  it('organizes localized routes and theme navigation from one config surface', () => {
    const zh = getSiteLocaleConfig('zh')
    const en = getSiteLocaleConfig('en')

    expect(zh.lang).toBe('zh-CN')
    expect(en.lang).toBe('en-US')
    expect(zh.themeConfig.nav.map((item) => item.text)).toEqual(['指南', '技能库', '工作区'])
    expect(en.themeConfig.nav.map((item) => item.text)).toEqual(['Guide', 'Skills', 'Workspace'])
    expect(zh.themeConfig.guideSections.map((section) => section.text)).toEqual(['简介', '内容与写作', '知识系统', '架构参考', '运维与扩展'])
    expect(zh.themeConfig.guideSections.flatMap((section) => section.items)).toHaveLength(14)
    expect(en.themeConfig.guideSections[1].items.map((item) => item.text)).toEqual([
      'Document Sources',
      'Plans Library',
      'Writing Markdown',
      'Frontmatter',
      'Search and Indexing',
    ])
    expect(zh.themeConfig.docSets.find((item) => item.id === 'guide')?.sourceId).toBe('axi-docs-zh')
    expect(en.themeConfig.docSets.find((item) => item.id === 'guide')?.sourceId).toBe('axi-docs-en')
    expect(buildGuideRoute('zh', 'getting-started')).toBe('/zh/guide/getting-started')
    expect(buildGuideRoute('en', 'frontend-bff')).toBe('/en/guide/frontend-bff')
    expect(buildDocSetRoute('en', 'skills')).toBe('/en/skills')
  })

  it('exposes locale options for the language menu', () => {
    expect(getLocaleOptions()).toEqual([
      expect.objectContaining({ code: 'zh', label: '简体中文', lang: 'zh-CN' }),
      expect.objectContaining({ code: 'en', label: 'English', lang: 'en-US' }),
    ])
    expect(isSiteLocale('zh')).toBe(true)
    expect(isGuidePageId('frontend-bff')).toBe(true)
    expect(isGuidePageId('next-steps')).toBe(false)
    expect(isDocSetId('workspace')).toBe(true)
  })

  it('maps localized skill doc sets without silently falling back to another language', () => {
    const sources: DocSource[] = [
      {
        id: 'axi-skills',
        name: 'Axi Skills',
        path: '/skills',
        enabled: true,
        type: 'local',
        kind: 'skill-library',
        locale: 'en',
      },
    ]

    expect(getDocSetSourceId('skills', 'zh', sources)).toBe('axi-skills-zh')
    expect(getDocSetSourceId('skills', 'en', sources)).toBe('axi-skills')
    expect(getDocSetSourceId('guide', 'zh', sources)).toBe('axi-docs-zh')
    expect(getDocSetSourceId('guide', 'en', sources)).toBe('axi-docs-en')
    expect(getDocSetSourceId('workspace', 'zh', sources)).toBe('workspace')
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { buildDocumentRoute } from './lib/routes'
import type { DocSource, KnowledgeCatalog } from './types'

const mocks = vi.hoisted(() => ({
  getKnowledgeCatalog: vi.fn(),
  getKnowledgeSearchSuggestions: vi.fn(),
  listKnowledgeSources: vi.fn(),
  readKnowledgeFile: vi.fn(),
  searchKnowledgeAll: vi.fn(),
}))

vi.mock('./lib/knowledgeClient', () => ({
  getKnowledgeCatalog: mocks.getKnowledgeCatalog,
  getKnowledgeSearchSuggestions: mocks.getKnowledgeSearchSuggestions,
  listKnowledgeSources: mocks.listKnowledgeSources,
  readKnowledgeFile: mocks.readKnowledgeFile,
  searchKnowledgeAll: mocks.searchKnowledgeAll,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

const source: DocSource = {
  id: 'workspace',
  name: 'Axi Workspace',
  description: 'Workspace registry',
  path: '/workspace',
  enabled: true,
  type: 'local',
  kind: 'workspace-registry',
  adapter: 'workspace',
}

const skillsSource: DocSource = {
  id: 'axi-skills',
  name: 'Axi Skills',
  description: 'Shared skill library',
  path: '/skills',
  enabled: true,
  type: 'local',
  kind: 'skill-library',
  adapter: 'skills',
  skillRoot: 'skills',
  locale: 'en',
}

const skillsSourceZh: DocSource = {
  id: 'axi-skills-zh',
  name: 'Axi Skills · 中文镜像',
  description: 'Axi Skills 的中文本地化镜像',
  path: '/skills',
  enabled: true,
  type: 'local',
  kind: 'skill-library',
  adapter: 'skills',
  skillRoot: 'skills.zh',
  locale: 'zh',
}

const docsSourceEn: DocSource = {
  id: 'axi-docs-en',
  name: 'Axi Docs · English',
  description: 'Axi Docs source-language documentation',
  path: '/docs/content/en',
  enabled: true,
  type: 'local',
  kind: 'markdown-vault',
  adapter: 'markdown',
  locale: 'en',
}

const docsSourceZh: DocSource = {
  id: 'axi-docs-zh',
  name: 'Axi Docs · 中文文档',
  description: 'Axi Docs 中文翻译目标目录',
  path: '/docs/content/zh',
  enabled: true,
  type: 'local',
  kind: 'markdown-vault',
  adapter: 'markdown',
  locale: 'zh',
}

const zhGettingStartedGuide = `---
title: 快速开始
description: 快速开始指南
---

## 启动本地站点

运行开发服务器。

## 文档导航

使用侧栏继续阅读。`

const enGettingStartedGuide = `---
title: Getting Started
description: Getting started guide
---

## Start the local site

Run the development server.

## Navigate the docs

Use the sidebar to continue.`

const catalog: KnowledgeCatalog = {
  sourceId: 'workspace',
  totalDocs: 1,
  totalTags: 0,
  generatedAt: '2026-06-05T00:00:00.000Z',
  topTags: [],
  recentDocs: [],
  sections: [
    {
      key: 'project',
      title: '项目知识',
      description: '项目文档',
      count: 1,
      items: [
        {
          sourceId: 'workspace',
          path: 'projects/workspace-relationship-graph.md',
          name: 'workspace-relationship-graph',
          title: '工作区Relationship图谱',
          description: '工作区项目关系图',
          docType: 'project',
          tags: [],
          categories: ['project'],
          techStack: [],
        },
      ],
    },
  ],
}

const skillsCatalog: KnowledgeCatalog = {
  ...catalog,
  sourceId: 'axi-skills',
  sections: [
    {
      key: 'frontend',
      title: 'Frontend',
      description: '前端技能',
      count: 1,
      items: [
        {
          sourceId: 'axi-skills',
          path: 'skills/frontend-dev/SKILL.md',
          name: 'frontend-dev',
          title: 'Frontend Dev',
          description: 'Frontend workflow skill',
          docType: 'skill',
          tags: [],
          categories: ['frontend'],
          techStack: [],
        },
      ],
    },
    {
      key: 'workflow',
      title: 'Workflow',
      description: '流程技能',
      count: 2,
      items: [
        {
          sourceId: 'axi-skills',
          path: 'skills/frontend-dev/SKILL.md',
          name: 'frontend-dev',
          title: 'Frontend Dev',
          description: 'Frontend workflow skill',
          docType: 'skill',
          tags: [],
          categories: ['frontend'],
          techStack: [],
        },
        {
          sourceId: 'axi-skills',
          path: 'skills/workflow/SKILL.md',
          name: 'workflow',
          title: 'Workflow Skill',
          description: 'Workflow automation skill',
          docType: 'skill',
          tags: [],
          categories: ['workflow'],
          techStack: [],
        },
      ],
    },
  ],
}

const skillsCatalogZh: KnowledgeCatalog = {
  ...catalog,
  sourceId: 'axi-skills-zh',
  sections: [
    {
      key: 'frontend',
      title: '前端技能',
      description: '前端相关技能',
      count: 1,
      items: [
        {
          sourceId: 'axi-skills-zh',
          path: 'skills.zh/frontend-dev/SKILL.md',
          name: 'frontend-dev',
          title: '前端开发',
          description: '前端工作流技能',
          docType: 'skill',
          tags: [],
          categories: ['frontend'],
          techStack: [],
        },
      ],
    },
  ],
}

describe('App document route', () => {
  it('renders the guide as a document pathname instead of a hash anchor route', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, docsSourceEn, docsSourceZh])
    mocks.getKnowledgeCatalog.mockResolvedValue(catalog)
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(zhGettingStartedGuide)

    render(
      <MemoryRouter initialEntries={['/zh/guide/getting-started']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: '快速开始', level: 1 })

    await waitFor(() => expect(mocks.getKnowledgeCatalog).toHaveBeenCalledWith('axi-docs-zh'))
    await waitFor(() => expect(mocks.readKnowledgeFile).toHaveBeenCalledTimes(1))
    expect(mocks.readKnowledgeFile).toHaveBeenCalledWith('axi-docs-zh', 'guide/getting-started.md')
    expect(screen.getAllByRole('link', { name: '快速开始' })[0]).toHaveAttribute('href', '/zh/guide/getting-started')
    expect(screen.getAllByRole('link', { name: '什么是 Axi Docs？' })[0]).toHaveAttribute('href', '/zh/guide/what-is-axi-docs')
  })

  it('redirects the root to the default localized guide document', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, docsSourceEn, docsSourceZh])
    mocks.getKnowledgeCatalog.mockResolvedValue(catalog)
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(zhGettingStartedGuide)

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: '快速开始', level: 1 })
    expect(screen.getAllByRole('link', { name: '快速开始' })[0]).toHaveAttribute('href', '/zh/guide/getting-started')
  })

  it('does not map old guide hashes to new guide document routes', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, docsSourceEn, docsSourceZh])
    mocks.getKnowledgeCatalog.mockResolvedValue(catalog)
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(zhGettingStartedGuide)

    render(
      <MemoryRouter initialEntries={['/#what-is-axi-docs']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: '快速开始', level: 1 })
    expect(screen.queryByRole('heading', { name: '什么是 Axi Docs？', level: 1 })).not.toBeInTheDocument()
  })

  it('renders the English guide under the locale-prefixed route', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, docsSourceEn, docsSourceZh])
    mocks.getKnowledgeCatalog.mockResolvedValue(catalog)
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(enGettingStartedGuide)

    render(
      <MemoryRouter initialEntries={['/en/guide/getting-started']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Getting Started', level: 1 })

    expect(mocks.getKnowledgeCatalog).toHaveBeenCalledWith('axi-docs-en')
    expect(screen.getAllByRole('link', { name: 'Getting Started' })[0]).toHaveAttribute('href', '/en/guide/getting-started')
    expect(screen.getAllByRole('link', { name: 'What is Axi Docs?' })[0]).toHaveAttribute('href', '/en/guide/what-is-axi-docs')
  })

  it('renders skills as a locale-prefixed document set with its own sidebar', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills') return skillsCatalog
      if (sourceId === 'axi-skills-zh') return skillsCatalogZh
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(null)

    render(
      <MemoryRouter initialEntries={['/zh/skills']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Axi Skills · 中文镜像', level: 1 })

    expect(mocks.getKnowledgeCatalog).toHaveBeenCalledWith('axi-skills-zh')
    expect(screen.getByRole('link', { name: '技能库' })).toHaveAttribute('href', '/zh/skills')
    expect(screen.getByRole('link', { name: '技能库' })).toHaveClass('active')
    const sidebar = screen.getByLabelText('侧边栏导航')
    expect(await within(sidebar).findByText('前端技能')).toBeInTheDocument()
    fireEvent.click(within(sidebar).getByRole('button', { name: '前端技能' }))
    expect(await within(sidebar).findByRole('button', { name: '前端开发' })).toBeInTheDocument()
    expect(within(sidebar).queryByText('Frontend workflow skill')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '快速开始' })).not.toBeInTheDocument()
  })

  it('opens skills documents through canonical document routes', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills') return skillsCatalog
      if (sourceId === 'axi-skills-zh') return skillsCatalogZh
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue('# Frontend Dev\n\nSkill body.')

    render(
      <MemoryRouter initialEntries={['/zh/skills']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: '前端技能' }))
    fireEvent.click(await screen.findByRole('button', { name: '前端开发' }))

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/docs/axi-skills-zh/skills.zh/frontend-dev/SKILL'))
    expect(screen.getByRole('link', { name: '指南' })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: '技能库' })).toHaveClass('active')
    expect(screen.getByLabelText('前端技能')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '前端技能' }))
    const activeLink = screen.getByRole('link', { name: '前端开发' })
    expect(activeLink).toHaveClass('active')

    expect(mocks.readKnowledgeFile).toHaveBeenCalledWith('axi-skills-zh', 'skills.zh/frontend-dev/SKILL.md')
  })

  it('keeps the full document sidebar stable when opening documents from later sections', async () => {
    const fullSkillsCatalog: KnowledgeCatalog = {
      ...skillsCatalogZh,
      sections: Array.from({ length: 6 }, (_, index) => ({
        key: `section-${index + 1}`,
        title: `分类 ${index + 1}`,
        description: `分类 ${index + 1} 描述`,
        count: 1,
        items: [
          {
            sourceId: 'axi-skills-zh',
            path: `skills.zh/item-${index + 1}/SKILL.md`,
            name: `item-${index + 1}`,
            title: `条目 ${index + 1}`,
            description: `条目 ${index + 1} 描述`,
            docType: 'skill',
            tags: [],
            categories: [`section-${index + 1}`],
            techStack: [],
          },
        ],
      })),
    }

    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills-zh') return fullSkillsCatalog
      if (sourceId === 'axi-skills') return skillsCatalog
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue('# 条目 6\n\nSkill body.')

    render(
      <MemoryRouter initialEntries={['/docs/axi-skills-zh/skills.zh/item-6/SKILL']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: '条目 6', level: 1 })

    for (let index = 1; index <= 6; index += 1) {
      expect(screen.getByLabelText(`分类 ${index}`)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('分类 6')).toHaveTextContent('分类 6')
  })

  it('strips legacy preview query parameters from document-set routes', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills') return skillsCatalog
      if (sourceId === 'axi-skills-zh') return skillsCatalogZh
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(null)

    render(
      <MemoryRouter initialEntries={['/zh/skills?source=axi-skills&doc=legacy']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Axi Skills · 中文镜像', level: 1 })
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/zh/skills'))
  })

  it('redirects removed category graph routes back to the localized document set', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills') return skillsCatalog
      if (sourceId === 'axi-skills-zh') return skillsCatalogZh
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(null)

    render(
      <MemoryRouter initialEntries={['/nodes/indexes?source=axi-skills-zh&view=tree&node=branch%3A__knowledge-root__']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/zh/skills'))
    await screen.findByRole('heading', { name: 'Axi Skills · 中文镜像', level: 1 })
    expect(screen.queryByText('分类图谱')).not.toBeInTheDocument()
  })

  it('redirects legacy category node document links to canonical document routes', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills') return skillsCatalog
      if (sourceId === 'axi-skills-zh') return skillsCatalogZh
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue('# 前端开发\n\nSkill body.')

    render(
      <MemoryRouter initialEntries={['/nodes/indexes?source=axi-skills-zh&view=tree&node=skills.zh/frontend-dev/SKILL.md']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/docs/axi-skills-zh/skills.zh/frontend-dev/SKILL'))
    expect(await screen.findAllByRole('heading', { name: '前端开发', level: 1 })).not.toHaveLength(0)
    expect(mocks.readKnowledgeFile).toHaveBeenCalledWith('axi-skills-zh', 'skills.zh/frontend-dev/SKILL.md')
  })

  it('loads a readable route document once instead of flickering back into loading', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source])
    mocks.getKnowledgeCatalog.mockResolvedValue(catalog)
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue('# Workspace Relationship Graph\n\nStable document body.')

    const route = buildDocumentRoute({
      sourceId: 'workspace',
      path: 'projects/workspace-relationship-graph.md',
    })

    render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /Workspace Relationship Graph/i })
    await waitFor(() => expect(mocks.readKnowledgeFile).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => window.setTimeout(resolve, 50))

    expect(mocks.readKnowledgeFile).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Stable document body.')).toBeInTheDocument()
  })

  it('returns 404 for legacy encoded document routes instead of redirecting them', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source])
    mocks.getKnowledgeCatalog.mockResolvedValue(catalog)
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue('# Workspace Relationship Graph\n\nLegacy link body.')

    render(
      <MemoryRouter initialEntries={['/doc/workspace:projects/workspace-relationship-graph.md']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: '页面不存在' })
    expect(mocks.readKnowledgeFile).not.toHaveBeenCalled()
  })

  it('routes /en/skills to the English axi-skills source and /zh/skills to the Chinese mirror', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills') return skillsCatalog
      if (sourceId === 'axi-skills-zh') return skillsCatalogZh
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(null)

    const { unmount } = render(
      <MemoryRouter initialEntries={['/en/skills']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Axi Skills', level: 1 })
    expect(mocks.getKnowledgeCatalog).toHaveBeenCalledWith('axi-skills')

    unmount()

    render(
      <MemoryRouter initialEntries={['/zh/skills']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Axi Skills · 中文镜像', level: 1 })
    expect(mocks.getKnowledgeCatalog).toHaveBeenCalledWith('axi-skills-zh')
  })

  it('does not silently fall back to English when the Chinese mirror is empty', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([source, skillsSource, skillsSourceZh])
    const emptyCatalog: KnowledgeCatalog = {
      ...skillsCatalogZh,
      totalDocs: 0,
      sections: [],
      recentDocs: [],
    }
    mocks.getKnowledgeCatalog.mockImplementation(async (sourceId: string) => {
      if (sourceId === 'axi-skills-zh') return emptyCatalog
      if (sourceId === 'axi-skills') return skillsCatalog
      return catalog
    })
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
    mocks.searchKnowledgeAll.mockResolvedValue([])
    mocks.readKnowledgeFile.mockResolvedValue(null)

    render(
      <MemoryRouter initialEntries={['/zh/skills']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Axi Skills · 中文镜像', level: 1 })
    expect(mocks.getKnowledgeCatalog).toHaveBeenCalledWith('axi-skills-zh')
    expect(mocks.getKnowledgeCatalog).not.toHaveBeenCalledWith('axi-skills')
  })
})

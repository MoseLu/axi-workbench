import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { HomeCommandCenter } from './HomeCommandCenter'
import type { DocSource, KnowledgeCatalog, SearchResult } from '../types'

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const sources: DocSource[] = [
  {
    id: 'workspace',
    name: 'Axi Workspace',
    description: 'Workspace registry',
    path: '/workspace',
    enabled: true,
    type: 'local',
    kind: 'workspace-registry',
    adapter: 'workspace',
  },
  {
    id: 'axi-skills',
    name: 'Axi Skills',
    description: 'Shared skill library',
    path: '/skills',
    enabled: true,
    type: 'local',
    kind: 'skill-library',
    adapter: 'skills',
  },
]

const catalog: KnowledgeCatalog = {
  sourceId: 'workspace',
  totalDocs: 2,
  totalTags: 0,
  generatedAt: '2026-06-05T00:00:00.000Z',
  topTags: [],
  recentDocs: [
    {
      sourceId: 'workspace',
      path: 'projects/alpha.md',
      name: 'alpha',
      title: 'Alpha Project',
      description: 'Project overview',
      docType: 'project',
      tags: [],
      categories: ['guide'],
      techStack: [],
    },
  ],
  sections: [
    {
      key: 'guide',
      title: '指南',
      description: '核心文档阅读路径',
      count: 2,
      items: [
        {
          sourceId: 'workspace',
          path: 'projects/alpha.md',
          name: 'alpha',
          title: 'Alpha Project',
          description: 'Project overview',
          docType: 'project',
          tags: [],
          categories: ['guide'],
          techStack: [],
        },
      ],
    },
  ],
}

const skillsCatalog: KnowledgeCatalog = {
  ...catalog,
  sourceId: 'axi-skills',
  recentDocs: [
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
  ],
}

const zhGuideMarkdown = `---
title: 快速开始
description: 快速开始说明
---

## 启动本地站点

运行开发服务器。

## 文档结构

使用分组侧栏和页面导航。`

const enGuideMarkdown = `---
title: Getting Started
description: Getting started guide
---

## Start the local site

Run the development server.

## Documentation structure

Use the grouped sidebar and page outline.`

describe('HomeCommandCenter', () => {
  it('renders a VitePress-like docs home instead of a marketing hero', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        graphFocusPath={null}
        fileContent={zhGuideMarkdown}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    expect(screen.getByRole('heading', { name: '快速开始', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'React 体系的专业文档站' })).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('侧边栏导航')).getByRole('link', { name: '快速开始' })).toHaveAttribute('href', '/zh/guide/getting-started')
    expect(within(screen.getByLabelText('侧边栏导航')).getByRole('link', { name: '什么是 Axi Docs？' })).toHaveAttribute('href', '/zh/guide/what-is-axi-docs')
    expect(within(screen.getByLabelText('页面导航')).getByRole('button', { name: '启动本地站点' })).toBeInTheDocument()
    expect(screen.queryByText('未锁定来源')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '文档结构' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '内容与写作' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '下一页导航与路由' })).toHaveAttribute('href', '/zh/guide/routing')
    expect(screen.queryByText('PROJECTS')).not.toBeInTheDocument()
  })

  it('exposes page navigation through a narrow-screen disclosure', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        graphFocusPath={null}
        fileContent={zhGuideMarkdown}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    const toggle = screen.getByRole('button', { name: '页面导航' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: '移动页面导航' })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const mobileOutline = screen.getByRole('region', { name: '移动页面导航' })
    expect(within(mobileOutline).getByRole('link', { name: '回到顶部' })).toHaveAttribute('href', '#overview')
    fireEvent.click(within(mobileOutline).getByRole('button', { name: '启动本地站点' }))

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: '移动页面导航' })).not.toBeInTheDocument()
    expect(within(mobileOutline).queryByText('未锁定来源')).not.toBeInTheDocument()
  })

  it('renders a nav-level skills document set with its own sidebar pages', () => {
    const onOpenItem = vi.fn()
    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="axi-skills"
        activeTag={null}
        catalog={skillsCatalog}
        docSet="skills"
        graphFocusPath={null}
        fileContent={enGuideMarkdown}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={onOpenItem}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[1]}
        sources={sources}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Axi Skills', level: 1 })).toBeInTheDocument()
    expect(within(screen.getByLabelText('侧边栏导航')).getByText('Frontend')).toBeInTheDocument()
    const frontendSection = screen.getByLabelText('Frontend')
    const frontendToggle = within(frontendSection).getByRole('button', { name: /^Frontend$/ })
    expect(frontendToggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(frontendSection).getByRole('button', { name: 'Frontend Dev' })).toHaveAttribute('title', 'Frontend workflow skill')
    expect(within(frontendSection).queryByText('Frontend workflow skill')).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('侧边栏导航')).getAllByRole('button', { name: 'Frontend Dev' })).toHaveLength(1)
    expect(within(screen.getByLabelText('侧边栏导航')).queryByRole('link', { name: '快速开始' })).not.toBeInTheDocument()
    fireEvent.click(within(frontendSection).getByRole('button', { name: 'Frontend Dev' }))
    expect(onOpenItem).toHaveBeenCalledWith('axi-skills', 'skills/frontend-dev/SKILL.md')
    expect(screen.getByText('当前来源')).toBeInTheDocument()
  })

  it('does not cap skills sidebar section items', () => {
    const manySkillItems: KnowledgeCatalog['sections'][number]['items'] = Array.from({ length: 25 }, (_, index) => ({
      sourceId: 'axi-skills',
      path: `skills/item-${index + 1}/SKILL.md`,
      name: `item-${index + 1}`,
      title: `Skill ${index + 1}`,
      description: `Skill ${index + 1} description`,
      docType: 'skill',
      tags: [],
      categories: ['frontend'],
      techStack: [],
    }))
    const onOpenItem = vi.fn()

    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="axi-skills"
        activeTag={null}
        catalog={{
          ...skillsCatalog,
          sections: [
            {
              key: 'frontend',
              title: 'Frontend',
              description: '前端技能',
              count: manySkillItems.length,
              items: manySkillItems,
            },
          ],
        }}
        docSet="skills"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={onOpenItem}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[1]}
        sources={sources}
      />,
    )

    const frontendSection = screen.getByLabelText('Frontend')
    fireEvent.click(within(frontendSection).getByRole('button', { name: /Frontend/ }))
    expect(within(frontendSection).getByRole('button', { name: 'Skill 25' })).toBeInTheDocument()
    expect(within(frontendSection).queryByText('本组还有更多条目')).not.toBeInTheDocument()
  })

  it('does not cap skills sidebar sections', () => {
    const sectionItems = Array.from({ length: 13 }, (_, index) => ({
      key: `section-${index + 1}`,
      title: `Section ${index + 1}`,
      description: `Section ${index + 1} description`,
      count: 1,
      items: [
        {
          sourceId: 'axi-skills',
          path: `skills/section-${index + 1}/SKILL.md`,
          name: `section-${index + 1}`,
          title: `Skill ${index + 1}`,
          description: `Skill ${index + 1} description`,
          docType: 'skill',
          tags: [],
          categories: ['skills'],
          techStack: [],
        },
      ],
    }))

    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="axi-skills"
        activeTag={null}
        catalog={{
          ...skillsCatalog,
          sections: sectionItems,
        }}
        docSet="skills"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[1]}
        sources={sources}
      />,
    )

    expect(within(screen.getByLabelText('侧边栏导航')).getByText('Section 13')).toBeInTheDocument()
  })

  it('renders skill subsections collapsed under expanded skill groups', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="axi-skills"
        activeTag={null}
        catalog={{
          ...skillsCatalog,
          sections: [
            {
              ...skillsCatalog.sections[0],
              count: 1,
              subsections: [
                {
                  key: 'components',
                  title: '组件与样式',
                  description: '组件技能',
                  count: 1,
                  items: skillsCatalog.sections[0].items,
                },
              ],
            },
          ],
        }}
        docSet="skills"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[1]}
        sources={sources}
      />,
    )

    const frontendSection = screen.getByLabelText('Frontend')
    const subsectionToggle = within(frontendSection).getByRole('button', { name: /组件与样式/ })

    expect(subsectionToggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(frontendSection).queryByRole('button', { name: 'Frontend Dev' })).not.toBeInTheDocument()

    fireEvent.click(subsectionToggle)
    expect(within(frontendSection).getByRole('button', { name: 'Frontend Dev' })).toBeInTheDocument()
  })

  it('renders workspace project labels from localized overview titles', () => {
    const workspaceSections: KnowledgeCatalog['sections'] = [
      {
        key: 'workspace-overview',
        title: '项目入口',
        description: 'README workspace document type',
        count: 2,
        items: [
          {
            sourceId: 'workspace',
            path: 'project-docs/alpha/README.md',
            name: 'alpha-overview',
            title: '阿尔法项目',
            description: 'Alpha project document',
            docType: 'project',
            tags: [],
            categories: ['projects'],
            techStack: [],
            projectId: 'alpha',
            projectTitle: 'Alpha Project',
            documentTypeKey: 'overview',
          },
          {
            sourceId: 'workspace',
            path: 'project-docs/beta/README.md',
            name: 'beta-overview',
            title: '贝塔项目',
            description: 'Beta project document',
            docType: 'project',
            tags: [],
            categories: ['projects'],
            techStack: [],
            projectId: 'beta',
            projectTitle: 'Beta Project',
            documentTypeKey: 'overview',
          },
        ],
      },
      {
        key: 'workspace-requirements',
        title: '需求文档',
        description: 'PRD workspace document type',
        count: 1,
        items: [
          {
            sourceId: 'workspace',
            path: 'project-docs/beta/PRD.md',
            name: 'beta-prd',
            title: '贝塔项目 需求文档',
            description: 'Beta PRD document',
            docType: 'project',
            tags: [],
            categories: ['projects'],
            techStack: [],
            projectId: 'beta',
            projectTitle: 'Beta Project',
            documentTypeKey: 'requirements',
          },
        ],
      },
    ]

    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="workspace"
        activeTag={null}
        catalog={{ ...catalog, sections: workspaceSections }}
        docSet="workspace"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    const documentTypes = screen.getByRole('navigation', { name: '文档类型' })
    expect(within(documentTypes).getByRole('button', { name: /项目入口/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(documentTypes).getByRole('button', { name: /^需求文档$/ })).toHaveAttribute('aria-pressed', 'false')
    expect(within(documentTypes).queryByRole('button', { name: /PRD|TDD|TODO|Agent/ })).not.toBeInTheDocument()

    const sidebar = screen.getByLabelText('侧边栏导航')
    const projectLabels = () => within(sidebar)
      .getAllByRole('navigation')
      .map((element) => element.getAttribute('aria-label'))

    expect(within(sidebar).queryByText('项目入口')).not.toBeInTheDocument()
    expect(projectLabels()).toEqual(['阿尔法项目', '贝塔项目'])
    expect(within(sidebar).queryByLabelText('Alpha Project')).not.toBeInTheDocument()
    expect(within(sidebar).queryByLabelText('Beta Project')).not.toBeInTheDocument()

    fireEvent.click(within(documentTypes).getByRole('button', { name: /^需求文档$/ }))
    expect(within(documentTypes).getByRole('button', { name: /^需求文档$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(projectLabels()).toEqual(['阿尔法项目', '贝塔项目'])
    expect(within(sidebar).getByLabelText('阿尔法项目')).toBeInTheDocument()
    expect(within(sidebar).getByLabelText('贝塔项目')).toBeInTheDocument()
    expect(within(sidebar).getByText('暂无需求文档')).toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: '贝塔项目 需求文档' })).toBeInTheDocument()
  })

  it('uses workspaceProjects translation map to override project labels per locale', () => {
    const workspaceSections: KnowledgeCatalog['sections'] = [
      {
        key: 'workspace-overview',
        title: '项目入口',
        description: 'README workspace document type',
        count: 1,
        items: [
          {
            sourceId: 'workspace',
            path: 'project-docs/axi-docs/README.md',
            name: 'axi-docs-overview',
            title: '原始中文名（不应显示）',
            description: 'Axi Docs document',
            docType: 'project',
            tags: [],
            categories: ['projects'],
            techStack: [],
            projectId: 'axi-docs',
            projectTitle: 'Axi Docs',
            documentTypeKey: 'overview',
          },
        ],
      },
    ]

    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="workspace"
        activeTag={null}
        catalog={{ ...catalog, sections: workspaceSections }}
        docSet="workspace"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    const sidebar = screen.getByLabelText('侧边栏导航')
    expect(within(sidebar).getByLabelText('Axi 文档站')).toBeInTheDocument()
    expect(within(sidebar).queryByLabelText('Axi Docs')).not.toBeInTheDocument()
  })

  it('keeps workspace project order stable when active document type item order differs', () => {
    const workspaceSections: KnowledgeCatalog['sections'] = ['README', 'TDD'].map((type, index) => ({
      key: `workspace-section-${index}`,
      title: `Workspace Type ${index}`,
      description: `${type} workspace document type`,
      count: 2,
      items: (index === 0 ? ['alpha', 'beta'] : ['beta', 'alpha']).map((projectId) => ({
        sourceId: 'workspace',
        path: `project-docs/${projectId}/doc-${index}.md`,
        name: `${projectId}-doc-${index}`,
        title: `${projectId === 'alpha' ? 'Alpha' : 'Beta'} ${type}`,
        description: 'Project document',
        docType: 'project',
        tags: [],
        categories: ['projects'],
        techStack: [],
        projectId,
        projectTitle: `${projectId === 'alpha' ? 'Alpha' : 'Beta'} Project`,
        documentTypeKey: `type-${index}`,
      })),
    }))

    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="workspace"
        activeTag={null}
        catalog={{ ...catalog, sections: workspaceSections }}
        docSet="workspace"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    const documentTypes = screen.getByRole('navigation', { name: '文档类型' })
    const sidebar = screen.getByLabelText('侧边栏导航')
    const projectLabels = () => within(sidebar)
      .getAllByRole('navigation')
      .map((element) => element.getAttribute('aria-label'))

    expect(projectLabels()).toEqual(['Alpha', 'Beta'])

    fireEvent.click(within(documentTypes).getByRole('button', { name: /Workspace Type 1/ }))
    expect(within(documentTypes).getByRole('button', { name: /Workspace Type 1/ })).toHaveAttribute('aria-pressed', 'true')
    expect(projectLabels()).toEqual(['Alpha', 'Beta'])
    expect(within(sidebar).getByRole('button', { name: 'Alpha TDD' })).toBeInTheDocument()
    expect(within(sidebar).queryByRole('button', { name: 'Alpha README' })).not.toBeInTheDocument()
  })

  it('opens skill section overview cards as documents instead of the removed category graph', () => {
    const onOpenExplorer = vi.fn()
    const onOpenItem = vi.fn()
    renderWithRouter(
      <HomeCommandCenter
        activeSourceId="axi-skills"
        activeTag={null}
        catalog={skillsCatalog}
        docSet="skills"
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={onOpenExplorer}
        onOpenItem={onOpenItem}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[1]}
        sources={sources}
      />,
    )

    const overview = document.querySelector('#doc-set-overview') as HTMLElement
    fireEvent.click(within(overview).getByRole('button', { name: /Frontend/ }))

    expect(onOpenItem).toHaveBeenCalledWith('axi-skills', 'skills/frontend-dev/SKILL.md')
    expect(onOpenExplorer).not.toHaveBeenCalled()
  })

  it('renders localized English guide navigation', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        fileContent={enGuideMarkdown}
        graphFocusPath={null}
        guideLocale="en"
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Getting Started', level: 1 })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Sidebar navigation')).getByRole('link', { name: 'Getting Started' })).toHaveAttribute('href', '/en/guide/getting-started')
    expect(within(screen.getByLabelText('Sidebar navigation')).getByRole('link', { name: 'What is Axi Docs?' })).toHaveAttribute('href', '/en/guide/what-is-axi-docs')
    expect(within(screen.getByLabelText('Page navigation')).getByRole('button', { name: 'Start the local site' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Documentation structure' })).toBeInTheDocument()
  })

  it('renders localized English search copy', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        graphFocusPath={null}
        guideLocale="en"
        guidePageId="search"
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery="AXI"
        searchResults={[]}
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Matches for "AXI"' })).toBeInTheDocument()
    expect(screen.getByText('No matching documents were found. Try another keyword or continue through the guide sidebar.')).toBeInTheDocument()
  })

  it('renders ordered previous-page navigation for the last guide page', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        graphFocusPath={null}
        guidePageId="configuration"
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    expect(screen.getByRole('link', { name: '在 GitHub 上编辑此页面' })).toHaveAttribute(
      'href',
      'https://github.com/axiomaticworld/axi-docs/edit/dev/docs/content/zh/guide/configuration.md',
    )
    expect(screen.getByRole('link', { name: '上一页国际化' })).toHaveAttribute('href', '/zh/guide/localization')
    expect(screen.queryByText('下一页')).not.toBeInTheDocument()
  })

  it('collapses and expands sidebar groups for real', () => {
    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={vi.fn()}
        onTagSelect={vi.fn()}
        searchQuery=""
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    const intro = screen.getByRole('button', { name: '简介' })
    fireEvent.click(intro)

    expect(intro).toHaveAttribute('aria-expanded', 'false')
    expect(within(screen.getByLabelText('简介')).queryByRole('link', { name: '快速开始' })).not.toBeInTheDocument()

    fireEvent.click(intro)

    expect(intro).toHaveAttribute('aria-expanded', 'true')
    expect(within(screen.getByLabelText('简介')).getByRole('link', { name: '快速开始' })).toBeInTheDocument()
  })

  it('shows inline search results as a document section', () => {
    const onOpenItem = vi.fn()
    const searchResults: SearchResult[] = [
      {
        sourceId: 'workspace',
        path: 'projects/axi-docs.md',
        name: 'axi-docs',
        type: 'file',
        title: 'Axi Docs',
        description: 'React 文档站项目说明',
        snippet: 'React 文档站项目说明',
        matches: [],
        score: 1,
        docType: 'project',
        tags: [],
        categories: ['guide'],
        matchedBy: ['title'],
      },
    ]

    renderWithRouter(
      <HomeCommandCenter
        activeTag={null}
        catalog={catalog}
        graphFocusPath={null}
        onClearSelectedFile={vi.fn()}
        onOpenExplorer={vi.fn()}
        onOpenItem={onOpenItem}
        guidePageId="search"
        onTagSelect={vi.fn()}
        searchQuery="AXI"
        searchResults={searchResults}
        selectedFile={null}
        source={sources[0]}
        sources={sources}
      />,
    )

    expect(screen.getByRole('heading', { name: '“AXI” 的匹配文档' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Axi Docs/i }))

    expect(onOpenItem).toHaveBeenCalledWith('workspace', 'projects/axi-docs.md')
  })
})

import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DocumentDetailPage } from './DocumentDetailPage'
import type { DocSource, KnowledgeCatalogItem, SelectedFile } from '../types'

vi.mock('./DocumentView', () => ({
  DocumentView: () => <article>Document body</article>,
}))

vi.mock('./TableOfContents', () => ({
  TableOfContents: () => <nav>Page toc</nav>,
}))

const source: DocSource = {
  id: 'workspace',
  name: 'Axi Docs',
  description: 'Workspace docs',
  path: '/workspace',
  enabled: true,
  type: 'local',
  kind: 'workspace-registry',
  adapter: 'workspace',
}

const selectedFile: SelectedFile = {
  sourceId: 'workspace',
  path: 'guide/getting-started.md',
}

const siblings: KnowledgeCatalogItem[] = [
  {
    sourceId: 'workspace',
    path: 'guide/what-is-axi-docs.md',
    name: 'what-is-axi-docs',
    title: '什么是 Axi Docs？',
    tags: [],
    categories: ['guide'],
    techStack: [],
  },
  {
    sourceId: 'workspace',
    path: 'guide/getting-started.md',
    name: 'getting-started',
    title: '快速开始',
    tags: [],
    categories: ['guide'],
    techStack: [],
  },
]

const relatedItems: KnowledgeCatalogItem[] = [
  {
    sourceId: 'workspace',
    path: 'guide/search.md',
    name: 'search',
    title: '搜索文档',
    tags: [],
    categories: ['guide'],
    techStack: [],
  },
]

function renderDocumentDetailPage() {
  return render(
    <MemoryRouter>
      <DocumentDetailPage
        categoryDescription="核心阅读路径"
        categoryTitle="简介"
        documentSiblings={siblings}
        fileContent="# 快速开始"
        fileLoading={false}
        fileName="getting-started.md"
        onTagSelect={vi.fn()}
        onWikiLink={vi.fn()}
        relatedItems={relatedItems}
        selectedCatalogItem={siblings[1]}
        selectedFile={selectedFile}
        source={source}
      />
    </MemoryRouter>,
  )
}

describe('DocumentDetailPage', () => {
  it('collapses and expands document sidebar sections for real', () => {
    renderDocumentDetailPage()

    const categoryNav = screen.getByLabelText('Axi Docs 文档目录')
    const categoryToggle = within(categoryNav).getByRole('button', { name: /简介/i })
    fireEvent.click(categoryToggle)

    expect(categoryToggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(categoryNav).queryByRole('link', { name: /快速开始/i })).not.toBeInTheDocument()

    fireEvent.click(categoryToggle)

    expect(categoryToggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(categoryNav).getByRole('link', { name: /快速开始/i })).toBeInTheDocument()

    const relatedNav = screen.getByLabelText('相关推荐')
    const relatedToggle = within(relatedNav).getByRole('button', { name: /相关推荐/i })
    fireEvent.click(relatedToggle)

    expect(relatedToggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(relatedNav).queryByRole('link', { name: /搜索文档/i })).not.toBeInTheDocument()
  })

  it('keeps full document-set sidebar sections on document pages', () => {
    render(
      <MemoryRouter>
        <DocumentDetailPage
          categoryDescription="核心阅读路径"
          categoryTitle="简介"
          documentSiblings={siblings}
          fileContent="# 快速开始"
          fileLoading={false}
          fileName="getting-started.md"
          onTagSelect={vi.fn()}
          onWikiLink={vi.fn()}
          relatedItems={[]}
          selectedCatalogItem={siblings[1]}
          selectedFile={selectedFile}
          sidebarSections={[
            {
              key: 'guide',
              title: '简介',
              description: '核心文档阅读路径',
              count: 2,
              items: siblings,
            },
            {
              key: 'reference',
              title: '参考',
              description: '参考文档',
              count: 1,
              items: relatedItems,
            },
          ]}
          source={source}
        />
      </MemoryRouter>,
    )

    expect(within(screen.getByLabelText('简介')).getByRole('link', { name: /快速开始/i })).toHaveClass('active')
    expect(within(screen.getByLabelText('参考')).getByRole('link', { name: /搜索文档/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('相关推荐')).not.toBeInTheDocument()
  })

  it('uses localized source kind labels for workspace document pages', () => {
    renderDocumentDetailPage()

    expect(screen.getAllByText('工作区文档')).toHaveLength(2)
    expect(screen.queryByText('Document Library')).not.toBeInTheDocument()
  })

  it('does not cap skill-library document-set sidebar sections', () => {
    const skillSource: DocSource = {
      ...source,
      id: 'axi-skills-zh',
      name: 'Axi Skills · 中文镜像',
      kind: 'skill-library',
      adapter: 'skills',
    }
    const skillItems: KnowledgeCatalogItem[] = Array.from({ length: 14 }, (_, index) => ({
      sourceId: 'axi-skills-zh',
      path: `skills.zh/item-${index + 1}/SKILL.md`,
      name: `item-${index + 1}`,
      title: `条目 ${index + 1}`,
      tags: [],
      categories: ['agent-orchestration'],
      techStack: [],
    }))

    render(
      <MemoryRouter>
        <DocumentDetailPage
          categoryDescription="多 Agent 协作"
          categoryTitle="Agent 编排与协作"
          documentSiblings={skillItems}
          fileContent="# 条目 1"
          fileLoading={false}
          fileName="SKILL.md"
          onTagSelect={vi.fn()}
          onWikiLink={vi.fn()}
          relatedItems={[]}
          selectedCatalogItem={skillItems[0]}
          selectedFile={{ sourceId: 'axi-skills-zh', path: 'skills.zh/item-1/SKILL.md' }}
          sidebarSections={[
            {
              key: 'agent-orchestration',
              title: 'Agent 编排与协作',
              description: '多 Agent 协作',
              count: skillItems.length,
              items: skillItems,
            },
          ]}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const section = screen.getByLabelText('Agent 编排与协作')
    const toggle = within(section).getByRole('button', { name: /Agent 编排与协作/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(section).getByRole('link', { name: '条目 14' })).toBeInTheDocument()
  })

  it('renders skill-library subsections collapsed on document pages', () => {
    const skillSource: DocSource = {
      ...source,
      id: 'axi-skills-zh',
      name: 'Axi Skills · 中文镜像',
      kind: 'skill-library',
      adapter: 'skills',
    }
    const skillItems: KnowledgeCatalogItem[] = [
      {
        sourceId: 'axi-skills-zh',
        path: 'skills.zh/team/SKILL.md',
        name: 'team',
        title: 'tmux 协同执行',
        tags: [],
        categories: ['agent-orchestration'],
        techStack: [],
      },
    ]

    render(
      <MemoryRouter>
        <DocumentDetailPage
          categoryDescription="多 Agent 协作"
          categoryTitle="Agent 编排与协作"
          documentSiblings={skillItems}
          fileContent="# tmux 协同执行"
          fileLoading={false}
          fileName="SKILL.md"
          onTagSelect={vi.fn()}
          onWikiLink={vi.fn()}
          relatedItems={[]}
          selectedCatalogItem={skillItems[0]}
          selectedFile={{ sourceId: 'axi-skills-zh', path: 'skills.zh/team/SKILL.md' }}
          sidebarSections={[
            {
              key: 'agent-orchestration',
              title: 'Agent 编排与协作',
              description: '多 Agent 协作',
              count: skillItems.length,
              items: skillItems,
              subsections: [
                {
                  key: 'team-agents',
                  title: '团队与子代理',
                  description: '团队、worker、子代理与并行分派。',
                  count: skillItems.length,
                  items: skillItems,
                },
              ],
            },
          ]}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    const section = screen.getByLabelText('Agent 编排与协作')
    const subsection = within(section).getByRole('button', { name: /团队与子代理/ })

    expect(subsection).toHaveAttribute('aria-expanded', 'false')
    expect(within(section).queryByRole('link', { name: 'tmux 协同执行' })).not.toBeInTheDocument()

    fireEvent.click(subsection)
    expect(within(section).getByRole('link', { name: 'tmux 协同执行' })).toHaveClass('active')
  })

  it('deduplicates repeated documents within each document-set sidebar section', () => {
    render(
      <MemoryRouter>
        <DocumentDetailPage
          categoryDescription="核心阅读路径"
          categoryTitle="简介"
          documentSiblings={siblings}
          fileContent="# 快速开始"
          fileLoading={false}
          fileName="getting-started.md"
          onTagSelect={vi.fn()}
          onWikiLink={vi.fn()}
          relatedItems={[]}
          selectedCatalogItem={siblings[1]}
          selectedFile={selectedFile}
          sidebarSections={[
            {
              key: 'guide',
              title: '简介',
              description: '核心文档阅读路径',
              count: 2,
              items: siblings,
            },
            {
              key: 'reference',
              title: '参考',
              description: '参考文档',
              count: 3,
              items: [siblings[1], siblings[1], relatedItems[0]],
            },
          ]}
          source={source}
        />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link', { name: /快速开始/i })).toHaveLength(2)
    expect(within(screen.getByLabelText('参考')).getByRole('link', { name: /搜索文档/i })).toBeInTheDocument()
  })
})

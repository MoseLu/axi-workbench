import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DocumentFooter } from './DocumentFooter'
import type { DocSource, KnowledgeCatalogItem } from '../types'

const source: DocSource = {
  id: 'axi-docs-zh',
  name: 'Axi Docs · 中文文档',
  path: '/docs/content/zh',
  enabled: true,
  type: 'local',
  kind: 'markdown-vault',
  adapter: 'markdown',
  locale: 'zh',
}

const items: KnowledgeCatalogItem[] = [
  {
    sourceId: 'axi-docs-zh',
    path: 'guide/what-is-axi-docs.md',
    name: 'what-is-axi-docs',
    title: '什么是 Axi Docs？',
    tags: [],
    categories: ['guide'],
    techStack: [],
  },
  {
    sourceId: 'axi-docs-zh',
    path: 'guide/getting-started.md',
    name: 'getting-started',
    title: '快速开始',
    tags: [],
    categories: ['guide'],
    techStack: [],
    updated: '2026-06-07T13:54:48+08:00',
  },
  {
    sourceId: 'axi-docs-zh',
    path: 'guide/search.md',
    name: 'search',
    title: '搜索文档',
    tags: [],
    categories: ['guide'],
    techStack: [],
  },
]

describe('DocumentFooter', () => {
  it('renders edit, updated, previous, and next controls', () => {
    render(
      <MemoryRouter>
        <DocumentFooter
          documentSiblings={items}
          selectedCatalogItem={items[1]}
          selectedFile={{ sourceId: 'axi-docs-zh', path: 'guide/getting-started.md' }}
          sidebarSections={[]}
          source={source}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '在 GitHub 上编辑此页面' })).toHaveAttribute(
      'href',
      'https://github.com/axiomaticworld/axi-docs/edit/dev/docs/content/zh/guide/getting-started.md',
    )
    expect(screen.getByText(/最后更新于/)).toBeInTheDocument()
    expect(within(screen.getByLabelText('分页器')).getByRole('link', { name: /上一页什么是 Axi Docs/ })).toBeInTheDocument()
    expect(within(screen.getByLabelText('分页器')).getByRole('link', { name: /下一页搜索文档/ })).toBeInTheDocument()
  })

  it('uses the Axi Skills repository and subsection order for skill documents', () => {
    const skillSource: DocSource = {
      ...source,
      id: 'axi-skills-zh',
      name: 'Axi Skills · 中文镜像',
      kind: 'skill-library',
      adapter: 'skills',
    }

    render(
      <MemoryRouter>
        <DocumentFooter
          documentSiblings={[]}
          selectedCatalogItem={{ ...items[1], sourceId: 'axi-skills-zh', path: 'skills.zh/worker/SKILL.md' }}
          selectedFile={{ sourceId: 'axi-skills-zh', path: 'skills.zh/worker/SKILL.md' }}
          sidebarSections={[
            {
              key: 'agent-orchestration',
              title: 'Agent 编排与协作',
              description: '团队协作',
              count: 3,
              items: [],
              subsections: [
                {
                  key: 'team-agents',
                  title: '团队与子代理',
                  description: '团队协作',
                  count: 3,
                  items: [
                    { ...items[0], sourceId: 'axi-skills-zh', path: 'skills.zh/team/SKILL.md', title: '团队协同' },
                    { ...items[1], sourceId: 'axi-skills-zh', path: 'skills.zh/worker/SKILL.md', title: 'Worker 协作协议' },
                    { ...items[2], sourceId: 'axi-skills-zh', path: 'skills.zh/create-subagent/SKILL.md', title: '创建子代理' },
                  ],
                },
              ],
            },
          ]}
          source={skillSource}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '在 GitHub 上编辑此页面' })).toHaveAttribute(
      'href',
      'https://github.com/MoseLu/axi-skills/edit/dev/skills.zh/worker/SKILL.md',
    )
    expect(within(screen.getByLabelText('分页器')).getByRole('link', { name: /上一页团队协同/ })).toBeInTheDocument()
    expect(within(screen.getByLabelText('分页器')).getByRole('link', { name: /下一页创建子代理/ })).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PreviewCard } from './PreviewCard'

vi.mock('./Icons', () => ({
  ClockIcon: () => <span data-testid="clock-icon">clock</span>,
  FileIcon: () => <span data-testid="file-icon">file</span>,
  FolderIcon: () => <span data-testid="folder-icon">folder</span>,
  TagIcon: () => <span data-testid="tag-icon">tag</span>,
}))

describe('PreviewCard', () => {
  it('renders document context, facts, and actions', () => {
    render(
      <PreviewCard
        actions={<button type="button">打开详情</button>}
        categories={['projects']}
        description="聚合当前条目的上下文与动作。"
        docType="ADR"
        facts={[
          { label: '结果类型', value: '文档内容' },
          { label: '命中说明', value: '标题 / 正文' },
        ]}
        onTagSelect={vi.fn()}
        path="20-Projects/axi-docs/ADR/ADR-001.md"
        sourceName="Obsidian 知识库"
        tags={['react', 'vite']}
        title="Axi Docs 导航重构"
        updated="2026-04-13T10:00:00.000Z"
      />,
    )

    expect(screen.getByText('Axi Docs 导航重构')).toBeInTheDocument()
    expect(screen.getByText('Obsidian 知识库')).toBeInTheDocument()
    expect(screen.getByText('结果类型')).toBeInTheDocument()
    expect(screen.getByText('命中说明')).toBeInTheDocument()
    expect(screen.getByText('项目')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '#react' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开详情' })).toBeInTheDocument()
  })

  it('calls onTagSelect when clicking a tag pill', () => {
    const onTagSelect = vi.fn()

    render(
      <PreviewCard
        onTagSelect={onTagSelect}
        path="notes/example.md"
        sourceName="Obsidian"
        tags={['ux']}
        title="Example"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '#ux' }))
    expect(onTagSelect).toHaveBeenCalledWith('ux')
  })
})

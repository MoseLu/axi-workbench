import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Header } from './Header'

const mocks = vi.hoisted(() => ({
  getKnowledgeSearchSuggestions: vi.fn(),
}))

vi.mock('../lib/knowledgeClient', () => ({
  getKnowledgeSearchSuggestions: mocks.getKnowledgeSearchSuggestions,
}))

vi.mock('./Icons', () => ({
  SearchIcon: () => <span data-testid="search-icon">🔍</span>,
  BookIcon: () => <span data-testid="book-icon">📖</span>,
  FileIcon: () => <span data-testid="file-icon">📄</span>,
  GitHubIcon: () => <span data-testid="github-icon">GitHub</span>,
  LanguageIcon: () => <span data-testid="language-icon">Language</span>,
  MoonIcon: () => <span data-testid="moon-icon">Moon</span>,
  TagIcon: () => <span data-testid="tag-icon">🏷️</span>,
  ThemeIcon: () => <span data-testid="theme-icon">Theme</span>,
}))

describe('Header', () => {
  const defaultProps = {
    onSearchChange: vi.fn(),
    onSearchSubmit: vi.fn(),
    onSuggestionSelect: vi.fn(),
    pageMode: 'home' as const,
    searchQuery: '',
    searching: false,
  }

  const renderHeader = (props = {}, route = '/') => render(
    <MemoryRouter initialEntries={[route]}>
      <Header {...defaultProps} {...props} />
    </MemoryRouter>,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-axi-docs-theme')
    document.documentElement.classList.remove('axi-theme-switching')
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([])
  })

  it('renders brand and global search input', () => {
    renderHeader()
    expect(screen.getByText('Axi Docs')).toBeInTheDocument()
    expect(screen.queryByText('Knowledge Hub')).not.toBeInTheDocument()
    expect(screen.getByText('搜索')).toBeInTheDocument()
    expect(screen.queryByText('搜索标签、标题或文档')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全局搜索' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '切换浅色样式' })).toHaveAttribute('title', '切换到浅色模式')
    expect(screen.getByRole('switch', { name: '切换浅色样式' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('moon-icon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/axiomaticworld/axi-docs')
  })

  it('toggles the docs theme mode', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('switch', { name: '切换浅色样式' }))

    expect(document.documentElement.dataset.axiDocsTheme).toBe('light')
    expect(screen.getByRole('switch', { name: '切换深色样式' })).toHaveAttribute('title', '切换到深色模式')
    expect(screen.getByRole('switch', { name: '切换深色样式' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('theme-icon')).toBeInTheDocument()
  })

  it('temporarily suppresses search transitions while switching themes', () => {
    vi.useFakeTimers()

    try {
      renderHeader()

      fireEvent.click(screen.getByRole('switch', { name: '切换浅色样式' }))

      expect(document.documentElement).toHaveClass('axi-theme-switching')

      act(() => {
        vi.advanceTimersByTime(180)
      })

      expect(document.documentElement).not.toHaveClass('axi-theme-switching')
    } finally {
      vi.useRealTimers()
    }
  })

  it('maps top navigation to locale-prefixed document sets', () => {
    renderHeader({ pageMode: 'home' }, '/zh/workspace')

    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/zh/guide/getting-started')
    expect(screen.getByRole('link', { name: '指南' })).toHaveAttribute('href', '/zh/guide/getting-started')
    expect(screen.getByRole('link', { name: '技能库' })).toHaveAttribute('href', '/zh/skills')
    expect(screen.getByRole('link', { name: '工作区' })).toHaveAttribute('href', '/zh/workspace')
    expect(screen.getByRole('link', { name: '指南' })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: '工作区' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: '选择语言' })).toBeInTheDocument()
    expect(screen.queryByText('简体中文')).not.toBeInTheDocument()
  })

  it('keeps a visible mobile menu label for the narrow docs utility row', () => {
    renderHeader({ pageMode: 'home' }, '/zh/guide/getting-started')

    expect(screen.getByRole('button', { name: '打开导航菜单' })).toBeInTheDocument()
    expect(screen.getByText('菜单')).toBeInTheDocument()
  })

  it('closes the narrow navigation when clicking the backdrop', () => {
    renderHeader({ pageMode: 'home' }, '/zh/guide/getting-started')

    fireEvent.click(screen.getByRole('button', { name: '打开导航菜单' }))
    expect(screen.getByRole('button', { name: '关闭导航菜单' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByTestId('header-nav-backdrop'))

    expect(screen.getByRole('button', { name: '打开导航菜单' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('header-nav-backdrop')).not.toBeInTheDocument()
  })

  it('renders mobile language switching as an expandable locale group', () => {
    renderHeader({ pageMode: 'home' }, '/zh/guide/getting-started')

    fireEvent.click(screen.getByRole('button', { name: '打开导航菜单' }))

    const localeGroup = screen.getByRole('group', { name: '选择语言' })
    const localeTrigger = within(localeGroup).getByRole('button', { name: /简体中文/i })
    expect(localeTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(localeTrigger).getByTestId('language-icon')).toBeInTheDocument()
    expect(within(localeGroup).getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/guide/getting-started')

    fireEvent.click(localeTrigger)

    expect(localeTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(within(localeGroup).queryByRole('link', { name: 'English' })).not.toBeInTheDocument()
  })

  it('keeps the guide nav active even when a stale source query is present', () => {
    renderHeader({ pageMode: 'home' }, '/zh/guide/getting-started?source=obsidian')

    expect(screen.getByRole('link', { name: '指南' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: '技能库' })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: '工作区' })).not.toHaveClass('active')
  })

  it('keeps skills nav active on axi-skills document pages', () => {
    renderHeader({ activeDocSet: 'skills', pageMode: 'document' }, '/docs/axi-skills/docs/SKILL_INDEX')

    expect(screen.getByRole('link', { name: '指南' })).not.toHaveClass('active')
    expect(screen.getByRole('link', { name: '技能库' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: '工作区' })).not.toHaveClass('active')
  })

  it('opens a locale menu with locale-prefixed guide routes', () => {
    renderHeader({ pageMode: 'home' }, '/zh/guide/search?q=axi')

    fireEvent.click(screen.getByRole('button', { name: '选择语言' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '简体中文' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('menuitem', { name: 'English' })).toHaveAttribute('href', '/en/guide/search?q=axi')
  })

  it('keeps English guide chrome and offers Chinese from the locale menu', () => {
    renderHeader({ pageMode: 'home' }, '/en/guide/getting-started')

    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))

    expect(screen.getByRole('menuitem', { name: '简体中文' })).toHaveAttribute('href', '/zh/guide/getting-started')
    expect(screen.getByRole('menuitem', { name: 'English' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/en/guide/getting-started')
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('href', '/en/guide/getting-started')
    expect(screen.getByRole('link', { name: 'Skills' })).toHaveAttribute('href', '/en/skills')
    expect(screen.getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/en/workspace')
  })

  it('debounces live search updates on the search page', async () => {
    const onSearchChange = vi.fn()
    renderHeader({ onSearchChange, pageMode: 'search' })

    fireEvent.click(screen.getByRole('button', { name: '全局搜索' }))
    fireEvent.change(screen.getByLabelText('搜索文档或标签'), { target: { value: 'graph' } })

    expect(onSearchChange).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith('graph'))
  })

  it('submits the current query on Enter', () => {
    const onSearchSubmit = vi.fn()
    renderHeader({ onSearchSubmit })

    fireEvent.click(screen.getByRole('button', { name: '全局搜索' }))

    const input = screen.getByLabelText('搜索文档或标签')
    fireEvent.change(input, { target: { value: '知识空间' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearchSubmit).toHaveBeenCalledWith('知识空间')
  })

  it('opens with the global shortcut and closes on Escape', async () => {
    renderHeader()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const input = screen.getByLabelText('搜索文档或标签')
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows and selects suggestions', async () => {
    const onSuggestionSelect = vi.fn()
    mocks.getKnowledgeSearchSuggestions.mockResolvedValue([
      {
        kind: 'tag',
        label: '#知识图谱',
        query: '#知识图谱',
        meta: '12 篇文档',
      },
    ])

    renderHeader({ onSuggestionSelect })

    fireEvent.click(screen.getByRole('button', { name: '全局搜索' }))
    const input = screen.getByLabelText('搜索文档或标签')
    fireEvent.change(input, { target: { value: '知识' } })

    const suggestion = await screen.findByRole('option', { name: /知识图谱/i })
    fireEvent.mouseDown(suggestion)

    expect(onSuggestionSelect).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'tag',
      query: '#知识图谱',
    }))
  })
})

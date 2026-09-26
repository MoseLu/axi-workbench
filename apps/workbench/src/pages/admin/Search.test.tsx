import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import SearchPage from './Search';

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ id: string; title?: string }> }) =>
      element('table', { 'data-axi': 'search-table' },
        element('tbody', null,
          (data ?? []).map((row) =>
            element('tr', { key: row.id, 'data-row': row.title ?? row.id }, row.title),
          ),
        ),
      ),
    AxiTableGroup: ({ children, description, title }: {
      children?: React.ReactNode;
      description?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'search-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description)),
        children,
      ),
  };
});

vi.mock('./DesktopCrudFrame', () => ({
  DesktopCrudFrame: ({ children, ariaLabel, search }: {
    children?: React.ReactNode;
    ariaLabel?: string;
    search?: React.ReactNode;
  }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'main',
      { 'data-axi': 'desktop-crud-frame', 'aria-label': ariaLabel },
      search,
      children,
    );
  },
}));

const i18nDict: Record<string, string> = {
  'search.title': '全局联想搜索',
  'search.column.kind': '类别',
  'search.column.title': '标题',
  'search.column.subtitle': '副标题',
  'search.input.ariaLabel': '搜索',
  'search.input.placeholder': '搜索已登记的工作台入口',
  'search.results.title': '搜索结果',
  'search.results.count': ' 项结果',
  'search.results.idle': '请输入关键字开始检索。',
  'search.results.waiting': '等待输入',
  'search.results.empty': '没有匹配「{query}」的入口',
  'search.section.navigation': '导航',
  'search.section.utility': '工具',
};

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderSearch() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <SearchPage />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Search', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the idle prompt and the wired search input before any query is typed', () => {
    renderSearch();
    expect(screen.getByLabelText('全局联想搜索')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索已登记的工作台入口')).toBeInTheDocument();
    expect(screen.getByText('请输入关键字开始检索。')).toBeInTheDocument();
    expect(document.querySelector('[data-axi="search-table"]')).toBeNull();
  });

  it('filters registered entries by title and renders them as navigation rows', () => {
    renderSearch();
    const input = screen.getByPlaceholderText('搜索已登记的工作台入口');
    // Type a query that must hit at least one registered navigation entry.
    input.textContent = '项目';
    // Use the value setter so React notices the change.
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(input, '项目');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // The corpus contains 项目 (project management) navigation hits — the table mock should appear.
    expect(document.querySelector('[data-axi="search-table"]')).not.toBeNull();
  });

  it('shows the localized empty-state copy when the query has no matches', () => {
    renderSearch();
    const input = screen.getByPlaceholderText('搜索已登记的工作台入口');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(input, 'zzzzzz-no-such-entry');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(screen.getByText(/没有匹配/)).toBeInTheDocument();
  });
});
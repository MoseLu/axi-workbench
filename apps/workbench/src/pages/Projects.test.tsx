import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../contexts/AuthContext';
import Projects from './Projects';

const mockUseControlSnapshot = vi.fn();

vi.mock('@axi/api-client', () => ({
  useControlSnapshot: () => mockUseControlSnapshot(),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ id: string; label?: string }> }) =>
      element('table', { 'data-axi': 'projects-table' },
        element('tbody', null,
          (data ?? []).map((row) =>
            element('tr', { key: row.id, 'data-project': row.label ?? row.id }, row.label ?? row.id),
          ),
        ),
      ),
    AxiTableGroup: ({ children, description, title }: {
      children?: React.ReactNode;
      description?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'projects-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description)),
        children,
      ),
  };
});

vi.mock('./admin/DesktopCrudFrame', () => ({
  DesktopCrudFrame: ({ children, ariaLabel, search, toolbar }: {
    children?: React.ReactNode;
    ariaLabel?: string;
    search?: React.ReactNode;
    toolbar?: React.ReactNode;
  }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'main',
      { 'data-axi': 'desktop-crud-frame', 'aria-label': ariaLabel },
      toolbar,
      search,
      children,
    );
  },
}));

vi.mock('./admin/ControlPlaneState', () => ({
  ControlPlaneState: ({ title, description, loading }: {
    title?: string;
    description?: string;
    loading?: boolean;
  }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'section',
      { 'data-axi': 'control-plane-state', 'data-loading': loading ? 'true' : 'false' },
      ReactModule.createElement('strong', null, title),
      ReactModule.createElement('p', null, description),
    );
  },
}));

const i18nDict: Record<string, string> = {
  'projects.title': '项目组合',
  'projects.refresh': '刷新',
  'projects.refreshing': '刷新中',
  'projects.error.title': '项目组合暂不可用',
  'projects.error.description': '无法从控制面读取项目组合；不会显示伪造数据。',
  'projects.loading.title': '正在同步项目',
  'projects.loading.description': '正在读取受控软件层项目目录。',
  'projects.count': ' 个项目',
  'projects.column.label': '项目',
  'projects.column.state': '状态',
  'projects.column.workspace': '工作区',
  'projects.column.branch': '分支',
  'projects.column.action': '查看',
  'projects.column.actionHeader': '操作',
  'projects.column.index': '序号',
  'projects.state.available': '可用',
  'projects.state.unknown': '待确认',
  'projects.branch.unregistered': '未登记',
  'projects.workspace.changes': '{value} 项变更',
  'projects.workspace.pending': '未确认',
  'projects.workspace.clean': '无变更',
  'projects.search.ariaLabel': '搜索项目',
  'projects.search.placeholder': '搜索项目名称、标识或契约',
  'projects.filter.all': '全部',
  'projects.filter.available': '可用',
  'projects.filter.attention': '需关注',
};

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderProjects() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Projects />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Projects', () => {
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

  it('renders the error state without fabricated rows when the snapshot fails', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: undefined,
      error: new Error('control plane offline'),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(async () => undefined),
    });

    renderProjects();
    expect(screen.getByText('项目组合暂不可用')).toBeInTheDocument();
    expect(screen.getByText('无法从控制面读取项目组合；不会显示伪造数据。')).toBeInTheDocument();
  });

  it('renders the loading state while the snapshot is in flight', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isFetching: true,
      isLoading: true,
      refetch: vi.fn(async () => undefined),
    });

    renderProjects();
    expect(screen.getByText('正在同步项目')).toBeInTheDocument();
    expect(document.querySelector('[data-axi="control-plane-state"][data-loading="true"]')).not.toBeNull();
  });

  it('renders project rows and a wired view action when the snapshot is healthy', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: {
        generatedAt: '2026-09-25T00:00:00.000Z',
        resources: [
          {
            id: 'axi-workbench',
            resourceId: 'axi-workbench',
            name: 'Axi Workbench',
            label: 'Axi Workbench',
            kind: 'product',
            layer: 'software',
            status: 'available',
            path: '/tmp',
            provides: [],
            consumes: [],
            contracts: [],
            commands: [],
            metadata: { git: { branch: 'dev', clean: true, changedEntries: 0 } },
          },
        ],
        agentTasks: [],
        approvals: [],
        runtimes: [],
        governance: undefined,
      },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(async () => undefined),
    });

    renderProjects();
    expect(screen.getByLabelText('项目组合')).toBeInTheDocument();
    expect(screen.getByText('Axi Workbench')).toBeInTheDocument();
    // Filter segmented control is wired (all / available / attention)
    expect(screen.getByRole('radiogroup', { name: 'segmented control' })).toBeInTheDocument();
    // Project row reached the table mock
    expect(document.querySelector('[data-axi="projects-table"] [data-project]')).not.toBeNull();
  });
});
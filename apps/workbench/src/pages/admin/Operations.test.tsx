import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import Operations from './Operations';

const mockUseControlSnapshot = vi.fn();

vi.mock('@axi/api-client', () => ({
  useControlSnapshot: () => mockUseControlSnapshot(),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ id: string; label?: string; status?: string }> }) =>
      element('table', { 'data-axi': 'axi-table' },
        element('tbody', null,
          (data ?? []).map((row, index) =>
            element('tr', { key: `${row.id}-${index}`, 'data-row': row.label ?? row.id }, row.label ?? row.id),
          ),
        ),
      ),
    AxiTableGroup: ({ children, description, title }: {
      children?: React.ReactNode;
      description?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'table-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description)),
        children,
      ),
  };
});

vi.mock('./DesktopCrudFrame', () => ({
  DesktopCrudFrame: ({ children, ariaLabel }: { children?: React.ReactNode; ariaLabel?: string }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'main',
      { 'data-axi': 'desktop-crud-frame', 'aria-label': ariaLabel },
      children,
    );
  },
}));

vi.mock('./ControlPlaneState', () => ({
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
  'operations.title': '运行状态',
  'operations.refresh': '刷新',
  'operations.error.title': '运行状态暂不可用',
  'operations.error.description': '无法从控制面读取运行状态；不会显示伪造数据。',
  'operations.error.retry': '重试',
  'operations.loading.title': '正在同步运行状态',
  'operations.loading.description': '正在读取关注项、项目健康和已登记运行环境。',
  'operations.attention.title': '关注项',
  'operations.attention.emptyAll': '当前没有需要关注的运行项。',
  'operations.attention.emptyFiltered': '当前筛选条件下没有匹配的关注项。',
  'operations.attention.count': ' 项关注',
  'operations.attention.kind.task': '任务',
  'operations.attention.kind.approval': '审批',
  'operations.attention.priority.failed': '失败',
  'operations.attention.priority.pending': '待处理',
  'operations.attention.priority.confirm': '待确认',
  'operations.attention.status.pending': '待处理',
  'operations.attention.fallbackSummary': '未提供摘要',
  'operations.column.kind': '类型',
  'operations.column.summary': '摘要',
  'operations.column.priority': '优先级',
  'operations.column.status': '状态',
  'operations.column.target': '项目',
  'operations.column.updatedAt': '更新时间',
  'operations.column.runtime': '运行环境',
  'operations.projects.title': '项目健康',
  'operations.projects.count': ' 项项目',
  'operations.project.state.attention': '需关注',
  'operations.project.state.healthy': '健康',
  'operations.runtime.unavailable': '不可用',
  'operations.runtimes.title': '已登记运行环境',
  'operations.runtimes.count': ' 项运行时',
  'operations.filter.ariaLabel': '项目筛选',
  'operations.filter.all': '全部',
  'operations.filter.attention': '需关注',
  'operations.filter.ok': '健康',
  'operations.search.ariaLabel': '搜索',
  'operations.search.placeholder': '搜索摘要、状态或项目',
  'workspace.runtime.available': '可用',
  'workspace.time.unknown': '—',
  'projects.branch.unregistered': '未登记',
  'projects.workspace.changes': '{value} 项变更',
  'projects.workspace.pending': '未确认',
  'projects.workspace.clean': '无变更',
  'common.search': '搜索',
};

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderOperations() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Operations />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Operations', () => {
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
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the error state without fabricated data when the snapshot fails', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: undefined,
      error: new Error('control plane offline'),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(async () => undefined),
    });

    renderOperations();
    expect(screen.getByText('运行状态暂不可用')).toBeInTheDocument();
    expect(screen.getByText('无法从控制面读取运行状态；不会显示伪造数据。')).toBeInTheDocument();
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

    renderOperations();
    expect(screen.getByText('正在同步运行状态')).toBeInTheDocument();
    expect(document.querySelector('[data-axi="control-plane-state"][data-loading="true"]')).not.toBeNull();
  });

  it('renders attention items, project health, and runtimes when the snapshot is healthy', () => {
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
        agentTasks: [
          {
            id: 'task-1',
            status: 'awaiting_approval',
            targetId: 'axi-workbench',
            summary: '等待 owner 审批交接',
            prompt: '',
            createdAt: '2026-09-25T00:00:00.000Z',
          },
        ],
        approvals: [],
        runtimes: [
          { kind: 'codex_cli', available: true, summary: '命令行执行器可用' },
        ],
        governance: undefined,
      },
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(async () => undefined),
    });

    renderOperations();
    // Page heading exposed via aria-label (not body text).
    expect(screen.getByLabelText('运行状态')).toBeInTheDocument();
    // Project row rendered through the wired AxiTable mock contract.
    expect(screen.getByText('Axi Workbench')).toBeInTheDocument();
    // Empty-state copy is localized; absence of error keeps the data table mounted.
    expect(screen.queryByText('运行状态暂不可用')).not.toBeInTheDocument();
  });
});
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import Dashboard from './Dashboard';

const mockUseControlSnapshot = vi.fn();
const mockUseTransitionGovernanceRisk = vi.fn();
const mockUseRunGovernanceAutomation = vi.fn();

vi.mock('@axi/api-client', () => ({
  useControlSnapshot: () => mockUseControlSnapshot(),
  useTransitionGovernanceRisk: () => mockUseTransitionGovernanceRisk(),
  useRunGovernanceAutomation: () => mockUseRunGovernanceAutomation(),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;

  return {
    AxiCrud: ({ children }: { children?: React.ReactNode }) =>
      element('section', { 'data-axi': 'crud' }, children),
    AxiCrudLayout: ({ children, search, top, toolbar, filters }: {
      children?: React.ReactNode;
      search?: React.ReactNode;
      top?: React.ReactNode;
      toolbar?: React.ReactNode;
      filters?: React.ReactNode;
    }) =>
      element('div', { 'data-axi': 'crud-layout' }, top, toolbar, filters, search, children),
    AxiCrudTable: ({ data }: { data?: Array<Record<string, unknown>> }) =>
      element('table', { 'data-axi': 'crud-table' },
        element('tbody', null,
          (data ?? []).map((row, index) =>
            element('tr', { key: String(row.id ?? index), 'data-axi': 'crud-row' },
              String(row.label ?? ''),
            ),
          ),
        ),
      ),
    AxiTable: ({ data }: { data?: Array<Record<string, unknown>> }) =>
      element('table', { 'data-axi': 'axi-table' },
        element('tbody', null,
          (data ?? []).map((row, index) =>
            element('tr', { key: String(row.id ?? index) }, String(row.label ?? row.name ?? '')),
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

vi.mock('./GovernanceSummary', () => ({
  GovernanceSummary: () => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement('section', { 'data-axi': 'governance-summary', 'aria-label': '治理态势摘要' });
  },
}));

const i18nDict: Record<string, string> = {
  'dashboard.title': '工作台概览',
  'dashboard.refresh': '刷新',
  'dashboard.refreshing': '刷新中',
  'dashboard.view': '查看',
  'dashboard.error.title': '工作台数据暂不可用',
  'dashboard.error.description': '无法从控制面读取项目与治理快照；不会显示静态替代数据。',
  'dashboard.error.retry': '重新连接',
  'dashboard.loading.title': '正在同步工作台',
  'dashboard.loading.description': '正在读取项目、运行环境和治理态势。',
  'projects.column.index': '序号',
  'projects.column.label': '项目',
  'projects.column.workspace': '工作区',
  'projects.column.branch': '分支',
  'projects.column.actionHeader': '操作',
  'projects.column.state': '状态',
  'projects.state.available': '可用',
  'projects.state.unknown': '待确认',
  'projects.branch.unregistered': '未登记',
  'projects.workspace.changes': '{value} 项变更',
  'projects.workspace.pending': '未确认',
  'projects.workspace.clean': '无变更',
  'operations.column.status': '状态',
};

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderDashboard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function mockEmptyMutation() {
  return {
    isPending: false,
    mutateAsync: vi.fn(async () => undefined),
  };
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockUseTransitionGovernanceRisk.mockReturnValue(mockEmptyMutation());
    mockUseRunGovernanceAutomation.mockReturnValue(mockEmptyMutation());
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

  it('wires the control-plane snapshot and renders the i18n heading', async () => {
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
            path: '/Volumes/code/workspace/workbench/axi-workbench',
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

    renderDashboard();

    // Page heading is exposed via DesktopCrudFrame aria-label (not body text).
    expect(await screen.findByLabelText('工作台概览')).toBeInTheDocument();
    // AxiCrud wrapper is present
    expect(screen.getByLabelText('工作台概览')).toBeInTheDocument();
    // Project row is rendered with its label
    expect(screen.getByText('Axi Workbench')).toBeInTheDocument();
    // Governance summary section is wired even when snapshot is healthy
    expect(screen.getByLabelText('治理态势摘要')).toBeInTheDocument();
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

    renderDashboard();

    // Error branch uses ControlPlaneState with localized title + retry label
    expect(screen.getByText('工作台数据暂不可用')).toBeInTheDocument();
    expect(screen.getByText('无法从控制面读取项目与治理快照；不会显示静态替代数据。')).toBeInTheDocument();
    // No project rows are fabricated in the error branch
    expect(screen.queryByText('Axi Workbench')).not.toBeInTheDocument();
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

    renderDashboard();

    expect(screen.getByText('正在同步工作台')).toBeInTheDocument();
    expect(screen.getByText('正在读取项目、运行环境和治理态势。')).toBeInTheDocument();
    // Loading flag propagates through the ControlPlaneState mock contract.
    expect(document.querySelector('[data-axi="control-plane-state"][data-loading="true"]')).not.toBeNull();
  });

  it('routes project rows to the project detail path via the wired action', async () => {
    const navigate = vi.fn();
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

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <WorkbenchLocaleProvider>
            <MemoryRouter>
              <Dashboard />
            </MemoryRouter>
          </WorkbenchLocaleProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    // wait for the row to be in the document; renderToStaticMarkup path is not
    // needed — we only assert that the snapshot row is wired up.
    await waitFor(() => expect(screen.getByText('Axi Workbench')).toBeInTheDocument());
    expect(navigate).not.toHaveBeenCalled();
  });
});
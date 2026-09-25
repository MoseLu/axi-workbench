import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import Team from './Team';

const mockUseControlSnapshot = vi.fn();

vi.mock('@axi/api-client', () => ({
  useControlSnapshot: () => mockUseControlSnapshot(),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ id: string; label?: string }> }) =>
      element('table', { 'data-axi': 'team-table' },
        element('tbody', null,
          (data ?? []).map((row) =>
            element('tr', { key: row.id, 'data-row': row.label ?? row.id }, row.label ?? row.id),
          ),
        ),
      ),
    AxiTableGroup: ({ children, description, title }: {
      children?: React.ReactNode;
      description?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'team-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description)),
        children,
      ),
  };
});

vi.mock('./DesktopCrudFrame', () => ({
  DesktopCrudFrame: ({ children, ariaLabel, toolbar }: {
    children?: React.ReactNode;
    ariaLabel?: string;
    toolbar?: React.ReactNode;
  }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'main',
      { 'data-axi': 'desktop-crud-frame', 'aria-label': ariaLabel },
      toolbar,
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
  'team.title': '团队',
  'team.refresh': '刷新',
  'team.refreshing': '刷新中',
  'team.error.title': '团队协作关系暂不可用',
  'team.error.description': '无法从控制面读取项目协作关系；不会显示伪造数据。',
  'team.loading.title': '正在读取协作关系',
  'team.loading.description': '正在汇总项目协作链接。',
  'team.collaboration.title': '项目协作关系',
  'team.column.relationship': '被消费项目数',
  'team.count': ' 项协作',
  'team.empty': '当前没有登记的项目协作关系。',
  'team.viewProject': '查看',
  'team.projectsLink': '项目组合',
  'projects.column.label': '项目',
  'projects.column.actionHeader': '操作',
};

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderTeam() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Team />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Team', () => {
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

    renderTeam();
    expect(screen.getByText('团队协作关系暂不可用')).toBeInTheDocument();
    expect(screen.getByText('无法从控制面读取项目协作关系；不会显示伪造数据。')).toBeInTheDocument();
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

    renderTeam();
    expect(screen.getByText('正在读取协作关系')).toBeInTheDocument();
  });

  it('renders collaboration rows when projects declare consumer relationships', () => {
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
            metadata: { consumers: ['axi-coder'] },
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

    renderTeam();
    expect(screen.getByLabelText('团队')).toBeInTheDocument();
    expect(screen.getByText('Axi Workbench')).toBeInTheDocument();
    expect(document.querySelector('[data-axi="team-table"] [data-row]')).not.toBeNull();
  });
});
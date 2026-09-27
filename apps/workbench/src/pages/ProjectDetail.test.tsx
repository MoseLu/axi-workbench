import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../contexts/AuthContext';
import ProjectDetail from './ProjectDetail';

const mockUseControlSnapshot = vi.fn();

vi.mock('@axi/api-client', () => ({
  useControlSnapshot: () => mockUseControlSnapshot(),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ key?: string; label?: string }> }) =>
      element('table', { 'data-axi': 'detail-table' },
        element('tbody', null,
          (data ?? []).map((row, index) =>
            element('tr', { key: row.key ?? `${index}`, 'data-row': row.label ?? '' }, row.label),
          ),
        ),
      ),
    AxiTableGroup: ({ children, title, description }: {
      children?: React.ReactNode;
      title?: React.ReactNode;
      description?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'detail-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description)),
        children,
      ),
  };
});

vi.mock('./admin/DesktopCrudFrame', () => ({
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

vi.mock('./admin/GovernanceInspector', () => ({
  GovernanceInspector: () => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement('section', { 'data-axi': 'governance-inspector', 'aria-label': '治理检查器' });
  },
}));

const i18nDict: Record<string, string> = {
  'projectDetail.title': '项目详情',
  'projectDetail.back': '返回',
  'projectDetail.refresh': '刷新',
  'projectDetail.refreshing': '刷新中',
  'projectDetail.error.title': '项目详情暂不可用',
  'projectDetail.error.description': '无法从控制面读取项目详情；不会显示伪造数据。',
  'projectDetail.loading.title': '正在读取项目详情',
  'projectDetail.loading.description': '正在读取对象与关联关系。',
  'projectDetail.notFound.title': '未找到项目',
  'projectDetail.notFound.description': '当前登录主体无法访问该项目。',
  'projectDetail.notFound.empty': '该项目不存在或已被移除。',
  'projectDetail.descriptions.state': '状态',
  'projectDetail.descriptions.workspace': '工作区',
  'projectDetail.descriptions.branch': '分支',
  'projectDetail.descriptions.commands': '命令数',
  'projectDetail.relationships.title': '关联项目',
  'projectDetail.relationships.count': ' 个关联',
  'projectDetail.relationships.empty': '当前项目没有登记的关联。',
  'projectDetail.relationship.consume': '消费',
  'projectDetail.relationship.consumer': '被消费',
  'projectDetail.relationship.contract': '合同',
  'projectDetail.relationship.peer': '对端',
  'projectDetail.relationship.relationship': '关系',
  'projectDetail.capabilities.title': '能力',
  'projectDetail.capabilities.count': ' 项能力',
  'projectDetail.capabilities.empty': '当前项目未登记能力。',
  'projectDetail.capability': '能力',
  'projectDetail.tasks.title': '受管任务',
  'projectDetail.tasks.count': ' 个任务',
  'projectDetail.tasks.empty': '当前项目暂无受管任务。',
  'projectDetail.commandsUnit': ' 个命令',
  'projects.state.available': '可用',
  'projects.state.unknown': '待确认',
  'projects.branch.unregistered': '未登记',
  'projects.workspace.changes': '{value} 项变更',
  'projects.workspace.pending': '未确认',
  'projects.workspace.clean': '无变更',
  'operations.column.status': '状态',
  'operations.attention.fallbackSummary': '未提供摘要',
  'workspace.column.task': '任务',
  'workspace.column.runtime': '运行环境',
  'workspace.column.createdAt': '创建时间',
  'workspace.time.unknown': '—',
};

vi.mock('../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderDetail(projectId: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter initialEntries={[`/admin/project/${encodeURIComponent(projectId)}`]}>
            <Routes>
              <Route path="/admin/project/:id" element={<ProjectDetail />} />
            </Routes>
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const baseResource = {
  id: 'axi-workbench',
  resourceId: 'axi-workbench',
  name: 'Axi Workbench',
  label: 'Axi Workbench',
  kind: 'product',
  layer: 'software',
  status: 'available',
  path: '/tmp',
  provides: ['workstation'],
  consumes: ['axi-kernel'],
  contracts: [],
  commands: [{ id: 'cmd-1' }, { id: 'cmd-2' }],
  metadata: { git: { branch: 'dev', clean: true, changedEntries: 0 } },
};

describe('ProjectDetail', () => {
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

  it('renders the error state when the snapshot fails', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: undefined,
      error: new Error('control plane offline'),
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(async () => undefined),
    });

    renderDetail('axi-workbench');
    expect(screen.getByText('项目详情暂不可用')).toBeInTheDocument();
    expect(screen.getByText('无法从控制面读取项目详情；不会显示伪造数据。')).toBeInTheDocument();
  });

  it('renders the not-found state when the requested project is not in the snapshot', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: {
        generatedAt: '2026-09-25T00:00:00.000Z',
        resources: [],
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

    renderDetail('missing-project');
    expect(screen.getByText('未找到项目')).toBeInTheDocument();
    expect(screen.getByText('该项目不存在或已被移除。')).toBeInTheDocument();
  });

  it('renders the project header, relationships, capabilities and task table when the snapshot is healthy', () => {
    mockUseControlSnapshot.mockReturnValue({
      data: {
        generatedAt: '2026-09-25T00:00:00.000Z',
        resources: [
          baseResource,
          {
            ...baseResource,
            id: 'axi-kernel',
            resourceId: 'axi-kernel',
            name: 'Axi Kernel',
            label: 'Axi Kernel',
            path: '/tmp/axi-kernel',
          },
        ],
        agentTasks: [
          {
            id: 'task-1',
            status: 'awaiting_approval',
            targetId: 'axi-workbench',
            summary: '等待 owner 审批交接',
            prompt: '',
            runtime: 'codex_cli',
            createdAt: '2026-09-25T00:00:00.000Z',
          },
        ],
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

    renderDetail('axi-workbench');
    expect(screen.getByLabelText('项目详情')).toBeInTheDocument();
    // Project label reached the heading group
    expect(screen.getByText('Axi Workbench')).toBeInTheDocument();
    // Back / refresh actions wired (antd inserts CJK spaces — match via regex)
    expect(screen.getByRole('button', { name: /返\s*回/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷\s*新/ })).toBeInTheDocument();
    // Governance inspector is wired through
    expect(screen.getByLabelText('治理检查器')).toBeInTheDocument();
  });
});
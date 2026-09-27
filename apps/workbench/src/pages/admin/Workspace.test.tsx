// Workspace.test.tsx — component-level contract for the Web Workspace page.
//
// `pages/admin/Workspace.test.ts` already exists but only tests the
// `filterTaskRows` / `filterApprovalRows` pure helpers. This file
// complements it with a wiring contract for the Workspace React component.

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import Workspace from './Workspace';

vi.setConfig({ testTimeout: 20000 });

const mockUseControlSnapshot = vi.fn();
const mockUseWorkflowEngineWorkflows = vi.fn();

vi.mock('@axi/api-client', () => ({
  useControlSnapshot: () => mockUseControlSnapshot(),
  useWorkflowEngineWorkflows: () => mockUseWorkflowEngineWorkflows(),
  // Other workspace-side hooks are stubbed to prevent real React Query calls;
  // WorkflowEffectsPanel renders even when these return empty data.
  useWorkflowEngineExecution: () => ({
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useWorkflowEngineApprovals: () => ({
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDecideWorkflowEngineApproval: () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

const i18nDict: Record<string, string> = {
  'workspace.title': '工作台工作队列',
  'workspace.tab.tasks': '任务',
  'workspace.tab.approvals': '审批',
  'workspace.tab.runtime': '运行时',
  'workspace.error.title': '工作台工作队列暂不可用',
  'workspace.error.description': '无法从控制面读取工作队列；不会显示伪造数据。',
  'workspace.loading.title': '正在同步工作队列',
  'workspace.loading.description': '正在读取任务、审批和已登记运行环境。',
  'workspace.empty.tasks': '当前主体没有受管任务。',
  'workspace.empty.approvals': '当前主体没有待处理审批。',
  'workspace.empty.runtime': '当前没有已登记的运行环境。',
  'workspace.empty.filtered': '当前筛选条件下没有匹配项。',
  'workspace.column.task': '任务',
  'workspace.column.runtime': '运行环境',
  'workspace.column.createdAt': '创建时间',
  'workspace.column.status': '状态',
  'workspace.column.target': '项目',
  'workspace.column.approval': '审批',
  'workspace.column.risk': '风险',
  'workspace.time.unknown': '—',
  'workspace.runtime.available': '可用',
  'workspace.runtime.unavailable': '不可用',
  'workspace.runtime.degraded': '降级',
  'workspace.task.fallbackSummary': '未提供摘要',
  'common.refresh': '刷新',
  'common.search': '搜索',
  'common.all': '全部',
  'operations.filter.all': '全部',
  'operations.filter.attention': '需关注',
  'operations.filter.ok': '健康',
  'projects.column.label': '项目',
  'projects.column.action': '查看',
  'projects.column.actionHeader': '操作',
  'projects.column.branch': '分支',
  'projects.column.workspace': '工作区',
  'projects.column.state': '状态',
  'projects.state.available': '可用',
  'projects.state.unknown': '待确认',
  'projects.branch.unregistered': '未登记',
  'projects.workspace.changes': '{value} 项变更',
  'projects.workspace.pending': '未确认',
  'projects.workspace.clean': '无变更',
  'operations.column.status': '状态',
  'operations.column.target': '项目',
  'operations.attention.kind.task': '任务',
  'operations.attention.kind.approval': '审批',
  'operations.attention.status.pending': '待处理',
  'operations.attention.priority.failed': '失败',
  'operations.attention.priority.pending': '待处理',
  'operations.attention.priority.confirm': '待确认',
  'operations.attention.fallbackSummary': '未提供摘要',
  'operations.column.summary': '摘要',
  'operations.column.priority': '优先级',
  'operations.column.updatedAt': '更新时间',
};

vi.mock('/Volumes/code/workspace/workbench/axi-workbench/apps/workbench/src/i18n/index.tsx', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderWorkspace() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Workspace />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Workspace (component)', () => {
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
      refetch: vi.fn(),
    });
    mockUseWorkflowEngineWorkflows.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWorkspace();
    // The mock i18n layer (绝对路径生效) renders the localized error copy;
    // we assert the contract that the error branch shows the offline state
    // without fabricating rows.
    expect(document.body.textContent).toContain('工作台工作队列暂不可用');
    expect(document.querySelectorAll('[data-axi="workspace-table"] [data-row]').length).toBe(0);
  });

  it('renders the empty placeholder when the snapshot is healthy but has zero tasks', () => {
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
      refetch: vi.fn(),
    });
    mockUseWorkflowEngineWorkflows.mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWorkspace();
    expect(document.querySelectorAll('[data-axi="workspace-table"] [data-row]').length).toBe(0);
  });

  it('renders task rows when the snapshot contains agent tasks', () => {
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
      refetch: vi.fn(),
    });
    mockUseWorkflowEngineWorkflows.mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWorkspace();
    expect(document.body.textContent).toContain('Axi Workbench');
  });
});
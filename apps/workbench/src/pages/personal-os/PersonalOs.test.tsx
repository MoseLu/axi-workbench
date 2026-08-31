import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalOsFocusResponse, PersonalOsQueueEnvelope, ProjectQueueItem } from '@axi/workstation-contracts';
import {
  usePersonalOsFocus,
  usePersonalOsQueue,
  useUpdatePersonalOsFocus,
  useUpdatePersonalOsProject,
} from '@epap/api-client';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../contexts/AuthContext';
import { PersonalOsToday, PersonalOsWorkbench } from './PersonalOs';

vi.mock('@axi/core', () => ({
  AxiSvgIcon: ({ name }: { name: string }) => <span aria-hidden="true" data-icon={name} />,
}));

vi.mock('@epap/api-client', () => ({
  usePersonalOsFocus: vi.fn(),
  usePersonalOsQueue: vi.fn(),
  useUpdatePersonalOsFocus: vi.fn(),
  useUpdatePersonalOsProject: vi.fn(),
}));

const mockedUseFocus = vi.mocked(usePersonalOsFocus);
const mockedUseQueue = vi.mocked(usePersonalOsQueue);
const mockedUseUpdateFocus = vi.mocked(useUpdatePersonalOsFocus);
const mockedUseUpdateProject = vi.mocked(useUpdatePersonalOsProject);

function item(overrides: Partial<ProjectQueueItem> = {}): ProjectQueueItem {
  return {
    id: 'sample-app',
    name: '示例应用',
    path: '/workspace/products/sample-app',
    partition: 'products',
    role: 'product',
    summary: '示例应用摘要',
    status: 'available',
    lifecycle: 'building',
    lifecycleSource: 'manual',
    overlay: {
      projectId: 'sample-app',
      lifecycleOverride: 'building',
      finishLine: '完成主流程',
      usesAxiUi: true,
      revision: 3,
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    finishLine: '完成主流程',
    usesAxiUi: true,
    focus: false,
    runtime: { state: 'running', registered: true, serviceIds: ['sample-app-web'], summary: 'sample-app-web', checkedAt: null },
    activity: {
      lastCommitAt: '2026-08-31T00:00:00.000Z',
      lastAgentRunAt: null,
      lastActivityAt: '2026-08-31T00:00:00.000Z',
      changedEntries: 0,
      clean: true,
    },
    recentAgentRuns: [],
    relationships: { provides: ['sample-capability'], consumes: ['axi-ui'], consumers: [] },
    source: { project: 'workspace.graph', runtime: 'devsvc', metadata: 'personal-os.sqlite' },
    ...overrides,
  };
}

const queue: PersonalOsQueueEnvelope = {
  contractVersion: 1,
  generatedAt: '2026-09-01T00:00:00.000Z',
  source: { project: 'workspace.graph', runtime: 'devsvc', metadata: 'personal-os.sqlite' },
  view: 'all',
  focusProjectId: null,
  items: [
    item(),
    item({
      id: 'stalled-app',
      name: '停滞应用',
      lifecycle: 'stalled',
      lifecycleSource: 'derived',
      overlay: { ...item().overlay, projectId: 'stalled-app', revision: 0, lifecycleOverride: null, finishLine: '' },
      finishLine: '',
      runtime: { state: 'unknown', registered: false, serviceIds: [], summary: '未登记 DevSvc 运行服务。', checkedAt: null },
    }),
  ],
  warnings: [],
};

const focus: PersonalOsFocusResponse = {
  contractVersion: 1,
  generatedAt: '2026-09-01T00:00:00.000Z',
  focus: { projectId: null, revision: 0, updatedAt: null },
  warnings: [],
};

function renderPage(element: React.ReactElement) {
  return render(
    <AuthProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/admin/personal-os/workbench']}>
          {element}
        </MemoryRouter>
      </I18nProvider>
    </AuthProvider>,
  );
}

describe('Personal OS project queue behavior', () => {
  const refetch = vi.fn();
  const updateProject = vi.fn().mockResolvedValue({});
  const updateFocus = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseQueue.mockReturnValue({ data: queue, error: null, isFetching: false, isLoading: false, refetch } as never);
    mockedUseFocus.mockReturnValue({ data: focus } as never);
    mockedUseUpdateProject.mockReturnValue({ error: null, isPending: false, mutateAsync: updateProject } as never);
    mockedUseUpdateFocus.mockReturnValue({ isPending: false, mutateAsync: updateFocus } as never);
  });

  afterEach(() => cleanup());

  it('renders the queue and inspector from the typed projection', () => {
    renderPage(<PersonalOsWorkbench />);

    expect(screen.getByRole('main', { name: '项目队列' })).toBeInTheDocument();
    expect(screen.getAllByText('示例应用')).toHaveLength(2);
    expect(screen.getByText('停滞应用')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '完成定义' })).toHaveValue('完成主流程');
    expect(screen.getByRole('complementary', { name: '项目检查器' })).toBeInTheDocument();
  });

  it('changes the requested queue view through the filter tabs', async () => {
    const user = userEvent.setup();
    renderPage(<PersonalOsWorkbench />);

    await user.click(screen.getByRole('tab', { name: '停滞' }));
    expect(mockedUseQueue).toHaveBeenLastCalledWith({ view: 'stalled', query: '' });
  });

  it('changes the Inspector when another project row is selected', async () => {
    const user = userEvent.setup();
    renderPage(<PersonalOsWorkbench />);

    await user.click(screen.getAllByTestId('personal-os-project-row')[1]);
    expect(screen.getByRole('heading', { name: '停滞应用' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '完成定义' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: '生命周期' })).toHaveValue('__auto');
  });

  it('saves owner metadata with the current overlay revision', async () => {
    const user = userEvent.setup();
    renderPage(<PersonalOsWorkbench />);

    const finishLine = screen.getByRole('textbox', { name: '完成定义' });
    await user.clear(finishLine);
    await user.type(finishLine, '完成新的主流程');
    await user.click(screen.getByRole('button', { name: '保存项目元数据' }));

    expect(updateProject).toHaveBeenCalledWith({
      projectId: 'sample-app',
      lifecycleOverride: 'building',
      finishLine: '完成新的主流程',
      usesAxiUi: true,
      revision: 3,
    });
  });

  it('sets the selected project as the single focus project', async () => {
    const user = userEvent.setup();
    renderPage(<PersonalOsWorkbench />);

    await user.click(screen.getByRole('button', { name: '设为焦点' }));
    expect(updateFocus).toHaveBeenCalledWith({ projectId: 'sample-app', revision: 0 });
  });

  it('offers an actionable empty state on Today without a focus project', () => {
    mockedUseQueue.mockReturnValue({ data: { ...queue, view: 'today', items: [] }, error: null, isFetching: false, isLoading: false, refetch } as never);
    renderPage(<PersonalOsToday />);

    expect(screen.getByText('今天还没有焦点项目')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开项目队列' })).toBeInTheDocument();
  });

  it('renders the loading state while the queue is synchronizing', () => {
    mockedUseQueue.mockReturnValue({ data: undefined, error: null, isFetching: true, isLoading: true, refetch } as never);
    renderPage(<PersonalOsWorkbench />);

    expect(screen.getByRole('status')).toHaveTextContent('正在同步项目队列');
  });

  it('explains a stale control-plane snapshot separately from a runtime outage', () => {
    mockedUseQueue.mockReturnValue({
      data: { ...queue, warnings: ['control_plane_snapshot_stale'] },
      error: null,
      isFetching: false,
      isLoading: false,
      refetch,
    } as never);
    renderPage(<PersonalOsWorkbench />);

    expect(screen.getByRole('status')).toHaveTextContent('控制面快照已过期');
    expect(screen.getByRole('status')).not.toHaveTextContent('DevSvc 当前不可用');
  });

  it('renders a recoverable error state', () => {
    mockedUseQueue.mockReturnValue({ data: undefined, error: new Error('unavailable'), isFetching: false, isLoading: false, refetch } as never);
    renderPage(<PersonalOsWorkbench />);

    expect(screen.getByRole('status')).toHaveTextContent('项目队列暂不可用');
    expect(screen.getByRole('button', { name: '重新连接' })).toBeInTheDocument();
  });

  it('retries a failed queue request from the error state', async () => {
    const user = userEvent.setup();
    mockedUseQueue.mockReturnValue({ data: undefined, error: new Error('unavailable'), isFetching: false, isLoading: false, refetch } as never);
    renderPage(<PersonalOsWorkbench />);

    await user.click(screen.getByRole('button', { name: '重新连接' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

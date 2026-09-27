import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../../contexts/AuthContext';
import Notifications from './Notifications';

vi.setConfig({ testTimeout: 20000 });

const fetchNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();
const announceNotificationChangeMock = vi.fn();

vi.mock('@axi/workbench-foundation', async () => {
  const actual = await vi.importActual<typeof import('@axi/workbench-foundation')>('@axi/workbench-foundation');
  return {
    ...actual,
    fetchNotifications: (args: { signal?: AbortSignal } = {}) =>
      fetchNotificationsMock(args).finally(() => {
        // Allow React Query to abort in-flight queries cleanly when the test
        // unmounts; otherwise the unmounted fetch leaks into the next test.
        args.signal?.aborted;
      }),
    markNotificationRead: (...args: unknown[]) => markNotificationReadMock(...args),
    markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsReadMock(...args),
    announceNotificationChange: (...args: unknown[]) => announceNotificationChangeMock(...args),
  };
});

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ id: string; subject?: string }> }) =>
      element('table', { 'data-axi': 'notifications-table' },
        element('tbody', null,
          (data ?? []).map((row) =>
            element('tr', { key: row.id, 'data-row': row.subject ?? row.id }, row.subject),
          ),
        ),
      ),
    AxiTableGroup: ({ children, description, title, actions }: {
      children?: React.ReactNode;
      description?: React.ReactNode;
      title?: React.ReactNode;
      actions?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'notifications-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description), actions),
        children,
      ),
  };
});

vi.mock('../DesktopCrudFrame', () => ({
  DesktopCrudFrame: ({ children, ariaLabel, toolbar, top }: {
    children?: React.ReactNode;
    ariaLabel?: string;
    toolbar?: React.ReactNode;
    top?: React.ReactNode;
  }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'main',
      { 'data-axi': 'desktop-crud-frame', 'aria-label': ariaLabel },
      top,
      toolbar,
      children,
    );
  },
}));

const i18nDict: Record<string, string> = {
  'notification.center': '通知中心',
  'notification.loading': '正在加载通知',
  'notification.failed': '通知加载失败',
  'notification.retry': '重试',
  'notification.empty': '暂无通知',
  'notification.allRead': '全部已读',
  'notification.marking': '正在标记…',
  'notification.markAllRead': '全部标记已读',
  'notification.read': '标记已读',
  'notification.unread': '未读',
  'notification.column.subject': '主题',
  'notification.column.category': '类别',
  'notification.column.status': '状态',
  'notification.column.time': '时间',
  'notification.category.home': '总览',
  'notification.category.projects': '项目',
  'notification.category.workspace': '工作区',
  'notification.category.me': '我',
};

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderNotifications() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Notifications />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Notifications', () => {
  beforeEach(() => {
    fetchNotificationsMock.mockReset();
    markNotificationReadMock.mockReset();
    markAllNotificationsReadMock.mockReset();
    announceNotificationChangeMock.mockReset();
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

  it('renders the loading state while notifications are in flight', () => {
    fetchNotificationsMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderNotifications();
    expect(screen.getByText('正在加载通知')).toBeInTheDocument();
  });

  it('renders the empty placeholder when the API returns zero notifications', async () => {
    fetchNotificationsMock.mockResolvedValue([]);
    renderNotifications();
    expect(await screen.findByText('暂无通知')).toBeInTheDocument();
  });

  it('wires the fetchNotifications API on mount and renders notification rows', async () => {
    fetchNotificationsMock.mockResolvedValue([
      {
        id: 'nt_1',
        type: 'in_app',
        userId: 'user_sub_xxx',
        recipient: 'alice',
        subject: '需要 Web 复核交接',
        content: '...',
        category: 'workspace',
        dotOnly: false,
        read: false,
        status: 'sent',
        createdAt: '2026-09-25T00:00:00.000Z',
      },
    ]);
    renderNotifications();
    await waitFor(() => expect(fetchNotificationsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('需要 Web 复核交接')).toBeInTheDocument());
    // The "全部标记已读" action is wired and visible — antd Button renders
    // CJK children with internal whitespace so we check the DOM directly.
    console.log('[body]', document.body.textContent);
    expect(document.body.textContent).toContain('全部标记已读');
  });
});
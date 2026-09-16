/**
 * CommitLedgerPage contract test
 *
 * Verifies the UI contract for /admin/operations/commit-ledger:
 *  - Heading is exposed via the i18n `commitLedger.title` key (zh-CN: 提交账本;
 *    en-US: Commit Ledger).
 *  - Loading state is rendered while the API is in flight.
 *  - Error state is rendered when the API errors.
 *  - Empty state is rendered when the API returns zero commits.
 *  - The page wires up the documented React Query hooks via
 *    `/api/v1/commit-ledger/summary` and `/api/v1/commit-ledger/commits`.
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import { I18nProvider } from '../../i18n';
import { CommitLedgerPage } from './CommitLedgerPage';

// The CRUD package's table components are exercised in the shell layer; we
// only need stable placeholders so the page can render its summary, filters and
// timeline sections. DesktopCrudFrame wraps everything in AxiCrudLayout, so
// the layout component must also be mocked.
vi.mock('@axi/crud', () => ({
  AxiCrudLayout: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="axi-crud-layout">{children}</div>
  ),
  AxiTable: ({
    columns,
    data,
    onRow,
  }: {
    columns: Array<{ dataIndex: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }>;
    data: Array<Record<string, unknown>>;
    onRow?: (row: Record<string, unknown>) => { onClick?: () => void };
  }) => (
    <table data-testid="commit-ledger-table">
      <tbody>
        {data.map((row, rowIndex) => (
          <tr
            key={`row-${rowIndex}`}
            onClick={() => onRow?.(row).onClick?.()}
          >
            {columns.map((column) => (
              <td key={column.dataIndex}>
                {column.render
                  ? column.render(row[column.dataIndex], row)
                  : String(row[column.dataIndex] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  AxiTableGroup: ({ children, description, title }: { children?: React.ReactNode; description?: React.ReactNode; title?: React.ReactNode }) => (
    <section data-testid="commit-ledger-section">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  ),
}));

// Replace the @ant-design/icons component imports with no-op placeholders so
// the page can be rendered under jsdom without pulling the icon package into
// this app's node_modules. The page only uses the icons for static visual
// decoration, so the contract test does not depend on the icon glyphs.
vi.mock('@ant-design/icons', () => ({
  CheckCircleOutlined: () => <span data-icon="check-circle" />,
  CloseCircleOutlined: () => <span data-icon="close-circle" />,
  ClockCircleOutlined: () => <span data-icon="clock-circle" />,
  CodeOutlined: () => <span data-icon="code" />,
  ExclamationCircleOutlined: () => <span data-icon="exclamation" />,
  InfoCircleOutlined: () => <span data-icon="info" />,
  ReloadOutlined: () => <span data-icon="reload" />,
  WarningOutlined: () => <span data-icon="warning" />,
}));

interface FetchResponse {
  ok: boolean;
  json: () => Promise<unknown>;
  status?: number;
}

function jsonResponse(body: unknown, status = 200): FetchResponse {
  return { ok: status >= 200 && status < 300, json: async () => body, status };
}

function errorResponse(status: number): FetchResponse {
  return { ok: false, json: async () => ({}), status };
}

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries so error state is observable within the test.
        retry: false,
      },
    },
  });
}

interface RenderOptions {
  fetchImpl: (input: RequestInfo | URL) => Promise<FetchResponse>;
}

function renderPage({ fetchImpl }: RenderOptions) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));

  return render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <I18nProvider>
            <CommitLedgerPage />
          </I18nProvider>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('CommitLedgerPage', () => {
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

  it('renders the i18n heading and loading state while in flight', () => {
    // Never resolving fetch keeps the query in the loading state.
    renderPage({ fetchImpl: () => new Promise<FetchResponse>(() => {}) });

    // Heading is rendered through DesktopCrudFrame's <main aria-label> using
    // t('commitLedger.title') -> zh-CN fallback -> 提交账本
    expect(screen.getByLabelText('提交账本')).toBeInTheDocument();
    // Loading indicator from the loading branch (ControlPlaneState loading)
    expect(screen.getByText('加载中')).toBeInTheDocument();
  });

  it('renders the error state when summary/commits fail', async () => {
    renderPage({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('/api/v1/commit-ledger/summary')) return errorResponse(503);
        if (url.includes('/api/v1/commit-ledger/commits')) return errorResponse(503);
        if (url.includes('/api/v1/commit-ledger/projects')) return jsonResponse({ projects: [] });
        return errorResponse(404);
      },
    });

    // Wait for the error branch to render. The page flips from the loading
    // branch to the error branch once the queries settle; we wait for the
    // retry button (only present on the error branch) and then assert the
    // status section has the localized error title.
    // The button label is rendered through antd Button which inserts a
    // whitespace gap between CJK characters in some scenarios, so match via
    // a regex rather than an exact string.
    const retryButton = await screen.findByRole('button', { name: /重\s*试/ });
    expect(retryButton).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('加载失败');
  });

  it('renders the empty state when API returns zero commits', async () => {
    renderPage({
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('/api/v1/commit-ledger/summary')) {
          return jsonResponse({
            workspace: {
              totalProjects: 0,
              totalCommits: 0,
              verifiedCommits: 0,
              unverifiedCommits: 0,
              dirtyWorkspaces: 0,
              conflictRecords: 0,
              lastUpdated: '2026-09-15T00:00:00.000Z',
            },
          });
        }
        if (url.includes('/api/v1/commit-ledger/commits')) {
          return jsonResponse({
            data: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
          });
        }
        if (url.includes('/api/v1/commit-ledger/projects')) {
          return jsonResponse({ projects: [] });
        }
        return jsonResponse({});
      },
    });

    // Section heading for the timeline
    expect(await screen.findByText('提交时间线')).toBeInTheDocument();
    // Empty description from t('commitLedger.empty.description')
    expect(screen.getByText('暂无提交记录')).toBeInTheDocument();
  });

  it('wires the summary and commits queries to /api/v1/commit-ledger', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/commit-ledger/summary')) {
        return jsonResponse({
          workspace: {
            totalProjects: 1,
            totalCommits: 1,
            verifiedCommits: 1,
            unverifiedCommits: 0,
            dirtyWorkspaces: 0,
            conflictRecords: 0,
            lastUpdated: '2026-09-15T00:00:00.000Z',
          },
        });
      }
      if (url.includes('/api/v1/commit-ledger/commits')) {
        return jsonResponse({
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
        });
      }
      if (url.includes('/api/v1/commit-ledger/projects')) {
        return jsonResponse({ projects: [] });
      }
      return jsonResponse({});
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryClientProvider client={makeTestQueryClient()}>
        <AuthProvider>
          <WorkbenchLocaleProvider>
            <I18nProvider>
              <CommitLedgerPage />
            </I18nProvider>
          </WorkbenchLocaleProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/commit-ledger/summary'),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/commit-ledger/commits'),
      );
    });
  });
});
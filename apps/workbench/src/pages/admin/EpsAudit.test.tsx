import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import EpsAudit from './EpsAudit';

const mockUseEpsAssets = vi.fn();
const mockUseRunEpsAudit = vi.fn();

vi.mock('@axi/api-client', () => ({
  useEpsAssets: () => mockUseEpsAssets(),
  useRunEpsAudit: () => mockUseRunEpsAudit(),
}));

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ id: string; path?: string; method?: string }> }) =>
      element('table', { 'data-axi': 'eps-table' },
        element('tbody', null,
          (data ?? []).map((row, index) =>
            element('tr', { key: `${row.id}-${index}`, 'data-path': row.path ?? row.id },
              row.method, ' ', row.path ?? row.id,
            ),
          ),
        ),
      ),
    AxiTableGroup: ({ children, title }: {
      children?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'eps-group', 'data-title': String(title ?? '') }, children),
  };
});

vi.mock('./DesktopCrudFrame', () => ({
  DesktopCrudFrame: ({ children, ariaLabel, top }: { children?: React.ReactNode; ariaLabel?: string; top?: React.ReactNode }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'main',
      { 'data-axi': 'desktop-crud-frame', 'aria-label': ariaLabel },
      top,
      children,
    );
  },
}));

function renderEpsAudit() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <EpsAudit />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('EpsAudit', () => {
  beforeEach(() => {
    mockUseRunEpsAudit.mockReturnValue({
      isPending: false,
      isError: false,
      mutate: vi.fn(),
    });
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

  it('renders the empty placeholder when no assets are registered', () => {
    mockUseEpsAssets.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });

    renderEpsAudit();
    expect(screen.getByText('暂无 API 资产')).toBeInTheDocument();
  });

  it('renders EPS asset rows and a run-audit action wired to the mutation hook', () => {
    mockUseEpsAssets.mockReturnValue({
      data: {
        items: [
          { id: 'asset-1', method: 'GET', path: '/api/v1/control-plane/snapshot', platform: 'platform-core', service: null, source: 'route-registry' },
          { id: 'asset-2', method: 'POST', path: '/api/v1/handoffs', platform: 'control-plane', service: 'control-plane', source: 'route-registry' },
        ],
      },
      isLoading: false,
    });

    renderEpsAudit();
    // Both wired assets reach the table
    expect(screen.getByText(/\/api\/v1\/control-plane\/snapshot/)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/v1\/handoffs/)).toBeInTheDocument();
    // Run audit action is wired
    expect(screen.getByRole('button', { name: '运行审计' })).toBeInTheDocument();
  });

  it('surfaces an inline error and does not render fabricated rows when the audit mutation fails', () => {
    const mutate = vi.fn();
    mockUseRunEpsAudit.mockReturnValue({
      isPending: false,
      isError: true,
      mutate,
    });
    mockUseEpsAssets.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    });

    renderEpsAudit();
    expect(screen.getByText('审计启动失败，请检查控制面与 API Gateway 连接。')).toBeInTheDocument();
    // Run-audit action is still visible to allow retry
    expect(screen.getByRole('button', { name: '运行审计' })).toBeInTheDocument();
  });
});
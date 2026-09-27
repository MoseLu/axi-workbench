import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import Observability from './Observability';

vi.mock('@axi/crud', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const element = ReactModule.createElement;
  return {
    AxiTable: ({ data }: { data?: Array<{ eventId: string; eventType?: string }> }) =>
      element('table', { 'data-axi': 'observability-table' },
        element('tbody', null,
          (data ?? []).map((row) =>
            element('tr', { key: row.eventId, 'data-event-type': row.eventType ?? '' }, row.eventType),
          ),
        ),
      ),
    AxiTableGroup: ({ children, description, title }: {
      children?: React.ReactNode;
      description?: React.ReactNode;
      title?: React.ReactNode;
    }) =>
      element('section', { 'data-axi': 'observability-group', 'data-title': String(title ?? '') },
        element('header', null, element('h2', null, title), element('p', null, description)),
        children,
      ),
  };
});

vi.mock('./ControlPlaneState', () => ({
  ControlPlaneState: ({ title, description, actionLabel }: {
    title?: string;
    description?: string;
    actionLabel?: string;
  }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'section',
      { 'data-axi': 'control-plane-state', 'data-loading': 'false' },
      ReactModule.createElement('strong', null, title),
      ReactModule.createElement('p', null, description),
      actionLabel ? ReactModule.createElement('button', null, actionLabel) : null,
    );
  },
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

function renderObservability(fetchImpl: (input: RequestInfo | URL) => Promise<FetchResponse>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Observability />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Observability', () => {
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
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the loading state while the overview query is in flight', () => {
    renderObservability(() => new Promise<FetchResponse>(() => {}));
    expect(screen.getByText('正在加载可观测性')).toBeInTheDocument();
  });

  it('renders the explicit "service unavailable" error without fabricated data when the overview 404s', async () => {
    renderObservability(async () => errorResponse(404));

    expect(await screen.findByText('可观测性服务暂不可用')).toBeInTheDocument();
    expect(screen.getByText('可观测性查询接口当前未接入，请联系服务维护者；页面不会展示伪造数据。')).toBeInTheDocument();
  });

  it('wires the overview and events queries to /api/v1/observability/* and renders the table', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/observability/overview')) {
        return jsonResponse({
          totalEvents: 2,
          projects: 1,
          services: 3,
          warnings: { total: 0, open: 0 },
          chain: { valid: true },
        });
      }
      if (url.includes('/api/v1/observability/events')) {
        return jsonResponse({
          events: [
            { eventId: 'evt-1', eventType: 'snapshot.refresh', occurredAt: '2026-09-25T00:00:00.000Z', projectId: 'axi-workbench', severity: 'info', status: 'ok', actorRef: 'system' },
            { eventId: 'evt-2', eventType: 'policy.decision', occurredAt: '2026-09-25T00:00:01.000Z', projectId: 'axi-workbench', severity: 'info', status: 'allowed', actorRef: 'owner' },
          ],
        });
      }
      return errorResponse(404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <WorkbenchLocaleProvider>
            <MemoryRouter>
              <Observability />
            </MemoryRouter>
          </WorkbenchLocaleProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/observability/overview'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/observability/events'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
    // Group description exposes overview counters (event count + projects + services).
    expect(screen.getByText(/事件 2 · 项目 1 · 服务 3/)).toBeInTheDocument();
    // Both events reach the table
    expect(screen.getByText('snapshot.refresh')).toBeInTheDocument();
    expect(screen.getByText('policy.decision')).toBeInTheDocument();
  });
});
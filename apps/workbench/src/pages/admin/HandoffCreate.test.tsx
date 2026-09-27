import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// HandoffCreate renders the real antd Form + Select + Modal; under full-suite
// contention it can exceed vitest's default 5s timeout. 20s is plenty.
vi.setConfig({ testTimeout: 20000 });
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../contexts/AuthContext';
import HandoffCreate from './HandoffCreate';

vi.mock('@axi/workbench-foundation', async () => {
  const actual = await vi.importActual<typeof import('@axi/workbench-foundation')>('@axi/workbench-foundation');
  return {
    ...actual,
    resolveGatewayURL: (path: string) => path,
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

interface FetchResponse {
  ok: boolean;
  json: () => Promise<unknown>;
  status?: number;
}

function jsonResponse(body: unknown, status = 200): FetchResponse {
  return { ok: status >= 200 && status < 300, json: async () => body, status };
}

function errorResponse(status: number, body: unknown = {}): FetchResponse {
  return { ok: false, json: async () => body, status };
}

function renderCreate(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<FetchResponse>) {
  const fetchMock = vi.fn(fetchImpl);
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    ...render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <WorkbenchLocaleProvider>
            <MemoryRouter initialEntries={['/admin/handoff/new']}>
              <Routes>
                <Route path="/admin/handoff" element={<div data-testid="handoff-list" />} />
                <Route path="/admin/handoff/new" element={<HandoffCreate />} />
                <Route path="/admin/handoff/:id" element={<div data-testid="handoff-detail" />} />
              </Routes>
            </MemoryRouter>
          </WorkbenchLocaleProvider>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('HandoffCreate', () => {
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

  it('renders the form with the documented defaults and the back action', () => {
    renderCreate(async () => jsonResponse({ id: 'unused' }));

    expect(screen.getByLabelText('创建交接')).toBeInTheDocument();
    // The page mounts the antd Form with default values; we only assert the
    // documented structural pieces (back link + submit button) to keep the
    // contract minimal.
    expect(screen.getByRole('button', { name: /返\s*回列\s*表/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /创\s*建交\s*接/ })).toBeInTheDocument();
  });

  it('POSTs the documented payload and routes to the handoff detail on success', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse({ id: 'handoff_abc123' }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <WorkbenchLocaleProvider>
            <MemoryRouter initialEntries={['/admin/handoff/new']}>
              <Routes>
                <Route path="/admin/handoff" element={<div data-testid="handoff-list" />} />
                <Route path="/admin/handoff/new" element={<HandoffCreate />} />
                <Route path="/admin/handoff/:id" element={<div data-testid="handoff-detail" />} />
              </Routes>
            </MemoryRouter>
          </WorkbenchLocaleProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    // Fill the required text fields that don't have defaults: objectId + reason.
    const objectIdInput = screen.getByPlaceholderText('请输入关联对象的唯一标识');
    await user.type(objectIdInput, 'workitem-42');
    const reasonInput = screen.getByPlaceholderText('请描述交接的原因和上下文');
    await user.type(reasonInput, '需要 Web 复核');

    await user.click(screen.getByRole('button', { name: /创\s*建交\s*接/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/handoffs',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    ));

    // Body contract: direction / targetSurface / actionLevel / object / context.
    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === '/api/v1/handoffs' && init?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.direction).toBe('web');
    expect(body.targetSurface).toBe('mobile');
    expect(body.actionLevel).toBe('B');
    expect(body.object).toEqual({ type: 'workitem', id: 'workitem-42' });
    expect(body.context).toEqual({ reason: '需要 Web 复核' });

    // On success the page navigates to the new handoff detail.
    expect(await screen.findByTestId('handoff-detail')).toBeInTheDocument();
  });

  it('surfaces the error message without navigating when the API rejects', async () => {
    const user = userEvent.setup();
    renderCreate(async () => errorResponse(500, { error: 'control plane offline' }));

    const objectIdInput = screen.getByPlaceholderText('请输入关联对象的唯一标识');
    await user.type(objectIdInput, 'workitem-43');
    const reasonInput = screen.getByPlaceholderText('请描述交接的原因和上下文');
    await user.type(reasonInput, '需要 Web 复核');

    await user.click(screen.getByRole('button', { name: /创\s*建交\s*接/ }));

    expect(await screen.findByText('handoff creation failed')).toBeInTheDocument();
    // We stay on the create page (no navigation to the detail placeholder).
    expect(screen.queryByTestId('handoff-detail')).not.toBeInTheDocument();
  });
});
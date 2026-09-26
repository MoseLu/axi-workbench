import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../../contexts/AuthContext';
import Devices from './Devices';

// vi.setConfig is set up in this file so the whole suite can stay under the
// vitest default 5s ceiling — Devices drives antd QRCode + Space, which
// occasionally exceeds 1s under jsdom contention.
vi.setConfig({ testTimeout: 20000 });

const fetchMock = vi.fn();

vi.mock('@axi/workbench-foundation', async () => {
  const actual = await vi.importActual<typeof import('@axi/workbench-foundation')>('@axi/workbench-foundation');
  return {
    ...actual,
    resolveGatewayURL: (path: string) => path,
  };
});

vi.mock('./DesktopSettingsPage', () => ({
  DesktopSettingsPage: ({ children, title, activeKey }: { children?: React.ReactNode; title?: string; activeKey?: string }) => {
    const ReactModule = require('react') as typeof import('react');
    return ReactModule.createElement(
      'section',
      { 'data-axi': 'desktop-settings-page', 'aria-label': String(title ?? ''), 'data-active-key': String(activeKey ?? '') },
      children,
    );
  },
}));

const i18nDict: Record<string, string> = {
  'account.devices.title': '登录设备与手机配对',
  'account.devices.group': '扫码配对手机',
  'account.devices.empty': '尚未生成配对二维码',
};

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDevices() {
  vi.stubGlobal('fetch', fetchMock);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Devices />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Devices', () => {
  beforeEach(() => {
    fetchMock.mockReset();
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

  it('renders the idle state without any QR before the user clicks "create"', () => {
    fetchMock.mockResolvedValue(jsonResponse({ authenticated: false }));

    renderDevices();
    expect(screen.getByLabelText('登录设备与手机配对')).toBeInTheDocument();
    expect(screen.getByText('尚未生成配对二维码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成配对二维码/ })).toBeInTheDocument();
    // The QR-creation endpoint has not been called yet.
    const qrCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/mobile/pair/qr'));
    expect(qrCalls).toHaveLength(0);
  });

  it('POSTs to /api/v1/control-plane/mobile/pair/qr when the user creates a new pairing QR', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST' && url.endsWith('/api/v1/control-plane/mobile/pair/qr')) {
        return jsonResponse({
          webPairingId: 'webpair_abc123',
          qrToken: 'qr_xxx',
          gatewayUrl: 'https://api.axiomaticworld.com',
          expiresAt: '2026-09-25T00:02:00.000Z',
        });
      }
      if (init?.method !== 'POST' && url.includes('/api/v1/control-plane/mobile/pair/qr/webpair_')) {
        // Status poll returns a sentinel to keep the alert quiet.
        return jsonResponse({ status: 'waiting_scan', expiresAt: '2026-09-25T00:02:00.000Z' });
      }
      return jsonResponse({ authenticated: false });
    });

    renderDevices();
    await user.click(screen.getByRole('button', { name: /生成配对二维码/ }));

    // The QR creation POST is the contract we are testing.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/control-plane/mobile/pair/qr',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      ),
    );
  });
});
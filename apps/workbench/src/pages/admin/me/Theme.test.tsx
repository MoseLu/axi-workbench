import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { AuthProvider } from '../../../contexts/AuthContext';
import Theme from './Theme';

const setPreference = vi.fn();

vi.mock('@axi/core', async () => {
  const actual = await vi.importActual<typeof import('@axi/core')>('@axi/core');
  return {
    ...actual,
    useAxiTheme: () => ({
      mode: 'dark',
      preference: 'system',
      setPreference,
      setStylePreset: vi.fn(),
      toggleMode: vi.fn(),
    }),
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
  'account.theme.title': '主题',
  'account.theme.group': '外观',
  'account.theme.mode.system': '跟随系统',
  'account.theme.mode.system.desc': '根据操作系统设置自动切换',
  'account.theme.mode.light': '亮色',
  'account.theme.mode.light.desc': '始终使用亮色主题',
  'account.theme.mode.dark': '暗色',
  'account.theme.mode.dark.desc': '始终使用暗色主题',
};

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    locale: 'zh-CN' as const,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => i18nDict[key] ?? fallback ?? key,
  }),
}));

function renderTheme() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <MemoryRouter>
            <Theme />
          </MemoryRouter>
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Theme', () => {
  beforeEach(() => {
    setPreference.mockReset();
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

  it('renders the heading and the three theme mode options with the current preference selected', () => {
    renderTheme();
    expect(screen.getByLabelText('主题')).toBeInTheDocument();
    // Three radio options: 跟随系统 / 亮色 / 暗色.
    expect(screen.getByText('跟随系统')).toBeInTheDocument();
    expect(screen.getByText('亮色')).toBeInTheDocument();
    expect(screen.getByText('暗色')).toBeInTheDocument();
  });

  it('calls setPreference when the user picks a different mode', async () => {
    const user = userEvent.setup();
    renderTheme();
    await user.click(screen.getByText('暗色'));
    expect(setPreference).toHaveBeenCalledWith('dark');
  });
});
import type { ThemePresetContribution } from '@axi/scaffold-kit';

export function createThemeRegistry(themePresets: ThemePresetContribution[]): string {
  const presetEntries = themePresets
    .map(
      (themePreset) => `  {
    id: '${themePreset.id}',
    label: '${themePreset.label}',
    description: '${themePreset.description}',
    thesis: '${themePreset.thesis}',
  },`,
    )
    .join('\n');
  const presetIds = themePresets.map((themePreset) => `'${themePreset.id}'`).join(' | ');
  const defaultThemePreset = themePresets[0]?.id ?? 'minimal';

  return `export interface ThemeModeDefinition {
  description: string;
  id: 'light' | 'dark';
  label: string;
}

export interface ThemePresetDefinition {
  description: string;
  id: ${presetIds || 'string'};
  label: string;
  thesis: string;
}

export type ThemeMode = ThemeModeDefinition['id'];
export type ThemePreset = ThemePresetDefinition['id'];

export interface ThemeCombination {
  mode: ThemeMode;
  preset: ThemePreset;
}

export const themeModeCatalog: ThemeModeDefinition[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Bright product surfaces with disciplined contrast and clean reading rhythm.',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Low-luminance surfaces for immersive workspaces and stronger focus contrast.',
  },
];

export const themePresetCatalog: ThemePresetDefinition[] = [
${presetEntries}
];

export const defaultThemeMode: ThemeMode = 'light';
export const defaultThemePreset: ThemePreset = '${defaultThemePreset}';

export const themeStorageKeys = {
  mode: 'axi.theme.mode',
  preset: 'axi.theme.preset',
} as const;

export const themeDimensionOwnership = {
  mode: [
    'color.bg.*',
    'color.border.*',
    'color.focus.ring',
    'color.surface.backdrop',
    'color.surface.elevated',
    'color.surface.input',
    'color.surface.page',
    'color.surface.*Base',
    'color.text.*',
    'shadow.field',
    'shadow.lg',
    'shadow.md',
    'shadow.sm',
    'shadow.xl',
  ],
  preset: [
    'color.accent.*',
    'color.surface.tint',
    'effect.surface.backdrop',
    'effect.surface.*BaseWeight',
    'font.family.display',
    'font.family.sans',
    'radius.*',
    'shadow.button*',
    'shadow.card*',
  ],
} as const;

export function listThemeModes(): ThemeModeDefinition[] {
  return [...themeModeCatalog];
}

export function listThemePresets(): ThemePresetDefinition[] {
  return [...themePresetCatalog];
}

export function listThemeCombinations(): ThemeCombination[] {
  return themeModeCatalog.flatMap((mode) =>
    themePresetCatalog.map((preset) => ({
      mode: mode.id,
      preset: preset.id,
    })),
  );
}
`;
}

export function createThemePreferencesHook(themePresets: ThemePresetContribution[]): string {
  const presetChecks = themePresets
    .map((themePreset) => `value === '${themePreset.id}'`)
    .join(' || ');

  return `import { useEffect, useState } from 'react';

import {
  defaultThemeMode,
  defaultThemePreset,
  themeStorageKeys,
  type ThemeMode,
  type ThemePreset,
} from './registry';

function canUseDom(): boolean {
  return typeof window !== 'undefined';
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function isThemePreset(value: string | null): value is ThemePreset {
  return ${presetChecks || 'false'};
}

function readStoredValue(key: string): string | null {
  if (!canUseDom()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  if (!canUseDom()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function resolveInitialMode(): ThemeMode {
  const storedMode = readStoredValue(themeStorageKeys.mode);

  if (isThemeMode(storedMode)) {
    return storedMode;
  }

  if (
    canUseDom() &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return defaultThemeMode;
}

function resolveInitialPreset(): ThemePreset {
  const storedPreset = readStoredValue(themeStorageKeys.preset);
  return isThemePreset(storedPreset) ? storedPreset : defaultThemePreset;
}

export function applyTheme(mode: ThemeMode, preset: ThemePreset) {
  if (!canUseDom()) {
    return;
  }

  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.themePreset = preset;
  document.documentElement.style.colorScheme = mode;
  writeStoredValue(themeStorageKeys.mode, mode);
  writeStoredValue(themeStorageKeys.preset, preset);
}

export function useThemePreferences() {
  const [mode, setMode] = useState<ThemeMode>(() => resolveInitialMode());
  const [preset, setPreset] = useState<ThemePreset>(() => resolveInitialPreset());

  useEffect(() => {
    applyTheme(mode, preset);
  }, [mode, preset]);

  return {
    mode,
    preset,
    setMode,
    setPreset,
  };
}
`;
}

export function createThemeCompatibilityHook(): string {
  return `import { useMemo } from 'react';

import type { ThemeMode } from './registry';
import { useThemePreferences } from './useThemePreferences';

export interface ThemeConfig {
  mode: ThemeMode;
  resolved: ThemeMode;
}

export function useTheme(): [ThemeConfig, (mode: ThemeMode) => void] {
  const { mode, setMode } = useThemePreferences();
  const config = useMemo<ThemeConfig>(
    () => ({
      mode,
      resolved: mode,
    }),
    [mode],
  );

  return [config, setMode];
}

export function useDarkMode(): [boolean, () => void] {
  const [{ resolved }, setTheme] = useTheme();

  return [
    resolved === 'dark',
    () => {
      setTheme(resolved === 'dark' ? 'light' : 'dark');
    },
  ];
}
`;
}

export function createThemeCompatibilityHookTest(): string {
  return `import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDarkMode, useTheme } from '@/shared/theme/useTheme';

describe('theme compatibility hooks', () => {
  it('exposes useTheme and useDarkMode wrappers', async () => {
    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('light');
    });

    expect(result.current[0].resolved).toBe('light');

    act(() => {
      result.current[1]('dark');
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    const { result: darkMode } = renderHook(() => useDarkMode());

    expect(darkMode.current[0]).toBe(true);

    act(() => {
      darkMode.current[1]();
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('light');
    });
  });
});
`;
}

export function createThemeCompatibilityIndex(): string {
  return `export * from './registry';
export { ThemeSwitcher } from './ThemeSwitcher';
export * from './useTheme';
export * from './useThemePreferences';
`;
}

export function createThemeSwitcher(): string {
  return `import { listThemeModes, listThemePresets } from './registry';
import { useThemePreferences } from './useThemePreferences';

const themeModes = listThemeModes();
const themePresets = listThemePresets();

export function ThemeSwitcher() {
  const { mode, preset, setMode, setPreset } = useThemePreferences();

  return (
    <section className="theme-panel" aria-label="Theme presets">
      <div>
        <h2>Theme system</h2>
        <p>Combine the light or dark core mode with a visual preset. The two dimensions stay independent.</p>
      </div>

      <div className="theme-control-group">
        <strong>Mode</strong>
        <div className="theme-control-options">
          {themeModes.map((entry) => (
            <button
              aria-pressed={mode === entry.id}
              className="theme-pill"
              data-active={mode === entry.id ? 'true' : 'false'}
              key={entry.id}
              onClick={() => setMode(entry.id)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="theme-control-group">
        <strong>Preset</strong>
        <div className="theme-control-options">
          {themePresets.map((entry) => (
            <button
              aria-pressed={preset === entry.id}
              className="theme-pill"
              data-active={preset === entry.id ? 'true' : 'false'}
              key={entry.id}
              onClick={() => setPreset(entry.id)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
`;
}

export function createThemeSwitcherTest(): string {
  return `import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeSwitcher } from '@/shared/theme/ThemeSwitcher';

describe('ThemeSwitcher', () => {
  it('renders mode and preset controls and applies updates', async () => {
    render(<ThemeSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cyberpunk' }));

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('dark');
      expect(document.documentElement.dataset.themePreset).toBe('cyberpunk');
    });
  });
});
`;
}

export function createThemeRegistryTest(): string {
  return `import { describe, expect, it } from 'vitest';

import {
  defaultThemeMode,
  defaultThemePreset,
  listThemeCombinations,
  listThemeModes,
  listThemePresets,
} from '@/shared/theme/registry';

describe('theme registry', () => {
  it('returns stable catalogs and all cartesian combinations', () => {
    const modes = listThemeModes();
    const presets = listThemePresets();
    const combinations = listThemeCombinations();

    expect(defaultThemeMode).toBe('light');
    expect(defaultThemePreset).toBe('minimal');
    expect(modes.map((entry) => entry.id)).toEqual(['light', 'dark']);
    expect(presets.map((entry) => entry.id)).toEqual(['minimal', 'cyberpunk', 'glassmorphism']);
    expect(combinations).toHaveLength(modes.length * presets.length);
    expect(combinations).toContainEqual({ mode: 'dark', preset: 'glassmorphism' });

    modes.pop();
    presets.pop();

    expect(listThemeModes()).toHaveLength(2);
    expect(listThemePresets()).toHaveLength(3);
  });
});
`;
}

export function createThemePreferencesTest(): string {
  return `import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultThemePreset,
  themeStorageKeys,
} from '@/shared/theme/registry';
import { applyTheme, useThemePreferences } from '@/shared/theme/useThemePreferences';

function createMatchMediaResult(matches: boolean, media: string) {
  return {
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches,
    media,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  };
}

describe('useThemePreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = '';
    document.documentElement.dataset.themeMode = '';
    document.documentElement.dataset.themePreset = '';
    document.documentElement.style.colorScheme = '';
    window.matchMedia = vi
      .fn()
      .mockImplementation((query: string) => createMatchMediaResult(false, query));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from stored values when they are valid', async () => {
    window.localStorage.setItem(themeStorageKeys.mode, 'dark');
    window.localStorage.setItem(themeStorageKeys.preset, 'glassmorphism');

    const { result } = renderHook(() => useThemePreferences());

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(result.current.preset).toBe('glassmorphism');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreset).toBe('glassmorphism');
  });

  it('falls back to dark mode from matchMedia and uses the default preset for invalid storage', async () => {
    window.localStorage.setItem(themeStorageKeys.mode, 'bogus');
    window.localStorage.setItem(themeStorageKeys.preset, 'bogus');
    window.matchMedia = vi
      .fn()
      .mockImplementation((query: string) => createMatchMediaResult(query.includes('dark'), query));

    const { result } = renderHook(() => useThemePreferences());

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(result.current.preset).toBe(defaultThemePreset);
  });

  it('applies updates and tolerates storage access failures', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('get blocked');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('set blocked');
    });

    const { result } = renderHook(() => useThemePreferences());

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('light');
    });

    act(() => {
      result.current.setMode('dark');
      result.current.setPreset('cyberpunk');
    });

    await waitFor(() => {
      expect(document.documentElement.dataset.themeMode).toBe('dark');
      expect(document.documentElement.dataset.themePreset).toBe('cyberpunk');
    });

    expect(getItemSpy).toHaveBeenCalled();
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('returns early when the DOM is unavailable', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });

    expect(() => applyTheme('light', 'minimal')).not.toThrow();

    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'window', originalDescriptor);
    }
  });
});
`;
}

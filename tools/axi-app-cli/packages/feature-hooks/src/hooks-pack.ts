import type {
  FeatureRenderContext,
  ProjectFile,
  ScaffoldModuleManifest,
} from '@axi/scaffold-kit';
import { defineScaffoldFeature } from '@axi/scaffold-kit';

function createUseMounted(): string {
  return `import { useEffect, useState } from 'react';

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
`;
}

function createUseMountedTest(): string {
  return `import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMounted } from '@/shared/hooks/useMounted';

describe('useMounted', () => {
  it('returns true after mount', () => {
    const { result } = renderHook(() => useMounted());

    expect(result.current).toBe(true);
  });
});
`;
}

function createUseLocalStorageState(): string {
  return `import { useEffect, useState } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const rawValue = window.localStorage.getItem(key);
      return rawValue ? (JSON.parse(rawValue) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
`;
}

function createUseLocalStorageStateTest(): string {
  return `import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLocalStorageState } from '@/shared/hooks/useLocalStorageState';

describe('useLocalStorageState', () => {
  it('hydrates and persists values', () => {
    window.localStorage.setItem('axi.test', JSON.stringify('saved'));

    const { result } = renderHook(() => useLocalStorageState('axi.test', 'initial'));

    expect(result.current[0]).toBe('saved');

    act(() => {
      result.current[1]('updated');
    });

    expect(window.localStorage.getItem('axi.test')).toBe(JSON.stringify('updated'));
  });
});
`;
}

function createUseMediaQuery(): string {
  return `import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', listener);

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}
`;
}

function createUseMediaQueryTest(): string {
  return `import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

describe('useMediaQuery', () => {
  it('tracks MediaQueryList changes', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    let currentMatch = false;

    window.matchMedia = vi.fn().mockImplementation(() => ({
      addEventListener: (_event: string, callback: (event: MediaQueryListEvent) => void) => {
        listener = callback;
      },
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: currentMatch,
      media: '(min-width: 768px)',
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }));

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

    expect(result.current).toBe(false);

    act(() => {
      currentMatch = true;
      listener?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });
});
`;
}

function createUseBreakpoints(): string {
  return `import { useEffect, useMemo, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const fallbackBreakpoints: Record<Breakpoint, number> = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];

function readBreakpointValue(breakpoint: Breakpoint): number {
  if (typeof window === 'undefined') {
    return fallbackBreakpoints[breakpoint];
  }

  const rawValue = getComputedStyle(document.documentElement)
    .getPropertyValue(\`--breakpoint-\${breakpoint}\`)
    .trim();
  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) ? parsedValue : fallbackBreakpoints[breakpoint];
}

function buildBreakpointMap(): Record<Breakpoint, number> {
  return {
    xs: readBreakpointValue('xs'),
    sm: readBreakpointValue('sm'),
    md: readBreakpointValue('md'),
    lg: readBreakpointValue('lg'),
    xl: readBreakpointValue('xl'),
    '2xl': readBreakpointValue('2xl'),
  };
}

function evaluateMatches(values: Record<Breakpoint, number>, width: number): Record<Breakpoint, boolean> {
  return {
    xs: width >= values.xs,
    sm: width >= values.sm,
    md: width >= values.md,
    lg: width >= values.lg,
    xl: width >= values.xl,
    '2xl': width >= values['2xl'],
  };
}

function resolveCurrent(matches: Record<Breakpoint, boolean>): Breakpoint | null {
  let current: Breakpoint | null = null;

  for (const breakpoint of breakpointOrder) {
    if (matches[breakpoint]) {
      current = breakpoint;
    }
  }

  return current;
}

export function useBreakpoints() {
  const values = useMemo(() => buildBreakpointMap(), []);
  const [matches, setMatches] = useState<Record<Breakpoint, boolean>>(() => {
    if (typeof window === 'undefined') {
      return evaluateMatches(values, 0);
    }

    return evaluateMatches(values, window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const update = () => {
      setMatches(evaluateMatches(values, window.innerWidth));
    };

    update();
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
    };
  }, [values]);

  const current = resolveCurrent(matches);

  return {
    current,
    isAtLeast: (breakpoint: Breakpoint) => matches[breakpoint],
    isAtMost: (breakpoint: Breakpoint) => {
      const index = breakpointOrder.indexOf(breakpoint);

      return breakpointOrder.slice(index + 1).every((entry) => !matches[entry]);
    },
    matches,
  };
}
`;
}

function createUseBreakpointsTest(): string {
  return `import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBreakpoints } from '@/shared/hooks/useBreakpoints';

describe('useBreakpoints', () => {
  it('reads breakpoint tokens from the document root and reacts to resize', () => {
    document.documentElement.style.setProperty('--breakpoint-xs', '480px');
    document.documentElement.style.setProperty('--breakpoint-sm', '640px');
    document.documentElement.style.setProperty('--breakpoint-md', '768px');
    document.documentElement.style.setProperty('--breakpoint-lg', '1024px');
    document.documentElement.style.setProperty('--breakpoint-xl', '1280px');
    document.documentElement.style.setProperty('--breakpoint-2xl', '1536px');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 820,
      writable: true,
    });

    const { result } = renderHook(() => useBreakpoints());

    expect(result.current.current).toBe('md');
    expect(result.current.isAtLeast('sm')).toBe(true);
    expect(result.current.isAtMost('lg')).toBe(true);

    act(() => {
      window.innerWidth = 1400;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.current).toBe('xl');
    expect(result.current.matches.xl).toBe(true);
    expect(result.current.isAtMost('md')).toBe(false);
  });
});
`;
}

function createHooksIndex(): string {
  return `export { useBreakpoints } from './useBreakpoints';
export { useLocalStorageState } from './useLocalStorageState';
export { useMediaQuery } from './useMediaQuery';
export { useMounted } from './useMounted';
`;
}

function createHooksPackDoc(): string {
  return `# Hooks Pack

This extension module adds extra shared React hooks intended to evolve into a broader
composables-style resource layer if the scaffold grows into multi-framework presets.

Current starters:

- \`useMounted\`
- \`useLocalStorageState\`
- \`useMediaQuery\`
- \`useBreakpoints\`
`;
}

export const hooksPackManifest = {
  category: 'resources',
  configKey: 'modules.hooks-pack.enabled',
  dependencies: ['web-core', 'docs-core'],
  description: 'Shared React hooks pack that can evolve into a broader composables resource area.',
  enabledByDefault: false,
  id: 'hooks-pack',
  layer: 'extension',
  title: 'Hooks Pack',
  version: '0.1.0',
} satisfies ScaffoldModuleManifest;

function applyHooksPack(_context: FeatureRenderContext): ProjectFile[] {
  return [
    { path: 'apps/web/src/shared/hooks/index.ts', content: createHooksIndex() },
    { path: 'apps/web/src/shared/hooks/useMounted.ts', content: createUseMounted() },
    {
      path: 'apps/web/src/shared/hooks/__tests__/useMounted.test.ts',
      content: createUseMountedTest(),
    },
    {
      path: 'apps/web/src/shared/hooks/useLocalStorageState.ts',
      content: createUseLocalStorageState(),
    },
    {
      path: 'apps/web/src/shared/hooks/__tests__/useLocalStorageState.test.ts',
      content: createUseLocalStorageStateTest(),
    },
    { path: 'apps/web/src/shared/hooks/useMediaQuery.ts', content: createUseMediaQuery() },
    {
      path: 'apps/web/src/shared/hooks/__tests__/useMediaQuery.test.ts',
      content: createUseMediaQueryTest(),
    },
    { path: 'apps/web/src/shared/hooks/useBreakpoints.ts', content: createUseBreakpoints() },
    {
      path: 'apps/web/src/shared/hooks/__tests__/useBreakpoints.test.ts',
      content: createUseBreakpointsTest(),
    },
    { path: 'docs/modules/hooks-pack.md', content: createHooksPackDoc() },
  ];
}

export const hooksPackFeature = defineScaffoldFeature(hooksPackManifest, applyHooksPack);

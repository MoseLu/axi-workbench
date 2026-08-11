import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { DEFAULT_API_PROXY_TARGET, selectApiProxyTarget } from './vite.apiProxyTarget';

const VITE_CONFIG_PATH = fileURLToPath(new URL('./vite.config.ts', import.meta.url));
const VITE_PROXY_ENV_KEYS = ['VITE_API_BASE_URL', 'VITE_API_PROXY_TARGET'] as const;

type ViteProxyEnvironmentKey = typeof VITE_PROXY_ENV_KEYS[number];
type ViteProxyEnvironment = Partial<Record<ViteProxyEnvironmentKey, string>>;

async function loadApiProxyTarget(environment: ViteProxyEnvironment): Promise<string> {
  const originalEnvironment = new Map<ViteProxyEnvironmentKey, string | undefined>(
    VITE_PROXY_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of VITE_PROXY_ENV_KEYS) {
      const value = environment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, VITE_CONFIG_PATH);
    const apiProxy = loaded?.config.server?.proxy?.['/api'];
    if (!apiProxy || typeof apiProxy === 'string' || typeof apiProxy.target !== 'string') {
      throw new Error('Workbench Vite config did not expose an /api proxy target');
    }
    return apiProxy.target;
  } finally {
    for (const key of VITE_PROXY_ENV_KEYS) {
      const value = originalEnvironment.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('selectApiProxyTarget', () => {
  it.each([
    ['HTTP', ' http://127.0.0.1:9191/ ', 'http://127.0.0.1:9191/'],
    ['HTTPS', ' https://proxy.axi.example/ ', 'https://proxy.axi.example/'],
    ['HTTP shorthand', 'http:127.0.0.1:39191', 'http://127.0.0.1:39191/'],
  ])('trims and prefers an explicit %s proxy target over a loopback API base URL', (_description, apiProxyTarget, expectedTarget) => {
    expect(selectApiProxyTarget({
      apiProxyTarget,
      apiBaseURL: 'http://127.0.0.1:9090',
    })).toBe(expectedTarget);
  });

  it.each([
    ['an empty target', '', 'http://127.0.0.1:9090', 'http://127.0.0.1:9090/'],
    ['a whitespace-only target', ' \t ', 'http://127.0.0.1:9090', 'http://127.0.0.1:9090/'],
    ['a whitespace-only target without a loopback base URL', ' \n ', undefined, DEFAULT_API_PROXY_TARGET],
  ])('falls back from %s', (_description, apiProxyTarget, apiBaseURL, expectedTarget) => {
    expect(selectApiProxyTarget({ apiProxyTarget, apiBaseURL })).toBe(expectedTarget);
  });

  it.each(['not a URL', 'ftp://127.0.0.1:9191'])('rejects an invalid explicit proxy target: %s', (apiProxyTarget) => {
    expect(() => selectApiProxyTarget({ apiProxyTarget })).toThrow(/VITE_API_PROXY_TARGET/u);
  });

  it.each([
    ['localhost', 'http://localhost:9090', 'http://localhost:9090/'],
    ['IPv4 loopback', 'http://127.0.0.1:9090', 'http://127.0.0.1:9090/'],
    ['IPv6 loopback', 'http://[::1]:9090', 'http://[::1]:9090/'],
    ['IPv4 shorthand', 'http:127.0.0.1:39191', 'http://127.0.0.1:39191/'],
  ])('uses a normalized %s API base URL as the proxy target without an explicit override', (_description, apiBaseURL, expectedTarget) => {
    expect(selectApiProxyTarget({ apiBaseURL })).toBe(expectedTarget);
  });

  it.each([
    ['a remote API base URL', 'https://api.axi.example'],
    ['an invalid API base URL', 'not a URL'],
    ['a non-configured 127/8 API base URL', 'http://127.0.0.2:9090'],
  ])('falls back to the default target for %s', (_description, apiBaseURL) => {
    expect(selectApiProxyTarget({ apiBaseURL })).toBe(DEFAULT_API_PROXY_TARGET);
  });
});

describe('Workbench Vite API proxy configuration', () => {
  it('uses the loopback API base URL when an explicit target is whitespace only', async () => {
    await expect(loadApiProxyTarget({
      VITE_API_BASE_URL: 'http://127.0.0.1:9090',
      VITE_API_PROXY_TARGET: ' \t ',
    })).resolves.toBe('http://127.0.0.1:9090/');
  });

  it('normalizes a shorthand loopback API base URL before Vite uses it as a proxy target', async () => {
    await expect(loadApiProxyTarget({
      VITE_API_BASE_URL: 'http:127.0.0.1:39191',
    })).resolves.toBe('http://127.0.0.1:39191/');
  });

  it.each([
    ['a standard URL', 'http://127.0.0.1:39191'],
    ['a shorthand URL', 'http:127.0.0.1:39191'],
  ])('normalizes an explicit proxy target from %s before Vite uses it', async (_description, apiProxyTarget) => {
    await expect(loadApiProxyTarget({
      VITE_API_PROXY_TARGET: apiProxyTarget,
    })).resolves.toBe('http://127.0.0.1:39191/');
  });

  it('fails fast while loading Vite config for an invalid explicit proxy target', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(loadApiProxyTarget({
        VITE_API_PROXY_TARGET: 'not a URL',
      })).rejects.toThrow(/VITE_API_PROXY_TARGET/u);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('restores both proxy environment variables after a failed Vite config load', async () => {
    const originalBaseURL = process.env.VITE_API_BASE_URL;
    const originalProxyTarget = process.env.VITE_API_PROXY_TARGET;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      process.env.VITE_API_BASE_URL = 'base-url-sentinel';
      process.env.VITE_API_PROXY_TARGET = 'proxy-target-sentinel';

      await expect(loadApiProxyTarget({
        VITE_API_PROXY_TARGET: 'not a URL',
      })).rejects.toThrow(/VITE_API_PROXY_TARGET/u);

      expect(process.env.VITE_API_BASE_URL).toBe('base-url-sentinel');
      expect(process.env.VITE_API_PROXY_TARGET).toBe('proxy-target-sentinel');
    } finally {
      consoleError.mockRestore();
      if (originalBaseURL === undefined) delete process.env.VITE_API_BASE_URL;
      else process.env.VITE_API_BASE_URL = originalBaseURL;
      if (originalProxyTarget === undefined) delete process.env.VITE_API_PROXY_TARGET;
      else process.env.VITE_API_PROXY_TARGET = originalProxyTarget;
    }
  });
});

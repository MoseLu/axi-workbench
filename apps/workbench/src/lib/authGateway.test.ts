import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { loadConfigFromFile } from 'vite';
import { normalizeGatewayBaseURL, resolveGatewayURL } from '@axi/workbench-foundation/auth';
import { DEFAULT_API_PROXY_TARGET, selectApiProxyTarget } from './apiProxyTarget';

const VITE_IPV4_ORIGIN = 'http://127.0.0.1:5173';
const VITE_CONFIG_PATH = fileURLToPath(new URL('../../vite.config.ts', import.meta.url));
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

// The Vite dev server binds only to VITE_IPV4_ORIGIN. Other loopback origins
// below exercise pure URL normalization, not additional listening endpoints.

describe('normalizeGatewayBaseURL', () => {
  it.each([
    ['a localhost Gateway from a localhost origin', 'http://localhost:8088', 'http://localhost:5173'],
    ['a localhost Gateway from the IPv4 Vite origin', 'http://localhost:8088', VITE_IPV4_ORIGIN],
    ['an IPv4 Gateway from a localhost origin', 'http://127.0.0.1:8088', 'http://localhost:5173'],
    ['an IPv6 Gateway from the IPv4 Vite origin', 'http://[::1]:8088', VITE_IPV4_ORIGIN],
    ['a localhost Gateway from an IPv6 origin', 'http://localhost:8088', 'http://[::1]:5173'],
    ['an HTTPS localhost Gateway from the IPv4 Vite origin', 'https://localhost:8443', VITE_IPV4_ORIGIN],
  ])('uses the same-origin Vite proxy for the pure loopback URL pair: %s', (_description, configuredBaseURL, browserOrigin) => {
    expect(normalizeGatewayBaseURL(configuredBaseURL, browserOrigin)).toBe('');
  });

  it.each([
    ['a remote gateway URL includes a trailing slash', 'https://api.axi.example/', VITE_IPV4_ORIGIN],
    ['the browser origin is remote', 'http://127.0.0.1:8088/', 'https://workbench.axi.example'],
    ['the Gateway uses a non-configured 127/8 hostname', 'http://127.0.0.2:8088', VITE_IPV4_ORIGIN],
    ['the configured gateway URL is invalid', 'not a URL/', VITE_IPV4_ORIGIN],
    ['the browser origin is invalid', 'http://127.0.0.1:8088/', 'not an origin'],
  ])('preserves the configured gateway URL byte-for-byte when %s', (_description, configuredBaseURL, browserOrigin) => {
    expect(normalizeGatewayBaseURL(configuredBaseURL, browserOrigin)).toBe(configuredBaseURL);
  });
});

describe('resolveGatewayURL', () => {
  it('removes a configured trailing slash only while joining the request path', () => {
    expect(resolveGatewayURL('/api/v1/auth/session', 'https://api.axi.example/')).toBe('https://api.axi.example/api/v1/auth/session');
  });
});

describe('selectApiProxyTarget', () => {
  it.each([
    ['HTTP', ' http://127.0.0.1:9191/ ', 'http://127.0.0.1:9191/'],
    ['HTTPS', ' https://proxy.axi.example/ ', 'https://proxy.axi.example/'],
  ])('trims and prefers an explicit %s proxy target over a loopback API base URL', (_description, apiProxyTarget, expectedTarget) => {
    expect(selectApiProxyTarget({
      apiProxyTarget,
      apiBaseURL: 'http://127.0.0.1:9090',
    })).toBe(expectedTarget);
  });

  it.each([
    ['an empty target', '', 'http://127.0.0.1:9090', 'http://127.0.0.1:9090'],
    ['a whitespace-only target', ' \t ', 'http://127.0.0.1:9090', 'http://127.0.0.1:9090'],
    ['a whitespace-only target without a loopback base URL', ' \n ', undefined, DEFAULT_API_PROXY_TARGET],
  ])('falls back from %s', (_description, apiProxyTarget, apiBaseURL, expectedTarget) => {
    expect(selectApiProxyTarget({ apiProxyTarget, apiBaseURL })).toBe(expectedTarget);
  });

  it.each(['not a URL', 'ftp://127.0.0.1:9191'])('rejects an invalid explicit proxy target: %s', (apiProxyTarget) => {
    expect(() => selectApiProxyTarget({ apiProxyTarget })).toThrow(/VITE_API_PROXY_TARGET/u);
  });

  it.each([
    ['localhost', 'http://localhost:9090'],
    ['IPv4 loopback', 'http://127.0.0.1:9090'],
    ['IPv6 loopback', 'http://[::1]:9090'],
  ])('uses a %s API base URL as the proxy target without an explicit override', (_description, apiBaseURL) => {
    expect(selectApiProxyTarget({ apiBaseURL })).toBe(apiBaseURL);
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
    })).resolves.toBe('http://127.0.0.1:9090');
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
});

import { describe, expect, it } from 'vitest';
import { normalizeGatewayBaseURL, resolveGatewayURL } from '@axi/workbench-foundation/auth';
import { DEFAULT_API_PROXY_TARGET, selectApiProxyTarget } from './apiProxyTarget';

const VITE_IPV4_ORIGIN = 'http://127.0.0.1:5173';

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
  it('prefers an explicit proxy target over a loopback API base URL', () => {
    expect(selectApiProxyTarget({
      apiProxyTarget: 'http://127.0.0.1:9191',
      apiBaseURL: 'http://127.0.0.1:9090',
    })).toBe('http://127.0.0.1:9191');
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

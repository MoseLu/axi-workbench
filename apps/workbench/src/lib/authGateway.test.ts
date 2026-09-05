import { describe, expect, it } from 'vitest';
import { normalizeGatewayBaseURL, resolveGatewayURL } from '@axi/workbench-foundation/auth';

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

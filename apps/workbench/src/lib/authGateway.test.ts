import { describe, expect, it } from 'vitest';
import { normalizeGatewayBaseURL } from '@axi/workbench-foundation/auth';

describe('normalizeGatewayBaseURL', () => {
  it.each([
    ['localhost on different ports and schemes', 'http://localhost:8088', 'https://localhost:5173'],
    ['localhost and IPv4 loopback', 'https://localhost:8088', 'http://127.0.0.1:5173'],
    ['IPv6 loopback', 'http://[::1]:8088', 'https://[::1]:5173'],
  ])('uses the same-origin Vite proxy for %s', (_description, configuredBaseURL, browserOrigin) => {
    expect(normalizeGatewayBaseURL(configuredBaseURL, browserOrigin)).toBe('');
  });

  it.each([
    ['a remote gateway', 'https://api.axi.example', 'http://127.0.0.1:5173'],
    ['a remote browser origin', 'http://127.0.0.1:8088', 'https://workbench.axi.example'],
  ])('preserves the configured gateway URL when %s', (_description, configuredBaseURL, browserOrigin) => {
    expect(normalizeGatewayBaseURL(configuredBaseURL, browserOrigin)).toBe(configuredBaseURL);
  });

  it.each([
    ['the configured gateway URL is invalid', 'not a URL', 'http://127.0.0.1:5173'],
    ['the browser origin is invalid', 'http://127.0.0.1:8088', 'not an origin'],
  ])('preserves the configured gateway URL when %s', (_description, configuredBaseURL, browserOrigin) => {
    expect(normalizeGatewayBaseURL(configuredBaseURL, browserOrigin)).toBe(configuredBaseURL);
  });
});

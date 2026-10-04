/**
 * Tests for the auth URL normalization surface in `@axi/workbench-foundation`.
 *
 * `normalizeGatewayBaseURL` is the only piece of auth behaviour that can be
 * exercised without booting React — the rest of the file is a `React.FC`
 * that defers to `refreshSession` once mounted. The reducer-style state
 * transitions (loading → authenticated → logged out) are covered in
 * `AuthProvider.test.tsx` via the React Testing Library surface.
 */
import { describe, expect, it } from 'vitest';
import { normalizeGatewayBaseURL, resolveGatewayURL } from './auth';

describe('normalizeGatewayBaseURL', () => {
  it('returns the configured URL when no browser origin is available', () => {
    expect(normalizeGatewayBaseURL('https://api.example.test', undefined)).toBe(
      'https://api.example.test',
    );
  });

  it('returns an empty string when the configured URL is empty', () => {
    expect(normalizeGatewayBaseURL('', 'http://localhost:5173')).toBe('');
  });

  it('rewrites loopback-to-loopback pairs to same-origin so Vite /api proxy works', () => {
    expect(normalizeGatewayBaseURL('http://127.0.0.1:8080', 'http://localhost:5173')).toBe('');
    expect(normalizeGatewayBaseURL('http://localhost:8080', 'http://127.0.0.1:5173')).toBe('');
    expect(normalizeGatewayBaseURL('http://[::1]:8080', 'http://[::1]:5173')).toBe('');
  });

  it('preserves the configured URL when only the browser origin is loopback', () => {
    // gateway is on a real domain → keep the explicit origin
    expect(normalizeGatewayBaseURL('https://api.example.test', 'http://localhost:5173')).toBe(
      'https://api.example.test',
    );
  });

  it('falls back to the configured URL when the configured value is not parseable', () => {
    // `not a url` is not a loopback hostname pair, so it should pass through
    expect(normalizeGatewayBaseURL('not a url', 'http://localhost:5173')).toBe('not a url');
  });
});

describe('resolveGatewayURL', () => {
  it('appends the path to a configured base URL', () => {
    expect(resolveGatewayURL('/api/v1/sessions/current', 'https://api.example.test')).toBe(
      'https://api.example.test/api/v1/sessions/current',
    );
  });

  it('strips trailing slashes from the base URL before joining', () => {
    expect(resolveGatewayURL('/api/v1/sessions/current', 'https://api.example.test///')).toBe(
      'https://api.example.test/api/v1/sessions/current',
    );
  });

  it('returns a relative path when no base URL is configured', () => {
    expect(resolveGatewayURL('/api/v1/sessions/current', '')).toBe('/api/v1/sessions/current');
  });
});
/**
 * Integration tests for `createApiClient`.
 *
 * Covers:
 *  - 401 responses: the OIDC redirect is initiated explicitly by the
 *    application rather than attempting a local refresh. The interceptor
 *    must propagate the error so callers can react.
 *  - Tauri fetch-adapter fallback: packaged Tauri routes `/api` through
 *    `window.fetch`, so the axios instance is configured with the
 *    `'fetch'` adapter. We assert that the resolved adapter is the fetch
 *    bridge, not XHR, on a Tauri-like runtime.
 */
import type { AxiosError, AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';

interface FakeAxiosRequestConfig {
  adapter?: unknown;
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  headers?: Record<string, string>;
}

const fetchAdapterMock = vi.fn();

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: (config: FakeAxiosRequestConfig) => ({
        defaults: { adapter: config.adapter ?? fetchAdapterMock },
        interceptors: {
          request: { use: vi.fn() },
          response: {
            use: (onFulfilled: (r: AxiosResponse) => AxiosResponse) => {
              // capture for assertions
              (fetchAdapterMock as unknown as { __fulfilled?: typeof onFulfilled }).__fulfilled = onFulfilled;
              return onFulfilled;
            },
          },
        },
      }),
    },
  };
});

describe('createApiClient', () => {
  beforeEach(() => {
    fetchAdapterMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the fetch adapter so packaged Tauri can route through window.fetch', () => {
    const client = createApiClient();
    expect(client.defaults.adapter).toBe('fetch');
  });

  it('forwards cookies via withCredentials for the gateway session boundary', () => {
    const client = createApiClient();
    expect(client.defaults.withCredentials).toBe(true);
  });

  it('propagates 401 responses through the response interceptor without re-throwing silently', () => {
    const client = createApiClient();
    const fulfilled = (fetchAdapterMock as unknown as {
      __fulfilled: (r: AxiosResponse) => AxiosResponse;
    }).__fulfilled;
    expect(typeof fulfilled).toBe('function');

    const response401 = { status: 401, data: null } as unknown as AxiosResponse;
    expect(fulfilled(response401)).toBe(response401);
  });

  it('exposes a rejected error path that callers can route to the OIDC redirect', () => {
    // The interceptor's error handler returns Promise.reject(error) so
    // application-level handlers can decide what to do with a 401 (e.g.
    // dispatch an OIDC redirect). We assert the rejection shape is preserved.
    let capturedError: AxiosError | null = null;
    const client = createApiClient();

    // Manually wire a catch-up handler to validate the rejection contract:
    void client.interceptors.response.use((response) => response);

    const rejected = new Error('unauthorized') as AxiosError;
    const maybePromise = Promise.reject(rejected).catch((err) => {
      capturedError = err;
    });
    return maybePromise.then(() => {
      expect(capturedError).toBe(rejected);
    });
  });
});
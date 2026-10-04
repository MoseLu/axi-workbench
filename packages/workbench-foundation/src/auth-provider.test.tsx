/**
 * AuthProvider reducer-style transition tests.
 *
 * The reducer surface lives in `useState`/`useCallback` hooks inside
 * AuthProvider rather than a Redux-style `reduce` function. We exercise the
 * same state transitions (loading → authenticated, refresh on 401, logout)
 * by mounting the provider and observing `useAuth()` across async
 * transitions, with `fetch` mocked via `vi.fn`.
 */
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { AuthProvider, useAuth } from './auth';

function jsonResponse(body: unknown, init?: { status?: number; ok?: boolean }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  } as unknown as Response;
}

function AuthProbe({ onReady }: { onReady: (api: ReturnType<typeof useAuth>) => void }) {
  const api = useAuth();
  React.useEffect(() => {
    onReady(api);
  }, [api]);
  return null;
}

describe('AuthProvider reducer transitions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in the loading state and resolves to unauthenticated on a 401 session probe', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 401, ok: false }));

    let snapshot: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthProbe onReady={(api) => (snapshot = api)} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(snapshot?.isLoading).toBe(false);
    });
    expect(snapshot?.isAuthenticated).toBe(false);
    expect(snapshot?.user).toBeNull();
  });

  it('resolves to authenticated when the session probe returns a user', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        authenticated: true,
        user: { subject: 'sub-1', email: 'user@example.test', name: 'User' },
      }),
    );

    let snapshot: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthProbe onReady={(api) => (snapshot = api)} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(snapshot?.isAuthenticated).toBe(true);
    });
    expect(snapshot?.user).toMatchObject({
      id: 'sub-1',
      email: 'user@example.test',
    });
  });

  it('logout() clears the user even if the upstream DELETE fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          authenticated: true,
          user: { subject: 'sub-1', email: 'user@example.test' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({}, { status: 500, ok: false }));

    let snapshot: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <AuthProbe onReady={(api) => (snapshot = api)} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(snapshot?.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await snapshot!.logout();
    });

    expect(snapshot?.isAuthenticated).toBe(false);
    expect(snapshot?.user).toBeNull();
  });
});
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffFetch } from './backoffFetch';

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('backoffFetch', () => {
  it('returns the response unchanged when it succeeds on first try', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await backoffFetch('/api/x', { backoff: { maxRetries: 3 } });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry 4xx — returns the response without backoff', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await backoffFetch('/api/x', { backoff: { maxRetries: 3 } });
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx up to maxRetries and eventually returns the last response', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const onRetry = vi.fn();
    const response = await backoffFetch('/api/x', {
      backoff: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2, onRetry },
    });
    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('retries on network error and surfaces BackoffError after exhaustion', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNRESET'); });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      backoffFetch('/api/x', { backoff: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 2 } }),
    ).rejects.toMatchObject({ name: 'BackoffError', status: null, attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors AbortSignal between retries', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const ac = new AbortController();
    const promise = backoffFetch('/api/x', {
      backoff: { maxRetries: 5, baseDelayMs: 1, maxDelayMs: 2 },
      signal: ac.signal,
    });
    setTimeout(() => ac.abort(), 0);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

/**
 * backoffFetch — shared retry+backoff wrapper around the global fetch.
 *
 * Goals:
 *   - 5xx and network errors get exponential backoff with jitter.
 *   - 4xx is treated as a hard error (no retry, immediate throw).
 *   - Bounded by maxRetries so a misbehaving stub backend can't be hammered
 *     forever; once retries are exhausted, callers can either fall back to a
 *     local degraded value or surface a `BackoffError` to upstream catch.
 *   - Honors the caller-supplied AbortSignal on every retry attempt.
 *
 * No third-party deps. Runs in the browser (Login.tsx, useNavBadges) and in
 * vitest (jsdom + node test env). Pure ESM, no React, no DOM globals beyond
 * AbortSignal/AbortController (available in Node 18+ and jsdom).
 */

export interface BackoffOptions {
  /** Total number of retries (not counting the initial attempt). Default 5. */
  maxRetries?: number;
  /** First retry delay in ms. Default 1000. */
  baseDelayMs?: number;
  /** Hard cap on a single retry delay in ms. Default 16000. */
  maxDelayMs?: number;
  /** Decide which HTTP statuses are retriable. Default: 5xx. */
  shouldRetry?: (status: number) => boolean;
  /** Hook fired before each retry sleep; useful for tests + telemetry. */
  onRetry?: (attempt: number, delayMs: number, status: number | null) => void;
}

export interface BackoffError extends Error {
  readonly name: 'BackoffError';
  readonly status: number | null;
  readonly attempts: number;
  readonly lastError?: unknown;
}

function makeBackoffError(status: number | null, attempts: number, lastError?: unknown): BackoffError {
  const err: BackoffError = Object.assign(
    new Error(
      status === null
        ? `backoffFetch: gave up after ${attempts} attempt(s) (network error)`
        : `backoffFetch: gave up after ${attempts} attempt(s); last status ${status}`,
    ),
    {
      name: 'BackoffError' as const,
      status,
      attempts,
      lastError,
    },
  );
  return err;
}

function defaultShouldRetry(status: number): boolean {
  return status >= 500 && status <= 599;
}

function nextDelay(attempt: number, base: number, cap: number): number {
  // Exponential 2^(attempt-1) * base, capped, plus up to ±25% jitter.
  const raw = Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = raw * (Math.random() * 0.5 - 0.25); // -25% .. +25%
  return Math.max(0, Math.floor(raw + jitter));
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(makeAbortError());
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(makeAbortError());
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort);
  });
}

function makeAbortError(): Error {
  const err: Error & { name: string } = new Error('backoffFetch: aborted');
  err.name = 'AbortError';
  return err;
}

export type BackoffFetchInit = RequestInit & { backoff?: BackoffOptions };

/**
 * Fetch with retry. Returns the final Response (so callers can inspect
 * `response.ok` themselves). Throws `BackoffError` if all retries fail; the
 * original fetch error is preserved on `err.lastError`.
 */
export async function backoffFetch(input: RequestInfo | URL, init: BackoffFetchInit = {}): Promise<Response> {
  const { backoff = {}, ...rest } = init;
  const maxRetries = Math.max(0, backoff.maxRetries ?? 5);
  const baseDelayMs = Math.max(0, backoff.baseDelayMs ?? 1000);
  const maxDelayMs = Math.max(baseDelayMs, backoff.maxDelayMs ?? 16000);
  const shouldRetry = backoff.shouldRetry ?? defaultShouldRetry;
  const onRetry = backoff.onRetry;
  const signal = rest.signal;

  let attempt = 0;
  let lastStatus: number | null = null;
  let lastError: unknown;

  while (true) {
    if (signal?.aborted) throw makeAbortError();
    attempt += 1;
    try {
      const response = await fetch(input, rest);
      if (!shouldRetry(response.status) || attempt > maxRetries + 1) {
        return response;
      }
      lastStatus = response.status;
      // Drain the body so the connection can be reused; ignore parsing errors.
      try { await response.arrayBuffer(); } catch { /* ignore */ }
      if (attempt > maxRetries) return response;
      const delay = nextDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt, delay, lastStatus);
      await sleep(delay, signal);
    } catch (cause: unknown) {
      // AbortSignal abort — propagate immediately, never retry.
      if (signal?.aborted) throw makeAbortError();
      lastStatus = null;
      lastError = cause;
      if (attempt > maxRetries) throw makeBackoffError(null, attempt, cause);
      const delay = nextDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt, delay, null);
      await sleep(delay, signal);
    }
  }
}

/** Convenience alias that mirrors `fetch` semantics but adds backoff. */
export const fetchWithBackoff = backoffFetch;

export default backoffFetch;

import type { ProviderFailure } from "@axi/gateway-contracts";
import { decideRetry, type RetryDecision } from "@axi/gateway-contracts";

/**
 * GHA-033 — retry / backoff scheduler.
 *
 * Wraps contracts/runtime.decideRetry with a deterministic delay
 * scheduler. The dispatcher calls `scheduleRetry(decision)` to obtain a
 * promise that resolves when the backoff window has elapsed. The
 * scheduler respects cancellation: if the parent AbortSignal fires
 * before the delay finishes, the promise rejects with `cancelled` so
 * the dispatcher exits without performing another attempt.
 *
 * Retryable predicate (retryable && routeIdempotent) is enforced in
 * decideRetry itself; this module only adds the timing layer and a
 * thin wrapper for the dispatcher's call site.
 */

const delayWithSignal = (ms: number, signal: AbortSignal | undefined): Promise<void> => {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (typeof timer.unref === "function") timer.unref();
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
};

export interface ScheduleRetryInput {
  readonly decision: RetryDecision;
  readonly signal?: AbortSignal;
}

/** Returns a promise that resolves after the retry's `delayMs` window.
 *  When the decision is `stop`, the promise resolves immediately so
 *  callers can treat both branches uniformly. */
export const scheduleRetry = async (input: ScheduleRetryInput): Promise<void> => {
  if (input.decision.action !== "retry") return;
  await delayWithSignal(input.decision.delayMs, input.signal);
};

export interface RetryPolicyInput {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly maxBackoffMs: number;
  readonly failure: ProviderFailure;
  readonly routeIdempotent: boolean;
}

/** Compute the next retry decision for the dispatcher. Pulls the
 *  pure-function from contracts so the wire-format and the dispatcher
 *  stay aligned. */
export const retryDecisionFor = (input: RetryPolicyInput): RetryDecision => decideRetry({
  attempt: input.attempt,
  maxAttempts: input.maxAttempts,
  retryable: input.failure.retryable,
  routeIdempotent: input.routeIdempotent,
  backoffMs: input.backoffMs,
  maxBackoffMs: input.maxBackoffMs,
});

/** Convenience: was this decision a "retry" outcome? Useful for the
 *  dispatcher's main loop. */
export const isRetry = (decision: RetryDecision): boolean => decision.action === "retry";
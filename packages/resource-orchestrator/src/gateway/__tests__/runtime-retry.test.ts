import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyResultFailure, classifyFailure } from "../runtime/failure";
import { isRetry, retryDecisionFor, scheduleRetry } from "../runtime/retry";

describe("retryDecisionFor", () => {
  const okPolicy = {
    attempt: 1,
    maxAttempts: 3,
    backoffMs: 100,
    maxBackoffMs: 1_000,
    failure: classifyFailure({ error: { status: 503 }, targetId: "t", routeId: "r", attempt: 1, cancelled: false }),
    routeIdempotent: true,
  };

  it("retries a retryable + idempotent failure within the budget", () => {
    const decision = retryDecisionFor(okPolicy);
    expect(decision.action).toBe("retry");
    if (decision.action === "retry") {
      expect(decision.attempt).toBe(2);
      expect(decision.delayMs).toBeGreaterThanOrEqual(0);
      expect(decision.reason).toBe("transient_failure");
    }
  });

  it("stops when the route is non-idempotent", () => {
    const decision = retryDecisionFor({ ...okPolicy, routeIdempotent: false });
    expect(decision.action).toBe("stop");
    if (decision.action === "stop") {
      expect(decision.reason).toBe("non_idempotent_route");
    }
  });

  it("stops when the failure is non-retryable", () => {
    const decision = retryDecisionFor({ ...okPolicy, failure: emptyResultFailure("t", "r", 1) });
    expect(decision.action).toBe("stop");
    if (decision.action === "stop") {
      expect(decision.reason).toBe("non_retryable_failure");
    }
  });

  it("stops when maxAttempts is reached", () => {
    const decision = retryDecisionFor({ ...okPolicy, attempt: 3 });
    expect(decision.action).toBe("stop");
    if (decision.action === "stop") {
      expect(decision.reason).toBe("max_attempts_exceeded");
    }
  });
});

describe("scheduleRetry", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("resolves immediately for a stop decision", async () => {
    const start = Date.now();
    await scheduleRetry({ decision: { action: "stop", attempt: 1, reason: "max_attempts_exceeded" } });
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("delays by the decision's delayMs for retry", async () => {
    vi.useFakeTimers();
    const promise = scheduleRetry({ decision: { action: "retry", attempt: 2, delayMs: 250, reason: "transient_failure" } });
    vi.advanceTimersByTime(250);
    await promise;
  });

  it("aborts the delay when the signal fires", async () => {
    vi.useFakeTimers();
    const ctrl = new AbortController();
    const promise = scheduleRetry({ decision: { action: "retry", attempt: 2, delayMs: 5_000, reason: "transient_failure" }, signal: ctrl.signal });
    setTimeout(() => ctrl.abort(new Error("cancelled")), 10);
    vi.advanceTimersByTime(20);
    await expect(promise).rejects.toThrow("cancelled");
  });
});

describe("isRetry", () => {
  it("identifies retry decisions", () => {
    expect(isRetry({ action: "retry", attempt: 2, delayMs: 100, reason: "transient_failure" })).toBe(true);
    expect(isRetry({ action: "stop", attempt: 1, reason: "max_attempts_exceeded" })).toBe(false);
  });
});
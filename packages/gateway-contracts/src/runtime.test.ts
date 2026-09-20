import { describe, expect, it } from "vitest";
import {
  cacheKeySchema,
  cacheScopeSchema,
  coalescingDecisionSchema,
  coalescingKeySchema,
  decideBackpressure,
  decideCoalescing,
  decideRetry,
  hashCacheKey,
  retryDecisionSchema,
  runtimeContractVersion,
} from "./runtime";

/**
 * Retry / backpressure / cache / coalescing runtime contract tests.
 *
 * Pin the pure decision functions and the closed enums. The
 * dispatcher uses these in production; tests here make sure the
 * semantics don't drift.
 */

describe("retry/backpressure/cache/coalescing runtime contract", () => {
  it("pins the runtime contract version", () => {
    expect(runtimeContractVersion).toBe(1);
  });

  it("covers the cache scope enum", () => {
    expect(cacheScopeSchema.options).toEqual(["route-payload", "request-key", "route-only"]);
  });

  it("allows retry up to maxAttempts then stops", () => {
    const first = decideRetry({ attempt: 1, maxAttempts: 3, retryable: true, routeIdempotent: true, backoffMs: 100, maxBackoffMs: 1000 });
    expect(first.action).toBe("retry");
    if (first.action === "retry") {
      expect(first.attempt).toBe(2);
      expect(first.delayMs).toBeGreaterThanOrEqual(100);
    }

    const last = decideRetry({ attempt: 2, maxAttempts: 3, retryable: true, routeIdempotent: true, backoffMs: 100, maxBackoffMs: 1000 });
    expect(last.action).toBe("retry");
    if (last.action === "retry") {
      expect(last.attempt).toBe(3);
    }

    const stop = decideRetry({ attempt: 3, maxAttempts: 3, retryable: true, routeIdempotent: true, backoffMs: 100, maxBackoffMs: 1000 });
    expect(stop.action).toBe("stop");
    expect(stop.reason).toBe("max_attempts_exceeded");
  });

  it("refuses to retry non-retryable failures even when attempts remain", () => {
    const result = decideRetry({ attempt: 1, maxAttempts: 5, retryable: false, routeIdempotent: true, backoffMs: 100, maxBackoffMs: 1000 });
    expect(result.action).toBe("stop");
    expect(result.reason).toBe("non_retryable_failure");
  });

  it("refuses to retry non-idempotent routes even when the failure is retryable", () => {
    const result = decideRetry({ attempt: 1, maxAttempts: 5, retryable: true, routeIdempotent: false, backoffMs: 100, maxBackoffMs: 1000 });
    expect(result.action).toBe("stop");
    expect(result.reason).toBe("non_idempotent_route");
  });

  it("caps the exponential backoff at maxBackoffMs", () => {
    const result = decideRetry({ attempt: 6, maxAttempts: 8, retryable: true, routeIdempotent: true, backoffMs: 100, maxBackoffMs: 500 });
    expect(result.action).toBe("retry");
    if (result.action === "retry") expect(result.delayMs).toBeLessThanOrEqual(500);
  });

  it("accepts a retry decision envelope", () => {
    const result = retryDecisionSchema.safeParse({ action: "retry", attempt: 2, delayMs: 250, reason: "transient_failure" });
    expect(result.success).toBe(true);
    const stop = retryDecisionSchema.safeParse({ action: "stop", attempt: 3, reason: "max_attempts_exceeded" });
    expect(stop.success).toBe(true);
  });

  it("admits a call when in-flight is below the semaphore", () => {
    const result = decideBackpressure({ inFlight: 1, queued: 0, maxConcurrent: 4, queueTimeoutMs: 1000 });
    expect(result.action).toBe("proceed");
  });

  it("queues a call when at capacity but the queue has room", () => {
    const result = decideBackpressure({ inFlight: 4, queued: 1, maxConcurrent: 4, queueTimeoutMs: 1000 });
    expect(result.action).toBe("queue");
    if (result.action === "queue") {
      expect(result.position).toBe(2);
      expect(result.queueTimeoutMs).toBe(1000);
    }
  });

  it("rejects a call when both the semaphore and the queue are full", () => {
    const result = decideBackpressure({ inFlight: 4, queued: 4, maxConcurrent: 4, queueTimeoutMs: 1000 });
    expect(result.action).toBe("reject");
    if (result.action === "reject") {
      expect(result.reason).toBe("queue_full");
      expect(result.retryAfterMs).toBe(1000);
    }
  });

  it("parses a versioned cache key", () => {
    const result = cacheKeySchema.safeParse({
      scope: "route-payload",
      routeId: "route.image",
      hash: "0123456789abcdef",
      manifestVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty cache hash", () => {
    const result = cacheKeySchema.safeParse({
      scope: "route-payload",
      routeId: "route.image",
      hash: "",
      manifestVersion: 1,
    });
    expect(result.success).toBe(false);
  });

  it("hashes a stable string deterministically", () => {
    const a = hashCacheKey("route.image|hello world");
    const b = hashCacheKey("route.image|hello world");
    const c = hashCacheKey("route.image|hello world!");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("parses a coalescing key", () => {
    const result = coalescingKeySchema.safeParse({
      routeId: "route.image",
      idempotencyKey: "gw-abc-123",
      manifestVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  it("joins an in-flight call when the key matches", () => {
    const result = decideCoalescing({
      policy: "idempotency",
      inFlightForKey: [{ routeId: "route.image", key: "k1", manifestVersion: 1 }],
      thisRouteId: "route.image",
      thisKey: "k1",
      thisManifestVersion: 1,
    });
    expect(result.action).toBe("join");
  });

  it("starts a new call when the route differs", () => {
    const result = decideCoalescing({
      policy: "idempotency",
      inFlightForKey: [{ routeId: "route.image", key: "k1", manifestVersion: 1 }],
      thisRouteId: "route.document",
      thisKey: "k1",
      thisManifestVersion: 1,
    });
    expect(result.action).toBe("start");
    if (result.action === "start") expect(result.reason).toBe("different_route");
  });

  it("starts a new call when the manifest version differs", () => {
    const result = decideCoalescing({
      policy: "idempotency",
      inFlightForKey: [{ routeId: "route.image", key: "k1", manifestVersion: 1 }],
      thisRouteId: "route.image",
      thisKey: "k1",
      thisManifestVersion: 2,
    });
    expect(result.action).toBe("start");
    if (result.action === "start") expect(result.reason).toBe("different_version");
  });

  it("disables coalescing when the policy is none", () => {
    const result = decideCoalescing({
      policy: "none",
      inFlightForKey: [{ routeId: "route.image", key: "k1", manifestVersion: 1 }],
      thisRouteId: "route.image",
      thisKey: "k1",
      thisManifestVersion: 1,
    });
    expect(result.action).toBe("disabled");
  });

  it("accepts a coalescing decision envelope", () => {
    const result = coalescingDecisionSchema.safeParse({ action: "join", shareCount: 3 });
    expect(result.success).toBe(true);
  });
});
/**
 * SharedStateManager contract + noop implementation tests.
 *
 * GHA-NEXT-020 — Phase D / P0 — L1 focused contract/noop tests
 *
 * These tests verify:
 *   1. All six store interfaces are structurally present and callable on
 *      a `SharedStateManager` returned by `createNoopSharedStateManager`.
 *   2. `configFromEnv` parses every `GATEWAY_SHARED_*` variable with correct
 *      defaults and overrides.
 *   3. Fail-open / fail-closed policies are correctly encoded in the config
 *      object (the policy enforcement itself lives in the orchestrator's
 *      dispatch path; the store layer only reports availability).
 *   4. `isEnabled` correctly reflects whether a store URL was configured.
 *   5. `dispose()` is idempotent (calling twice does not throw).
 *   6. `createUnreachableSharedStateManager` simulates a configured-but-unreachable
 *      store and all `isAvailable()` calls return `false`.
 *
 * These are L1 tests only. L2 tests (real Valkey / integration harness)
 * are covered by GHA-NEXT-021 through GHA-NEXT-028.
 */

import { describe, expect, it } from "vitest";
import {
  createNoopSharedStateManager,
  createUnreachableSharedStateManager,
  noopBreakerStore,
  noopRateLimitStore,
  noopIdempotencyStore,
  noopCacheStore,
  noopSnapshotStore,
  noopCoalesceStore,
} from "../shared-state";
import { configFromEnv } from "../shared-state/shared-state-manager";
import type {
  SharedStateManager,
  SharedStateConfig,
  BreakerStore,
  RateLimitStore,
  IdempotencyStore,
  CacheStore,
  SnapshotStore,
  CoalesceStore,
} from "../shared-state/shared-state-manager";
import type { BreakerSnapshot } from "../circuit-breaker";

// ---------------------------------------------------------------------------
// Structural presence tests
// ---------------------------------------------------------------------------

describe("SharedStateManager structural presence", () => {
  it("exposes all six store roles", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(typeof mgr.breaker).toBe("object");
    expect(typeof mgr.rateLimit).toBe("object");
    expect(typeof mgr.idempotency).toBe("object");
    expect(typeof mgr.cache).toBe("object");
    expect(typeof mgr.snapshot).toBe("object");
    expect(typeof mgr.coalesce).toBe("object");
  });

  it("exposes `isEnabled` and `dispose`", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(typeof mgr.isEnabled).toBe("boolean");
    expect(typeof mgr.dispose).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Individual store interface contracts
// ---------------------------------------------------------------------------

describe("BreakerStore contract", () => {
  const store = noopBreakerStore();

  it("getState returns undefined (never seen)", () => {
    expect(store.getState("image-factory")).toBeUndefined();
  });

  it("record does not throw", () => {
    expect(() => store.record("image-factory", true)).not.toThrow();
    expect(() => store.record("image-factory", false)).not.toThrow();
  });

  it("record accepts optional `now` parameter", () => {
    expect(() => store.record("image-factory", true, 1_000_000_000)).not.toThrow();
  });

  it("tryClose returns false (noop never closes)", () => {
    expect(store.tryClose("image-factory")).toBe(false);
  });

  it("snapshotAll returns an empty Map", () => {
    expect(store.snapshotAll()).toBeInstanceOf(Map);
    expect(store.snapshotAll().size).toBe(0);
  });

  it("isAvailable returns false (noop)", () => {
    expect(store.isAvailable()).toBe(false);
  });
});

describe("RateLimitStore contract", () => {
  const store = noopRateLimitStore();

  it("checkAndIncrement resolves with allowed=true (fail-open)", async () => {
    const result = await store.checkAndIncrement("user_abc", 10, 60_000);
    expect(result.allowed).toBe(true);
    expect(typeof result.remaining).toBe("number");
    expect(typeof result.resetAt).toBe("number");
  });

  it("checkAndIncrement works with arbitrary key/limit/window", async () => {
    const result = await store.checkAndIncrement("provider_xyz", 1, 1_000);
    expect(result.allowed).toBe(true);
  });

  it("reset resolves without error", async () => {
    await expect(store.reset("user_abc")).resolves.toBeUndefined();
  });

  it("isAvailable returns false (noop)", () => {
    expect(store.isAvailable()).toBe(false);
  });
});

describe("IdempotencyStore contract", () => {
  const store = noopIdempotencyStore();

  it("tryAcquire always returns true (caller proceeds)", async () => {
    await expect(store.tryAcquire("req_abc_v1_hash", 30_000)).resolves.toBe(true);
  });

  it("tryAcquire works with any TTL value", async () => {
    await expect(store.tryAcquire("req_abc_v1_hash", 5_000)).resolves.toBe(true);
    await expect(store.tryAcquire("req_abc_v1_hash", 120_000)).resolves.toBe(true);
  });

  it("release resolves without error", async () => {
    await expect(store.release("req_abc_v1_hash")).resolves.toBeUndefined();
  });

  it("getResult returns undefined (no cached result)", async () => {
    await expect(store.getResult("req_abc_v1_hash")).resolves.toBeUndefined();
  });

  it("setResult resolves without error", async () => {
    const fakeResult = {
      items: [],
      sourceVersion: "0",
      confidence: "high" as const,
      mode: "live" as const,
    };
    await expect(store.setResult("req_abc_v1_hash", fakeResult, 60_000)).resolves.toBeUndefined();
  });

  it("isAvailable returns false (noop)", () => {
    expect(store.isAvailable()).toBe(false);
  });
});

describe("CacheStore contract", () => {
  const store = noopCacheStore();

  const fakeKey = {
    scope: "route-payload" as const,
    routeId: "image-search",
    hash: "deadbeefdeadbeef",
    manifestVersion: 1,
  };

  it("get returns undefined", () => {
    expect(store.get(fakeKey)).toBeUndefined();
  });

  it("set does not throw", () => {
    const entry = { result: { items: [], sourceVersion: "0", confidence: "high" as const, mode: "live" as const }, expiresAt: Date.now() + 60_000, source: "test" };
    expect(() => store.set(fakeKey, entry, 60_000)).not.toThrow();
  });

  it("invalidate does not throw", () => {
    expect(() => store.invalidate(fakeKey)).not.toThrow();
  });

  it("invalidateByRoute does not throw", () => {
    expect(() => store.invalidateByRoute("image-search")).not.toThrow();
  });

  it("isAvailable returns false (noop)", () => {
    expect(store.isAvailable()).toBe(false);
  });
});

describe("SnapshotStore contract", () => {
  const store = noopSnapshotStore();

  it("getActiveVersion returns 0 (no snapshot)", () => {
    expect(store.getActiveVersion()).toBe(0);
  });

  it("getSnapshot returns undefined for any version", () => {
    expect(store.getSnapshot(0)).toBeUndefined();
    expect(store.getSnapshot(99)).toBeUndefined();
  });

  it("publish returns 0 (no-op)", () => {
    expect(store.publish([])).toBe(0);
    expect(store.publish([{ id: "r1", toolId: "x", description: "x", predicates: [], targets: [], filters: { pre: [], post: [] }, loadBalancer: "failover-only" as const }])).toBe(0);
  });

  it("getInUseVersion returns 0", () => {
    expect(store.getInUseVersion()).toBe(0);
  });

  it("markInUse does not throw", () => {
    expect(() => store.markInUse(1)).not.toThrow();
  });

  it("isAvailable returns false (noop)", () => {
    expect(store.isAvailable()).toBe(false);
  });
});

describe("CoalesceStore contract", () => {
  const store = noopCoalesceStore();

  const fakeKey = {
    routeId: "image-generate",
    idempotencyKey: "req_abc",
    manifestVersion: 1,
  };

  it("checkInFlight returns undefined (no shared coalescing in noop)", () => {
    expect(store.checkInFlight(fakeKey)).toBeUndefined();
  });

  it("registerInFlight calls the factory immediately (no shared coalescing)", async () => {
    let called = false;
    const factory = async () => {
      called = true;
      return { items: [], sourceVersion: "0", confidence: "high" as const, mode: "live" as const };
    };
    const result = await store.registerInFlight(fakeKey, factory);
    expect(called).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it("removeInFlight does not throw", () => {
    expect(() => store.removeInFlight(fakeKey)).not.toThrow();
  });

  it("isAvailable returns false (noop)", () => {
    expect(store.isAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SharedStateManager factory
// ---------------------------------------------------------------------------

describe("createNoopSharedStateManager", () => {
  it("isEnabled is false when no store URL is configured", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(mgr.isEnabled).toBe(false);
  });

  it("all stores report isAvailable === false", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(mgr.breaker.isAvailable()).toBe(false);
    expect(mgr.rateLimit.isAvailable()).toBe(false);
    expect(mgr.idempotency.isAvailable()).toBe(false);
    expect(mgr.cache.isAvailable()).toBe(false);
    expect(mgr.snapshot.isAvailable()).toBe(false);
    expect(mgr.coalesce.isAvailable()).toBe(false);
  });

  it("dispose is idempotent", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(() => mgr.dispose()).not.toThrow();
    expect(() => mgr.dispose()).not.toThrow();
    expect(() => mgr.dispose()).not.toThrow();
  });

  it("breaker getState is callable on the assembled manager", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(mgr.breaker.getState("any-target")).toBeUndefined();
  });

  it("snapshot getActiveVersion is 0 on the assembled manager", () => {
    const mgr = createNoopSharedStateManager(configFromEnv({}));
    expect(mgr.snapshot.getActiveVersion()).toBe(0);
  });
});

describe("createUnreachableSharedStateManager", () => {
  it("isEnabled is true (store URL was configured, just unreachable)", () => {
    const mgr = createUnreachableSharedStateManager(configFromEnv({ "GATEWAY_SHARED_STORE_URL": "redis://localhost:6379" }));
    expect(mgr.isEnabled).toBe(true);
  });

  it("all stores still report isAvailable === false", () => {
    const mgr = createUnreachableSharedStateManager(configFromEnv({ "GATEWAY_SHARED_STORE_URL": "redis://localhost:6379" }));
    expect(mgr.breaker.isAvailable()).toBe(false);
    expect(mgr.rateLimit.isAvailable()).toBe(false);
    expect(mgr.idempotency.isAvailable()).toBe(false);
    expect(mgr.cache.isAvailable()).toBe(false);
    expect(mgr.snapshot.isAvailable()).toBe(false);
    expect(mgr.coalesce.isAvailable()).toBe(false);
  });

  it("dispose is idempotent", () => {
    const mgr = createUnreachableSharedStateManager(configFromEnv({}));
    expect(() => mgr.dispose()).not.toThrow();
    expect(() => mgr.dispose()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// configFromEnv
// ---------------------------------------------------------------------------

describe("configFromEnv", () => {
  const emptyEnv = (): Record<string, string | undefined> => ({});

  it("returns correct defaults when all vars are absent", () => {
    const cfg = configFromEnv(emptyEnv());
    expect(cfg.storeUrl).toBe("");
    expect(cfg.storeType).toBeUndefined();
    expect(cfg.breakerFailOpen).toBe(true);
    expect(cfg.rateLimitFailClosed).toBe(true);
    expect(cfg.idempotencyFailClosed).toBe(true);
    expect(cfg.propagationMs).toBe(100);
    expect(cfg.connectTimeoutMs).toBe(2000);
    expect(cfg.breakerTtlSeconds).toBe(60);
    expect(cfg.coalesceTtlSeconds).toBe(30);
  });

  it("parses storeUrl", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_STORE_URL": "redis://localhost:6379" });
    expect(cfg.storeUrl).toBe("redis://localhost:6379");
    expect(cfg.storeType).toBe("redis");
  });

  it("infers storeType from redis:// prefix", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_STORE_URL": "redis://localhost:6379" }).storeType).toBe("redis");
  });

  it("infers storeType from postgres:// prefix", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_STORE_URL": "postgres://localhost:5432" }).storeType).toBe("postgres");
  });

  it("explicit storeType overrides inference", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_STORE_URL": "redis://localhost:6379", "GATEWAY_SHARED_STORE_TYPE": "valkey" });
    expect(cfg.storeType).toBe("valkey");
  });

  it("breakerFailOpen=false when GATEWAY_SHARED_BREAKER_STRICT=true", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_BREAKER_STRICT": "true" });
    expect(cfg.breakerFailOpen).toBe(false);
  });

  it("breakerFailOpen=true when GATEWAY_SHARED_BREAKER_STRICT=false", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_BREAKER_STRICT": "false" });
    expect(cfg.breakerFailOpen).toBe(true);
  });

  it("rateLimitFailClosed=false when GATEWAY_SHARED_RATELIMIT_GRACEFUL=true", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_RATELIMIT_GRACEFUL": "true" });
    expect(cfg.rateLimitFailClosed).toBe(false);
  });

  it("idempotencyFailClosed=false when GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL=true", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL": "true" });
    expect(cfg.idempotencyFailClosed).toBe(false);
  });

  it("parses propagationMs", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_PROPAGATION_MS": "250" }).propagationMs).toBe(250);
  });

  it("falls back to default for non-numeric propagationMs", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_PROPAGATION_MS": "bad" }).propagationMs).toBe(100);
  });

  it("parses connectTimeoutMs", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_CONNECT_TIMEOUT_MS": "5000" }).connectTimeoutMs).toBe(5000);
  });

  it("parses breakerTtlSeconds", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_BREAKER_TTL_SECONDS": "120" }).breakerTtlSeconds).toBe(120);
  });

  it("parses coalesceTtlSeconds", () => {
    expect(configFromEnv({ "GATEWAY_SHARED_COALESCE_TTL_SECONDS": "45" }).coalesceTtlSeconds).toBe(45);
  });

  it("treats empty string as missing", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_STORE_URL": "" });
    expect(cfg.storeUrl).toBe("");
    expect(cfg.storeType).toBeUndefined();
  });

  it("trims whitespace from values", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_STORE_URL": "  redis://localhost:6379  ", "GATEWAY_SHARED_PROPAGATION_MS": "  250  " });
    expect(cfg.storeUrl).toBe("redis://localhost:6379");
    expect(cfg.propagationMs).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// Fail-open / fail-closed policy documentation tests
//
// These are documentation tests that make the policy explicit and testable.
// The actual enforcement lives in the orchestrator's dispatch path.
// ---------------------------------------------------------------------------

describe("Fail-open / fail-closed policies", () => {
  /**
   * Breaker: default fail-open.
   * When `breaker.isAvailable() === false` AND `config.breakerFailOpen === true`,
   * the orchestrator MUST fall back to the local `CircuitBreaker` instance.
   * GHA-NEXT-020 does NOT enforce this; it is documented here so the
   * implementation in GHA-NEXT-021 has a clear contract to satisfy.
   */
  it("breaker default is fail-open (breakerFailOpen=true)", () => {
    const cfg = configFromEnv({});
    expect(cfg.breakerFailOpen).toBe(true);
  });

  /**
   * Rate limit: default fail-closed.
   * When `rateLimit.isAvailable() === false` AND `config.rateLimitFailClosed === true`,
   * the orchestrator MUST reject the request (allowed=false) rather than
   * risk exceeding the provider's quota.
   */
  it("rate-limit default is fail-closed (rateLimitFailClosed=true)", () => {
    const cfg = configFromEnv({});
    expect(cfg.rateLimitFailClosed).toBe(true);
  });

  /**
   * Idempotency: default fail-closed.
   * When `idempotency.isAvailable() === false` AND `config.idempotencyFailClosed === true`,
   * the orchestrator MUST reject non-idempotent operations (resource.generate.*)
   * and MUST NOT execute them locally without shared deduplication.
   */
  it("idempotency default is fail-closed (idempotencyFailClosed=true)", () => {
    const cfg = configFromEnv({});
    expect(cfg.idempotencyFailClosed).toBe(true);
  });

  /**
   * GRACEFUL override examples — setting the GRACEFUL env var inverts the policy.
   */
  it("breaker can be made strict (fail-closed) via GATEWAY_SHARED_BREAKER_STRICT", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_BREAKER_STRICT": "true" });
    expect(cfg.breakerFailOpen).toBe(false);
  });

  it("rate-limit can be made graceful (fail-open) via GATEWAY_SHARED_RATELIMIT_GRACEFUL", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_RATELIMIT_GRACEFUL": "true" });
    expect(cfg.rateLimitFailClosed).toBe(false);
  });

  it("idempotency can be made graceful (local coalescing fallback) via GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL", () => {
    const cfg = configFromEnv({ "GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL": "true" });
    expect(cfg.idempotencyFailClosed).toBe(false);
  });
});

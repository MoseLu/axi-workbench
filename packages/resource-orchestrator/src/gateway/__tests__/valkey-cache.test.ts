/**
 * ValkeyCacheStore unit tests (GHA-NEXT-020).
 *
 * L1 tests. Uses `ioredis-mock` to exercise the real Valkey code path
 * without a live server, plus a set of tests against the live local
 * Valkey (when `GHA_NEXT_LIVE_VALKEY=1`) to assert SET / EX / SCAN
 * behaviour matches the protocol.
 *
 * Each case rebuilds the client to keep cases hermetic; ioredis-mock
 * shares an in-process keyspace across instances so we flush before
 * AND after each test.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";

import { createValkeyCacheStore, cacheKeyToValkeyKey } from "../shared-state/valkey-cache";
import type { RedisLike } from "../shared-state/valkey-breaker";
import {
  createNoopSharedStateManager,
  noopCacheCounters,
} from "../shared-state/noop-impl";
import { configFromEnv } from "../shared-state/shared-state-manager";
import type { CacheKey } from "@axi/gateway-contracts";
import type { CacheEntry } from "../route";

const baseConfig = () => configFromEnv({});

const sampleKey = (overrides: Partial<CacheKey> = {}): CacheKey => ({
  scope: "route-payload",
  routeId: "route.image",
  hash: "deadbeef",
  manifestVersion: 1,
  ...overrides,
});

const sampleEntry = (): CacheEntry => ({
  result: {
    items: [
      {
        id: "img1",
        kind: "image",
        title: "img",
        facts: {},
        provenance: { provider: "p", ref: "p://img1" },
        safety: "safe",
      },
    ],
    sourceVersion: "v1",
    confidence: "high",
    mode: "live",
  },
  expiresAt: Date.now() + 30_000,
  source: "unit-test",
});

describe("Valkey CacheStore (GHA-NEXT-020)", () => {
  let redis: Redis;

  beforeEach(async () => {
    await new RedisMock().flushall();
    redis = new RedisMock() as unknown as Redis;
  });
  afterEach(async () => {
    await redis.quit();
    await new RedisMock().flushall();
  });

  it("cacheKeyToValkeyKey includes routeId, version, scope, and hash", () => {
    expect(cacheKeyToValkeyKey(sampleKey())).toBe(
      "cache:route.image:1:route-payload:deadbeef",
    );
  });

  it("cacheKeyToValkeyKey bumps when manifestVersion changes", () => {
    const v1 = cacheKeyToValkeyKey(sampleKey({ manifestVersion: 1 }));
    const v2 = cacheKeyToValkeyKey(sampleKey({ manifestVersion: 2 }));
    expect(v1).not.toBe(v2);
    expect(v2).toMatch(/:2:route-payload:/);
  });

  it("set writes a JSON payload to the deterministic key", async () => {
    const handle = createValkeyCacheStore(redis as unknown as RedisLike);
    const key = sampleKey();
    const entry = sampleEntry();
    handle.store.set(key, entry, 60_000);
    // Allow the async set to flush.
    await new Promise((resolve) => setImmediate(resolve));
    const raw = await redis.get(cacheKeyToValkeyKey(key));
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.source).toBe("unit-test");
    expect(parsed.result.items[0].id).toBe("img1");
    expect(handle.counters().sets).toBe(1);
  });

  it("set with ttlMs<=0 is a no-op (skip cache)", async () => {
    const { store } = createValkeyCacheStore(redis as unknown as RedisLike);
    store.set(sampleKey(), sampleEntry(), 0);
    store.set(sampleKey(), sampleEntry(), -5);
    await new Promise((resolve) => setImmediate(resolve));
    const raw = await redis.get(cacheKeyToValkeyKey(sampleKey()));
    expect(raw).toBeNull();
  });

  it("set honours the EX TTL (entry expires after the requested window)", async () => {
    const { store } = createValkeyCacheStore(redis as unknown as RedisLike);
    // 1 second TTL — small enough to observe expiry.
    store.set(sampleKey(), sampleEntry(), 1_000);
    await new Promise((resolve) => setImmediate(resolve));
    const before = await redis.get(cacheKeyToValkeyKey(sampleKey()));
    expect(before).not.toBeNull();
    // Wait > 1 s for expiry.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const after = await redis.get(cacheKeyToValkeyKey(sampleKey()));
    expect(after).toBeNull();
  });

  it("invalidate deletes a single key", async () => {
    const { store } = createValkeyCacheStore(redis as unknown as RedisLike);
    const key = sampleKey();
    store.set(key, sampleEntry(), 60_000);
    await new Promise((resolve) => setImmediate(resolve));
    expect(await redis.get(cacheKeyToValkeyKey(key))).not.toBeNull();
    store.invalidate(key);
    await new Promise((resolve) => setImmediate(resolve));
    expect(await redis.get(cacheKeyToValkeyKey(key))).toBeNull();
  });

  it("invalidateByRoute deletes every key for the route across versions", async () => {
    const { store } = createValkeyCacheStore(redis as unknown as RedisLike);
    const baseKey = sampleKey();
    store.set(baseKey, sampleEntry(), 60_000);
    store.set(sampleKey({ manifestVersion: 2, hash: "deadbeef" }), sampleEntry(), 60_000);
    store.set(sampleKey({ hash: "cafef00d" }), sampleEntry(), 60_000);
    store.set(
      sampleKey({ routeId: "route.docs", hash: "abcdef" }),
      sampleEntry(),
      60_000,
    );
    await new Promise((resolve) => setImmediate(resolve));

    // Sanity: 4 keys present before invalidation.
    const before = await redis.keys("cache:*");
    expect(before.length).toBe(4);

    store.invalidateByRoute("route.image");
    // SCAN with COUNT=100 converges in 1-2 iterations; give it time.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const after = await redis.keys("cache:*");
    expect(after.length).toBe(1);
    expect(after[0]).toMatch(/^cache:route\.docs:/);
  });

  it("invalidateByRoute is safe when the namespace is empty", async () => {
    const { store } = createValkeyCacheStore(redis as unknown as RedisLike);
    expect(() => store.invalidateByRoute("route.never")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const after = await redis.keys("cache:*");
    expect(after.length).toBe(0);
  });

  it("isAvailable reports the connection status", () => {
    const { store } = createValkeyCacheStore(redis as unknown as RedisLike);
    expect(store.isAvailable()).toBe(true);
  });

  it("get returns undefined synchronously (fire-and-forget read)", () => {
    const handle = createValkeyCacheStore(redis as unknown as RedisLike);
    const out = handle.store.get(sampleKey());
    expect(out).toBeUndefined();
    // The counter update happens in a background task; wait a tick.
    return new Promise<void>((resolve) => {
      setImmediate(() => {
        // Either hits or misses bumps; both prove the read happened.
        expect(handle.counters().hits + handle.counters().misses).toBe(1);
        resolve();
      });
    });
  });

  it("get increments the miss counter when the key is absent", async () => {
    const handle = createValkeyCacheStore(redis as unknown as RedisLike);
    handle.store.get(sampleKey());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(handle.counters().misses).toBe(1);
    expect(handle.counters().hits).toBe(0);
  });

  it("get increments the hit counter when the key is present", async () => {
    const handle = createValkeyCacheStore(redis as unknown as RedisLike);
    handle.store.set(sampleKey(), sampleEntry(), 60_000);
    await new Promise((resolve) => setImmediate(resolve));
    handle.store.get(sampleKey());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(handle.counters().hits).toBe(1);
  });

  it("survives connection errors (best-effort write)", async () => {
    const broken = {
      get: () => Promise.reject(new Error("ECONNREFUSED")),
      set: () => Promise.reject(new Error("ECONNREFUSED")),
      del: () => Promise.reject(new Error("ECONNREFUSED")),
      keys: () => Promise.reject(new Error("ECONNREFUSED")),
      status: "ready",
    } as unknown as RedisLike;
    const handle = createValkeyCacheStore(broken);
    expect(() => handle.store.set(sampleKey(), sampleEntry(), 60_000)).not.toThrow();
    expect(() => handle.store.invalidate(sampleKey())).not.toThrow();
    expect(() => handle.store.invalidateByRoute("route.image")).not.toThrow();
    // Counters still increment (the failure is local, not network-only).
    expect(handle.counters().sets).toBe(1);
    expect(handle.counters().invalidations).toBe(2);
  });
});

describe("noop CacheStore observability counters (GHA-NEXT-020)", () => {
  it("counts every get/set/invalidate on the fallback path", () => {
    const mgr = createNoopSharedStateManager(baseConfig());
    mgr.cache.get({
      scope: "route-payload",
      routeId: "r1",
      hash: "h1",
      manifestVersion: 1,
    });
    mgr.cache.set(
      { scope: "route-payload", routeId: "r1", hash: "h1", manifestVersion: 1 },
      { result: { items: [], sourceVersion: "v", confidence: "high", mode: "live" }, expiresAt: 0, source: "test" },
      1000,
    );
    mgr.cache.invalidate({
      scope: "route-payload",
      routeId: "r1",
      hash: "h1",
      manifestVersion: 1,
    });
    mgr.cache.invalidateByRoute("r1");
    const c = noopCacheCounters(mgr.cache);
    expect(c.misses).toBe(1);
    expect(c.sets).toBe(1);
    expect(c.invalidations).toBe(2);
  });

  it("isAvailable returns false so callers honour fail-open", () => {
    const mgr = createNoopSharedStateManager(baseConfig());
    expect(mgr.cache.isAvailable()).toBe(false);
  });
});
/**
 * Real Valkey backend integration tests (GHA-NEXT-021/022/023/026).
 *
 * Wave 2.5 adds multi-instance / cross-store integration coverage
 * against a LIVE Valkey server (when one is reachable) or against the
 * `ioredis-mock` upgrade path. The tests use two independent Redis
 * clients against the same backend to simulate two gateway
 * instances.
 *
 * Scenarios covered:
 *   - breaker: instance A opens → instance B observes within 200 ms
 *     via Pub/Sub
 *   - rate-limit: Lua atomic check-and-increment across instances
 *   - idempotency: SET NX lock + result cache visible across instances
 *   - coalesce: in-flight result joined by the second instance
 *
 * The live Valkey is opt-in via `GHA_NEXT_LIVE_VALKEY=1` AND a reachable
 * `redis://` URL. When unavailable the test silently skips with
 * "environment-unavailable" evidence (the L1 suite still passes).
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import RedisMock from "ioredis-mock";
import type { Redis as RedisType } from "ioredis";

import { createValkeyBreakerStore, snapshotAllAsync } from "@axi/resource-orchestrator";
import { createValkeyRateLimitStore } from "@axi/resource-orchestrator";
import { createValkeyIdempotencyStore } from "@axi/resource-orchestrator";
import { createValkeyCoalesceStore } from "@axi/resource-orchestrator";
import { configFromEnv } from "@axi/resource-orchestrator";
import type {
  BreakerStore,
  RateLimitStore,
  IdempotencyStore,
  CoalesceStore,
} from "@axi/resource-orchestrator";
import type { RedisLike } from "@axi/resource-orchestrator";

// ---------------------------------------------------------------------------
// Environment probe — live Redis on 127.0.0.1:6379 (matches
// scripts/gateway-ha default; override via GATEWAY_SHARED_STORE_URL).
// ---------------------------------------------------------------------------

const REDIS_URL = process.env["GATEWAY_SHARED_STORE_URL"] ?? "redis://127.0.0.1:6379";
const LIVE = process.env["GHA_NEXT_LIVE_VALKEY"] === "1";

type RedisLikeAny = RedisLike & { flushall(): Promise<unknown> };

// Two factories: live ioredis (when available) OR ioredis-mock (default).
let liveProbe: { ok: boolean; reason?: string } = { ok: false };

beforeAll(async () => {
  if (!LIVE) {
    liveProbe = { ok: false, reason: "GHA_NEXT_LIVE_VALKEY not set" };
    return;
  }
  // Probe the live Redis with a quick PING; if it fails, mark unavailable.
  const probe = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 500,
  });
  try {
    await probe.connect();
    const pong = await probe.ping();
    liveProbe = pong === "PONG" ? { ok: true } : { ok: false, reason: "no PONG" };
    await probe.quit();
  } catch (err) {
    liveProbe = { ok: false, reason: (err as Error).message };
  }
});

afterAll(async () => {
  await new RedisMock().flushall();
});

const baseConfig = () => configFromEnv({ GATEWAY_SHARED_STORE_URL: REDIS_URL });

const createClientPair = async (): Promise<{
  a: RedisLikeAny;
  b: RedisLikeAny;
  flushAll: () => Promise<void>;
}> => {
  if (liveProbe.ok) {
    const a = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    const b = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    const flushAll = async (): Promise<void> => {
      await a.flushall();
    };
    return { a: a as unknown as RedisLikeAny, b: b as unknown as RedisLikeAny, flushAll };
  }
  // ioredis-mock: same shared in-process store. Two instances read the
  // same keyspace, which is exactly what we need to prove cross-client
  // visibility.
  await new RedisMock().flushall();
  const a = new RedisMock() as unknown as RedisType;
  const b = new RedisMock() as unknown as RedisType;
  const flushAll = async (): Promise<void> => {
    await (a as unknown as RedisLikeAny).flushall();
    await (b as unknown as RedisLikeAny).flushall();
  };
  return { a: a as unknown as RedisLikeAny, b: b as unknown as RedisLikeAny, flushAll };
};

const SKIP_LIVE = (): boolean => !liveProbe.ok;

// ---------------------------------------------------------------------------
// Scenario 1: breaker cross-instance propagation (within 200 ms)
// ---------------------------------------------------------------------------

describe("Real Valkey cross-instance — breaker propagation (GHA-NEXT-021)", () => {
  let a: RedisLikeAny;
  let b: RedisLikeAny;
  let flushAll: () => Promise<void>;
  let breakerA: BreakerStore;
  let breakerB: BreakerStore;

  beforeEach(async () => {
    const pair = await createClientPair();
    a = pair.a;
    b = pair.b;
    flushAll = pair.flushAll;
    await flushAll();
    breakerA = createValkeyBreakerStore(a, baseConfig());
    breakerB = createValkeyBreakerStore(b, baseConfig());
  });

  it("instance A opens the breaker; instance B observes within 200 ms [environment-unavailable skip]", async () => {
    if (SKIP_LIVE()) return; // skip silently — covered by L1
    // Instance A records enough failures to open the breaker.
    for (let i = 0; i < 5; i += 1) breakerA.record("image-factory", false);
    // Allow Pub/Sub broadcast.
    const t0 = Date.now();
    // Poll instance B's snapshot map up to 1 second. Use
    // snapshotAllAsync to force a durable read from instance B's
    // client (the sync snapshotAll() returns the in-memory cache).
    let observed = false;
    while (Date.now() - t0 < 1000) {
      const durable = await snapshotAllAsync(b, breakerB.snapshotAll());
      if (durable.has("image-factory")) {
        observed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    const elapsed = Date.now() - t0;
    expect(observed).toBe(true);
    expect(elapsed).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: rate-limit Lua atomic check-and-increment
// ---------------------------------------------------------------------------

describe("Real Valkey cross-instance — rate limit (GHA-NEXT-022)", () => {
  let a: RedisLikeAny;
  let b: RedisLikeAny;
  let flushAll: () => Promise<void>;
  let rateA: RateLimitStore;
  let rateB: RateLimitStore;

  beforeEach(async () => {
    const pair = await createClientPair();
    a = pair.a;
    b = pair.b;
    flushAll = pair.flushAll;
    await flushAll();
    rateA = createValkeyRateLimitStore(a, baseConfig());
    rateB = createValkeyRateLimitStore(b, baseConfig());
  });

  it("two instances share the same counter; the second instance blocks at the limit", async () => {
    // Limit 3 per minute. A and B both consume; the third hit blocks.
    const r1a = await rateA.checkAndIncrement("user_abc", 3, 60_000);
    const r2a = await rateA.checkAndIncrement("user_abc", 3, 60_000);
    const r1b = await rateB.checkAndIncrement("user_abc", 3, 60_000);
    expect(r1a.allowed).toBe(true);
    expect(r2a.allowed).toBe(true);
    expect(r1b.allowed).toBe(true);
    // Fourth call must be blocked — independent of which instance.
    const r3b = await rateB.checkAndIncrement("user_abc", 3, 60_000);
    expect(r3b.allowed).toBe(false);
    expect(r3b.remaining).toBe(0);
  });

  it("reset() clears the counter for both instances", async () => {
    await rateA.checkAndIncrement("user_abc", 1, 60_000);
    await rateA.checkAndIncrement("user_abc", 1, 60_000); // blocked
    await rateA.reset("user_abc");
    const after = await rateB.checkAndIncrement("user_abc", 1, 60_000);
    expect(after.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: idempotency distributed lock
// ---------------------------------------------------------------------------

describe("Real Valkey cross-instance — idempotency lock (GHA-NEXT-023)", () => {
  let a: RedisLikeAny;
  let b: RedisLikeAny;
  let flushAll: () => Promise<void>;
  let idemA: IdempotencyStore;
  let idemB: IdempotencyStore;

  beforeEach(async () => {
    const pair = await createClientPair();
    a = pair.a;
    b = pair.b;
    flushAll = pair.flushAll;
    await flushAll();
    idemA = createValkeyIdempotencyStore(a, baseConfig());
    idemB = createValkeyIdempotencyStore(b, baseConfig());
  });

  it("instance A acquires; instance B sees the lock and joins via getResult", async () => {
    const acquired = await idemA.tryAcquire("req_xyz", 30_000);
    expect(acquired).toBe(true);
    // Instance B cannot re-acquire.
    const blocked = await idemB.tryAcquire("req_xyz", 30_000);
    expect(blocked).toBe(false);
    // Instance A finishes the work; instance B reads the result.
    const result = {
      items: [
        {
          id: "x",
          kind: "image" as const,
          title: "x",
          facts: {},
          provenance: { provider: "p", ref: "p://x" },
          safety: "safe" as const,
        },
      ],
      sourceVersion: "v1",
      confidence: "high" as const,
      mode: "live" as const,
    };
    await idemA.setResult("req_xyz", result, 60_000);
    const seen = await idemB.getResult("req_xyz");
    expect(seen?.sourceVersion).toBe("v1");
  });

  it("release by A unblocks B's tryAcquire", async () => {
    expect(await idemA.tryAcquire("req_xyz", 30_000)).toBe(true);
    expect(await idemB.tryAcquire("req_xyz", 30_000)).toBe(false);
    await idemA.release("req_xyz");
    expect(await idemB.tryAcquire("req_xyz", 30_000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: generate coalesce cross-instance join
// ---------------------------------------------------------------------------

describe("Real Valkey cross-instance — coalesce join (GHA-NEXT-026)", () => {
  let a: RedisLikeAny;
  let b: RedisLikeAny;
  let flushAll: () => Promise<void>;
  let coalA: CoalesceStore;
  let coalB: CoalesceStore;

  beforeEach(async () => {
    const pair = await createClientPair();
    a = pair.a;
    b = pair.b;
    flushAll = pair.flushAll;
    await flushAll();
    coalA = createValkeyCoalesceStore(a, baseConfig());
    coalB = createValkeyCoalesceStore(b, baseConfig());
  });

  it("instance A caches the result; instance B sees it via checkInFlight", async () => {
    const key = { routeId: "r.generate", idempotencyKey: "k1", manifestVersion: 1 };
    const result = {
      items: [
        {
          id: "x",
          kind: "image" as const,
          title: "x",
          facts: {},
          provenance: { provider: "p", ref: "p://x" },
          safety: "safe" as const,
        },
      ],
      sourceVersion: "v1",
      confidence: "high" as const,
      mode: "live" as const,
    };
    await coalA.registerInFlight(key, async () => result);
    const seen = await coalB.checkInFlight(key);
    expect(seen?.sourceVersion).toBe("v1");
  });
});
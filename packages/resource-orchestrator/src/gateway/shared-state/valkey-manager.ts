/**
 * Top-level Valkey `SharedStateManager` factory (GHA-NEXT-021~026 — P0).
 *
 * Wires the six concrete Valkey stores together into the facade that
 * `GatewayOrchestrator` consumes. The orchestrator doesn't import this
 * factory directly; the composition root in `apps/gateway` decides
 * whether to use Valkey or Postgres based on `SharedStateConfig`.
 *
 * Lazy connection: the Redis client is NOT opened until the caller
 * invokes any of the store methods. This keeps imports free of
 * side-effects and lets tests construct a fully wired manager without
 * network IO.
 */

import type Redis from "ioredis";
import { createValkeyBreakerStore, type RedisLike } from "./valkey-breaker";
import { createValkeyRateLimitStore } from "./valkey-ratelimit";
import { createValkeyIdempotencyStore } from "./valkey-idempotency";
import { createValkeySnapshotStore } from "./valkey-snapshot";
import { createValkeyCoalesceStore } from "./valkey-coalesce";
import { createValkeyCacheStore } from "./valkey-cache";
import type { SharedStateManager, SharedStateConfig } from "./shared-state-manager";

/** A function that builds a Redis client. The factory is invoked
 *  once when the manager needs to wire its stores. Must be synchronous. */
export type RedisClientFactory = () => RedisLike;

export const createValkeySharedStateManager = (
  config: SharedStateConfig,
  redisOrFactory: RedisLike | RedisClientFactory,
): SharedStateManager => {
  // The factory may be invoked lazily so we don't pay the connect
  // cost until the first store call. For tests we accept an already-
  // built client (ioredis-mock).
  let cachedClient: RedisLike | null = null;
  const client = (): RedisLike => {
    if (cachedClient) return cachedClient;
    if (typeof redisOrFactory === "function") {
      const result = (redisOrFactory as RedisClientFactory)();
      if (result instanceof Promise) {
        throw new Error("createValkeySharedStateManager requires a sync RedisClientFactory");
      }
      cachedClient = result;
      return result;
    }
    cachedClient = redisOrFactory;
    return redisOrFactory;
  };

  // Build the stores lazily so an import of this file (without
  // actually using the manager) doesn't trigger any IO.
  let breaker: ReturnType<typeof createValkeyBreakerStore> | null = null;
  let rateLimit: ReturnType<typeof createValkeyRateLimitStore> | null = null;
  let idempotency: ReturnType<typeof createValkeyIdempotencyStore> | null = null;
  let snapshot: ReturnType<typeof createValkeySnapshotStore> | null = null;
  let coalesce: ReturnType<typeof createValkeyCoalesceStore> | null = null;
  let cacheHandle: ReturnType<typeof createValkeyCacheStore> | null = null;

  const ensureStores = () => {
    if (breaker && rateLimit && idempotency && snapshot && coalesce && cacheHandle) return;
    const c = client();
    breaker = createValkeyBreakerStore(c, config);
    rateLimit = createValkeyRateLimitStore(c, config);
    idempotency = createValkeyIdempotencyStore(c, config);
    snapshot = createValkeySnapshotStore(c, config);
    coalesce = createValkeyCoalesceStore(c, config);
    cacheHandle = createValkeyCacheStore(c);
  };

  let disposed = false;

  const facade: SharedStateManager = {
    get breaker() {
      ensureStores();
      return breaker!;
    },
    get rateLimit() {
      ensureStores();
      return rateLimit!;
    },
    get idempotency() {
      ensureStores();
      return idempotency!;
    },
    get cache() {
      // GHA-NEXT-020: real Valkey CacheStore. Sync read returns
      // undefined (the dispatcher falls back to the local
      // VersionedCache); writes, invalidations, and route-scoped
      // sweeps are dispatched asynchronously.
      ensureStores();
      return cacheHandle!.store;
    },
    get snapshot() {
      ensureStores();
      return snapshot!;
    },
    get coalesce() {
      ensureStores();
      return coalesce!;
    },
    get isEnabled() {
      return !disposed && Boolean(config.storeUrl) && (config.storeType === "redis" || config.storeType === "valkey" || config.storeType === undefined);
    },
    // GHA-NEXT-025 — surface the operator's SharedStateConfig so
    // dispatchers can honour rateLimitFailClosed /
    // idempotencyFailClosed per-route.
    config,
    async dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const c = client();
        if (typeof c.quit === "function") await c.quit();
        else if (typeof c.disconnect === "function") c.disconnect();
      } catch {
        /* best-effort */
      }
    },
  };

  return facade;
};

// Re-export for tests that want to construct a real ioredis client.
export type { Redis };
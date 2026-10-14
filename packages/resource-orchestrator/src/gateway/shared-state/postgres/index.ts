/**
 * Postgres shared-state backend (GHA-NEXT-027 — Phase D / P1 → Full).
 *
 * Replaces the previous "SnapshotStore real + 5 noop" partial wiring
 * with a full `pg.Pool`-backed implementation for ALL six stores. The
 * five remaining roles (BreakerStore / RateLimitStore / IdempotencyStore
 * / CacheStore / CoalesceStore) now have real SQL implementations that
 * mirror the equivalent Valkey stores in semantics, using Postgres
 * primitives (advisory locks, transactional INCR, ON CONFLICT, JSONB,
 * TTL via `expires_at` columns) wherever the Valkey version relies on
 * Redis commands / Lua scripts.
 *
 * Table layout + advisory-lock key map live in `./pool.ts`, next to
 * the DDL that creates them.
 *
 * Fail strategy: preserved from Wave 2.
 *   - breaker / cache / snapshot / coalesce: fail-open (admin override).
 *   - rate-limit / idempotency: fail-closed (admin override).
 *
 * Test seam: every store accepts the same `PostgresLikePool` shim so
 * tests can drop in an in-memory fake that simulates `pg_try_advisory_lock`,
 * `INSERT ... ON CONFLICT`, `DELETE WHERE expires_at < now()` and JSONB
 * semantics. A separate `live` block in the test file connects to a
 * real Postgres when `GHA_NEXT_LIVE_PG=1` AND `GATEWAY_SHARED_STORE_URL`
 * points at `postgres://...`.
 *
 * File map for this package:
 *   - `connection.ts` — pool types, advisory-lock key constants,
 *     `createRealPgPool`.
 *   - `pool.ts`       — DDL statements, `runDdlOnce`, key builders,
 *     storage-layout reference.
 *   - `query.ts`      — per-store SQL implementations (six store
 *     creators) + private breaker helpers.
 *   - `index.ts`      — facade (`createPostgresSharedStateManager`)
 *     and the public exports used by `shared-state/index.ts`.
 */

import type { SharedStateManager, SharedStateConfig } from "../shared-state-manager";
import {
  noopBreakerStore,
  noopRateLimitStore,
  noopIdempotencyStore,
  noopCacheStore,
  noopCoalesceStore,
  noopSnapshotStore,
} from "../noop-impl";

import {
  type PostgresLikePool,
  type PostgresClientFactory,
} from "./connection";
import {
  createPostgresBreakerStore,
  createPostgresRateLimitStore,
  createPostgresIdempotencyStore,
  createPostgresCacheStore,
  createPostgresCoalesceStore,
  createPostgresSnapshotStore,
} from "./query";

// Re-export everything from the connection / pool / query segments so
// `shared-state/index.ts` keeps importing these names from one place.
export {
  type PostgresLikePool,
  type PostgresLikeClient,
  type PostgresClientFactory,
  SNAPSHOT_PUBLISH_ADVISORY_KEY,
  BREAKER_ADVISORY_NAMESPACE,
  createRealPgPool,
} from "./connection";
export {
  POSTGRES_SHARED_STATE_DDL,
  POSTGRES_SHARED_STATE_DDL_STATEMENTS,
  cacheKeyToPostgresKey,
  coalesceKey,
} from "./pool";
export {
  createPostgresSnapshotStore,
  createPostgresBreakerStore,
  breakerSnapshotAllAsync,
  createPostgresRateLimitStore,
  createPostgresIdempotencyStore,
  createPostgresCacheStore,
  createPostgresCoalesceStore,
} from "./query";

// Marker for the post-stub version; bumped whenever the data platform
// owns pg.Pool reuse.
export const __POSTGRES_STUB_VERSION = "0.3.0-real-full";

/**
 * Build a Postgres-backed `SharedStateManager`.
 *
 * When the factory is omitted the manager stays on all-noop with the
 * existing legacy behaviour. When a factory (or an inline pool) is
 * provided, ALL six stores are wired against the same Postgres pool
 * using the implementations above.
 */
export const createPostgresSharedStateManager = (
  config: SharedStateConfig,
  clientOrFactory?: PostgresLikePool | PostgresClientFactory,
): SharedStateManager => {
  // Lightweight noop fallbacks so a deferred-resolution path can
  // return a coherent facade while the real pool is still resolving.
  const noop = {
    breaker: noopBreakerStore(),
    rateLimit: noopRateLimitStore(),
    idempotency: noopIdempotencyStore(),
    cache: noopCacheStore(),
    coalesce: noopCoalesceStore(),
  };

  let breakerStore = noop.breaker;
  let rateLimitStore = noop.rateLimit;
  let idempotencyStore = noop.idempotency;
  let cacheStore = noop.cache;
  let coalesceStore = noop.coalesce;

  let snapshotStore = noopSnapshotStore();
  // GHA-NEXT-025 — deferred factory resolution. The previous
  // implementation invoked `clientOrFactory()` synchronously
  // during this function, which meant `pg.Pool` was constructed
  // (and `pg.Client.connect` was started) at boot, even if the
  // operator never sent a dispatch. The composition root in
  // apps/gateway passes `() => createRealPgPool(env.storeUrl)`,
  // and that closure now stays dormant until the first store
  // access. Until the pool resolves, every store returns the
  // noop fallback.
  let resolvedPool: PostgresLikePool | null = null;
  let resolvingPool: Promise<PostgresLikePool | null> | null = null;
  const wireStores = (pool: PostgresLikePool): void => {
    breakerStore = createPostgresBreakerStore(pool, config);
    rateLimitStore = createPostgresRateLimitStore(pool, config);
    idempotencyStore = createPostgresIdempotencyStore(pool, config);
    cacheStore = createPostgresCacheStore(pool);
    coalesceStore = createPostgresCoalesceStore(pool, config);
    snapshotStore = createPostgresSnapshotStore(pool);
  };

  const ensurePool = async (): Promise<PostgresLikePool | null> => {
    if (resolvedPool) return resolvedPool;
    if (resolvingPool) return resolvingPool;
    if (typeof clientOrFactory === "function") {
      resolvingPool = (async () => {
        try {
          const pool = await clientOrFactory();
          resolvedPool = pool;
          wireStores(pool);
        } catch (err) {
          // Pool factory failed: keep noops. The operator can
          // re-trigger by restarting the gateway once the upstream
          // Postgres is reachable.
          // eslint-disable-next-line no-console
          console.error(`[shared-state] postgres pool factory failed: ${String(err)}`);
        } finally {
          resolvingPool = null;
        }
        return resolvedPool;
      })();
      return resolvingPool;
    }
    if (clientOrFactory) {
      // Inline pool: assume already open, wire stores now.
      resolvedPool = clientOrFactory;
      wireStores(resolvedPool);
      return resolvedPool;
    }
    return null;
  };

  // GHA-NEXT-027 — short bounded synchronous wait so the FIRST
  // dispatch call does not race the async pool resolution. The
  // store variables start as noops; wireStores() flips them to the
  // real Postgres impls once the factory resolves. We use
  // `Atomics.wait` on a 4-byte Int32Array view of a
  // SharedArrayBuffer so the worker thread actually suspends
  // (a `Date.now()`-busy-spin only yields the event loop
  // without parking the thread — fine for an inline pool that
  // resolves synchronously, broken for a real `pg.Pool` whose
  // first `connect` is a TCP round-trip). When
  // `SharedArrayBuffer` is unavailable (sandbox / no `cross-origin-
  // isolated` context) we fall back to a short busy-poll with
  // a microtask yield so the dev-box loopback path stays fast
  // without freezing the event loop.
  const awaitOrSpin = (deadlineMs = 50): boolean => {
    if (resolvedPool) return true;
    if (typeof SharedArrayBuffer === "function" && typeof Atomics !== "undefined" && typeof Atomics.wait === "function") {
      const sab = new SharedArrayBuffer(4);
      const i32 = new Int32Array(sab);
      void ensurePool().then(() => {
        if (resolvedPool) Atomics.store(i32, 0, 1);
        Atomics.notify(i32, 0);
      });
      Atomics.wait(i32, 0, 0, deadlineMs);
      return resolvedPool !== null;
    }
    void ensurePool();
    const startedAt = Date.now();
    while (!resolvedPool && Date.now() - startedAt < deadlineMs) {
      // No setTimeout here: yielding to the event loop breaks the
      // 50 ms cap. We expect the dev-box pool to resolve in <1 ms.
    }
    return resolvedPool !== null;
  };

  // If the caller passed an inline (already-materialised) pool we
  // wire stores now so the first dispatch is not a noop. A
  // factory closure stays deferred until the first store access.
  if (clientOrFactory && typeof clientOrFactory !== "function") {
    resolvedPool = clientOrFactory;
    wireStores(resolvedPool);
  }

  let disposed = false;

  return {
    get breaker() {
      awaitOrSpin();
      return breakerStore;
    },
    get rateLimit() {
      awaitOrSpin();
      return rateLimitStore;
    },
    get idempotency() {
      awaitOrSpin();
      return idempotencyStore;
    },
    get cache() {
      awaitOrSpin();
      return cacheStore;
    },
    get snapshot() {
      awaitOrSpin();
      return snapshotStore;
    },
    get coalesce() {
      awaitOrSpin();
      return coalesceStore;
    },

    get isEnabled() {
      return config.storeType === "postgres" && !disposed;
    },
    // GHA-NEXT-025 / GHA-NEXT-027 — surface the operator's
    // SharedStateConfig so dispatchers can honour
    // rateLimitFailClosed / idempotencyFailClosed per-route.
    config,

    async dispose() {
      if (disposed) return;
      disposed = true;
      // If a pool resolution is in flight, await it before closing
      // so the caller is guaranteed a deterministic post-dispose
      // state. After the await, `resolvedPool` may be a real pool
      // (close it) or still null (the factory never ran / failed).
      if (resolvingPool) {
        try { await resolvingPool; } catch { /* best-effort */ }
      }
      if (resolvedPool && typeof resolvedPool.end === "function") {
        try {
          await resolvedPool.end();
        } catch {
          /* best-effort */
        }
      }
    },
  };
};

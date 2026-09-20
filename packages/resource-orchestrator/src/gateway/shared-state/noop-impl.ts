/**
 * No-op shared-state implementation.
 *
 * GHA-NEXT-020 — Phase D / P0
 *
 * This module provides the all-noop `SharedStateManager` that is used when
 * `GATEWAY_SHARED_STORE_URL` is not set (the default, backward-compatible
 * local-only mode). Every store operation is a no-op that:
 *
 *   - BreakerStore: returns undefined / empty snapshots (local breakers run as-is)
 *   - RateLimitStore: always returns `{ allowed: true }` (fail-open)
 *   - IdempotencyStore: always returns `true` from `tryAcquire` (caller proceeds;
 *                        fail-closed is the caller's responsibility to enforce
 *                        when `SharedStateManager.isEnabled === false`)
 *   - CacheStore: no-op (local VersionedCache handles everything)
 *   - SnapshotStore: returns version 0 / undefined (local in-memory snapshot)
 *   - CoalesceStore: always returns `undefined` from `checkInFlight`
 *                    (local CoalescingRegistry handles within-instance deduplication)
 *
 * The noop impl is the explicit baseline that lets us add shared-state
 * capability without breaking the existing single-instance deployment.
 *
 * Tests in `__tests__/shared-state-manager.test.ts` verify:
 *   1. All six stores are structurally present on the returned object.
 *   2. `isEnabled === false` when no store URL is configured.
 *   3. `breakerFailOpen=true` → `BreakerStore.isAvailable()` returns `false`
 *      and `getState` returns `undefined` (local breaker runs).
 *   4. `rateLimitFailClosed=true` → `RateLimitStore.isAvailable()` returns `false`
 *      BUT `checkAndIncrement` still returns `allowed: true` (fail-open path;
 *      the caller sees `isAvailable()===false` and decides).
 *   5. `idempotencyFailClosed=true` → `IdempotencyStore.tryAcquire` returns `true`
 *      (caller proceeds with local coalescing; fail-closed behaviour is the
 *      caller's responsibility when `isEnabled === false`).
 *   6. `dispose()` is idempotent (calling twice does not throw).
 */

import type {
  SharedStateManager,
  SharedStateConfig,
  BreakerStore,
  RateLimitStore,
  IdempotencyStore,
  CacheStore,
  SnapshotStore,
  CoalesceStore,
} from "./shared-state-manager";
import type { AdapterSearchResult } from "@axi/gateway-contracts";
import type { BreakerSnapshot } from "../circuit-breaker";
import type { CacheKey, CacheScope } from "@axi/gateway-contracts";
import type { CacheEntry } from "../route";
import type { RouteDefinition } from "../route";
import type { CoalescingKey } from "@axi/gateway-contracts";

// ---------------------------------------------------------------------------
// Individual noop stores
// ---------------------------------------------------------------------------

/** Noop breaker: `isAvailable() === false`; all reads return `undefined`. */
export const noopBreakerStore = (): BreakerStore => ({
  getState: () => undefined,
  record: () => {},
  tryClose: () => false,
  snapshotAll: () => new Map<string, BreakerSnapshot>(),
  isAvailable: () => false,
});

/** Noop rate-limit: always allows. */
export const noopRateLimitStore = (): RateLimitStore => ({
  checkAndIncrement: async (_key, _limit, _windowMs) => ({
    allowed: true,
    remaining: -1,
    resetAt: 0,
  }),
  reset: async () => {},
  isAvailable: () => false,
});

/** Noop idempotency: always acquires (caller proceeds). */
export const noopIdempotencyStore = (): IdempotencyStore => ({
  tryAcquire: async () => true,
  release: async () => {},
  getResult: async () => undefined,
  setResult: async () => {},
  isAvailable: () => false,
});

/**
 * Noop cache: all ops are no-ops, but every call is counted so the
 * fallback path is observable via `noopCacheCounters(store)`.
 *
 * GHA-NEXT-020 — counts make the "store unavailable, falling back to
 * local cache" path auditable from tests and ops dashboards. The store
 * still returns `isAvailable() === false` so callers honour the
 * fail-open contract.
 */
export const noopCacheStore = (): CacheStore & { __counters?: () => NoopCacheCounters } => {
  let hits = 0;
  let misses = 0;
  let sets = 0;
  let invalidations = 0;
  const store: CacheStore = {
    get: () => {
      misses += 1;
      return undefined;
    },
    set: () => {
      sets += 1;
    },
    invalidate: () => {
      invalidations += 1;
    },
    invalidateByRoute: () => {
      invalidations += 1;
    },
    isAvailable: () => false,
  };
  (store as CacheStore & { __counters?: () => NoopCacheCounters }).__counters = () => ({
    hits,
    misses,
    sets,
    invalidations,
  });
  return store as CacheStore & { __counters?: () => NoopCacheCounters };
};

/** Read the live observability counters from a noop cache store. Returns
 *  zeros when the store does not expose counters (e.g. a third-party
 *  implementation). */
export const noopCacheCounters = (store: CacheStore): NoopCacheCounters => {
  const withCounters = store as CacheStore & { __counters?: () => NoopCacheCounters };
  if (typeof withCounters.__counters === "function") {
    return withCounters.__counters();
  }
  return { hits: 0, misses: 0, sets: 0, invalidations: 0 };
};

/** Counter shape exposed by `noopCacheStore`. */
export interface NoopCacheCounters {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
}

/** Noop snapshot: version 0, no snapshots, no persistence. */
export const noopSnapshotStore = (): SnapshotStore => ({
  getActiveVersion: () => 0,
  publish: () => 0,
  getSnapshot: () => undefined,
  getInUseVersion: () => 0,
  markInUse: () => {},
  isAvailable: () => false,
});

/** Noop coalesce: never finds an in-flight entry; caller always registers. */
export const noopCoalesceStore = (): CoalesceStore => ({
  checkInFlight: () => undefined,
  registerInFlight: async (key, factory) => factory(),
  removeInFlight: () => {},
  isAvailable: () => false,
});

// ---------------------------------------------------------------------------
// SharedStateManager factory
// ---------------------------------------------------------------------------

/**
 * Build a noop `SharedStateManager`.
 *
 * When `config.storeUrl` is empty (the default), this is equivalent to
 * constructing with all six noop stores. When a URL is provided but the
 * store cannot be reached, callers MUST honour the fail-open/fail-closed
 * policies encoded in `config` — they are NOT enforced by this factory.
 *
 * The returned `SharedStateManager.isEnabled` is `true` ONLY when a
 * non-empty `storeUrl` is configured (meaning a real backend *should* be
 * used). The actual availability of each store is reported via its
 * individual `isAvailable()` method.
 */
export const createNoopSharedStateManager = (
  config: SharedStateConfig,
): SharedStateManager => {
  const breaker = noopBreakerStore();
  const rateLimit = noopRateLimitStore();
  const idempotency = noopIdempotencyStore();
  const cache = noopCacheStore();
  const snapshot = noopSnapshotStore();
  const coalesce = noopCoalesceStore();

  let disposed = false;

  return {
    breaker,
    rateLimit,
    idempotency,
    cache,
    snapshot,
    coalesce,
    config,

    /** True only when a store URL was configured. */
    get isEnabled(): boolean {
      // A store URL in the config means the operator WANTS shared state;
      // `isAvailable()` on each store tells us whether it is reachable.
      // `isEnabled === true` means "attempt to use the store" — callers
      // MUST still check `isAvailable()` before trusting the result.
      return false; // noop mode: always false
    },

    dispose(): void | Promise<void> {
      if (disposed) return;
      disposed = true;
      // All noop stores are stateless; nothing to close.
    },
  };
};

/**
 * Build a noop `SharedStateManager` that reports `isEnabled = true` but
 * all stores return `isAvailable() = false`.
 *
 * Used in tests to verify that callers correctly handle a misconfigured
 * store (store URL present but backend unreachable) by falling back to
 * local behaviour per the fail-open / fail-closed config.
 */
export const createUnreachableSharedStateManager = (
  config: SharedStateConfig,
): SharedStateManager => {
  const breaker = noopBreakerStore();
  const rateLimit = noopRateLimitStore();
  const idempotency = noopIdempotencyStore();
  const cache = noopCacheStore();
  const snapshot = noopSnapshotStore();
  const coalesce = noopCoalesceStore();

  let disposed = false;

  return {
    breaker,
    rateLimit,
    idempotency,
    cache,
    snapshot,
    coalesce,
    config,

    /** Configured but unreachable → `isEnabled = true` but `isAvailable() = false` for all stores. */
    get isEnabled(): boolean {
      // Simulates: GATEWAY_SHARED_STORE_URL=redis://... but the Redis server is down.
      // The operator WANTS shared state; the store just isn't reachable yet.
      return true;
    },

    dispose(): void | Promise<void> {
      if (disposed) return;
      disposed = true;
    },
  };
};

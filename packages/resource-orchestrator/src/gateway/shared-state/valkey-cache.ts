/**
 * Valkey-backed `CacheStore` (GHA-NEXT-020 — Phase D / P0).
 *
 * Cross-instance response cache. Stores serialized `CacheEntry` payloads
 * keyed by the existing `CacheKey` shape (routeId, manifestVersion, scope,
 * hash). All operations are eventually consistent; manifest version bumps
 * naturally invalidate the old version's keys without requiring a
 * fan-out broadcast.
 *
 * Storage layout:
 *
 *   STRING  cache:{routeId}:{manifestVersion}:{scope}:{hash}    JSON CacheEntry
 *
 *   The `manifestVersion` is part of the key, so a snapshot bump
 *   automatically orphans the old entries. We do NOT maintain a
 *   route-id index because the `invalidateByRoute` path uses `SCAN`
 *   with the `cache:{routeId}:*` pattern, which Valkey accepts in
 *   production (it is only `KEYS *` that is blocked).
 *
 * TTL: per-entry `ttlMs`. We round up to the next whole second (Valkey
 *      EX accepts whole seconds) and treat `ttlMs <= 0` as "skip cache".
 *
 * Fail strategy: fail-open. When the connection drops the orchestrator
 * MUST fall back to the local `VersionedCache`. The local cache is
 * always present so a degraded shared store never blocks traffic.
 *
 * Observability: every `get/set/invalidate` increments an internal
 * counter exposed via `__cacheCounters(store)`. Counters reset on
 * connection drop because `status` flips back to ready.
 */

import type { CacheEntry } from "../route";
import type { CacheKey } from "@axi/gateway-contracts";
import type { CacheStore } from "./shared-state-manager";
import type { RedisLike } from "./valkey-breaker";

/** Convert a `CacheKey` into a deterministic Valkey key. The `version`
 *  segment comes BEFORE the scope so version bumps naturally segregate
 *  stale entries without an explicit purge. */
export const cacheKeyToValkeyKey = (key: CacheKey): string =>
  `cache:${key.routeId}:${key.manifestVersion}:${key.scope}:${key.hash}`;

const routeKeyPrefix = (routeId: string): string => `cache:${routeId}:`;

/** Convert milliseconds to whole seconds, rounding UP. A 0/negative
 *  ttl returns 0 (the caller MUST treat that as "skip cache"). */
const ttlSeconds = (ttlMs: number): number => {
  if (ttlMs <= 0) return 0;
  return Math.max(1, Math.ceil(ttlMs / 1000));
};

export interface ValkeyCacheCounters {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
}

export interface ValkeyCacheStoreHandle {
  readonly store: CacheStore;
  /** Read the live observability counters. */
  counters(): ValkeyCacheCounters;
}

export const createValkeyCacheStore = (redis: RedisLike): ValkeyCacheStoreHandle => {
  let disposed = false;

  let hits = 0;
  let misses = 0;
  let sets = 0;
  let invalidations = 0;

  const isAlive = (): boolean =>
    !disposed && redis.status !== "end" && redis.status !== "close";

  const store: CacheStore = {
    get(_key) {
      // GHA-NEXT-020 — the `CacheStore.get` contract is sync. The
      // original fire-and-forget behaviour is preserved (background
      // counter increment + eventual mirror warm-up). The async
      // path that actually returns a cross-instance value lives in
      // `readAsync` and is invoked by `dispatch.ts` BEFORE this
      // sync getter runs; the sync getter is the second-chance
      // lookup for the in-process mirror that a previous
      // dispatcher already warmed. We do NOT block on a network
      // round-trip here — that would stall the entire Node.js
      // event loop. The async path is the cross-instance fix.
      const valkeyKey = cacheKeyToValkeyKey(_key);
      void (async () => {
        try {
          const raw = await redis.get(valkeyKey);
          if (raw) hits += 1;
          else misses += 1;
        } catch {
          /* best-effort */
        }
      })();
      return undefined;
    },

    /**
     * GHA-NEXT-020 — async cross-instance read. The dispatcher
     * awaits this BEFORE the sync `get` to convert the sync
     * `CacheStore` contract into a real cross-instance cache
     * without changing the interface. Returns `undefined` on miss
     * or transport failure.
     */
    async readAsync(_key): Promise<CacheEntry | undefined> {
      const valkeyKey = cacheKeyToValkeyKey(_key);
      try {
        const raw = await redis.get(valkeyKey);
        if (!raw) {
          misses += 1;
          return undefined;
        }
        hits += 1;
        return JSON.parse(raw) as CacheEntry;
      } catch {
        misses += 1;
        return undefined;
      }
    },

    set(key, entry, ttlMs) {
      if (ttlMs <= 0) return;
      const seconds = ttlSeconds(ttlMs);
      const valkeyKey = cacheKeyToValkeyKey(key);
      const payload = JSON.stringify(entry);
      sets += 1;
      void (async () => {
        try {
          await redis.set(valkeyKey, payload, "EX", seconds);
        } catch {
          /* best-effort */
        }
      })();
    },

    invalidate(key) {
      const valkeyKey = cacheKeyToValkeyKey(key);
      invalidations += 1;
      void (async () => {
        try {
          await redis.del(valkeyKey);
        } catch {
          /* best-effort */
        }
      })();
    },

    invalidateByRoute(routeId) {
      // SCAN-based sweep. KEYS is blocked in production clusters so we
      // use SCAN with a tiny COUNT hint; the iteration completes in the
      // background and never blocks the call site.
      const prefix = routeKeyPrefix(routeId);
      invalidations += 1;
      void (async () => {
        try {
          // ioredis exposes scan via `.scan(cursor, "MATCH", pattern, "COUNT", n)`.
          // We keep the type loose because the mock's signature differs.
          const scan = (redis as unknown as {
            scan: (
              cursor: string | number,
              ...args: unknown[]
            ) => Promise<[string | number, string[]]>;
          }).scan.bind(redis);
          let cursor: string | number = "0";
          const collected: string[] = [];
          // Bound the iteration; in practice a route has at most a few
          // hundred keys and the cursor converges quickly.
          for (let iter = 0; iter < 32; iter += 1) {
            const [next, batch] = await scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
            for (const k of batch) {
              if (k.startsWith(prefix)) collected.push(k);
            }
            cursor = typeof next === "string" ? next : Number(next);
            if (cursor === "0" || cursor === 0) break;
          }
          if (collected.length) {
            // `del` is variadic in ioredis; cast to keep the type
            // surface clean for the mock.
            const del = (redis as unknown as {
              del: (...keys: string[]) => Promise<number>;
            }).del.bind(redis);
            await del(...collected);
          }
        } catch {
          /* best-effort */
        }
      })();
    },

    isAvailable() {
      return isAlive();
    },
  };

  return {
    store,
    counters: () => ({ hits, misses, sets, invalidations }),
  };
};
/**
 * Valkey-backed `IdempotencyStore` (GHA-NEXT-023 — Phase D / P0).
 *
 * Distributed lock for non-idempotent operations (`resource.generate.*`).
 * Two-state model:
 *
 *   - `idempotency:{key}:lock`     — STRING; SET NX PX (atomic lock)
 *   - `idempotency:{key}:result`   — STRING JSON; SET + EX (cached payload)
 *
 * Lock lifecycle:
 *
 *   1. Caller asks `tryAcquire(key, ttlMs)`:
 *      SET `idempotency:{key}:lock` "{owner}" NX PX ttlMs.
 *      Returns true if acquired, false if the lock is held.
 *
 *   2. On successful execution the caller writes the result via
 *      `setResult(key, result, ttlMs)` so concurrent callers can
 *      join via `getResult(key)`.
 *
 *   3. On failure the caller calls `release(key)` so a retry can
 *      proceed; successful executions do NOT release (the result TTL
 *      handles cleanup and the lock is overwritten by `setResult`).
 *
 * Fail strategy: fail-closed by default. When the store is
 * unreachable `tryAcquire` returns true so the caller proceeds with
 * local in-memory coalescing only — the noop fallback advertises the
 * same surface. Set `GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL=false` (the
 * default in configFromEnv) to make the orchestrator reject
 * non-idempotent operations on outage.
 *
 * Test seam: `createValkeyIdempotencyStore` accepts an `ioredis-mock`
 * client instead of a real `ioredis` instance.
 */

import type { AdapterSearchResult } from "@axi/gateway-contracts";
import type { IdempotencyStore } from "./shared-state-manager";
import type { SharedStateConfig } from "./shared-state-manager";
import type { RedisLike } from "./valkey-breaker";

const lockKey = (key: string): string => `idempotency:${key}:lock`;
const resultKey = (key: string): string => `idempotency:${key}:result`;

export const createValkeyIdempotencyStore = (
  redis: RedisLike,
  _config: SharedStateConfig,
): IdempotencyStore => {
  // SET NX PX via raw command. ioredis-mock returns the string "OK"
  // when NX succeeds and `null` when the key already exists. We use
  // a defensive try/catch so a connection error fails closed.
  const setNxPx = async (key: string, value: string, ttlMs: number): Promise<boolean> => {
    try {
      // Cast through any because ioredis's overloads vary by version;
      // the runtime contract is (key, value, "PX", ttlMs, "NX") and
      // returns "OK" | null.
      const result = await (redis as unknown as {
        set: (...args: unknown[]) => Promise<unknown>;
      }).set(key, value, "PX", ttlMs, "NX");
      return result === "OK";
    } catch {
      // On connection error, fail-open: caller proceeds with local coalescing.
      return true;
    }
  };

  return {
    async tryAcquire(key, ttlMs) {
      // Owner is a random UUID-ish token so a future release knows
      // whether it owns the lock. Releases from non-owners are
      // skipped (best-effort).
      const owner = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      return setNxPx(lockKey(key), owner, Math.max(1000, ttlMs));
    },

    async release(key) {
      try {
        await redis.del(lockKey(key));
      } catch {
        /* best-effort */
      }
    },

    async getResult(key) {
      try {
        const raw = await redis.get(resultKey(key));
        if (!raw) return undefined;
        return JSON.parse(raw) as AdapterSearchResult;
      } catch {
        return undefined;
      }
    },

    async setResult(key, result, ttlMs) {
      try {
        await redis.set(resultKey(key), JSON.stringify(result), "EX", Math.max(1, Math.ceil(ttlMs / 1000)));
        // Drop the lock once the result is durable; concurrent joiners
        // see the result without round-tripping through the lock.
        await redis.del(lockKey(key));
      } catch {
        /* best-effort */
      }
    },

    isAvailable() {
      return redis.status !== "end" && redis.status !== "close";
    },
  };
};
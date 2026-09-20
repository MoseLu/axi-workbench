/**
 * Valkey-backed `CoalesceStore` (GHA-NEXT-026 — Phase D / P0).
 *
 * Cross-instance request coalescing for `resource.generate.*` routes.
 * Idempotent routes (`resource.search.*`) use the local
 * `CoalescingRegistry` and do NOT interact with this store.
 *
 * Storage layout:
 *
 *   STRING  coalesce:{routeId}:{idempotencyKey}:{manifestVersion}
 *          — JSON `AdapterSearchResult` written when the in-flight
 *            request resolves; subsequent callers `GET` it to join.
 *
 * Lifecycle:
 *
 *   1. Caller asks `checkInFlight(key)`; if a result is already cached
 *      it returns that and the caller does NOT execute the factory.
 *   2. Otherwise the caller passes its factory to
 *      `registerInFlight(key, factory)` which executes the factory
 *      and atomically SETs the result with TTL on completion.
 *   3. `removeInFlight(key)` is called by callers that want to
 *      proactively drop the entry — the TTL handles cleanup in the
 *      normal path.
 *
 * Fail strategy: fail-open. If the store is unreachable the caller
 * proceeds with the local `CoalescingRegistry` only (no
 * cross-instance deduplication). This is safe because each instance
 * already deduplicates locally.
 */

import type { AdapterSearchResult, CoalescingKey } from "@axi/gateway-contracts";
import type { CoalesceStore } from "./shared-state-manager";
import type { SharedStateConfig } from "./shared-state-manager";
import type { RedisLike } from "./valkey-breaker";

const coalesceKey = (key: CoalescingKey): string =>
  `coalesce:${key.routeId}:${key.idempotencyKey}:${key.manifestVersion}`;
const IN_FLIGHT_TOKEN = "__in_flight__";

export const createValkeyCoalesceStore = (
  redis: RedisLike,
  config: SharedStateConfig,
): CoalesceStore => {
  return {
    async checkInFlight(key) {
      try {
        const raw = await redis.get(coalesceKey(key));
        if (!raw) return undefined;
        // The token sentinel means a peer is currently running the
        // factory; callers should not race past it.
        if (raw === IN_FLIGHT_TOKEN) return undefined;
        return JSON.parse(raw) as AdapterSearchResult;
      } catch {
        return undefined;
      }
    },

    /**
     * GHA-NEXT-026 — atomic cross-instance claim via SET NX.
     *
     * Two peers calling this with the same key: exactly one
     * SET NX returns "OK" (the claimer); the other returns
     * null (lost race). Only the claimer runs the factory;
     * the loser waits for the result.
     *
     * The factory's returned value replaces the sentinel
     * under the same key with a TTL so subsequent callers
     * receive the cached result.
     */
    async registerInFlight(key, factory) {
      const keyStr = coalesceKey(key);
      try {
        // Atomic claim: SET key sentinel NX EX ttl
        const claimed = await redis.set(
          keyStr,
          IN_FLIGHT_TOKEN,
          "EX",
          Math.max(5, config.coalesceTtlSeconds),
          "NX",
        );
        if (claimed !== "OK") {
          // Lost the race; another peer owns the work. Wait for
          // the result by polling checkInFlight (up to ttl).
          const deadline = Date.now() + (config.coalesceTtlSeconds * 1000);
          while (Date.now() < deadline) {
            const r = await redis.get(keyStr);
            if (r && r !== IN_FLIGHT_TOKEN) {
              return JSON.parse(r) as AdapterSearchResult;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          // Timeout: peer took too long; fall through and run
          // factory locally so the request does not hang forever.
        }
      } catch {
        // Fail-open: if the store is unreachable, fall through
        // and run the factory locally. Each instance still
        // deduplicates via its own CoalescingRegistry.
      }
      // Claimer (or fail-open path) runs the factory.
      const result = await factory();
      try {
        await redis.set(
          keyStr,
          JSON.stringify(result),
          "EX",
          Math.max(5, config.coalesceTtlSeconds),
        );
      } catch {
        /* best-effort */
      }
      return result;
    },

    removeInFlight(key) {
      void (async () => {
        try {
          await redis.del(coalesceKey(key));
        } catch {
          /* best-effort */
        }
      })();
    },

    isAvailable() {
      return redis.status !== "end" && redis.status !== "close";
    },
  };
};
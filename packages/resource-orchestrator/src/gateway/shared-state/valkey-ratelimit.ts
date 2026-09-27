/**
 * Valkey-backed `RateLimitStore` (GHA-NEXT-022 — Phase D / P0).
 *
 * Counter-per-window implementation. The atomic check-and-increment
 * is performed by a single Lua script that:
 *
 *   1. INCRs `ratelimit:{key}:{windowStart}` (Valkey STRING),
 *   2. sets EXPIRE on first increment,
 *   3. returns `{ count, ttlMs }`.
 *
 * The caller decides allow/deny based on `count <= limit`. Putting the
 * INCR + EXPIRE inside one Lua script avoids the race where a client
 * crashes between INCR and EXPIRE and leaves an immortal counter.
 *
 * Fail strategy: fail-closed by default (`rateLimitFailClosed=true`).
 * When the connection drops the orchestrator MUST reject the request
 * (return `{ allowed: false, ... }`) rather than risk exceeding the
 * provider's quota. Set `GATEWAY_SHARED_RATELIMIT_GRACEFUL=true` for
 * fail-open behaviour.
 */

import type { RateLimitStore } from "./shared-state-manager";
import type { SharedStateConfig } from "./shared-state-manager";
import type { RedisLike } from "./valkey-breaker";

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

const windowKey = (key: string, windowStart: number): string => `ratelimit:${key}:${windowStart}`;

const windowStartFor = (now: number, windowMs: number): number => Math.floor(now / windowMs) * windowMs;

export const createValkeyRateLimitStore = (
  redis: RedisLike,
  _config: SharedStateConfig,
): RateLimitStore => {
  return {
    async checkAndIncrement(key, limit, windowMs) {
      const now = Date.now();
      const start = windowStartFor(now, windowMs);
      const redisKey = windowKey(key, start);
      const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      try {
        // ioredis-mock and ioredis both expose `eval(script, numKeys, key, arg)`.
        // We cast through unknown because ioredis-mock's typing differs.
        const raw = await (redis as unknown as {
          eval: (script: string, numKeys: number, ...args: string[]) => Promise<unknown>;
        }).eval(RATE_LIMIT_LUA, 1, redisKey, String(ttlSeconds));
        const arr = Array.isArray(raw) ? raw : [];
        const count = typeof arr[0] === "number" ? arr[0] : Number(arr[0]);
        const pttl = typeof arr[1] === "number" ? arr[1] : Number(arr[1]);
        const resetAt = Number.isFinite(pttl) && pttl > 0 ? now + pttl : now + windowMs;
        const allowed = count <= limit;
        return {
          allowed,
          remaining: Math.max(0, limit - count),
          resetAt,
        };
      } catch {
        // Fail-closed: surface as `allowed=false` so the orchestrator
        // can return 429. The caller is expected to log the underlying
        // error via the metrics layer.
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + windowMs,
        };
      }
    },

    async reset(key) {
      try {
        const now = Date.now();
        const matches = await redis.keys(`ratelimit:${key}:*`);
        if (matches.length) await redis.del(matches[0]!);
        void now;
      } catch {
        /* best-effort */
      }
    },

    isAvailable() {
      return redis.status !== "end" && redis.status !== "close";
    },
  };
};
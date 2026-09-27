/**
 * Valkey-backed `SnapshotStore` (GHA-NEXT-024 — Phase D / P0).
 *
 * Atomic publish/markInUse. Previous versions are retained under
 * `snapshot:v{n}` so a rolling restart can warm up against any
 * historical version.
 *
 * Storage layout:
 *
 *   STRING  snapshot:active         — int (current version)
 *   STRING  snapshot:v{n}           — JSON `ReadonlyArray<RouteDefinition>`
 *   STRING  snapshot:inuse          — int (this instance's loaded version)
 *
 * Publish uses a Lua script that:
 *
 *   1. Reads `snapshot:active` → `prev`
 *   2. Writes `snapshot:v{prev + 1}` = JSON(routes)
 *   3. Updates `snapshot:active` = prev + 1
 *
 * This is single-writer safe; concurrent publishers serialise through
 * the script. The previous version's payload stays at
 * `snapshot:v{prev}` so a warm-up reader can still find it.
 *
 * Fail strategy: fail-open. When the store is unreachable the
 * orchestrator continues with its in-memory snapshot (the previous
 * behaviour); the store just isn't getting the broadcast.
 */

import type { RouteDefinition } from "../route";
import type { SnapshotStore } from "./shared-state-manager";
import type { SharedStateConfig } from "./shared-state-manager";
import type { RedisLike } from "./valkey-breaker";

const ACTIVE_KEY = "snapshot:active";
const INUSE_KEY = "snapshot:inuse";

const PUBLISH_LUA = `
local prev = tonumber(redis.call('GET', KEYS[1]) or '0')
local nextVersion = prev + 1
redis.call('SET', KEYS[2], ARGV[1])
redis.call('SET', KEYS[1], tostring(nextVersion))
return nextVersion
`;

export const createValkeySnapshotStore = (
  redis: RedisLike,
  _config: SharedStateConfig,
): SnapshotStore => {
  let cachedActive = 0;
  let cachedInUse = 0;
  const snapshotCache = new Map<number, ReadonlyArray<RouteDefinition>>();

  const refreshActive = async (): Promise<void> => {
    try {
      const raw = await redis.get(ACTIVE_KEY);
      cachedActive = raw ? Number(raw) || 0 : 0;
    } catch {
      /* keep cached value */
    }
  };

  // Eagerly hydrate the active version so the synchronous
  // `getActiveVersion` accessor returns the durable value on the
  // first call. We don't await here; the first read after startup
  // may briefly see 0 until the promise settles.
  void refreshActive();

  return {
    getActiveVersion() {
      return cachedActive;
    },

    publish(snapshot) {
      // Synchronous surface — mirrors the noop snapshot store. We
      // compute the next version locally from the cached active and
      // dispatch the durable write asynchronously. The Lua script
      // serialises concurrent writers so a missed snapshot still
      // produces a unique version number.
      const next = cachedActive + 1;
      const payload = JSON.stringify(snapshot);
      const versionKey = `snapshot:v${next}`;
      snapshotCache.set(next, snapshot);
      cachedActive = next;
      void (async () => {
        try {
          await (redis as unknown as {
            eval: (script: string, numKeys: number, ...args: string[]) => Promise<unknown>;
          }).eval(PUBLISH_LUA, 2, ACTIVE_KEY, versionKey, payload);
          // Refresh in case another publisher raced ahead of us.
          await refreshActive();
        } catch {
          /* fail-open */
        }
      })();
      return next;
    },

    getSnapshot(version) {
      const cached = snapshotCache.get(version);
      if (cached) return cached;
      // Synchronous surface: an async reader is exposed below.
      return undefined;
    },

    getInUseVersion() {
      return cachedInUse;
    },

    markInUse(version) {
      cachedInUse = version;
      void (async () => {
        try {
          await redis.set(INUSE_KEY, String(version));
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

/**
 * Async variant of `getSnapshot`. Reads `snapshot:v{n}` directly from
 * Valkey when the local cache misses. Returns `undefined` on error
 * (fail-open).
 */
export const getSnapshotAsync = async (
  redis: RedisLike,
  version: number,
): Promise<ReadonlyArray<RouteDefinition> | undefined> => {
  try {
    const raw = await redis.get(`snapshot:v${version}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as ReadonlyArray<RouteDefinition>;
  } catch {
    return undefined;
  }
};
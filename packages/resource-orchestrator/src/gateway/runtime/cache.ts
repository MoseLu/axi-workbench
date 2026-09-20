import type { AdapterSearchResult, Intent } from "@axi/gateway-contracts";
import { hashCacheKey, type CacheKey, type CacheScope } from "@axi/gateway-contracts";
import type { CacheEntry } from "../route";

/**
 * GHA-039 — versioned cache key builder + negative-cache support.
 *
 * The previous cache filter stored entries keyed only on the
 * `requestKey`. That bled across manifest versions and across
 * toolIds: bumping the snapshot didn't invalidate stale results, and
 * a requestKey collision between two tools shared the same entry.
 *
 * This module builds keys from `(routeId, manifestVersion, scope,
 * payloadHash)`. The manifest version prevents stale-snapshot reads;
 * the scope controls whether payload is included.
 *
 * A negative-cache entry is just a CacheEntry whose result has zero
 * items; we honour a separate `negativeTtlMs` so a sick provider isn't
 * pounded by retries.
 */

export type { CacheScope };

export interface BuildCacheKeyInput {
  readonly routeId: string;
  readonly manifestVersion: number;
  readonly scope: CacheScope;
  readonly intent: Intent;
  /** Opaque caller-supplied request key. When scope === "request-key"
   *  this is hashed as the only payload source. */
  readonly requestKey: string;
}

const payloadFor = (intent: Intent): string => {
  // Deterministic JSON-ish string: we sort keys so {a:1,b:2} and
  // {b:2,a:1} hash identically. Constraints may carry arbitrary
  // values; stringification tolerates that without a full JSON
  // canonicalization pass.
  const constraints = intent.constraints || {};
  const parts: string[] = [];
  const keys = Object.keys(constraints).sort();
  for (const key of keys) parts.push(`${key}=${stringifyStable(constraints[key])}`);
  parts.push(`kinds=${(intent.resourceKinds || []).slice().sort().join(",")}`);
  return parts.join(";");
};

const stringifyStable = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(stringifyStable).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${k}:${stringifyStable(v)}`).join(",")}}`;
  }
  return String(value);
};

export const buildCacheKey = (input: BuildCacheKeyInput): CacheKey => {
  let payload: string;
  switch (input.scope) {
    case "route-only":
      payload = "";
      break;
    case "request-key":
      payload = input.requestKey;
      break;
    case "route-payload":
    default:
      payload = `${input.requestKey}|${payloadFor(input.intent)}`;
      break;
  }
  // The manifest version is folded into the hash so that a snapshot
  // bump naturally invalidates every entry from the previous version
  // — callers that pre-compute a new key can read the old store
  // through `VersionedCache.get` and receive `undefined` without
  // having to flush.
  return {
    scope: input.scope,
    routeId: input.routeId,
    hash: hashCacheKey(`${input.manifestVersion}|${payload}`),
    manifestVersion: input.manifestVersion,
  };
};

const serialize = (key: CacheKey): string => `${key.routeId}|${key.manifestVersion}|${key.scope}|${key.hash}`;

/** A thin wrapper around the gateway's `Map<string, CacheEntry>` that
 *  handles version-aware lookup and insertion. */
export class VersionedCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly limits = new Map<string, { maxEntries: number }>();

  /** Set the LRU cap for a route. When the route exceeds `maxEntries`,
 *   the oldest entry is evicted. 0 disables caching for the route. */
  configure(routeId: string, maxEntries: number): void {
    this.limits.set(routeId, { maxEntries });
  }

  /** Read an entry. Returns `undefined` when missing or expired. */
  get(key: CacheKey, now = Date.now()): CacheEntry | undefined {
    const entry = this.store.get(serialize(key));
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(serialize(key));
      return undefined;
    }
    return entry;
  }

  /** Insert an entry. The TTL is computed from the route policy:
 *   empty results use `negativeTtlMs`; everything else uses
 *   `ttlMs`. `ttlMs === 0` disables insertion. */
  set(key: CacheKey, result: AdapterSearchResult, options: { ttlMs: number; negativeTtlMs: number }, now = Date.now()): void {
    if (options.ttlMs <= 0) return;
    const isEmpty = !result.items || result.items.length === 0;
    const ttl = isEmpty ? Math.min(options.ttlMs, options.negativeTtlMs) : options.ttlMs;
    if (ttl <= 0) return;
    const entry: CacheEntry = {
      result,
      expiresAt: now + ttl,
      source: key.routeId,
    };
    const serialized = serialize(key);
    this.store.set(serialized, entry);
    const limit = this.limits.get(key.routeId);
    if (limit && limit.maxEntries > 0) {
      // Evict oldest entries for this route when over the cap. Cheap
      // O(n) scan; the cache is bounded by maxEntries so n is small.
      const sameRoute: string[] = [];
      for (const [k, e] of this.store.entries()) {
        const parsed = parseSerialized(k);
        if (parsed?.routeId === key.routeId && e.expiresAt > now) sameRoute.push(k);
      }
      while (sameRoute.length > limit.maxEntries) {
        const oldestKey = sameRoute.shift();
        if (oldestKey) this.store.delete(oldestKey);
      }
    }
  }

  /** Test-only: drop everything. */
  clear(): void {
    this.store.clear();
  }

  /** Diagnostic: number of live entries. */
  size(): number {
    return this.store.size;
  }

  /** Snapshot the cache as a plain `Map<string, CacheEntry>` for
   *  consumers (legacy filters, tests) that read through the old
   *  interface. The returned map is a snapshot — mutations are NOT
   *  reflected in the versioned cache. */
  asMap(): Map<string, CacheEntry> {
    const map = new Map<string, CacheEntry>();
    for (const [key, entry] of this.store.entries()) map.set(key, entry);
    return map;
  }

  /** Iterate the serialized keys — used by tests and the dispatcher's
   *  snapshot bridge. */
  *entries(): IterableIterator<[string, CacheEntry]> {
    for (const [k, v] of this.store.entries()) yield [k, v];
  }
}

/** Adapter that wraps a legacy `Map<string, CacheEntry>` so a
 *  VersionedCache can be presented to callers that still observe
 *  the Map interface (filters, tests). Mirrors writes through to the
 *  underlying Map so `cache.size` and `cache.get(...)` reflect
 *  inserts done via the VersionedCache. */
export const attachLegacyMap = (
  cache: VersionedCache,
  legacy: Map<string, CacheEntry>,
): VersionedCache => {
  for (const [key, value] of legacy.entries()) cache["store"].set(key, value);
  const originalSet = cache.set.bind(cache);
  // The function type already accepts CacheKey; we re-wrap to mirror
  // writes without losing the caller's typed signature.
  const wrappedSet = cache.set;
  void wrappedSet;
  cache.set = ((key: CacheKey, result: AdapterSearchResult, options: { ttlMs: number; negativeTtlMs: number }, now = Date.now()) => {
    originalSet(key, result, options, now);
    const serialized = `${key.routeId}|${key.manifestVersion}|${key.scope}|${key.hash}`;
    const entry = cache["store"].get(serialized);
    if (entry) legacy.set(serialized, entry);
    return cache;
  }) as typeof cache.set;
  return cache;
};

const parseSerialized = (key: string): CacheKey | undefined => {
  const [routeId, manifestVersion, scope, hash] = key.split("|");
  if (!routeId || !manifestVersion || !scope || !hash) return undefined;
  return {
    routeId,
    manifestVersion: Number(manifestVersion),
    scope: scope as CacheScope,
    hash,
  };
};
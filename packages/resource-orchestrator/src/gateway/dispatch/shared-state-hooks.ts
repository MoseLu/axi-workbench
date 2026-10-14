import type { AdapterSearchResult, CacheKey, CacheScope, CoalescingKey } from "@axi/gateway-contracts";
import type { CacheEntry } from "../route";
import { buildCacheKey } from "../runtime/cache";
import type { SharedStateManager } from "../shared-state/shared-state-manager";
import type { DispatchOptions, IdempotencyOutcome } from "./types";

// ---------------------------------------------------------------------------
// Shared-state helpers (GHA-NEXT-018 / 020 / 035 / 040)
//
// Every helper that touches `options.sharedState` is wrapped in try/catch
// so a misbehaving store backend NEVER throws inside the dispatch hot path.
// Fail-open / fail-closed defaults mirror the Wave 2 design (see
// shared-state-manager.ts §11):
//
//   - rateLimitFailClosed=true (default): allow when store unreachable,
//     since the noop default returns allowed=true.
//   - breakerFailOpen=true (default): skip cross-instance breaker sync
//     when store unreachable; the in-process CircuitBreaker still runs.
//   - idempotencyFailClosed=true (default): skip lock when store
//     unreachable; local CoalescingRegistry handles within-instance
//     dedup.
//   - cache / coalesce: fail-open — local VersionedCache /
//     CoalescingRegistry is the source of truth.
//
// The dispatcher reads these helpers BEFORE any target adapter call so
// fail-closed rejections short-circuit cleanly with a typed warning
// marker (`[shared-state:429:rate_limited:reset=<ms>]` and
// `[shared-state:409:idempotency_conflict]`) the HTTP edge maps to
// 429 / 409 responses.
// ---------------------------------------------------------------------------

/** Resolve the per-toolId rate-limit key. Cross-instance quota is
 *  bucketed by toolId so two unrelated callers don't starve each other.
 *  When the route's toolId is `resource.search.*` we use a fixed
 *  "search:{toolId}" namespace; "resource.generate.*" uses
 *  "generate:{toolId}". */
const rateLimitKeyFor = (toolId: string): string => {
  const namespace = toolId.startsWith("resource.generate.") ? "generate" : "search";
  return `${namespace}:${toolId}`;
};

/** Resolve the idempotency key for non-idempotent routes. Stable per
 *  (toolId, requestKey) so two concurrent identical requests against
 *  the same generation route collide on the same lock and join the
 *  same in-flight invocation. */
export const idempotencyKeyFor = (toolId: string, requestKey: string, manifestVersion: number): string =>
  `idemp:${toolId}:${manifestVersion}:${requestKey}`;

/** Resolve the cross-instance coalesce key for non-idempotent routes.
 *  CoalesceStore.registerInFlight uses this to dedupe concurrent
 *  generation requests across gateway instances. */
export const coalesceStoreKeyFor = (
  routeId: string,
  toolId: string,
  manifestVersion: number,
  requestKey: string,
): CoalescingKey => ({
  routeId,
  idempotencyKey: `${toolId}|${manifestVersion}|${requestKey}`,
  manifestVersion,
});

/** Build the cross-instance cache key. Reuses `buildCacheKey` so the
 *  payload hashing stays consistent with the in-process VersionedCache;
 *  the dispatcher writes through to both stores on cache miss so a
 *  cache hit on any instance resolves the same key. */
export const sharedCacheKeyFor = (
  options: DispatchOptions,
  routeId: string,
  cacheScope: CacheScope,
): CacheKey => buildCacheKey({
  routeId,
  manifestVersion: options.manifestVersion || 1,
  scope: cacheScope,
  intent: options.intent,
  requestKey: options.requestKey,
});

/** GHA-NEXT-018 — cross-instance rate-limit gate. Returns `null` when
 *  the call is allowed; returns a typed warning marker when the
 *  shared store denies. Wrapped in try/catch: an unreachable store
 *  falls open (caller proceeds with no quota) per Wave 2 defaults. */
export const sharedRateLimitCheck = async (
  sharedState: SharedStateManager | undefined,
  toolId: string,
): Promise<string | null> => {
  if (!sharedState) return null;
  // GHA-NEXT-025 — honour the operator's `rateLimitFailClosed`
  // config for BOTH the unreachable (`!isAvailable()`) and
  // exception paths. Default true ⇒ unavailable store allows the
  // call through (fail-open); set to false to reject with a
  // typed failure. The previous implementation bailed out
  // early on `!isAvailable()` and never read the config, which
  // meant the operator's "fail-closed" preference was silently
  // ignored on the unreachable path.
  const failClosed = sharedState.config?.rateLimitFailClosed ?? true;
  if (!sharedState.rateLimit.isAvailable()) {
    return failClosed ? null : `[shared-state:429:rate_limit_unavailable] route=${toolId}`;
  }
  try {
    // 60 calls / minute per toolId is a sensible default; manifest
    // overrides are a Phase 2 follow-up (GHA-NEXT-018 escalation
    // path). Window chosen so a sick deploy can't cascade into a
    // self-inflicted quota exhaustion on the upstream.
    const decision = await sharedState.rateLimit.checkAndIncrement(
      rateLimitKeyFor(toolId),
      60,
      60_000,
    );
    if (decision.allowed) return null;
    return `[shared-state:429:rate_limited:reset=${decision.resetAt}] route=${toolId} remaining=${decision.remaining}`;
  } catch (err) {
    if (failClosed) return null;
    return `[shared-state:429:rate_limit_unavailable] route=${toolId}`;
  }
};

/** GHA-NEXT-020 / GHA-NEXT-040 — shared cache read. Returns the entry
 *  on a hit (caller short-circuits) and `undefined` on miss / when the
 *  store is unreachable / when the dispatcher hasn't opted into the
 *  shared cache. Fail-open: unreachable store returns undefined so
 *  the dispatcher falls back to the in-process VersionedCache. */
export const sharedCacheRead = async (
  sharedState: SharedStateManager | undefined,
  key: CacheKey,
): Promise<CacheEntry | undefined> => {
  if (!sharedState) return undefined;
  if (!sharedState.cache.isAvailable()) return undefined;
  // GHA-NEXT-020 — try the async cross-instance read first
  // (`ValkeyCacheStore.readAsync`); fall back to the sync getter
  // for in-process mirrors / noop stores that do not implement
  // the async hook. This is the only place where a cross-instance
  // cache hit actually lands in the dispatch path.
  if (typeof sharedState.cache.readAsync === "function") {
    try {
      return await sharedState.cache.readAsync(key);
    } catch {
      return undefined;
    }
  }
  try {
    return sharedState.cache.get(key);
  } catch {
    return undefined;
  }
};

/** GHA-NEXT-020 / GHA-NEXT-040 — shared cache write. Stores the
 *  entry using the serving route's `cacheTtlMs` so cache entries
 *  honour the per-route TTL semantics. Fail-open: unreachable store
 *  silently skips. */
export const sharedCacheWrite = (
  sharedState: SharedStateManager | undefined,
  key: CacheKey,
  result: AdapterSearchResult,
  cacheTtlMs: number,
  negativeTtlMs: number,
): void => {
  if (!sharedState) return;
  if (!sharedState.cache.isAvailable()) return;
  if (cacheTtlMs <= 0) return;
  try {
    const isEmpty = !result.items || result.items.length === 0;
    const ttl = isEmpty ? Math.min(cacheTtlMs, negativeTtlMs) : cacheTtlMs;
    if (ttl <= 0) return;
    // The shared CacheStore stores CacheEntry values; mirror the
    // VersionedCache.set semantics (expiresAt + source) so reads on
    // another instance observe the same expiry contract.
    sharedState.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
      source: key.routeId,
    }, ttl);
  } catch {
    // Fail-open — unreachable store must not break dispatch.
  }
};

export const sharedIdempotencyAcquire = async (
  sharedState: SharedStateManager | undefined,
  key: string,
  ttlMs: number,
): Promise<IdempotencyOutcome> => {
  if (!sharedState) return { status: "proceed" };
  // GHA-NEXT-025 — honour the operator's `idempotencyFailClosed`
  // config for BOTH the unreachable (`!isAvailable()`) and
  // exception paths. Default true ⇒ unavailable store allows
  // the call through (local CoalescingRegistry handles
  // within-instance dedup); set to false to reject with a
  // typed conflict. The previous implementation bailed out
  // early on `!isAvailable()` and never read the config, which
  // meant the operator's "fail-closed" preference was silently
  // ignored on the unreachable path.
  const failClosed = sharedState.config?.idempotencyFailClosed ?? true;
  if (!sharedState.idempotency.isAvailable()) {
    return failClosed ? { status: "proceed" } : { status: "conflict" };
  }
  try {
    const acquired = await sharedState.idempotency.tryAcquire(key, ttlMs);
    if (acquired) return { status: "proceed" };
    // Lock NOT acquired — peer holds it. Try to join a published
    // result first; if absent, surface 409.
    const peerResult = await sharedState.idempotency.getResult(key);
    if (peerResult) return { status: "join", result: peerResult };
    return { status: "conflict" };
  } catch {
    if (failClosed) return { status: "proceed" };
    return { status: "conflict" };
  }
};

/** Publish the result for a non-idempotent route so future
 *  concurrent callers can join instead of re-executing. Called after
 *  a successful dispatch on a `idempotent=false` route. Fail-open:
 *  an unreachable store is silently skipped. */
export const sharedIdempotencyPublish = async (
  sharedState: SharedStateManager | undefined,
  key: string,
  result: AdapterSearchResult,
  ttlMs: number,
): Promise<void> => {
  if (!sharedState) return;
  if (!sharedState.idempotency.isAvailable()) return;
  try {
    await sharedState.idempotency.setResult(key, result, ttlMs);
  } catch {
    // Fail-open.
  }
};

/** Release the lock when execution FAILED. Successful executions
 *  keep the lock until the result TTL fires — releasing would let a
 *  peer re-execute a generation call that already succeeded. */
export const sharedIdempotencyRelease = async (
  sharedState: SharedStateManager | undefined,
  key: string,
): Promise<void> => {
  if (!sharedState) return;
  if (!sharedState.idempotency.isAvailable()) return;
  try {
    await sharedState.idempotency.release(key);
  } catch {
    // Fail-open.
  }
};

/** GHA-NEXT-035 — cross-instance coalesce for non-idempotent routes
 *  only. `addInFlight` returns either an in-flight AdapterSearchResult
 *  (caller joins) or `undefined` (caller proceeds to execute). The
 *  per-call CoalescingRegistry still runs for within-instance dedup;
 *  the shared CoalesceStore handles cross-instance dedup. */
export const sharedCoalesceCheck = async (
  sharedState: SharedStateManager | undefined,
  key: CoalescingKey,
): Promise<AdapterSearchResult | undefined> => {
  if (!sharedState) return undefined;
  if (!sharedState.coalesce.isAvailable()) return undefined;
  try {
    const inFlight = await sharedState.coalesce.checkInFlight(key);
    return inFlight;
  } catch {
    return undefined;
  }
};

/** Register the in-flight entry so peer instances can join. The
 *  factory builds the underlying promise; the store removes the entry
 *  when the promise settles. */
export const sharedCoalesceRegister = async (
  sharedState: SharedStateManager | undefined,
  key: CoalescingKey,
  factory: () => Promise<AdapterSearchResult>,
): Promise<AdapterSearchResult> => {
  if (!sharedState || !sharedState.coalesce.isAvailable()) {
    return factory();
  }
  try {
    return await sharedState.coalesce.registerInFlight(key, factory);
  } catch {
    return factory();
  }
};

/** GHA-NEXT-040 — record the outcome of a single adapter attempt on
 *  the shared breaker store so peer instances see the same circuit
 *  state within `propagationMs`. Fail-open: an unreachable store is
 *  silently skipped (the in-process CircuitBreaker still runs). */
export const sharedBreakerRecord = (
  sharedState: SharedStateManager | undefined,
  targetId: string,
  success: boolean,
): void => {
  if (!sharedState) return;
  if (!sharedState.breaker.isAvailable()) return;
  try {
    sharedState.breaker.record(targetId, success);
  } catch {
    // Fail-open.
  }
};

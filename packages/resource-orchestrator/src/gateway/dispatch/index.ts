import type { AdapterSearchResult } from "@axi/gateway-contracts";
import type { Filter, RouteContext, RouteDefinition } from "../route";
import { composeFilters } from "../filters";
import { createContext } from "../context";
import { BackpressureRegistry } from "../runtime/backpressure";
import { CoalescingRegistry } from "../runtime/coalesce";
import { buildCacheKey } from "../runtime/cache";
import { selectFallbackChain } from "../runtime/route-selection";
import { tryRoute } from "./handler";
import { legacyMapFor, policyForRouteId, selectRoute, versionedCacheFor } from "./router";
import {
  sharedCacheWrite,
  sharedIdempotencyPublish,
  sharedIdempotencyRelease,
  sharedRateLimitCheck,
} from "./shared-state-hooks";
import type { DispatchOptions, DispatchPolicy, DispatchRunState } from "./types";

/**
 * Gateway dispatch — the gateway's only side-effectful function.
 *
 * Responsibilities (GHA-021 / GHA-031..039):
 *   1. Match a route for an intent and toolId via deterministic scoring
 *      (selectBestRoute). Higher score wins; ties break on
 *      predicate count then lexicographic id.
 *   2. Compose pre/post filter chains.
 *   3. Run a target through its per-target circuit breaker with the
 *      strict half-open single-probe invariant.
 *   4. Wrap each adapter call with a derived AbortSignal that fans in
 *      the caller's signal AND a per-target timeout. Cancellation of
 *      the caller propagates to the in-flight call; retry is gated on
 *      `failure.retryable && routeIdempotent`.
 *   5. Honour per-route retry/backoff policy via contracts/runtime.decideRetry.
 *   6. Honour per-route bounded concurrency + queue timeout via the
 *      BackpressureRegistry. When the queue is full or times out, the
 *      dispatcher rejects the call rather than piling on the provider.
 *   7. Fan out parallel calls for multi-target routes (concurrency > 1)
 *      using the same bounded semaphore.
 *   8. Coalesce concurrent identical requests via a per-gateway
 *      CoalescingRegistry so two callers sharing a requestKey share
 *      one in-flight adapter call.
 *   9. Cache results via a VersionedCache keyed on
 *      (routeId, manifestVersion, scope, payloadHash). Negative
 *      results use the route's `negativeTtlMs` so a sick provider
 *      isn't pounded.
 *  10. Walk the explicit fallback chain only AFTER the primary route
 *      has fully exhausted its target pool. Cancellation NEVER triggers
 *      a fallback.
 *
 * Module layout (split from the original 1195-line dispatch.ts):
 *   - types.ts               — DispatchOptions / DispatchPolicy / run-state types
 *   - router.ts              — route selection, policy resolution, merge helpers
 *   - shared-state-hooks.ts  — cross-instance (GHA-NEXT-018/020/035/040) stores
 *   - retry.ts               — per-target invocation + retry/breaker loop
 *   - handler.ts             — per-route execution (tryRoute)
 */

export const dispatchRoute = async (
  routes: ReadonlyArray<RouteDefinition>,
  options: DispatchOptions,
): Promise<AdapterSearchResult> => {
  const route = selectRoute(routes, options.toolId, options.intent);
  if (!route) {
    return {
      items: [],
      sourceVersion: "gateway:no-route",
      confidence: "low",
      warnings: [`no route matched toolId=${options.toolId}`],
      mode: "fixture",
    };
  }

  // GHA-NEXT-018 — cross-instance rate-limit gate. Runs BEFORE any
  // target adapter call so a quota-exhausted toolId short-circuits
  // cleanly with a typed 429 marker. The shared store is consulted
  // once per dispatch (per (toolId, requestKey) bucket). Fail-open:
  // an unreachable store falls through to the local dispatch path
  // so a Redis outage cannot cascade into a gateway outage.
  const rateLimitMarker = await sharedRateLimitCheck(options.sharedState, options.toolId);
  if (rateLimitMarker) {
    return {
      items: [],
      sourceVersion: "gateway:rate-limited",
      confidence: "low",
      warnings: [rateLimitMarker],
      mode: "fixture",
    };
  }

  const cache = versionedCacheFor(options);
  // Per-route cache cap: when policyByRoute is provided we configure
  // the cap for EVERY route the dispatcher might walk (primary +
  // fallback). When it is omitted we keep the legacy single-configure
  // behaviour for direct callers.
  if (cache && options.policyByRoute) {
    for (const [routeId, routePolicy] of options.policyByRoute.entries()) {
      cache.configure(routeId, routePolicy.maxCacheEntries);
    }
  }
  const primaryPolicy: DispatchPolicy = policyForRouteId(options, route.id);
  if (cache && !options.policyByRoute) cache.configure(route.id, primaryPolicy.maxCacheEntries);

  // Tracks the route that actually served the result so the cache
  // mirror keys on the serving route id + its OWN cacheTtlMs (not the
  // primary's). Defaults to the primary for the legacy single-policy
  // path where every route shares the same policy. Per-route
  // idempotency bookkeeping for non-idempotent routes is captured in
  // the same run state: the key + TTL are stashed when the handler
  // acquires a lock so the post-processing tail can release on
  // failure or publish on success.
  const state: DispatchRunState = {
    servingRoute: route,
    servingPolicy: primaryPolicy,
    servedFromCache: false,
    idempotencyBookkeeping: new Map(),
  };

  const ctx = createContext({
    requestKey: options.requestKey,
    intent: options.intent,
    routeId: route.id,
    toolId: route.toolId,
    signal: options.signal,
    cache: legacyMapFor(options),
  });

  const preChain: Filter = composeFilters(route.filters.pre);
  const postChain: Filter = composeFilters(route.filters.post);

  const backpressure = options.backpressure || new BackpressureRegistry();

  const inner = async (): Promise<RouteContext> => {
    if (ctx.shortCircuit) return ctx;
    const primaryResult = await tryRoute(route, options, ctx, backpressure, state);
    if (primaryResult) {
      ctx.result = primaryResult;
      return ctx;
    }
    if (options.fallbackChain?.length) {
      const chain = selectFallbackChain(routes, options.toolId, options.fallbackChain);
      for (const fallbackRoute of chain) {
        if (fallbackRoute.id === route.id) continue;
        if (options.signal?.aborted) break;
        const fallbackResult = await tryRoute(fallbackRoute, options, ctx, backpressure, state);
        if (fallbackResult) {
          ctx.result = {
            ...fallbackResult,
            warnings: [...ctx.warnings, ...(fallbackResult.warnings || [])],
          };
          return ctx;
        }
      }
    }
    ctx.result = {
      items: [],
      sourceVersion: "gateway:empty",
      confidence: "low",
      warnings: ctx.warnings.slice(),
      mode: "fixture",
    };
    return ctx;
  };

  const wrapped = async (): Promise<RouteContext> => postChain.apply(ctx, () => preChain.apply(ctx, inner));
  const final = await wrapped();
  const result = final.result || {
    items: [],
    sourceVersion: "gateway:no-result",
    confidence: "low",
    mode: "fixture",
  };
  // When the caller supplied a VersionedCache and the route policy
  // enables caching, mirror the dispatch result into the versioned
  // store. Legacy filters (cacheLookupFilter / cacheStoreFilter) keep
  // reading through the Map shape, but new callers that want
  // manifest-version invalidation should observe this entry directly.
  // Always mirror into the versioned store when provided, regardless of
  // whether the legacy cache filters fired — this is what gives callers
  // manifest-version invalidation without depending on filter wiring.
  // Cache mirror: key on the SERVING route id + its OWN cacheTtlMs
  // and cacheScope. This is what guarantees a fallback route with a
  // different cacheTtlMs does NOT inherit the primary's TTL and
  // invalidate the wrong entries on a manifest-version bump.
  // GHA-NEXT-020 / 040 — mirror the entry into the shared cache so
  // peer instances observe the same hit. Key is identical so the
  // manifest-version invalidation contract is preserved end-to-end.
  // The shared write runs independently of whether the caller passed
  // a VersionedCache: callers that only want cross-instance caching
  // (no in-process VersionedCache) still get the shared write through.
  // On a cache-hit short-circuit we MUST skip the shared writeback
  // because the entry is already there; re-writing would just refresh
  // the TTL and confuse TTL-counting observers.
  if (state.servingPolicy.cacheTtlMs > 0) {
    const key = buildCacheKey({
      routeId: state.servingRoute.id,
      manifestVersion: options.manifestVersion || 1,
      scope: state.servingPolicy.cacheScope,
      intent: options.intent,
      requestKey: options.requestKey,
    });
    if (cache) {
      cache.set(key, result, { ttlMs: state.servingPolicy.cacheTtlMs, negativeTtlMs: state.servingPolicy.negativeTtlMs });
    }
    if (!state.servedFromCache) {
      sharedCacheWrite(
        options.sharedState,
        key,
        result,
        state.servingPolicy.cacheTtlMs,
        state.servingPolicy.negativeTtlMs,
      );
    }
  }

  // GHA-NEXT-035 — publish or release the non-idempotent-route
  // idempotency lock. Successful execution publishes the result so
  // concurrent callers join; failure releases so the next request can
  // retry the generation. Lock presence is sufficient evidence we
  // held one — `idempotencyBookkeeping` only contains routes that
  // passed the `tryAcquire` gate.
  for (const [, bookkeeping] of state.idempotencyBookkeeping) {
    if (result.items.length > 0) {
      await sharedIdempotencyPublish(
        options.sharedState,
        bookkeeping.idemKey,
        result,
        bookkeeping.idemTtlMs,
      );
    } else {
      await sharedIdempotencyRelease(
        options.sharedState,
        bookkeeping.idemKey,
      );
    }
  }

  return result;
};

/** Dispatch multiple routes concurrently, coalescing identical requestKeys.
 *  GHA-NEXT-008 — uses a per-call `CoalescingRegistry` instead of the
 *  legacy module-level `legacyInFlight` Map. The registry is created
 *  on first use and discarded when the call returns, so two
 *  `dispatchParallel` calls do NOT share state. Tests that need a
 *  shared coalescing registry across multiple `dispatchParallel`
 *  calls must pass `options.coalescing` themselves. */
export const dispatchParallel = async (
  routes: ReadonlyArray<RouteDefinition>,
  optionsList: ReadonlyArray<DispatchOptions>,
): Promise<AdapterSearchResult[]> => {
  const coalescing = optionsList.find((options) => options.coalescing)?.coalescing ?? new CoalescingRegistry();
  return Promise.all(optionsList.map((options) => {
    const sharedOptions = options.coalescing ? options : { ...options, coalescing };
    return dispatchRoute(routes, sharedOptions);
  }));
};

/** Test-only: convenience export for tests that want to reset their
 *  own coalescing registry state. The legacy module-level in-flight
 *  map was removed as part of GHA-NEXT-008; callers that relied on
 *  the global reset must now hold a `CoalescingRegistry` reference
 *  and call `reset()` on it directly. */
export const __resetInFlight = (registry?: CoalescingRegistry): void => {
  registry?.reset();
};

// ---------------------------------------------------------------------------
// Re-exported surface.
//
// These bindings were re-exported by the original single-file
// `dispatch.ts`; consumers that import them from `./dispatch` keep
// working unchanged after the split. New code should import them from
// their owning modules directly.
// ---------------------------------------------------------------------------

export {
  classifyFailure,
  emptyResultFailure,
  isEmptyResult,
  shouldFallbackFor,
  summarizeFailure,
} from "../runtime/failure";
export { deriveAbortSignal, abortable } from "../runtime/signal";
export { retryDecisionFor, scheduleRetry } from "../runtime/retry";
export { BackpressureRegistry } from "../runtime/backpressure";
export { CoalescingRegistry } from "../runtime/coalesce";
export { VersionedCache } from "../runtime/cache";
export { selectBestRoute, selectFallbackChain } from "../runtime/route-selection";
export type { ProviderFailure } from "../runtime/failure";

export type { DispatchOptions, DispatchPolicy } from "./types";

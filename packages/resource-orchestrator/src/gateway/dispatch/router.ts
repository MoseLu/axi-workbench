import type { AdapterSearchResult, CoalescingKey, Intent } from "@axi/gateway-contracts";
import type { CacheEntry, RouteDefinition, Target } from "../route";
import { CircuitBreaker } from "../circuit-breaker";
import { VersionedCache } from "../runtime/cache";
import { selectBestRoute } from "../runtime/route-selection";
import { DEFAULT_POLICY, type DispatchOptions, type DispatchPolicy } from "./types";

export const legacyMapFor = (options: DispatchOptions): Map<string, CacheEntry> => {
  const supplied = options.cache;
  if (supplied instanceof VersionedCache) return supplied.asMap();
  return supplied;
};

export const versionedCacheFor = (options: DispatchOptions): VersionedCache | undefined => {
  if (options.versionedCache) return options.versionedCache;
  if (options.cache instanceof VersionedCache) return options.cache;
  return undefined;
};

export const coalescingKeyFor = (
  options: DispatchOptions,
  routeId: string,
  targetId: string,
): CoalescingKey => {
  // Stable per (routeId, targetId, manifestVersion, requestKey). Two
  // concurrent calls sharing all four fields join the same in-flight
  // adapter invocation. The `coalescingKeyKind` gate lives at the
  // call site, not in this helper, so "none" simply means we never
  // reach here for that route.
  return {
    routeId,
    idempotencyKey: `${routeId}|${targetId}|${options.manifestVersion || 1}|${options.requestKey}`,
    manifestVersion: options.manifestVersion || 1,
  };
};

/** Resolve the `DispatchPolicy` that applies to `routeId`. When
 *  `options.policyByRoute` is supplied by the caller (GatewayOrchestrator
 *  does this), we use the route-specific entry. Otherwise we fall back
 *  to a single shared `options.policy` for every route in the chain —
 *  this preserves the historical behaviour for direct callers that
 *  only know the primary route's policy. */
export const policyForRouteId = (
  options: DispatchOptions,
  routeId: string,
): DispatchPolicy => {
  const perRoute = options.policyByRoute?.get(routeId);
  if (perRoute) return perRoute;
  return { ...DEFAULT_POLICY, ...(options.policy || {}) };
};

export const breakerFor = (options: DispatchOptions, target: Target, config?: RouteDefinition["circuit"]): CircuitBreaker => {
  if (!options.breakers) {
    throw new Error("breaker registry missing; pass options.breakers to dispatchRoute().");
  }
  const existing = options.breakers.get(target.id);
  if (existing) return existing;
  const breaker = new CircuitBreaker(config || {
    minSamples: 5,
    errorRateThreshold: 0.5,
    openMs: 30_000,
  });
  options.breakers.set(target.id, breaker);
  return breaker;
};

export const mergeResults = (parts: ReadonlyArray<AdapterSearchResult>): AdapterSearchResult => {
  const seen = new Set<string>();
  const items = parts.flatMap((part) => part.items).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const warnings = parts.flatMap((part) => part.warnings || []);
  const confidence = parts.some((part) => part.confidence === "high") ? "high"
    : parts.some((part) => part.confidence === "medium") ? "medium"
    : "low";
  const mode: AdapterSearchResult["mode"] = parts.some((part) => part.mode === "live") ? "live" : "fixture";
  const clarification = parts.flatMap((part) => part.clarification || []).slice(0, 6);
  const single = parts.length === 1 ? parts[0] : undefined;
  return {
    items: items.slice(0, 12),
    sourceVersion: parts.map((part) => part.sourceVersion).filter(Boolean).join("|") || "gateway:merged",
    confidence,
    warnings: warnings.length ? warnings : undefined,
    clarification: clarification.length ? clarification : undefined,
    mode,
    ...(single ? {
      page: single.page,
      pageSize: single.pageSize,
      totalItems: single.totalItems,
      hasMore: single.hasMore,
    } : {}),
  };
};

/** Backwards-compatible selectRoute: deterministic specificity via scoreFor. */
export const selectRoute = (routes: ReadonlyArray<RouteDefinition>, toolId: string, intent: Intent): RouteDefinition | undefined => selectBestRoute(routes, toolId, intent);

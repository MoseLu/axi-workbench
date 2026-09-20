import type { Intent, AdapterSearchResult } from "@axi/gateway-contracts";
import type { CacheEntry, RouteContext } from "./route";

const now = () => Date.now();

/**
 * Build a fresh RouteContext. The cache map is shared across the whole run
 * so cache hits survive between routes (e.g. image-search cache is reusable
 * by the image-empty-fallback route). The trace and filtersVisited sets are
 * per-context so each dispatch is observable.
 */
export const createContext = (options: {
  requestKey: string;
  intent: Intent;
  routeId: string;
  toolId: string;
  signal?: AbortSignal;
  cache: Map<string, CacheEntry>;
}): RouteContext => ({
  requestKey: options.requestKey,
  intent: options.intent,
  routeId: options.routeId,
  toolId: options.toolId,
  signal: options.signal,
  cache: options.cache,
  trace: [],
  filtersVisited: new Set<string>(),
  result: null,
  startedAt: now(),
  warnings: [],
});

/** Copy-on-read accessor for filters that want a snapshot of the result. */
export const cloneResult = (result: AdapterSearchResult): AdapterSearchResult => ({
  items: result.items.slice(),
  sourceVersion: result.sourceVersion,
  confidence: result.confidence,
  clarification: result.clarification ? result.clarification.slice() : undefined,
  warnings: result.warnings ? result.warnings.slice() : undefined,
  mode: result.mode,
});

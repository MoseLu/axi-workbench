import type { AdapterSearchResult } from "@axi/gateway-contracts";
import type { CacheEntry, Filter, RouteContext } from "./route";

/**
 * Built-in filters. The gateway composes them as a chain:
 *   ctx -> pre: trace -> safety -> cacheLookup -> ...
 *         -> invoke target
 *         -> post: normalize -> dedup -> cacheStore
 *         -> ctx
 *
 * Filters must be idempotent: re-entering a filter (e.g. on a retry) must
 * produce the same observable state. The trace filter records this by
 * appending to ctx.trace; the safety filter mutates warnings but not items.
 */

const visited = (ctx: RouteContext, filterId: string): boolean => {
  if (ctx.filtersVisited.has(filterId)) return true;
  ctx.filtersVisited.add(filterId);
  return false;
};

/** Trace filter — emits a one-line string for each pass. */
export const traceFilter = (): Filter => {
  const id = "trace";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      ctx.trace.push(`[${ctx.routeId}] start`);
      const next_ = await next();
      ctx.trace.push(`[${ctx.routeId}] done (${ctx.result?.items.length ?? 0} items)`);
      return next_;
    },
  };
};

/** Safety filter — refuses routes whose intent is missing query, etc. */
export const safetyFilter = (): Filter => {
  const id = "safety";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      const query = typeof ctx.intent.constraints.query === "string" ? ctx.intent.constraints.query.trim() : "";
      if (!query) {
        ctx.warnings.push("intent is missing query; gateway still routed, but providers may return empty.");
      }
      return next();
    },
  };
};

/** Cache lookup filter — short-circuits dispatch when an unexpired entry exists. */
export const cacheLookupFilter = (): Filter => {
  const id = "cache-lookup";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      const entry = ctx.cache.get(ctx.requestKey);
      if (entry && entry.expiresAt > Date.now()) {
        ctx.result = entry.result;
        ctx.trace.push(`[${ctx.routeId}] cache hit (${entry.source})`);
        ctx.shortCircuit = true;
        return ctx;
      }
      return next();
    },
  };
};

/** Cache store filter — persists the dispatch result for future hits. */
export const cacheStoreFilter = (ttlMs: number): Filter => {
  const id = "cache-store";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      const result = await next();
      if (result.result && ttlMs > 0) {
        const entry: CacheEntry = {
          result: result.result,
          expiresAt: Date.now() + ttlMs,
          source: result.routeId,
        };
        result.cache.set(result.requestKey, entry);
      }
      return result;
    },
  };
};

/** Normalize filter — clamps items to the visible/capped count. */
export const normalizeFilter = (): Filter => {
  const id = "normalize";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      const result = await next();
      if (!result.result) return result;
      const items = result.result.items;
      const normalized: AdapterSearchResult = {
        ...result.result,
        items: items.slice(0, 12),
        warnings: result.result.warnings ? result.result.warnings.slice() : undefined,
      };
      result.result = normalized;
      return result;
    },
  };
};

/** Dedup filter — removes candidates with the same id, preserving order. */
export const dedupFilter = (): Filter => {
  const id = "dedup";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      const result = await next();
      if (!result.result) return result;
      const seen = new Set<string>();
      const unique = result.result.items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      if (unique.length !== result.result.items.length) {
        ctx.trace.push(`[${ctx.routeId}] dedup ${result.result.items.length - unique.length}`);
      }
      result.result = { ...result.result, items: unique };
      return result;
    },
  };
};

/** Enrichment filter — adds a stable source tag for downstream UI labels. */
export const enrichmentFilter = (): Filter => {
  const id = "enrichment";
  return {
    id,
    async apply(ctx, next) {
      if (visited(ctx, id)) return next();
      const result = await next();
      if (result.result) {
        result.result = {
          ...result.result,
          sourceVersion: result.result.sourceVersion || `gateway:${result.routeId}`,
        };
      }
      return result;
    },
  };
};

/** Compose filters in order; returns a single Filter that runs them sequentially. */
export const composeFilters = (filters: ReadonlyArray<Filter>): Filter => ({
  id: `chain(${filters.map((f) => f.id).join("|") || "empty"})`,
  async apply(ctx, next) {
    let index = 0;
    const runner = async (): Promise<RouteContext> => {
      const filter = filters[index];
      if (!filter) return next();
      index += 1;
      return filter.apply(ctx, runner);
    };
    return runner();
  },
});

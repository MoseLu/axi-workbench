import type { HealthRegistry } from "./registries/health-registry";
import type { LoadBalancerStrategy, RouteContext, Target } from "./route";

/**
 * Stateless load balancers.
 *
 * Counter state (round-robin cursor) is kept inside the RouteContext via
 * a Symbol-keyed slot so it survives within a run but never escapes. This
 * keeps each strategy deterministic for tests while staying allocation-free.
 *
 * GHA-NEXT-037 — when a `HealthRegistry` is injected, `pickTarget` filters
 * out any target whose factory status is `"ejected"` before applying the
 * strategy. The status is read through a module-level 1-second TTL cache
 * so we don't hammer `forFactory()` on every request. If the entire pool
 * ends up filtered out, the call falls back to the unfiltered pool so a
 * transiently-ejected factory doesn't deadlock the route (the dispatcher's
 * circuit breaker will still record the failure and reopen the circuit
 * normally — this gate is a hint, not a hard rule).
 */

const LB_COUNTERS: unique symbol = Symbol.for("resource-broker.lb-counters");

type CounterSlot = Map<string, number>;
const countersFor = (ctx: RouteContext): CounterSlot => {
  const slot = (ctx as unknown as Record<symbol, unknown>)[LB_COUNTERS] as CounterSlot | undefined;
  if (slot) return slot;
  const fresh: CounterSlot = new Map();
  (ctx as unknown as Record<symbol, unknown>)[LB_COUNTERS] = fresh;
  return fresh;
};

const nextCursor = (ctx: RouteContext, key: string): number => {
  const slot = countersFor(ctx);
  const current = slot.get(key) || 0;
  slot.set(key, current + 1);
  return current;
};

const stickyKey = (ctx: RouteContext): string => {
  const query = typeof ctx.intent.constraints.query === "string" ? ctx.intent.constraints.query : "";
  return `${ctx.toolId}|${query}`;
};

const hash32 = (value: string): number => {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.codePointAt(0) || 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

/* -------------------------------------------------------------------------- */
/*  HealthRegistry ejection cache (GHA-NEXT-037)                               */
/* -------------------------------------------------------------------------- */

/** Per-factory cached snapshot. `expiresAt` is wall-clock ms; once
 *  crossed we re-call `forFactory()`. 1s TTL matches the prompt spec
 *  so a freshly-ejected factory is excluded within ~1 request round. */
interface HealthCacheEntry {
  readonly status: import("./registries/health-registry").HealthStatus;
  readonly expiresAt: number;
}

const HEALTH_TTL_MS = 1_000;

/** Module-level cache, scoped by registry identity so two registries
 *  (e.g. test fixtures) don't poison each other. We key by the
 *  registry reference so swapping registries in tests is safe. */
const healthCacheByRegistry = new WeakMap<HealthRegistry, Map<string, HealthCacheEntry>>();

const cacheFor = (registry: HealthRegistry): Map<string, HealthCacheEntry> => {
  let slot = healthCacheByRegistry.get(registry);
  if (!slot) {
    slot = new Map();
    healthCacheByRegistry.set(registry, slot);
  }
  return slot;
};

const cachedStatus = (registry: HealthRegistry, factoryId: string, now: number): import("./registries/health-registry").HealthStatus => {
  const slot = cacheFor(registry);
  const cached = slot.get(factoryId);
  if (cached && cached.expiresAt > now) return cached.status;
  const status = registry.forFactory(factoryId);
  slot.set(factoryId, { status, expiresAt: now + HEALTH_TTL_MS });
  return status;
};

/** External seam so the dispatcher's multi-target fan-out path can
 *  reuse the same 1s TTL cache that `pickTarget` reads from. The
 *  cache is keyed on registry identity, so a registry swap in tests
 *  yields a fresh slot without polluting existing entries. */
export const cachedHealthStatus = (
  registry: HealthRegistry,
  factoryId: string,
  now: number = Date.now(),
): import("./registries/health-registry").HealthStatus => cachedStatus(registry, factoryId, now);

/** Drop every cached entry for `registry`. Tests that swap registries
 *  mid-suite call this so the new registry observes fresh state on the
 *  next `pickTarget` call. Production callers rarely need this. */
export const __resetHealthCacheForTests = (registry?: HealthRegistry): void => {
  if (registry) {
    healthCacheByRegistry.delete(registry);
    return;
  }
};

/** Exported so the test can advance the cache clock manually without
 *  resorting to real timers. */
export const __healthCacheTtlMs = HEALTH_TTL_MS;

/* -------------------------------------------------------------------------- */
/*  pickTarget                                                                 */
/* -------------------------------------------------------------------------- */

export interface PickTargetOptions {
  /** Inject a HealthRegistry so ejected factories are excluded from
   *  the candidate pool. When absent the LB behaves exactly as it did
   *  before GHA-NEXT-037. */
  readonly healthRegistry?: HealthRegistry;
  /** Clock seam for tests. Defaults to Date.now. */
  readonly now?: () => number;
}

/** Exclude any target whose factory is currently `ejected` according to
 *  `healthRegistry`. The status read is cached for 1s per factory. If
 *  every non-fallback target is ejected, we return the unfiltered pool
 *  — gating the entire route on ejection would deadlock when the only
 *  registered factory is misbehaving. */
const filterEjected = (
  pool: ReadonlyArray<Target>,
  options: PickTargetOptions | undefined,
): Target[] => {
  if (!options?.healthRegistry) return pool.slice();
  const registry = options.healthRegistry;
  const now = (options.now ?? Date.now)();
  const out: Target[] = [];
  for (const target of pool) {
    if (cachedStatus(registry, target.id, now) === "ejected") continue;
    out.push(target);
  }
  return out;
};

export const pickTarget = (
  targets: ReadonlyArray<Target>,
  strategy: LoadBalancerStrategy,
  ctx: RouteContext,
  options?: PickTargetOptions,
): Target | undefined => {
  if (!targets.length) return undefined;
  const primaryPool = targets.filter((target) => !target.fallback);
  const basePool = primaryPool.length ? primaryPool : targets;
  const filtered = filterEjected(basePool, options);
  const pool = filtered.length ? filtered : basePool;
  switch (strategy) {
    case "round-robin":
      return pool[nextCursor(ctx, `${ctx.routeId}|rr`) % pool.length];
    case "weighted-round-robin": {
      const ring: Target[] = [];
      for (const target of pool) {
        const w = Math.max(1, target.weight);
        for (let i = 0; i < w; i += 1) ring.push(target);
      }
      return ring[nextCursor(ctx, `${ctx.routeId}|wrr`) % ring.length];
    }
    case "sticky-by-query":
      return pool[hash32(stickyKey(ctx)) % pool.length];
    case "failover-only":
      return pool[0];
    default:
      return pool[0];
  }
};
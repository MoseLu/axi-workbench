/**
 * SharedStateManager — gateway shared-state interface layer.
 *
 * GHA-NEXT-020 — Phase D / P0 — interface + noop + env-config (L1 closed).
 *
 * Fail-over defaults (mirrored in `configFromEnv`):
 *
 *   | Store           | Default            | Override env var                       |
 *   |-----------------|--------------------|----------------------------------------|
 *   | Circuit breaker | Fail-OPEN (default)| GATEWAY_SHARED_BREAKER_STRICT=true      |
 *   | Rate limit      | Fail-CLOSED        | GATEWAY_SHARED_RATELIMIT_GRACEFUL=true  |
 *   | Idempotency     | Fail-CLOSED        | GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL=true|
 *   | Cache           | Fail-OPEN          | —                                      |
 *   | Snapshot        | Fail-OPEN          | —                                      |
 *   | Coalescing      | Fail-OPEN          | —                                      |
 *
 *   - `breakerFailOpen=true` (default): when the shared breaker store is
 *     unreachable, calls proceed using the local `CircuitBreaker`
 *     instance. Operators opt INTO fail-closed by setting
 *     `GATEWAY_SHARED_BREAKER_STRICT=true`. Rationale: an outage of the
 *     shared store should not cascade into request failures.
 *   - `rateLimitFailClosed=true` (default): when the shared rate-limit
 *     store is unreachable, calls are REJECTED (allowed=false) to avoid
 *     silently exceeding the provider's quota. Operators opt INTO
 *     fail-open via `GATEWAY_SHARED_RATELIMIT_GRACEFUL=true`. Rationale:
 *     over-quota has higher blast radius (provider bans) than
 *     short-term false-positives.
 *   - `idempotencyFailClosed=true` (default): when the shared
 *     idempotency store is unreachable, non-idempotent operations
 *     (resource.generate.*) are REJECTED so callers do NOT execute the
 *     same generator call twice on the upstream. Operators opt INTO
 *     local coalescing fallback via
 *     `GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL=true`. Rationale: generation
 *     is stateful and side-effectful; double-execution is worse than
 *     a temporary error.
 *
 * Style rules (matching the rest of the orchestrator package):
 *   - Pure types and JSDoc; no side effects, no concrete store imports.
 *   - Key namespaces are documented per interface so engineers know exactly
 *     what key pattern to use when implementing a store backend.
 *   - All TTLs are in milliseconds (ms); store clients convert as needed.
 */

import type { AdapterSearchResult } from "@axi/gateway-contracts";
import type { BreakerSnapshot } from "../circuit-breaker";
import type { CacheKey, CacheScope } from "@axi/gateway-contracts";
import type { CacheEntry } from "../route";
import type { RouteDefinition } from "../route";
import type { CoalescingKey } from "@axi/gateway-contracts";

// ---------------------------------------------------------------------------
// SharedStateConfig
// ---------------------------------------------------------------------------

/**
 * Environment-driven configuration for the shared-state layer.
 * Maps 1:1 to `GATEWAY_SHARED_*` env vars documented in 02-shared-state.md §11.
 */
export interface SharedStateConfig {
  /** `redis://` or `postgres://` URL. Empty / undefined = noop (local only). */
  readonly storeUrl: string;
  /** `"redis"` | `"valkey"` | `"postgres"`; auto-inferred from `storeUrl` if omitted. */
  readonly storeType?: "redis" | "valkey" | "postgres";
  /** When true, breaker store unavailability fails closed (deny requests). Default: false (fail-open). */
  readonly breakerFailOpen: boolean;
  /** When true, rate-limit store unavailability fails open (allow). Default: false (fail-closed). */
  readonly rateLimitFailClosed: boolean;
  /** When true, idempotency store unavailability falls back to local coalescing. Default: false (fail-closed). */
  readonly idempotencyFailClosed: boolean;
  /** Max delay before a breaker state change is visible to other instances (ms). Default: 100. */
  readonly propagationMs: number;
  /** Connection timeout for the store backend (ms). Default: 2000. */
  readonly connectTimeoutMs: number;
  /** TTL for breaker state entries in the store (seconds). Default: 60. */
  readonly breakerTtlSeconds: number;
  /** TTL for shared coalescing entries (seconds). Default: 30. */
  readonly coalesceTtlSeconds: number;
}

// ---------------------------------------------------------------------------
// BreakerStore
// ---------------------------------------------------------------------------

/**
 * Cross-instance circuit-breaker state store.
 *
 * Key format:   `breaker:{targetId}`   (Valkey STRING + Lua atomic update)
 * TTL:          `max(openMs * 2, 30s)` — tombstone cleanup; minimum 30 s
 * Consistency:  Eventually consistent; writes are broadcast via Pub/Sub so
 *               other instances see the change within `propagationMs`.
 *
 * Fail strategy: fail-open by default (`breakerFailOpen=true`). Set
 * `GATEWAY_SHARED_BREAKER_STRICT=true` for fail-closed behaviour.
 */
export interface BreakerStore {
  /**
   * Read the current breaker snapshot for `targetId`.
   * Returns `undefined` when the target has never been seen by any instance.
   */
  getState(targetId: string): BreakerSnapshot | undefined;

  /**
   * Record a single call outcome and update the sliding window.
   * `success=true` increments successes; `success=false` increments errors.
   */
  record(targetId: string, success: boolean, now?: number): void;

  /**
   * Atomically transition the breaker for `targetId` from half-open → closed.
   * Called by the instance that owns the successful half-open probe.
   * Returns `true` when this instance performed the close; `false` when
   * another instance already closed it.
   */
  tryClose(targetId: string): boolean;

  /**
   * Snapshot all known breaker states — used by `/metrics`.
   * Returns a map from `targetId → BreakerSnapshot`.
   */
  snapshotAll(): Map<string, BreakerSnapshot>;

  /**
   * Returns `true` when the store backend is reachable.
   * Used internally to decide between fail-open and fail-closed paths.
   */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// RateLimitStore
// ---------------------------------------------------------------------------

/**
 * Cross-instance rate-limit counter store.
 *
 * Key format:   `ratelimit:{key}:{windowStart}`   e.g. `ratelimit:user_abc:3600`
 * TTL:          `windowMs / 1000 + 1` (sliding-window expiry)
 * Consistency:  Strongly consistent (Lua atomic INCR + EXPIRE in Valkey/Redis)
 * Fail strategy: fail-closed by default (`rateLimitFailClosed=true`).
 *               Set `GATEWAY_SHARED_RATELIMIT_GRACEFUL=true` for fail-open.
 */
export interface RateLimitStore {
  /**
   * Atomically check and increment a rate-limit counter.
   *
   * @param key       — arbitrary key, typically `user_{id}` or `provider_{id}`
   * @param limit     — maximum allowed calls in this window
   * @param windowMs  — window size in milliseconds (e.g. 60_000 = 1 minute)
   * @returns whether the call is allowed; remaining quota; reset timestamp (ms)
   */
  checkAndIncrement(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }>;

  /**
   * Administrative reset of a rate-limit key (e.g. after a ban lift).
   */
  reset(key: string): Promise<void>;

  /** Whether the store backend is reachable. */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// IdempotencyStore
// ---------------------------------------------------------------------------

/**
 * Cross-instance distributed idempotency lock for non-idempotent operations
 * (primarily `resource.generate.*` routes).
 *
 * Key format:
 *   - Lock:   `idempotency:{key}:lock`   (STRING; SET NX + TTL)
 *   - Result: `idempotency:{key}:result` (STRING JSON; separate TTL)
 * TTL for lock: `ttlMs` (typically `requestTimeoutMs + 5s`)
 * TTL for result: `max(ttlMs, resultCacheTtlMs)`
 * Consistency:    Strongly consistent (SET NX is atomic)
 * Fail strategy:  fail-closed by default; the caller MUST NOT execute
 *                 a non-idempotent operation when `tryAcquire` returns `false`.
 *                 Set `GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL=true` to fall back
 *                 to local coalescing (only safe for idempotent routes).
 */
export interface IdempotencyStore {
  /**
   * Attempt to acquire the idempotency lock for `key`.
   *
   * @returns `true`  — lock acquired; caller MAY proceed to execute the operation
   * @returns `false` — lock held by another instance or result already cached;
   *                    caller MUST NOT re-execute (join via `getResult` instead)
   */
  tryAcquire(key: string, ttlMs: number): Promise<boolean>;

  /**
   * Release the idempotency lock. Call only when execution failed and the
   * caller wants to allow a future retry. Successful executions MUST NOT
   * release the lock (the result TTL handles cleanup).
   */
  release(key: string): Promise<void>;

  /**
   * Read a cached result for `key` (written by the instance that executed
   * the operation). Used when `tryAcquire` returns `false` to join the
   * in-flight or completed work.
   */
  getResult(key: string): Promise<AdapterSearchResult | undefined>;

  /**
   * Write the execution result so concurrent callers can join.
   * @param result  — the `AdapterSearchResult` from the completed operation
   * @param ttlMs   — TTL for the cached result; must >= `requestTimeoutMs * maxAttempts`
   */
  setResult(key: string, result: AdapterSearchResult, ttlMs: number): Promise<void>;

  /** Whether the store backend is reachable. */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// CacheStore
// ---------------------------------------------------------------------------

/**
 * Cross-instance response cache.
 *
 * Key format: `cache:{routeId}|{manifestVersion}|{scope}|{hash}`
 *             (identical to the versioned key built in `runtime/cache.ts`)
 * TTL:        per-entry `ttlMs`; `0` = disabled
 * Consistency: Eventually consistent. Manifest version bump naturally
 *              invalidates all keys from the old version — no explicit
 *              cross-instance invalidation is needed.
 * Fail strategy: fail-open (store unavailable → fall back to local LRU).
 *                This is safe because the VersionedCache already provides
 *                per-instance correctness; cross-instance sharing is an
 *                optimisation only.
 */
export interface CacheStore {
  get(key: CacheKey): CacheEntry | undefined;
  /**
   * GHA-NEXT-020 — async cross-instance read. Dispatchers call
   * this BEFORE the sync `get` so a value written by another
   * instance actually lands in the local mirror. Returns
   * `undefined` on miss / transport failure. Default
   * implementation may simply call `get` and return; the
   * `ValkeyCacheStore` overrides it to do a real async GET.
   */
  readAsync?(key: CacheKey): Promise<CacheEntry | undefined>;
  set(key: CacheKey, entry: CacheEntry, ttlMs: number): void;
  /** Invalidate a single key. */
  invalidate(key: CacheKey): void;
  /**
   * Invalidate all keys belonging to `routeId`.
   * Called when a route's snapshot version changes.
   */
  invalidateByRoute(routeId: string): void;

  /** Whether the store backend is reachable. */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// SnapshotStore
// ---------------------------------------------------------------------------

/**
 * Cross-instance route snapshot publish / mark-in-use store.
 *
 * Key format:
 *   - Active: `snapshot:active`  (STRING; int version number)
 *   - By ver: `snapshot:v{version}` (STRING JSON; full route array)
 * TTL:        No TTL — snapshots are explicitly managed via `publish` / `markInUse`
 * Consistency: Single-writer (one leader instance or external operator publishes;
 *              all others follow). Concurrent publishes are serialised via a
 *              distributed lock or compare-and-swap on the `active` key.
 * Fail strategy: fail-open. Store unavailable → each instance continues using
 *                its in-memory snapshot (current behaviour, backward-compatible).
 */
export interface SnapshotStore {
  /** Returns the currently active snapshot version (0 if none). */
  getActiveVersion(): number;

  /**
   * Atomically publish a new snapshot and return its version number.
   * The previous version is retained under `snapshot:v{prev}` for recovery.
   * @returns the new version number (always > `getActiveVersion()`)
   */
  publish(snapshot: ReadonlyArray<RouteDefinition>): number;

  /**
   * Read a specific snapshot version (for warm-up after restart).
   */
  getSnapshot(version: number): ReadonlyArray<RouteDefinition> | undefined;

  /** Returns the version currently marked as in-use by this instance. */
  getInUseVersion(): number;

  /**
   * Mark `version` as in-use by this instance.
   * Called after the orchestrator has loaded the snapshot into memory.
   * The `active` version may be ahead of `inUse`; callers of `dispatch()`
   * use `inUse` until the orchestrator reloads.
   */
  markInUse(version: number): void;

  /** Whether the store backend is reachable. */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// CoalesceStore
// ---------------------------------------------------------------------------

/**
 * Cross-instance request coalescing for non-idempotent routes
 * (`resource.generate.*` only). Idempotent routes (`resource.search.*`)
 * use the local `CoalescingRegistry` and do NOT interact with this store.
 *
 * Key format: `coalesce:{routeId}:{idempotencyKey}:{manifestVersion}`
 * TTL:        `max(expectedDuration + 10s, 5s)`; default 30 s
 * Consistency: Eventually consistent. If two instances race to register
 *              the same key, one wins; the other joins via the result path.
 * Fail strategy: fail-open. Store unavailable → instances execute
 *                independently (no cross-instance coalescing; local
 *                CoalescingRegistry still deduplicates within one instance).
 */
export interface CoalesceStore {
  /**
   * Check whether an in-flight request already exists for `key`.
   * Returns either an `AdapterSearchResult` (join this) or `undefined`
   * (caller should register).
   *
   * The noop implementation returns `undefined` synchronously; the
   * Valkey implementation returns a `Promise<AdapterSearchResult |
   * undefined>` because `GET` is async. Callers MUST `await` the
   * return value regardless.
   */
  checkInFlight(key: CoalescingKey): Promise<AdapterSearchResult | undefined> | AdapterSearchResult | undefined;

  /**
   * Register a new in-flight request. The caller passes a `factory` that
   * builds the underlying promise; on resolution the entry is removed.
   *
   * If a result is already cached (from a concurrent instance), the factory
   * is NOT called and the cached result is returned instead.
   */
  registerInFlight(
    key: CoalescingKey,
    factory: () => Promise<AdapterSearchResult>,
  ): Promise<AdapterSearchResult>;

  /** Remove an in-flight entry (called when the underlying work completes). */
  removeInFlight(key: CoalescingKey): void;

  /** Whether the store backend is reachable. */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// SharedStateManager
// ---------------------------------------------------------------------------

/**
 * Facade that exposes all six store roles.
 *
 * Consumers (primarily `GatewayOrchestrator`) hold a single `SharedStateManager`
 * instance and delegate store access through it. The concrete implementation
 * is injected at construction time — `noop-impl.ts` provides the all-noop
 * fallback; Valkey / Postgres implementations are loaded when
 * `GATEWAY_SHARED_STORE_URL` is set.
 *
 * The facade does NOT implement any store logic; it only exposes the
 * already-constructed stores. This makes it easy to swap implementations
 * or inject mocks in tests.
 */
export interface SharedStateManager {
  readonly breaker: BreakerStore;
  readonly rateLimit: RateLimitStore;
  readonly idempotency: IdempotencyStore;
  readonly cache: CacheStore;
  readonly snapshot: SnapshotStore;
  readonly coalesce: CoalesceStore;

  /**
   * Whether ANY store backend is configured (vs. all-noop).
   * `false` means the gateway is running in local-only mode.
   */
  readonly isEnabled: boolean;

  /**
   * Operator-supplied configuration (e.g. `rateLimitFailClosed`,
   * `idempotencyFailClosed`). Dispatchers read this to decide
   * between fail-open and fail-closed behaviour on store faults.
   */
  readonly config?: SharedStateConfig;

  /**
   * Shutdown hook — closes store connections, stops Pub/Sub listeners, etc.
   * Idempotent; safe to call multiple times.
   */
  dispose(): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a `SharedStateConfig` from process.env.
 * Matches the defaults documented in 02-shared-state.md §11.
 *
 * Missing / empty `GATEWAY_SHARED_STORE_URL` → all stores are noop.
 */
export const configFromEnv = (env: Record<string, string | undefined>): SharedStateConfig => {
  const storeUrl = (env["GATEWAY_SHARED_STORE_URL"] ?? "").trim();
  const rawType = (env["GATEWAY_SHARED_STORE_TYPE"] ?? "").trim().toLowerCase();
  let storeType: SharedStateConfig["storeType"] | undefined;
  if (rawType === "redis") storeType = "redis";
  else if (rawType === "valkey") storeType = "valkey";
  else if (rawType === "postgres") storeType = "postgres";
  else if (storeUrl.startsWith("redis://") || storeUrl.startsWith("rediss://")) storeType = "redis";
  else if (storeUrl.startsWith("postgres://") || storeUrl.startsWith("postgresql://")) storeType = "postgres";

  const int = (key: string, fallback: number): number => {
    const raw = (env[key] ?? "").trim();
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const bool = (key: string, fallback: boolean): boolean => {
    const raw = (env[key] ?? "").trim().toLowerCase();
    if (!raw) return fallback;
    return raw === "true" || raw === "1";
  };

  return {
    storeUrl,
    storeType,
    breakerFailOpen: !bool("GATEWAY_SHARED_BREAKER_STRICT", false),
    rateLimitFailClosed: !bool("GATEWAY_SHARED_RATELIMIT_GRACEFUL", false),
    idempotencyFailClosed: !bool("GATEWAY_SHARED_IDEMPOTENCY_GRACEFUL", false),
    propagationMs: int("GATEWAY_SHARED_PROPAGATION_MS", 100),
    connectTimeoutMs: int("GATEWAY_SHARED_CONNECT_TIMEOUT_MS", 2000),
    breakerTtlSeconds: int("GATEWAY_SHARED_BREAKER_TTL_SECONDS", 60),
    coalesceTtlSeconds: int("GATEWAY_SHARED_COALESCE_TTL_SECONDS", 30),
  };
};

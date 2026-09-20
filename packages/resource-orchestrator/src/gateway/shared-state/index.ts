/**
 * Gateway shared-state public exports.
 *
 * GHA-NEXT-020 — Phase D / P0 — interface + noop + env-config barrel.
 * GHA-NEXT-021~026 — Phase D / P0 — Valkey store factories + facade.
 * GHA-NEXT-027 — Phase D / P1 — Postgres factory stub.
 *
 * Usage:
 *
 * ```typescript
 * import {
 *   type SharedStateManager,
 *   type SharedStateConfig,
 *   configFromEnv,
 *   createNoopSharedStateManager,
 *   createValkeySharedStateManager,
 *   createPostgresSharedStateManager,
 * } from "@axi/resource-orchestrator/gateway/shared-state";
 *
 * // In the gateway composition root:
 * const config = configFromEnv(process.env);
 * const shared = config.storeUrl
 *   ? (config.storeType === "postgres"
 *       ? createPostgresSharedStateManager(config)
 *       : createValkeySharedStateManager(config, () => new Redis(config.storeUrl)))
 *   : createNoopSharedStateManager(config);
 *
 * orchestrator.opts.sharedState = shared;
 * ```
 *
 * Each Valkey store is also exported individually for tests:
 *   - `createValkeyBreakerStore`  (Pub/Sub broadcast)
 *   - `createValkeyRateLimitStore` (Lua atomic check-and-increment)
 *   - `createValkeyIdempotencyStore` (SET NX PX + result cache)
 *   - `createValkeySnapshotStore`  (Lua atomic publish/markInUse)
 *   - `createValkeyCoalesceStore`  (generate routes only)
 *
 * They accept a `RedisLike` client — `ioredis` itself, `ioredis-mock`,
 * or any other compatible client — so tests don't need a real Valkey.
 */

export type {
  SharedStateManager,
  SharedStateConfig,
  BreakerStore,
  RateLimitStore,
  IdempotencyStore,
  CacheStore,
  SnapshotStore,
  CoalesceStore,
} from "./shared-state-manager";

export { configFromEnv } from "./shared-state-manager";

// Noop factory — default for local-only deployments.
export {
  createNoopSharedStateManager,
  createUnreachableSharedStateManager,
  noopBreakerStore,
  noopRateLimitStore,
  noopIdempotencyStore,
  noopCacheStore,
  noopCacheCounters,
  type NoopCacheCounters,
  noopSnapshotStore,
  noopCoalesceStore,
} from "./noop-impl";

// Valkey factories — production L3 deployments.
export {
  createValkeyBreakerStore,
  snapshotAllAsync,
  type RedisLike,
} from "./valkey-breaker";
export { createValkeyRateLimitStore } from "./valkey-ratelimit";
export { createValkeyIdempotencyStore } from "./valkey-idempotency";
export { createValkeySnapshotStore, getSnapshotAsync } from "./valkey-snapshot";
export { createValkeyCoalesceStore } from "./valkey-coalesce";
export {
  createValkeyCacheStore,
  cacheKeyToValkeyKey,
  type ValkeyCacheStoreHandle,
  type ValkeyCacheCounters,
} from "./valkey-cache";
export {
  createValkeySharedStateManager,
  type RedisClientFactory,
} from "./valkey-manager";

// Postgres facade + helpers (re-exported for the gateway composition root).
export {
  createPostgresSharedStateManager,
  createRealPgPool,
  type PostgresLikePool,
  type PostgresLikeClient,
  type PostgresClientFactory,
  SNAPSHOT_PUBLISH_ADVISORY_KEY,
  BREAKER_ADVISORY_NAMESPACE,
} from "./postgres-shared-state";
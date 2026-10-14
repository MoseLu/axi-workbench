/**
 * Pool schema + key-builders for the Postgres shared-state backend.
 *
 * Owns:
 *   - `POSTGRES_SHARED_STATE_DDL_STATEMENTS` — the per-store CREATE TABLE
 *     / CREATE INDEX statements that the runtime applies idempotently
 *     on first store use.
 *   - `runDdlOnce` — the per-pool lazy runner. Every store calls this
 *     on first use; it remembers which pools it has already migrated
 *     via a `WeakSet` so re-entry is a no-op.
 *   - `POSTGRES_SHARED_STATE_DDL` — the joined string kept for
 *     backward-compat with the original snapshot-store test.
 *   - `cacheKeyToPostgresKey` / `coalesceKey` — the two key builders
 *     that translate gateway `CacheKey` / `CoalescingKey` values into
 *     Postgres-safe strings.
 *
 * Storage layout (created by the DDL below):
 *
 *   TABLE  route_snapshots (
 *     version      BIGINT PRIMARY KEY,
 *     payload      JSONB NOT NULL,
 *     published_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   )
 *   TABLE  route_snapshot_meta (
 *     id SMALLINT PRIMARY KEY, active BIGINT NOT NULL DEFAULT 0, in_use BIGINT NOT NULL DEFAULT 0
 *   )
 *
 *   TABLE  breakers (
 *     target_id   TEXT PRIMARY KEY,
 *     snapshot    JSONB NOT NULL,
 *     expires_at  TIMESTAMPTZ NOT NULL,
 *     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *   )
 *
 *   TABLE  rate_limit_buckets (
 *     key           TEXT NOT NULL,
 *     window_start  BIGINT NOT NULL,
 *     count         INTEGER NOT NULL DEFAULT 0,
 *     expires_at    TIMESTAMPTZ NOT NULL,
 *     PRIMARY KEY (key, window_start)
 *   )
 *
 *   TABLE  idempotency_locks (
 *     key TEXT PRIMARY KEY,
 *     owner TEXT NOT NULL,
 *     expires_at TIMESTAMPTZ NOT NULL
 *   )
 *   TABLE  idempotency_results (
 *     key TEXT PRIMARY KEY,
 *     payload JSONB NOT NULL,
 *     expires_at TIMESTAMPTZ NOT NULL
 *   )
 *
 *   TABLE  cache_entries (
 *     cache_key TEXT PRIMARY KEY,
 *     route_id  TEXT NOT NULL,
 *     payload   JSONB NOT NULL,
 *     expires_at TIMESTAMPTZ
 *   )
 *   INDEX cache_entries_route_idx ON cache_entries (route_id)
 *
 *   TABLE  coalesce_inflight (
 *     key TEXT PRIMARY KEY,
 *     payload JSONB,
 *     expires_at TIMESTAMPTZ NOT NULL
 *   )
 *
 * Advisory-lock keys:
 *   - Snapshot publish:        0x5348415000100001
 *   - Breaker write (per-target): namespace 0x5348415000200001
 *     xor FNV-1a(targetId). Different targets don't block each other.
 *   - RateLimit / Idempotency / Cache / Coalesce: ON CONFLICT
 *     semantics; no advisory lock needed.
 *
 * pg 18's simple-protocol mode rejects concatenated DDL with a
 * `pg_type_typname_nsp_index` duplicate-key error, so the helper below
 * loops `pg.query` per statement instead of sending one multi-statement
 * batch.
 */

import type { CacheKey, CoalescingKey } from "@axi/gateway-contracts";
import type { PostgresLikePool } from "./connection";

const POSTGRES_SHARED_STATE_DDL_STATEMENTS: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS route_snapshots (version BIGINT PRIMARY KEY, payload JSONB NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS route_snapshot_meta (id SMALLINT PRIMARY KEY, active BIGINT NOT NULL DEFAULT 0, in_use BIGINT NOT NULL DEFAULT 0)`,
  `INSERT INTO route_snapshot_meta (id, active, in_use) VALUES (1, 0, 0) ON CONFLICT (id) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS breakers (target_id TEXT PRIMARY KEY, snapshot JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS rate_limit_buckets (key TEXT NOT NULL, window_start BIGINT NOT NULL, count INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (key, window_start))`,
  `CREATE TABLE IF NOT EXISTS idempotency_locks (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS idempotency_results (key TEXT PRIMARY KEY, payload JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cache_entries (cache_key TEXT PRIMARY KEY, route_id TEXT NOT NULL, payload JSONB NOT NULL, expires_at TIMESTAMPTZ)`,
  `CREATE INDEX IF NOT EXISTS cache_entries_route_idx ON cache_entries (route_id)`,
  `CREATE TABLE IF NOT EXISTS coalesce_inflight (key TEXT PRIMARY KEY, payload JSONB, expires_at TIMESTAMPTZ NOT NULL)`,
];

/** Lazily run the DDL on a pool. Each store lazily calls this on
 *  first use; the helper is idempotent (every statement is
 *  `IF NOT EXISTS`) and runs each statement separately so it works
 *  against pg 18's simple-protocol mode. */
const runDdlOnce = (() => {
  const seen = new WeakSet<PostgresLikePool>();
  return async (pool: PostgresLikePool): Promise<void> => {
    if (seen.has(pool)) return;
    seen.add(pool);
    for (const sql of POSTGRES_SHARED_STATE_DDL_STATEMENTS) {
      try {
        await pool.query(sql);
      } catch {
        // Per-statement failures fall through so an unrelated DDL
        // problem (e.g. permissions on one schema) doesn't silently
        // disable ALL stores.
      }
    }
  };
})();

// Legacy helper kept for backward-compatibility with the original
// `postgres-shared-state.test.ts` snapshot-store test that probes
// the simple DDL string directly.
export const POSTGRES_SHARED_STATE_DDL = POSTGRES_SHARED_STATE_DDL_STATEMENTS.join(";\n") + ";";

export { POSTGRES_SHARED_STATE_DDL_STATEMENTS, runDdlOnce };

/** Build the Postgres cache key from a `CacheKey`. The manifest
 *  version is part of the key so a snapshot bump invalidates old
 *  entries naturally — same property as the Valkey implementation. */
export const cacheKeyToPostgresKey = (key: CacheKey): string =>
  `cache:${key.routeId}|${key.manifestVersion}|${key.scope}|${key.hash}`;

/** Build the Postgres coalesce key from a `CoalescingKey`. Mirrors
 *  the Valkey implementation. */
export const coalesceKey = (key: CoalescingKey): string =>
  `coalesce:${key.routeId}:${key.idempotencyKey}:${key.manifestVersion}`;

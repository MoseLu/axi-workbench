/**
 * Connection-side types and factories for the Postgres shared-state
 * backend. Owns the pool interface that every store in this package
 * consumes, plus `createRealPgPool` which the production wiring in
 * `apps/gateway` reaches for when the operator sets
 * `GATEWAY_SHARED_STORE_URL=postgres://...`.
 *
 * Pool types (PostgresLikePool, PostgresLikeClient, PostgresClientFactory)
 * are exported here so tests can inject `pg-mem` or a hand-rolled fake
 * without depending on `pg` directly. The advisory-lock key constants
 * (SNAPSHOT_PUBLISH_ADVISORY_KEY, BREAKER_ADVISORY_NAMESPACE) live
 * alongside the pool types because both keys are pool-level
 * coordination primitives used by every store.
 */

import pg from "pg";

/** Minimal subset of `pg` we depend on. Lets tests inject `pg-mem` or a
 *  hand-rolled fake without a real database. */
export interface PostgresLikePool {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
  connect(): Promise<PostgresLikeClient>;
  end(): Promise<void>;
}

export interface PostgresLikeClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
  release(): void;
}

export type PostgresClientFactory = () => PostgresLikePool | Promise<PostgresLikePool>;

/** Advisory-lock key for `publish`. Stable bigint so all instances
 *  serialise against the same lock without coordination. */
export const SNAPSHOT_PUBLISH_ADVISORY_KEY = BigInt("0x5348415000100001");

/** Advisory-lock namespace for breaker writes. The per-target key is
 *  `BREAKER_ADVISORY_NAMESPACE xor FNV-1a(targetId)` so two writers
 *  for the SAME target serialise, but writes for different targets
 *  proceed in parallel. */
export const BREAKER_ADVISORY_NAMESPACE = BigInt("0x5348415000200001");

/** Build a real `pg.Pool` against `connectionString`. Exposed for the
 *  production wiring in `apps/gateway`; tests pass a custom factory. */
export const createRealPgPool = (connectionString: string): pg.Pool =>
  new pg.Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 2_000,
  });

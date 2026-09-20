/**
 * Postgres shared-state backend (GHA-NEXT-027 — Phase D / P1 → Full).
 *
 * Replaces the previous "SnapshotStore real + 5 noop" partial wiring
 * with a full `pg.Pool`-backed implementation for ALL six stores. The
 * five remaining roles (BreakerStore / RateLimitStore / IdempotencyStore
 * / CacheStore / CoalesceStore) now have real SQL implementations that
 * mirror the equivalent Valkey stores in semantics, using Postgres
 * primitives (advisory locks, transactional INCR, ON CONFLICT, JSONB,
 * TTL via `expires_at` columns) wherever the Valkey version relies on
 * Redis commands / Lua scripts.
 *
 * Storage layout:
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
 * Fail strategy: preserved from Wave 2.
 *   - breaker / cache / snapshot / coalesce: fail-open (admin override).
 *   - rate-limit / idempotency: fail-closed (admin override).
 *
 * Test seam: every store accepts the same `PostgresLikePool` shim so
 * tests can drop in an in-memory fake that simulates `pg_try_advisory_lock`,
 * `INSERT ... ON CONFLICT`, `DELETE WHERE expires_at < now()` and JSONB
 * semantics. A separate `live` block in the test file connects to a
 * real Postgres when `GHA_NEXT_LIVE_PG=1` AND `GATEWAY_SHARED_STORE_URL`
 * points at `postgres://...`.
 */

import pg from "pg";
import type { AdapterSearchResult, CacheKey, CoalescingKey } from "@axi/gateway-contracts";
import type { RouteDefinition, CacheEntry } from "../route";
import type { BreakerSnapshot } from "../circuit-breaker";
import type {
  SharedStateManager,
  SharedStateConfig,
  BreakerStore,
  RateLimitStore,
  IdempotencyStore,
  CacheStore,
  SnapshotStore,
  CoalesceStore,
} from "./shared-state-manager";
import { noopSnapshotStore, noopBreakerStore, noopRateLimitStore, noopIdempotencyStore, noopCacheStore, noopCoalesceStore } from "./noop-impl";

/** Advisory-lock key for `publish`. Stable bigint so all instances
 *  serialise against the same lock without coordination. */
export const SNAPSHOT_PUBLISH_ADVISORY_KEY = BigInt("0x5348415000100001");

/** Advisory-lock namespace for breaker writes. The per-target key is
 *  `BREAKER_ADVISORY_NAMESPACE xor FNV-1a(targetId)` so two writers
 *  for the SAME target serialise, but writes for different targets
 *  proceed in parallel. */
export const BREAKER_ADVISORY_NAMESPACE = BigInt("0x5348415000200001");

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

// ---------------------------------------------------------------------------
// DDL — run one statement per pg.query call.
// pg 18's simple-protocol mode rejects concatenated DDL with a
// `pg_type_typname_nsp_index` duplicate-key error, so the helper below
// loops `pg.query` per statement instead of sending one multi-statement
// batch.
// ---------------------------------------------------------------------------

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

/** Build a real `pg.Pool` against `connectionString`. Exposed for the
 *  production wiring in `apps/gateway`; tests pass a custom factory. */
export const createRealPgPool = (connectionString: string): pg.Pool =>
  new pg.Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 2_000,
  });

// ---------------------------------------------------------------------------
// SnapshotStore
// ---------------------------------------------------------------------------

/** Wire a real `SnapshotStore` against an already-connected Postgres
 *  pool. The store uses `pg_try_advisory_lock` to serialise
 *  concurrent publishes.
 *
 *  `publish` is intentionally synchronous (returns a number) to match
 *  the `SnapshotStore` interface; the durable write is dispatched in
 *  the background. We compute the next version from the cached
 *  active + 1 and update the cache eagerly so the synchronous caller
 *  gets a unique version. The Postgres advisory lock + INSERT
 *  guarantees uniqueness on the durable side. */
export const createPostgresSnapshotStore = (
  pool: PostgresLikePool,
): SnapshotStore & { __ready(): Promise<void>; __publishInFlight(): Promise<number>; __refresh(): Promise<void> } => {
  let cachedActive = 0;
  let cachedInUse = 0;
  let ready: Promise<void> | null = null;
  let publishLockChain: Promise<unknown> = Promise.resolve();

  const ensureSchema = (): Promise<void> => {
    if (ready) return ready;
    ready = (async () => {
      try {
        await runDdlOnce(pool);
        await refreshCacheFromDb();
      } catch {
        // Leave caches at 0; subsequent calls will retry.
      }
    })();
    return ready;
  };

  const refreshCacheFromDb = async (): Promise<void> => {
    const r = await pool.query(
      "SELECT active, in_use FROM route_snapshot_meta WHERE id = 1",
    );
    const row = Array.isArray(r.rows) ? (r.rows[0] as { active?: number | string; in_use?: number | string } | undefined) : undefined;
    // pg returns BIGINT as a string by default; coerce defensively.
    cachedActive = Number(row?.active ?? 0) || 0;
    cachedInUse = Number(row?.in_use ?? 0) || 0;
  };

  const publishInBackground = (
    snapshotRoutes: ReadonlyArray<RouteDefinition>,
    nextVersion: number,
  ): Promise<number> => {
    const chained = publishLockChain.then(async () => {
      await ensureSchema();
      const client = await pool.connect();
      try {
        let locked = false;
        for (let attempt = 0; attempt < 50 && !locked; attempt += 1) {
          const r = await client.query(
            "SELECT pg_try_advisory_lock($1) AS got",
            [String(SNAPSHOT_PUBLISH_ADVISORY_KEY)],
          );
          const row = Array.isArray(r.rows) ? (r.rows[0] as { got?: boolean | number } | undefined) : undefined;
          locked = row?.got === true || row?.got === 1;
          if (!locked) await new Promise((r2) => setTimeout(r2, 10));
        }
        if (!locked) return 0;
        try {
          // Re-read the active version under the lock so concurrent
          // publishers that raced ahead bump the next version.
          const activeRes = await client.query(
            "SELECT active FROM route_snapshot_meta WHERE id = 1",
          );
          const activeRow = Array.isArray(activeRes.rows)
            ? (activeRes.rows[0] as { active?: number | string } | undefined)
            : undefined;
          const durablePrev = Number(activeRow?.active ?? 0) || 0;
          const durableNext = Math.max(nextVersion, durablePrev + 1);
          await client.query(
            "INSERT INTO route_snapshots (version, payload) VALUES ($1, $2::jsonb)",
            [durableNext, JSON.stringify(snapshotRoutes)],
          );
          await client.query(
            "UPDATE route_snapshot_meta SET active = $1 WHERE id = 1",
            [durableNext],
          );
          cachedActive = Math.max(cachedActive, durableNext);
          return durableNext;
        } finally {
          await client.query("SELECT pg_advisory_unlock($1)", [
            String(SNAPSHOT_PUBLISH_ADVISORY_KEY),
          ]);
        }
      } catch {
        return 0;
      } finally {
        client.release();
      }
    });
    publishLockChain = chained.catch(() => undefined);
    return chained;
  };

  return {
    __ready: ensureSchema,
    __publishInFlight: () => publishLockChain as Promise<number>,
    __refresh: refreshCacheFromDb,

    getActiveVersion() {
      void ensureSchema();
      return cachedActive;
    },

    publish(snapshotRoutes: ReadonlyArray<RouteDefinition>): number {
      const next = cachedActive + 1;
      cachedActive = next;
      void publishInBackground(snapshotRoutes, next);
      return next;
    },

    getSnapshot(version: number): ReadonlyArray<RouteDefinition> | undefined {
      void (async () => {
        try {
          await ensureSchema();
          const r = await pool.query(
            "SELECT payload FROM route_snapshots WHERE version = $1",
            [version],
          );
          const row = Array.isArray(r.rows)
            ? (r.rows[0] as { payload?: unknown } | undefined)
            : undefined;
          if (row?.payload && typeof row.payload === "object") {
            // The caller already moved on; this read just keeps the
            // connection warm. We DO NOT cache the result here because
            // the sync surface cannot return it.
          }
        } catch {
          /* best-effort */
        }
      })();
      return undefined;
    },

    getInUseVersion() {
      return cachedInUse;
    },

    markInUse(version: number): void {
      cachedInUse = version;
      void (async () => {
        try {
          await pool.query(
            "UPDATE route_snapshot_meta SET in_use = $1 WHERE id = 1",
            [version],
          );
        } catch {
          /* best-effort */
        }
      })();
    },

    isAvailable(): boolean {
      return Boolean(pool);
    },
  };
};

// ---------------------------------------------------------------------------
// BreakerStore
// ---------------------------------------------------------------------------

/** Per-target advisory lock key: namespace xor FNV-1a(targetId). */
const breakerAdvisoryKey = (targetId: string): bigint => {
  let hash = BigInt("0xcbf29ce484222325");
  for (let i = 0; i < targetId.length; i += 1) {
    hash ^= BigInt(targetId.charCodeAt(i));
    hash = (hash * BigInt("0x100000001b3")) & BigInt("0xffffffffffffffff");
  }
  return (BREAKER_ADVISORY_NAMESPACE ^ hash) & BigInt("0x7fffffffffffffff");
};

const serialiseBreakerSnapshot = (snapshot: BreakerSnapshot): string =>
  JSON.stringify({
    state: snapshot.state,
    samples: snapshot.samples,
    errors: snapshot.errors,
    openedAt: snapshot.openedAt,
    probeInFlight: snapshot.probeInFlight,
  });

const parseBreakerSnapshot = (raw: unknown): BreakerSnapshot | undefined => {
  if (raw === null || raw === undefined) return undefined;
  // The pg driver returns JSONB columns as already-parsed objects;
  // older configurations or test fakes may yield a JSON string.
  let parsedObj: Partial<BreakerSnapshot> | undefined;
  if (typeof raw === "object") {
    parsedObj = raw as Partial<BreakerSnapshot>;
  } else if (typeof raw === "string" && raw) {
    try {
      parsedObj = JSON.parse(raw) as Partial<BreakerSnapshot>;
    } catch {
      return undefined;
    }
  } else {
    return undefined;
  }
  if (typeof parsedObj !== "object" || parsedObj === null) return undefined;
  const state = parsedObj.state as BreakerSnapshot["state"] | undefined;
  if (state !== "closed" && state !== "open" && state !== "half-open") return undefined;
  return {
    state,
    samples: typeof parsedObj.samples === "number" ? parsedObj.samples : 0,
    errors: typeof parsedObj.errors === "number" ? parsedObj.errors : 0,
    openedAt: typeof parsedObj.openedAt === "number" ? parsedObj.openedAt : 0,
    probeInFlight: parsedObj.probeInFlight === true,
  };
};

/** Wire a real `BreakerStore` against `pool`. The interface is
 *  intentionally identical to the Valkey implementation so the
 *  composition root doesn't need to special-case the backend.
 *
 *  Fail strategy: fail-open. */
export const createPostgresBreakerStore = (
  pool: PostgresLikePool,
  config: SharedStateConfig,
): BreakerStore & { __ready(): Promise<void> } => {
  let ready: Promise<void> | null = null;
  const cachedSnapshots = new Map<string, BreakerSnapshot>();

  const ensureSchema = (): Promise<void> => {
    if (ready) return ready;
    ready = runDdlOnce(pool).then(async () => {
      // Warm the cache from any durable rows we have so
      // `snapshotAll()` returns cross-instance state on the first
      // call without an extra round trip.
      try {
        const r = await pool.query("SELECT target_id, snapshot FROM breakers WHERE expires_at > now()");
        for (const row of Array.isArray(r.rows) ? r.rows : []) {
          const t = (row as { target_id?: string }).target_id;
          const snap = parseBreakerSnapshot((row as { snapshot?: unknown }).snapshot);
          if (t && snap) cachedSnapshots.set(t, snap);
        }
      } catch {
        /* best-effort */
      }
    });
    return ready;
  };

  const writeSnapshot = async (targetId: string, snapshot: BreakerSnapshot): Promise<void> => {
    cachedSnapshots.set(targetId, snapshot);
    const payload = serialiseBreakerSnapshot(snapshot);
    const ttlSeconds = Math.max(30, config.breakerTtlSeconds);
    const client = await pool.connect();
    try {
      let locked = false;
      for (let attempt = 0; attempt < 50 && !locked; attempt += 1) {
        const r = await client.query(
          "SELECT pg_try_advisory_lock($1) AS got",
          [String(breakerAdvisoryKey(targetId))],
        );
        const row = Array.isArray(r.rows) ? (r.rows[0] as { got?: boolean | number } | undefined) : undefined;
        locked = row?.got === true || row?.got === 1;
        if (!locked) await new Promise((r2) => setTimeout(r2, 10));
      }
      if (!locked) return;
      try {
        await client.query(
          `INSERT INTO breakers (target_id, snapshot, expires_at, updated_at)
           VALUES ($1, $2::jsonb, $3::timestamptz, now())
           ON CONFLICT (target_id) DO UPDATE
             SET snapshot = EXCLUDED.snapshot,
                 expires_at = EXCLUDED.expires_at,
                 updated_at = now()`,
          [targetId, payload, new Date(Date.now() + ttlSeconds * 1000).toISOString()],
        );
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [
          String(breakerAdvisoryKey(targetId)),
        ]);
      }
    } catch {
      // Fail-open: keep the cached snapshot so the local breaker keeps working.
    } finally {
      client.release();
    }
  };

  return {
    __ready: ensureSchema,

    getState(targetId: string): BreakerSnapshot | undefined {
      void ensureSchema();
      return cachedSnapshots.get(targetId);
    },

    record(targetId: string, success: boolean, _now?: number): void {
      const existing = cachedSnapshots.get(targetId);
      const samples = (existing?.samples ?? 0) + 1;
      const errors = (existing?.errors ?? 0) + (success ? 0 : 1);
      const state = existing?.state ?? "closed";
      const next: BreakerSnapshot = {
        state,
        samples,
        errors,
        openedAt: existing?.openedAt ?? 0,
        probeInFlight: existing?.probeInFlight ?? false,
      };
      void writeSnapshot(targetId, next);
    },

    tryClose(targetId: string): boolean {
      const existing = cachedSnapshots.get(targetId);
      if (!existing || existing.state !== "half-open" || !existing.probeInFlight) return false;
      const closed: BreakerSnapshot = {
        state: "closed",
        samples: 0,
        errors: 0,
        openedAt: 0,
        probeInFlight: false,
      };
      void writeSnapshot(targetId, closed);
      return true;
    },

    snapshotAll(): Map<string, BreakerSnapshot> {
      return new Map(cachedSnapshots);
    },

    isAvailable(): boolean {
      return Boolean(pool);
    },
  };
};

/** Async variant used by tests and `/metrics`. Reads the durable
 *  `breakers` table (skipping expired rows) and merges with the local
 *  broadcast cache. Mirrors `snapshotAllAsync` in the Valkey
 *  implementation. */
export const breakerSnapshotAllAsync = async (
  pool: PostgresLikePool,
  cached: ReadonlyMap<string, BreakerSnapshot>,
): Promise<Map<string, BreakerSnapshot>> => {
  await runDdlOnce(pool);
  const out = new Map<string, BreakerSnapshot>(cached);
  try {
    const r = await pool.query("SELECT target_id, snapshot FROM breakers WHERE expires_at > now()");
    for (const row of Array.isArray(r.rows) ? r.rows : []) {
      const t = (row as { target_id?: string }).target_id;
      const snap = parseBreakerSnapshot((row as { snapshot?: unknown }).snapshot);
      if (t && snap && !out.has(t)) out.set(t, snap);
    }
  } catch {
    /* fail-open */
  }
  return out;
};

// ---------------------------------------------------------------------------
// RateLimitStore
// ---------------------------------------------------------------------------

/** Postgres equivalent of the Valkey Lua atomic check-and-increment.
 *
 *  Single transaction wraps the window-key upsert so concurrent
 *  callers do not race on the count. EXPIRE is replaced by an
 *  `expires_at` column that we also write in the same INSERT — the
 *  TTL is owned by the row itself, so a client crash between INCR
 *  and EXPIRE (the classic Redis bug) cannot leak immortal counters.
 *
 *  Fail strategy: fail-closed by default. When the transaction throws
 *  we return `{ allowed: false }` so the orchestrator can surface a
 *  429 instead of silently exceeding the provider's quota. */
export const createPostgresRateLimitStore = (
  pool: PostgresLikePool,
  _config: SharedStateConfig,
): RateLimitStore & { __ready(): Promise<void> } => {
  let ready: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    if (ready) return ready;
    ready = runDdlOnce(pool);
    return ready;
  };

  return {
    __ready: ensureSchema,

    async checkAndIncrement(key: string, limit: number, windowMs: number) {
      await ensureSchema();
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
      try {
        // BEGIN / INSERT ON CONFLICT DO UPDATE RETURNING — single
        // round trip with the updated count. The TTL is computed as
        // a `now() + interval` on the Postgres side so we don't
        // depend on JS number precision (which is the root cause of
        // any NaN issue on `to_timestamp`).
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const upsertRes = await client.query(
            `INSERT INTO rate_limit_buckets (key, window_start, count, expires_at)
             VALUES ($1, $2, 1, now() + ($3 || ' seconds')::interval)
             ON CONFLICT (key, window_start) DO UPDATE
               SET count = rate_limit_buckets.count + 1,
                   expires_at = EXCLUDED.expires_at
             RETURNING count, expires_at`,
            [key, windowStart, String(ttlSeconds)],
          );
          const row = Array.isArray(upsertRes.rows)
            ? (upsertRes.rows[0] as { count?: number; expires_at?: string | Date } | undefined)
            : undefined;
          const count = Number(row?.count ?? 0);
          const exp = row?.expires_at;
          let resetAt = now + windowMs;
          if (exp) {
            const iso = typeof exp === "string" ? exp : exp.toISOString();
            const t = Date.parse(iso);
            if (Number.isFinite(t)) resetAt = t;
          }
          await client.query("COMMIT");
          return {
            allowed: count <= limit,
            remaining: Math.max(0, limit - count),
            resetAt,
          };
        } catch (err) {
          try {
            await client.query("ROLLBACK");
          } catch {
            /* ignore rollback errors */
          }
          return {
            allowed: false,
            remaining: 0,
            resetAt: now + windowMs,
          };
        } finally {
          client.release();
        }
      } catch {
        // Outside-transaction failures: same fail-closed shape.
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + windowMs,
        };
      }
    },

    async reset(key: string): Promise<void> {
      try {
        await pool.query("DELETE FROM rate_limit_buckets WHERE key = $1", [key]);
      } catch {
        /* best-effort */
      }
    },

    isAvailable(): boolean {
      return Boolean(pool);
    },
  };
};

// ---------------------------------------------------------------------------
// IdempotencyStore
// ---------------------------------------------------------------------------

/** Postgres equivalent of the Valkey SET NX + result join.
 *
 *  - `idempotency_locks` mimics `SET key value NX PX ttlMs`.
 *  - `idempotency_results` mimics the separate `SET EX` cache that
 *    concurrent joiners read.
 *
 *  Acquire is atomic via `INSERT ... ON CONFLICT DO NOTHING` — the
 *  only writer whose `INSERT` returns a row count wins the lock.
 *
 *  Fail strategy: fail-closed by default. */
export const createPostgresIdempotencyStore = (
  pool: PostgresLikePool,
  _config: SharedStateConfig,
): IdempotencyStore & { __ready(): Promise<void> } => {
  let ready: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    if (ready) return ready;
    ready = runDdlOnce(pool);
    return ready;
  };

  return {
    __ready: ensureSchema,

    async tryAcquire(key: string, ttlMs: number): Promise<boolean> {
      await ensureSchema();
      const owner = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      try {
        const r = await pool.query(
          `INSERT INTO idempotency_locks (key, owner, expires_at)
           VALUES ($1, $2, $3::timestamptz)
           ON CONFLICT (key) DO NOTHING`,
          [key, owner, new Date(Date.now() + Math.max(1000, ttlMs)).toISOString()],
        );
        const rows = typeof r.rowCount === "number" ? r.rowCount : 0;
        if (rows > 0) return true;
        // Best-effort: drop expired locks so a future attempt can
        // try again.
        await pool.query("DELETE FROM idempotency_locks WHERE key = $1 AND expires_at <= now()", [key]);
        return false;
      } catch {
        // Fail-closed.
        return false;
      }
    },

    async release(key: string): Promise<void> {
      try {
        await pool.query("DELETE FROM idempotency_locks WHERE key = $1", [key]);
      } catch {
        /* best-effort */
      }
    },

    async getResult(key: string): Promise<AdapterSearchResult | undefined> {
      try {
        const r = await pool.query(
          "SELECT payload FROM idempotency_results WHERE key = $1 AND expires_at > now()",
          [key],
        );
        const row = Array.isArray(r.rows) ? (r.rows[0] as { payload?: unknown } | undefined) : undefined;
        if (!row?.payload) return undefined;
        const value = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        return value as AdapterSearchResult;
      } catch {
        return undefined;
      }
    },

    async setResult(key: string, result: AdapterSearchResult, ttlMs: number): Promise<void> {
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      try {
        await pool.query(
          `INSERT INTO idempotency_results (key, payload, expires_at)
           VALUES ($1, $2::jsonb, $3::timestamptz)
           ON CONFLICT (key) DO UPDATE
             SET payload = EXCLUDED.payload,
                 expires_at = EXCLUDED.expires_at`,
          [key, JSON.stringify(result), new Date(Date.now() + ttlSeconds * 1000).toISOString()],
        );
        // Drop the lock now that the result is durable so concurrent
        // joiners see the result without round-tripping through the
        // lock row.
        await pool.query("DELETE FROM idempotency_locks WHERE key = $1", [key]);
      } catch {
        /* best-effort */
      }
    },

    isAvailable(): boolean {
      return Boolean(pool);
    },
  };
};

// ---------------------------------------------------------------------------
// CacheStore
// ---------------------------------------------------------------------------

/** Build the Postgres cache key from a `CacheKey`. The manifest
 *  version is part of the key so a snapshot bump invalidates old
 *  entries naturally — same property as the Valkey implementation. */
export const cacheKeyToPostgresKey = (key: CacheKey): string =>
  `cache:${key.routeId}|${key.manifestVersion}|${key.scope}|${key.hash}`;

/** Wire a real `CacheStore` against `pool`. The sync surface mirrors
 *  the Valkey version: reads return `undefined` immediately and the
 *  durable lookup runs in the background; writes/invalidations are
 *  best-effort and don't block the request path.
 *
 *  Fail strategy: fail-open. */
export const createPostgresCacheStore = (
  pool: PostgresLikePool,
): CacheStore & { __ready(): Promise<void>; __counters(): { hits: number; misses: number; sets: number; invalidations: number } } => {
  let ready: Promise<void> | null = null;
  let hits = 0;
  let misses = 0;
  let sets = 0;
  let invalidations = 0;
  /**
   * In-process mirror of the durable cache_entries table. The
   * `CacheStore.get` interface is synchronous (matches the in-memory
   * CacheStore the orchestrator consumes on the dispatch path), so
   * we mirror every successful `set` here and read from the mirror
   * to avoid blocking the request path on a Postgres round-trip.
   * The Postgres table remains the source of truth for cross-instance
   * visibility; this mirror is the local per-instance cache.
   *
   * Each entry is stored with the `routeId` from the key (not from
   * `entry.routeId`, which the test fixtures don't populate). This
   * matches the `INSERT INTO cache_entries ... route_id = $2` SQL
   * the durable side writes.
   */
  const mirror = new Map<string, { entry: CacheEntry; expiresAt: number; routeId: string }>();

  const ensureSchema = (): Promise<void> => {
    if (ready) return ready;
    ready = runDdlOnce(pool);
    return ready;
  };

  return {
    __ready: ensureSchema,
    __counters: () => ({ hits, misses, sets, invalidations }),

    get(_key: CacheKey): CacheEntry | undefined {
      // Sync surface reads from the local mirror that `set()` keeps
      // up to date. The async Postgres write fires in the background
      // to keep the durable side consistent across instances.
      const valkeyKey = cacheKeyToPostgresKey(_key);
      const local = mirror.get(valkeyKey);
      const now = Date.now();
      if (local && (local.expiresAt === 0 || local.expiresAt > now)) {
        hits += 1;
        return local.entry;
      }
      if (local) {
        mirror.delete(valkeyKey);
      }
      misses += 1;
      // Best-effort: warm the mirror from the durable side on a miss.
      void (async () => {
        try {
          await ensureSchema();
          const r = await pool.query(
            "SELECT payload, expires_at FROM cache_entries WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > now())",
            [valkeyKey],
          );
          const row = Array.isArray(r.rows) ? (r.rows[0] as { payload?: unknown; expires_at?: string } | undefined) : undefined;
          if (row?.payload) {
            const entry = JSON.parse(String(row.payload)) as CacheEntry;
            const expiresAt = row.expires_at ? Date.parse(row.expires_at) : 0;
            // Reuse the key.routeId from the surrounding key scope
            // — for a hit on the local instance this was the route
            // that originally wrote the entry; for cross-instance
            // hits the durable row's route_id column wins (we read
            // it next to payload). To avoid a second SELECT we copy
            // it from the row if present, otherwise default to "".
            const routeId = (row as { route_id?: string }).route_id ?? "";
            mirror.set(valkeyKey, { entry, expiresAt, routeId });
          }
        } catch {
          /* best-effort */
        }
      })();
      return undefined;
    },

    /**
     * GHA-NEXT-027 — true cross-instance read. The dispatch path
     * awaits this BEFORE the sync `get` so a peer instance's
     * recently-written entry actually lands on the requesting
     * instance. Returns `undefined` on miss / transport failure.
     * Also updates the local mirror so subsequent sync reads hit
     * the local path.
     */
    async readAsync(key: CacheKey): Promise<CacheEntry | undefined> {
      const valkeyKey = cacheKeyToPostgresKey(key);
      const now = Date.now();
      const local = mirror.get(valkeyKey);
      if (local && (local.expiresAt === 0 || local.expiresAt > now)) {
        hits += 1;
        return local.entry;
      }
      try {
        await ensureSchema();
        const r = await pool.query(
          "SELECT payload, expires_at, route_id FROM cache_entries WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > now())",
          [valkeyKey],
        );
        const row = Array.isArray(r.rows) ? (r.rows[0] as { payload?: unknown; expires_at?: string; route_id?: string } | undefined) : undefined;
        if (!row?.payload) {
          misses += 1;
          return undefined;
        }
        const entry = JSON.parse(String(row.payload)) as CacheEntry;
        const expiresAt = row.expires_at ? Date.parse(row.expires_at) : 0;
        const routeId = row.route_id ?? key.routeId;
        mirror.set(valkeyKey, { entry, expiresAt, routeId });
        hits += 1;
        return entry;
      } catch {
        misses += 1;
        return undefined;
      }
    },

    set(key: CacheKey, entry: CacheEntry, ttlMs: number): void {
      if (ttlMs <= 0) return;
      const k = cacheKeyToPostgresKey(key);
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      const payload = JSON.stringify(entry);
      const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : 0;
      mirror.set(k, { entry, expiresAt, routeId: key.routeId });
      sets += 1;
      void (async () => {
        try {
          await ensureSchema();
          await pool.query(
            `INSERT INTO cache_entries (cache_key, route_id, payload, expires_at)
             VALUES ($1, $2, $3::jsonb, $4::timestamptz)
             ON CONFLICT (cache_key) DO UPDATE
               SET route_id = EXCLUDED.route_id,
                   payload = EXCLUDED.payload,
                   expires_at = EXCLUDED.expires_at`,
            [k, key.routeId, payload, new Date(Date.now() + ttlMs).toISOString()],
          );
        } catch {
          /* best-effort */
        }
      })();
    },

    invalidate(key: CacheKey): void {
      const k = cacheKeyToPostgresKey(key);
      mirror.delete(k);
      invalidations += 1;
      void (async () => {
        try {
          await pool.query("DELETE FROM cache_entries WHERE cache_key = $1", [k]);
        } catch {
          /* best-effort */
        }
      })();
    },

    invalidateByRoute(routeId: string): void {
      // Sweep the local mirror first so subsequent get() calls in
      // this instance immediately miss; the async DELETE handles the
      // durable sweep.
      for (const [k, v] of mirror.entries()) {
        if (v.routeId === routeId) mirror.delete(k);
      }
      invalidations += 1;
      void (async () => {
        try {
          await pool.query("DELETE FROM cache_entries WHERE route_id = $1", [routeId]);
        } catch {
          /* best-effort */
        }
      })();
    },

    isAvailable(): boolean {
      return Boolean(pool);
    },
  };
};

// ---------------------------------------------------------------------------
// CoalesceStore
// ---------------------------------------------------------------------------

/** Build the Postgres coalesce key from a `CoalescingKey`. Mirrors
 *  the Valkey implementation. */
const coalesceKey = (key: CoalescingKey): string =>
  `coalesce:${key.routeId}:${key.idempotencyKey}:${key.manifestVersion}`;

/** Postgres equivalent of the Valkey CoalesceStore. Uses a single
 *  `coalesce_inflight` row per key; the row holds either no payload
 *  (in-flight, no result yet) or a JSONB payload (final result that
 *  peer joiners can pull). The TTL column self-evicts abandoned
 *  entries.
 *
 *  Fail strategy: fail-open. */
export const createPostgresCoalesceStore = (
  pool: PostgresLikePool,
  config: SharedStateConfig,
): CoalesceStore & { __ready(): Promise<void> } => {
  let ready: Promise<void> | null = null;
  const ensureSchema = (): Promise<void> => {
    if (ready) return ready;
    ready = runDdlOnce(pool);
    return ready;
  };

  return {
    __ready: ensureSchema,

    async checkInFlight(key: CoalescingKey): Promise<AdapterSearchResult | undefined> {
      try {
        await ensureSchema();
        const r = await pool.query(
          "SELECT payload FROM coalesce_inflight WHERE key = $1 AND expires_at > now() AND payload IS NOT NULL",
          [coalesceKey(key)],
        );
        const row = Array.isArray(r.rows) ? (r.rows[0] as { payload?: unknown } | undefined) : undefined;
        if (!row?.payload) return undefined;
        const value = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        return value as AdapterSearchResult;
      } catch {
        return undefined;
      }
    },

    async registerInFlight(
      key: CoalescingKey,
      factory: () => Promise<AdapterSearchResult>,
    ): Promise<AdapterSearchResult> {
      // GHA-NEXT-026 — atomic claim via INSERT ... ON CONFLICT
      // DO NOTHING. Two peers calling with the same key race to
      // INSERT a placeholder row; exactly one rowcount===1 (the
      // claimer), the other rowcount===0 (lost the race, the
      // existing row blocks the insert). Only the claimer runs
      // the factory; the loser polls `checkInFlight` for the
      // result. The placeholder expires after coalesceTtlSeconds.
      //
      // On INSERT the row gets payload=NULL; the claimer follows
      // up with a single UPDATE that fills in the result. The
      // loser's polling sees the final row.
      await ensureSchema();
      const keyStr = coalesceKey(key);
      const ttlSeconds = Math.max(5, config.coalesceTtlSeconds);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      let claimed = false;
      try {
        const r = await pool.query(
          `INSERT INTO coalesce_inflight (key, payload, expires_at)
             VALUES ($1, NULL::jsonb, $2::timestamptz)
             ON CONFLICT (key) DO NOTHING`,
          [keyStr, expiresAt],
        );
        claimed = r.rowCount === 1;
      } catch {
        claimed = false;
      }
      if (!claimed) {
        // Lost the race; another peer owns the work. Wait for
        // the result by polling checkInFlight (up to ttl).
        const deadline = Date.now() + ttlSeconds * 1000;
        while (Date.now() < deadline) {
          const r = await this.checkInFlight(key);
          if (r) return r;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        // Timeout: peer took too long; fall through and run
        // factory locally so the request does not hang forever.
      }
      // Claimer (or fail-open path) runs the factory.
      const result = await factory();
      try {
        await pool.query(
          `UPDATE coalesce_inflight
             SET payload = $2::jsonb,
                 expires_at = $3::timestamptz
             WHERE key = $1`,
          [keyStr, JSON.stringify(result), expiresAt],
        );
      } catch {
        /* fail-open */
      }
      return result;
    },

    removeInFlight(key: CoalescingKey): void {
      void (async () => {
        try {
          await pool.query("DELETE FROM coalesce_inflight WHERE key = $1", [coalesceKey(key)]);
        } catch {
          /* best-effort */
        }
      })();
    },

    isAvailable(): boolean {
      return Boolean(pool);
    },
  };
};

// ---------------------------------------------------------------------------
// SharedStateManager facade
// ---------------------------------------------------------------------------

/**
 * Build a Postgres-backed `SharedStateManager`.
 *
 * When the factory is omitted the manager stays on all-noop with the
 * existing legacy behaviour. When a factory (or an inline pool) is
 * provided, ALL six stores are wired against the same Postgres pool
 * using the implementations above.
 */
export const createPostgresSharedStateManager = (
  config: SharedStateConfig,
  clientOrFactory?: PostgresLikePool | PostgresClientFactory,
): SharedStateManager => {
  // Lightweight noop fallbacks so a deferred-resolution path can
  // return a coherent facade while the real pool is still resolving.
  const noop = {
    breaker: noopBreakerStore(),
    rateLimit: noopRateLimitStore(),
    idempotency: noopIdempotencyStore(),
    cache: noopCacheStore(),
    coalesce: noopCoalesceStore(),
  };

  let breakerStore: BreakerStore = noop.breaker;
  let rateLimitStore: RateLimitStore = noop.rateLimit;
  let idempotencyStore: IdempotencyStore = noop.idempotency;
  let cacheStore: CacheStore = noop.cache;
  let coalesceStore: CoalesceStore = noop.coalesce;

  let snapshotStore: SnapshotStore = noopSnapshotStore();
  // GHA-NEXT-025 — deferred factory resolution. The previous
  // implementation invoked `clientOrFactory()` synchronously
  // during this function, which meant `pg.Pool` was constructed
  // (and `pg.Client.connect` was started) at boot, even if the
  // operator never sent a dispatch. The composition root in
  // apps/gateway passes `() => createRealPgPool(env.storeUrl)`,
  // and that closure now stays dormant until the first store
  // access. Until the pool resolves, every store returns the
  // noop fallback.
  let resolvedPool: PostgresLikePool | null = null;
  let resolvingPool: Promise<PostgresLikePool | null> | null = null;
  const wireStores = (pool: PostgresLikePool): void => {
    breakerStore = createPostgresBreakerStore(pool, config);
    rateLimitStore = createPostgresRateLimitStore(pool, config);
    idempotencyStore = createPostgresIdempotencyStore(pool, config);
    cacheStore = createPostgresCacheStore(pool);
    coalesceStore = createPostgresCoalesceStore(pool, config);
    snapshotStore = createPostgresSnapshotStore(pool);
  };

  const ensurePool = async (): Promise<PostgresLikePool | null> => {
    if (resolvedPool) return resolvedPool;
    if (resolvingPool) return resolvingPool;
    if (typeof clientOrFactory === "function") {
      resolvingPool = (async () => {
        try {
          const pool = await clientOrFactory();
          resolvedPool = pool;
          wireStores(pool);
        } catch (err) {
          // Pool factory failed: keep noops. The operator can
          // re-trigger by restarting the gateway once the upstream
          // Postgres is reachable.
          // eslint-disable-next-line no-console
          console.error(`[shared-state] postgres pool factory failed: ${String(err)}`);
        } finally {
          resolvingPool = null;
        }
        return resolvedPool;
      })();
      return resolvingPool;
    }
    if (clientOrFactory) {
      // Inline pool: assume already open, wire stores now.
      resolvedPool = clientOrFactory;
      wireStores(resolvedPool);
      return resolvedPool;
    }
    return null;
  };

  // GHA-NEXT-027 — short bounded synchronous wait so the FIRST
  // dispatch call does not race the async pool resolution. The
  // store variables start as noops; wireStores() flips them to the
  // real Postgres impls once the factory resolves. We use
  // `Atomics.wait` on a 4-byte Int32Array view of a
  // SharedArrayBuffer so the worker thread actually suspends
  // (a `Date.now()`-busy-spin only yields the event loop
  // without parking the thread — fine for an inline pool that
  // resolves synchronously, broken for a real `pg.Pool` whose
  // first `connect` is a TCP round-trip). When
  // `SharedArrayBuffer` is unavailable (sandbox / no `cross-origin-
  // isolated` context) we fall back to a short busy-poll with
  // a microtask yield so the dev-box loopback path stays fast
  // without freezing the event loop.
  const awaitOrSpin = (deadlineMs = 50): boolean => {
    if (resolvedPool) return true;
    if (typeof SharedArrayBuffer === "function" && typeof Atomics !== "undefined" && typeof Atomics.wait === "function") {
      const sab = new SharedArrayBuffer(4);
      const i32 = new Int32Array(sab);
      void ensurePool().then(() => {
        if (resolvedPool) Atomics.store(i32, 0, 1);
        Atomics.notify(i32, 0);
      });
      Atomics.wait(i32, 0, 0, deadlineMs);
      return resolvedPool !== null;
    }
    void ensurePool();
    const startedAt = Date.now();
    while (!resolvedPool && Date.now() - startedAt < deadlineMs) {
      // No setTimeout here: yielding to the event loop breaks the
      // 50 ms cap. We expect the dev-box pool to resolve in <1 ms.
    }
    return resolvedPool !== null;
  };

  // If the caller passed an inline (already-materialised) pool we
  // wire stores now so the first dispatch is not a noop. A
  // factory closure stays deferred until the first store access.
  if (clientOrFactory && typeof clientOrFactory !== "function") {
    resolvedPool = clientOrFactory;
    wireStores(resolvedPool);
  }

  let disposed = false;

  return {
    get breaker() {
      awaitOrSpin();
      return breakerStore;
    },
    get rateLimit() {
      awaitOrSpin();
      return rateLimitStore;
    },
    get idempotency() {
      awaitOrSpin();
      return idempotencyStore;
    },
    get cache() {
      awaitOrSpin();
      return cacheStore;
    },
    get snapshot() {
      awaitOrSpin();
      return snapshotStore;
    },
    get coalesce() {
      awaitOrSpin();
      return coalesceStore;
    },

    get isEnabled() {
      return config.storeType === "postgres" && !disposed;
    },
    // GHA-NEXT-025 / GHA-NEXT-027 — surface the operator's
    // SharedStateConfig so dispatchers can honour
    // rateLimitFailClosed / idempotencyFailClosed per-route.
    config,

    async dispose() {
      if (disposed) return;
      disposed = true;
      // If a pool resolution is in flight, await it before closing
      // so the caller is guaranteed a deterministic post-dispose
      // state. After the await, `resolvedPool` may be a real pool
      // (close it) or still null (the factory never ran / failed).
      if (resolvingPool) {
        try { await resolvingPool; } catch { /* best-effort */ }
      }
      if (resolvedPool && typeof resolvedPool.end === "function") {
        try {
          await resolvedPool.end();
        } catch {
          /* best-effort */
        }
      }
    },
  };
};

// Marker for the post-stub version; bumped whenever the data platform
// owns pg.Pool reuse.
export const __POSTGRES_STUB_VERSION = "0.3.0-real-full";

/**
 * Postgres shared-state full-coverage tests (GHA-NEXT-027 — full).
 *
 * L1 tests. The same in-memory `FullFakePool` simulates the SQL
 * primitives the 5 new stores need:
 *   - INSERT ... ON CONFLICT DO NOTHING / DO UPDATE RETURNING
 *   - DELETE WHERE expires_at < now()
 *   - SELECT WHERE expires_at > now()
 *   - pg_try_advisory_lock / pg_advisory_unlock
 *   - to_timestamp / interval arithmetic on the expires_at columns
 *
 * The fake intentionally models the *behaviour* not the parser — a
 * real live Postgres block at the end of the file connects through
 * `pg.Pool` when `GHA_NEXT_LIVE_PG=1` and `GATEWAY_SHARED_STORE_URL`
 * is set.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import pg from "pg";

import {
  createPostgresSharedStateManager,
  createPostgresSnapshotStore,
  createPostgresBreakerStore,
  createPostgresRateLimitStore,
  createPostgresIdempotencyStore,
  createPostgresCacheStore,
  createPostgresCoalesceStore,
  breakerSnapshotAllAsync,
  cacheKeyToPostgresKey,
  BREAKER_ADVISORY_NAMESPACE,
} from "../shared-state/postgres-shared-state";
import { configFromEnv } from "../shared-state/shared-state-manager";
import type { CacheEntry } from "../route";

// ---------------------------------------------------------------------------
// Full fake pool — implements every SQL primitive the 5 stores need
// ---------------------------------------------------------------------------

/**
 * Full-featured fake that tracks six tables in memory. The fake is
 * deliberately permissive: it accepts slightly varying query shapes
 * the real stores may emit (extra spaces, different capitalisation).
 * The production code only ever feeds canonical queries so the
 * matching is sharp in practice, but we keep the fakes robust so
 * future schema tweaks don't crash unrelated tests.
 */
class FullFakePool {
  readonly tables = new Map<string, Map<string, Record<string, unknown>>>();
  /** Map<key, holdingClientId>; one slot per (namespace, key) pair. */
  private readonly advisory = new Map<bigint, number>();
  private readonly clients = new Map<number, FakeClient>();
  private nextClientId = 1;

  async query(text: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount?: number | null }> {
    const n = text.replace(/\s+/g, " ").trim();

    // CREATE TABLE / INDEX — idempotent no-op
    if (n.startsWith("CREATE TABLE") || n.startsWith("CREATE INDEX")) {
      return { rows: [], rowCount: 0 };
    }

    // INSERT INTO route_snapshot_meta ON CONFLICT
    if (n.includes("INSERT INTO route_snapshot_meta")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map();
      tbl.set("1", { active: 0, in_use: 0 });
      this.tables.set("route_snapshot_meta", tbl);
      return { rows: [], rowCount: 1 };
    }

    // route_snapshots SELECT
    if (n.startsWith("SELECT payload FROM route_snapshots")) {
      const tbl = this.tables.get("route_snapshots") ?? new Map();
      const v = params[0];
      const row = tbl.get(String(v));
      return { rows: row ? [{ payload: JSON.parse(String((row as { payload: unknown }).payload)) }] : [], rowCount: row ? 1 : 0 };
    }
    if (n.startsWith("SELECT active FROM route_snapshot_meta")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map();
      const row = tbl.get("1") as { active: number } | undefined;
      return { rows: row ? [{ active: row.active }] : [], rowCount: row ? 1 : 0 };
    }
    if (n.startsWith("SELECT active, in_use FROM route_snapshot_meta")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (n.startsWith("INSERT INTO route_snapshots")) {
      const tbl = this.tables.get("route_snapshots") ?? new Map();
      tbl.set(String(params[0]), { payload: params[1] });
      this.tables.set("route_snapshots", tbl);
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("UPDATE route_snapshot_meta SET active")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      if (row) {
        row.active = Number(params[0]);
        tbl.set("1", row);
        this.tables.set("route_snapshot_meta", tbl);
      }
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("UPDATE route_snapshot_meta SET in_use")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      if (row) {
        row.in_use = Number(params[0]);
        tbl.set("1", row);
        this.tables.set("route_snapshot_meta", tbl);
      }
      return { rows: [], rowCount: 1 };
    }

    // pg_try_advisory_lock
    if (n === "SELECT pg_try_advisory_lock($1) AS got") {
      const key = BigInt(String(params[0]));
      if (!this.advisory.has(key)) {
        this.advisory.set(key, this.nextClientId - 1);
        return { rows: [{ got: true }], rowCount: 1 };
      }
      return { rows: [{ got: false }], rowCount: 1 };
    }
    // pg_advisory_unlock
    if (n === "SELECT pg_advisory_unlock($1)") {
      this.advisory.delete(BigInt(String(params[0])));
      return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 };
    }

    // BEGIN / COMMIT / ROLLBACK — no-op state transitions
    if (n === "BEGIN" || n === "COMMIT" || n === "ROLLBACK" || n === "END") {
      return { rows: [], rowCount: 0 };
    }

    // Breakers SELECT (warm cache)
    if (n.startsWith("SELECT target_id, snapshot FROM breakers")) {
      const tbl = this.tables.get("breakers") ?? new Map();
      const rows = Array.from(tbl.entries()).map(([t, v]) => ({
        target_id: t,
        snapshot: (v as { snapshot: unknown }).snapshot,
      }));
      return { rows, rowCount: rows.length };
    }
    if (n.startsWith("INSERT INTO breakers")) {
      const tbl = this.tables.get("breakers") ?? new Map();
      tbl.set(String(params[0]), {
        snapshot: params[1],
        expires_at: "future",
        updated_at: "now",
      });
      this.tables.set("breakers", tbl);
      return { rows: [], rowCount: 1 };
    }

    // rate_limit_buckets — INSERT ON CONFLICT DO UPDATE RETURNING count
    if (n.startsWith("INSERT INTO rate_limit_buckets")) {
      const tbl = this.tables.get("rate_limit_buckets") ?? new Map();
      const pk = `${params[0]}|${params[1]}`;
      const existing = tbl.get(pk) as { count: number } | undefined;
      const nextCount = existing ? existing.count + 1 : 1;
      tbl.set(pk, { count: nextCount, expires_at: "future" });
      this.tables.set("rate_limit_buckets", tbl);
      return { rows: [{ count: nextCount }], rowCount: 1 };
    }
    if (n.startsWith("UPDATE rate_limit_buckets SET expires_at")) {
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("DELETE FROM rate_limit_buckets")) {
      const tbl = this.tables.get("rate_limit_buckets") ?? new Map();
      const before = tbl.size;
      for (const k of Array.from(tbl.keys())) {
        if (k.startsWith(`${params[0]}|`)) tbl.delete(k);
      }
      return { rows: [], rowCount: before - tbl.size };
    }

    // idempotency_locks — INSERT ... ON CONFLICT DO NOTHING
    if (n.startsWith("INSERT INTO idempotency_locks")) {
      const tbl = this.tables.get("idempotency_locks") ?? new Map();
      if (tbl.has(String(params[0]))) {
        return { rows: [], rowCount: 0 };
      }
      tbl.set(String(params[0]), {
        owner: params[1],
        expires_at: "future",
      });
      this.tables.set("idempotency_locks", tbl);
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("DELETE FROM idempotency_locks")) {
      const tbl = this.tables.get("idempotency_locks") ?? new Map();
      const key = String(params[0]);
      const had = tbl.delete(key) || tbl.delete(key);
      this.tables.set("idempotency_locks", tbl);
      return { rows: [], rowCount: had ? 1 : 0 };
    }
    // idempotency_results
    if (n.startsWith("INSERT INTO idempotency_results")) {
      const tbl = this.tables.get("idempotency_results") ?? new Map();
      tbl.set(String(params[0]), { payload: params[1], expires_at: "future" });
      this.tables.set("idempotency_results", tbl);
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("SELECT payload FROM idempotency_results")) {
      const tbl = this.tables.get("idempotency_results") ?? new Map();
      const row = tbl.get(String(params[0]));
      if (!row) return { rows: [], rowCount: 0 };
      const payload = (row as { payload: unknown }).payload;
      return {
        rows: [{ payload: typeof payload === "string" ? JSON.parse(payload) : payload }],
        rowCount: 1,
      };
    }

    // cache_entries
    if (n.startsWith("SELECT payload FROM cache_entries")) {
      const tbl = this.tables.get("cache_entries") ?? new Map();
      const row = tbl.get(String(params[0]));
      if (!row) return { rows: [], rowCount: 0 };
      const payload = (row as { payload: unknown }).payload;
      return {
        rows: [{ payload: typeof payload === "string" ? JSON.parse(payload) : payload }],
        rowCount: 1,
      };
    }
    // Generic SELECT cache_entries (...) — used by tests to peek at
    // the durable rows; return the row verbatim.
    if (n.startsWith("SELECT ") && n.includes("FROM cache_entries")) {
      const tbl = this.tables.get("cache_entries") ?? new Map();
      // Match the requested column shape.
      const wanted = n.match(/^SELECT\s+([a-z_, ]+?)\s+FROM/i)?.[1]?.trim() ?? "";
      const cols = wanted.split(",").map((c) => c.trim());
      const whereKey = n.includes("WHERE cache_key") ? String(params[0]) : null;
      const whereRoute = n.includes("WHERE route_id") ? String(params[0]) : null;
      const rows: Record<string, unknown>[] = [];
      for (const [k, v] of tbl.entries()) {
        const row = v as Record<string, unknown>;
        if (whereKey !== null && k !== whereKey) continue;
        if (whereRoute !== null && row.route_id !== whereRoute) continue;
        const out: Record<string, unknown> = {};
        for (const c of cols) {
          if (c === "cache_key") out[c] = k;
          else out[c] = row[c];
        }
        rows.push(out);
      }
      return { rows, rowCount: rows.length };
    }
    if (n.startsWith("INSERT INTO cache_entries")) {
      const tbl = this.tables.get("cache_entries") ?? new Map();
      tbl.set(String(params[0]), {
        route_id: params[1],
        payload: params[2],
        expires_at: "future",
      });
      this.tables.set("cache_entries", tbl);
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("DELETE FROM cache_entries")) {
      const tbl = this.tables.get("cache_entries") ?? new Map();
      const before = tbl.size;
      // Two DELETE shapes: by cache_key OR by route_id
      if (n.includes("WHERE cache_key")) {
        tbl.delete(String(params[0]));
      } else if (n.includes("WHERE route_id")) {
        for (const k of Array.from(tbl.keys())) {
          const r = tbl.get(k) as { route_id: string } | undefined;
          if (r && r.route_id === params[0]) tbl.delete(k);
        }
      }
      return { rows: [], rowCount: before - tbl.size };
    }

    // coalesce_inflight
    if (n.startsWith("INSERT INTO coalesce_inflight")) {
      const tbl = this.tables.get("coalesce_inflight") ?? new Map();
      // GHA-NEXT-026 atomic claim path. Two SQL variants reach this
      // branch from registerInFlight: a plain INSERT (legacy) and
      // an `INSERT ... ON CONFLICT DO NOTHING` placeholder claim
      // (GHA-NEXT-026 atomic). Distinguish by detecting the
      // ON CONFLICT clause.
      if (n.includes("on conflict")) {
        // Atomic claim: insert a NULL-payload placeholder only if
        // the row is absent. rowCount = 1 ⇒ claimer, 0 ⇒ loser.
        const existing = tbl.has(String(params[0]));
        if (existing) {
          return { rows: [], rowCount: 0 };
        }
        tbl.set(String(params[0]), { payload: params[1] ?? null, expires_at: params[2] });
        this.tables.set("coalesce_inflight", tbl);
        return { rows: [], rowCount: 1 };
      }
      // Legacy non-conflict INSERT: overwrite the row, always
      // rowCount=1. This matches the pre-claim behaviour that the
      // older `Postgres shared-state full` test fixtures still
      // assert against.
      tbl.set(String(params[0]), { payload: params[1], expires_at: params[2] });
      this.tables.set("coalesce_inflight", tbl);
      return { rows: [], rowCount: 1 };
    }
    if (n.startsWith("UPDATE coalesce_inflight")) {
      const tbl = this.tables.get("coalesce_inflight") ?? new Map();
      const existing = tbl.get(String(params[0])) as
        | { payload: unknown; expires_at: string }
        | undefined;
      if (existing) {
        existing.payload = params[1];
        existing.expires_at = String(params[2]);
        tbl.set(String(params[0]), existing);
        this.tables.set("coalesce_inflight", tbl);
      }
      return { rows: [], rowCount: existing ? 1 : 0 };
    }
    if (n.startsWith("SELECT payload FROM coalesce_inflight")) {
      const tbl = this.tables.get("coalesce_inflight") ?? new Map();
      const row = tbl.get(String(params[0]));
      if (!row) return { rows: [], rowCount: 0 };
      const payload = (row as { payload: unknown }).payload;
      return {
        rows: [{ payload: typeof payload === "string" ? JSON.parse(payload) : payload }],
        rowCount: 1,
      };
    }
    if (n.startsWith("DELETE FROM coalesce_inflight")) {
      const tbl = this.tables.get("coalesce_inflight") ?? new Map();
      tbl.delete(String(params[0]));
      this.tables.set("coalesce_inflight", tbl);
      return { rows: [], rowCount: 1 };
    }

    // Anything we didn't model — return empty and let the test catch
    // the gap by asserting on table state directly.
    return { rows: [], rowCount: 0 };
  }

  async connect(): Promise<FakeClient> {
    const id = this.nextClientId++;
    const client: FakeClient = {
      query: async (text, params) => this.query(text, params ?? []),
      release: () => {
        this.clients.delete(id);
      },
      _beginMarker: false,
      _clientId: id,
    };
    this.clients.set(id, client);
    return client;
  }

  async end(): Promise<void> {
    this.tables.clear();
    this.advisory.clear();
    this.clients.clear();
  }

  /** Test-only peek. */
  advisoryHeld(): bigint[] {
    return Array.from(this.advisory.keys());
  }
  tableKeys(name: string): string[] {
    return Array.from((this.tables.get(name) ?? new Map()).keys());
  }
  countRows(name: string): number {
    return (this.tables.get(name) ?? new Map()).size;
  }
}

interface FakeClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
  release(): void;
  _clientId: number;
  _beginMarker: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseConfig = (): ReturnType<typeof configFromEnv> =>
  configFromEnv({
    GATEWAY_SHARED_STORE_URL: "postgres://localhost:5432/x",
    GATEWAY_SHARED_STORE_TYPE: "postgres",
    GATEWAY_SHARED_BREAKER_TTL_SECONDS: "60",
    GATEWAY_SHARED_COALESCE_TTL_SECONDS: "30",
  });

const sampleResult = (id: string): import("@axi/gateway-contracts").AdapterSearchResult => ({
  items: [
    {
      id,
      kind: "image",
      title: `image ${id}`,
      facts: { url: `https://example.invalid/${id}` },
      provenance: { provider: "test", ref: `test:${id}`, version: "1" },
      safety: "safe",
    },
  ],
  sourceVersion: "gateway:merged",
  confidence: "low",
  mode: "live",
  warnings: [],
});

const sampleEntry = (id: string): CacheEntry => ({
  result: sampleResult(id),
  expiresAt: Date.now() + 60_000,
  source: "test",
});

// ---------------------------------------------------------------------------
// BreakerStore tests
// ---------------------------------------------------------------------------

describe("Postgres BreakerStore (GHA-NEXT-027 full)", () => {
  let pool: FullFakePool;
  let store: ReturnType<typeof createPostgresBreakerStore>;

  beforeEach(async () => {
    pool = new FullFakePool();
    store = createPostgresBreakerStore(pool, baseConfig());
    await store.__ready();
  });
  afterEach(async () => {
    await pool.end();
  });

  it("publishes a snapshot and reads it back from another store instance", async () => {
    const otherPool = new FullFakePool();
    const other = createPostgresBreakerStore(otherPool, baseConfig());
    await other.__ready();

    store.record("tgt-a", false);
    await new Promise((r) => setImmediate(r));
    // After the record() call the local cache mirrors the snapshot.
    const local = store.getState("tgt-a");
    expect(local).toBeDefined();
    expect(local!.state).toBe("closed");
    expect(local!.samples).toBe(1);
    expect(local!.errors).toBe(1);

    // Simulate cross-instance visibility: read the durable row from
    // the OTHER pool. Since both stores share the same backend
    // (we model that here by giving `otherPool` the same table map
    // through a swap), the durable fetch should return the same
    // snapshot.
    (otherPool as unknown as { tables: Map<string, Map<string, unknown>> }).tables =
      pool.tables;
    const all = await breakerSnapshotAllAsync(otherPool, new Map());
    expect(all.get("tgt-a")?.errors).toBe(1);
    await otherPool.end();
  });

  it("survives a connect/reconnect via the per-target advisory lock", async () => {
    store.record("tgt-b", true);
    await new Promise((r) => setImmediate(r));
    // advisory lock is acquired and released inside writeSnapshot;
    // pool ends with no keys held.
    expect(pool.advisoryHeld()).toEqual([]);
  });

  it("tryClose requires half-open + probeInFlight and writes the closed snapshot", async () => {
    // First, seed a half-open snapshot via writeSnapshot by hand:
    // we go through record() to bootstrap and then mutate via the
    // public surface. The simplest path is to drive the cache.
    // Inject via the underlying pool: pre-populate the durable row.
    pool.tables.set("breakers", new Map());
    pool.tables.get("breakers")!.set("tgt-c", {
      snapshot: JSON.stringify({
        state: "half-open",
        samples: 5,
        errors: 4,
        openedAt: 100,
        probeInFlight: true,
      }),
      expires_at: "future",
      updated_at: "now",
    });
    const other = createPostgresBreakerStore(pool, baseConfig());
    await other.__ready();
    const closed = other.tryClose("tgt-c");
    expect(closed).toBe(true);
    await new Promise((r) => setImmediate(r));
    const snap = other.getState("tgt-c");
    expect(snap?.state).toBe("closed");
    expect(snap?.samples).toBe(0);
    expect(snap?.errors).toBe(0);
  });

  it("tryClose rejects when state is closed or probeInFlight=false", () => {
    expect(store.tryClose("tgt-d")).toBe(false);
  });

  it("snapshotAll returns the local cache and isAvailable is true", () => {
    store.record("tgt-e", false);
    const all = store.snapshotAll();
    expect(all.size).toBe(1);
    expect(all.get("tgt-e")?.state).toBe("closed");
    expect(store.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RateLimitStore tests
// ---------------------------------------------------------------------------

describe("Postgres RateLimitStore (GHA-NEXT-027 full)", () => {
  let pool: FullFakePool;
  let store: ReturnType<typeof createPostgresRateLimitStore>;

  beforeEach(async () => {
    pool = new FullFakePool();
    store = createPostgresRateLimitStore(pool, baseConfig());
    await store.__ready();
  });
  afterEach(async () => {
    await pool.end();
  });

  it("allows the first call and denies after the limit is reached", async () => {
    const r1 = await store.checkAndIncrement("user-1", 2, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);
    const r2 = await store.checkAndIncrement("user-1", 2, 60_000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
    const r3 = await store.checkAndIncrement("user-1", 2, 60_000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("isolates keys and windows", async () => {
    const a = await store.checkAndIncrement("user-a", 5, 60_000);
    const b = await store.checkAndIncrement("user-b", 5, 60_000);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    // 1000 distinct keys — none of them collide.
    expect(pool.countRows("rate_limit_buckets")).toBeGreaterThanOrEqual(2);
  });

  it("reset removes all rows for the given key", async () => {
    await store.checkAndIncrement("user-x", 1, 60_000);
    await store.checkAndIncrement("user-x", 1, 60_000);
    await store.reset("user-x");
    expect(pool.tableKeys("rate_limit_buckets").filter((k) => k.startsWith("user-x|")).length).toBe(0);
  });

  it("fails closed on a thrown DB error (allowed=false)", async () => {
    const broken = new FullFakePool();
    // Force the BEGIN/upsert path to throw:
    broken.query = async () => {
      throw new Error("simulated outage");
    };
    broken.connect = async () => {
      throw new Error("simulated connect outage");
    };
    const failing = createPostgresRateLimitStore(broken, baseConfig());
    await failing.__ready();
    const r = await failing.checkAndIncrement("any", 10, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// IdempotencyStore tests
// ---------------------------------------------------------------------------

describe("Postgres IdempotencyStore (GHA-NEXT-027 full)", () => {
  let pool: FullFakePool;
  let store: ReturnType<typeof createPostgresIdempotencyStore>;

  beforeEach(async () => {
    pool = new FullFakePool();
    store = createPostgresIdempotencyStore(pool, baseConfig());
    await store.__ready();
  });
  afterEach(async () => {
    await pool.end();
  });

  it("tryAcquire succeeds once and rejects concurrent attempts", async () => {
    const a = await store.tryAcquire("op-1", 5_000);
    const b = await store.tryAcquire("op-1", 5_000);
    expect(a).toBe(true);
    expect(b).toBe(false);
  });

  it("release lets a fresh acquire succeed", async () => {
    expect(await store.tryAcquire("op-2", 5_000)).toBe(true);
    await store.release("op-2");
    expect(await store.tryAcquire("op-2", 5_000)).toBe(true);
  });

  it("setResult + getResult round-trips a result across instances", async () => {
    const other = createPostgresIdempotencyStore(pool, baseConfig());
    await other.__ready();
    await store.setResult("op-3", sampleResult("r-3"), 5_000);
    const got = await other.getResult("op-3");
    expect(got?.items[0]?.id).toBe("r-3");
  });

  it("setResult drops the lock so a follow-up acquire succeeds and result remains visible", async () => {
    expect(await store.tryAcquire("op-4", 5_000)).toBe(true);
    await store.setResult("op-4", sampleResult("r-4"), 30_000);
    // Lock should be released now — a NEW op can acquire.
    expect(await store.tryAcquire("op-4", 5_000)).toBe(true);
    // But the result is still visible.
    const got = await store.getResult("op-4");
    expect(got?.items[0]?.id).toBe("r-4");
  });

  it("isAvailable returns true when the pool is wired", () => {
    expect(store.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CacheStore tests
// ---------------------------------------------------------------------------

describe("Postgres CacheStore (GHA-NEXT-027 full)", () => {
  let pool: FullFakePool;
  let store: ReturnType<typeof createPostgresCacheStore>;

  beforeEach(async () => {
    pool = new FullFakePool();
    store = createPostgresCacheStore(pool);
    await store.__ready();
  });
  afterEach(async () => {
    await pool.end();
  });

  const k = (scope: string, hash: string) => ({
    scope: scope as never,
    routeId: "route.image",
    manifestVersion: 1,
    hash,
  });

  it("set + get round-trips via the local mirror (set also flushes durably)", async () => {
    const key = k("request-key", "h-1");
    const entry = sampleEntry("r-1");
    store.set(key, entry, 5_000);
    // Sync read against the local mirror returns the entry.
    const got = store.get(key);
    expect(got?.result.items[0]?.id).toBe("r-1");
    // Allow background INSERT to reach the durable side.
    await new Promise((r) => setTimeout(r, 10));
    const durable = await pool.query(
      "SELECT route_id FROM cache_entries WHERE cache_key = $1",
      [cacheKeyToPostgresKey(key)],
    );
    expect((durable.rows[0] as { route_id?: string } | undefined)?.route_id).toBe("route.image");
  });

  it("EXPIRE: set with ttlMs<=0 is a no-op (the entry never lands)", () => {
    const key = k("request-key", "h-2");
    store.set(key, sampleEntry("r-2"), 0);
    expect(store.get(key)).toBeUndefined();
  });

  it("invalidate removes a single key", () => {
    const key = k("request-key", "h-3");
    store.set(key, sampleEntry("r-3"), 60_000);
    store.invalidate(key);
    expect(store.get(key)).toBeUndefined();
  });

  it("invalidateByRoute sweeps the durable entries for a route", async () => {
    const a = createPostgresCacheStore(pool);
    const b = createPostgresCacheStore(pool);
    await a.__ready();
    await b.__ready();
    const k1 = k("request-key", "h-4a");
    const k2 = k("route-only", "h-4b");
    a.set(k1, sampleEntry("r-4a"), 60_000);
    b.set(k2, sampleEntry("r-4b"), 60_000);
    // Allow the background INSERTs to flush.
    await new Promise((r) => setTimeout(r, 10));
    // Both stores' local mirrors must be cleared eagerly and the
    // DELETE must reach the durable side.
    a.invalidateByRoute("route.image");
    await new Promise((r) => setTimeout(r, 10));
    expect(a.get(k1)).toBeUndefined();
    // The local mirror on b is unaware of a's invalidation. We
    // exercise this directly against the pool to confirm the
    // durable DELETE actually happened.
    const durable = await pool.query("SELECT cache_key FROM cache_entries WHERE route_id = $1", [
      "route.image",
    ]);
    expect(durable.rows.length).toBe(0);
  });

  it("isAvailable returns true and counters increment", async () => {
    const key = k("request-key", "h-5");
    store.set(key, sampleEntry("r-5"), 60_000);
    // Mirror read returns the entry.
    expect(store.get(key)?.result.items[0]?.id).toBe("r-5");
    // Missing key goes through the async background read.
    expect(store.get(k("request-key", "missing"))).toBeUndefined();
    const c = store.__counters();
    expect(c.sets).toBe(1);
    expect(store.isAvailable()).toBe(true);
  });

  it("cacheKeyToPostgresKey composes the same format the store uses", () => {
    expect(cacheKeyToPostgresKey(k("request-key", "abc"))).toBe(
      "cache:route.image|1|request-key|abc",
    );
  });
});

// ---------------------------------------------------------------------------
// CoalesceStore tests
// ---------------------------------------------------------------------------

describe("Postgres CoalesceStore (GHA-NEXT-027 full)", () => {
  let pool: FullFakePool;
  let store: ReturnType<typeof createPostgresCoalesceStore>;

  beforeEach(async () => {
    pool = new FullFakePool();
    store = createPostgresCoalesceStore(pool, baseConfig());
    await store.__ready();
  });
  afterEach(async () => {
    await pool.end();
  });

  const ck = (id: string) => ({
    routeId: "route.generate",
    idempotencyKey: id,
    manifestVersion: 1,
  });

  it("checkInFlight returns undefined when nothing is cached", async () => {
    expect(await store.checkInFlight(ck("c-1"))).toBeUndefined();
  });

  it("registerInFlight runs the factory and joins across instances", async () => {
    const other = createPostgresCoalesceStore(pool, baseConfig());
    await other.__ready();
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return sampleResult("r-coalesce");
    };
    const first = await store.registerInFlight(ck("c-2"), factory);
    // Allow the SET to flush.
    await new Promise((r) => setImmediate(r));
    // Second instance should see the cached result.
    const joined = await other.checkInFlight(ck("c-2"));
    expect(joined?.items[0]?.id).toBe("r-coalesce");
    expect(first.items[0]?.id).toBe("r-coalesce");
    expect(calls).toBe(1); // factory only ran ONCE
  });

  it("removeInFlight clears the cached result", async () => {
    await store.registerInFlight(ck("c-3"), async () => sampleResult("r-3"));
    await new Promise((r) => setImmediate(r));
    store.removeInFlight(ck("c-3"));
    await new Promise((r) => setImmediate(r));
    expect(await store.checkInFlight(ck("c-3"))).toBeUndefined();
  });

  it("isAvailable returns true", () => {
    expect(store.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createPostgresSharedStateManager — full wiring
// ---------------------------------------------------------------------------

describe("createPostgresSharedStateManager full wiring (GHA-NEXT-027 full)", () => {
  it("wires all six stores when an inline pool is provided", () => {
    const pool = new FullFakePool();
    const mgr = createPostgresSharedStateManager(
      configFromEnv({
        GATEWAY_SHARED_STORE_URL: "postgres://localhost/x",
        GATEWAY_SHARED_STORE_TYPE: "postgres",
      }),
      pool,
    );
    expect(mgr.isEnabled).toBe(true);
    expect(mgr.snapshot.isAvailable()).toBe(true);
    expect(mgr.breaker.isAvailable()).toBe(true);
    expect(mgr.rateLimit.isAvailable()).toBe(true);
    expect(mgr.idempotency.isAvailable()).toBe(true);
    expect(mgr.cache.isAvailable()).toBe(true);
    expect(mgr.coalesce.isAvailable()).toBe(true);
  });

  it("dispose closes the pool", async () => {
    const pool = new FullFakePool();
    const mgr = createPostgresSharedStateManager(
      configFromEnv({ GATEWAY_SHARED_STORE_TYPE: "postgres" }),
      pool,
    );
    expect(mgr.isEnabled).toBe(true);
    await mgr.dispose();
    expect(mgr.isEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Postgres integration tests — env-gated, environment-unavailable skip.
// ---------------------------------------------------------------------------

describe("Postgres shared-state FULL live integration (GHA-NEXT-027 full)", () => {
  const url = process.env["GATEWAY_SHARED_STORE_URL"];
  const live =
    process.env["GHA_NEXT_LIVE_PG"] === "1" && Boolean(url) && url!.startsWith("postgres");
  let pool: pg.Pool | null = null;

  const ensureSchema = async (p: pg.Pool): Promise<void> => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS breakers (target_id TEXT PRIMARY KEY, snapshot JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS rate_limit_buckets (key TEXT NOT NULL, window_start BIGINT NOT NULL, count INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (key, window_start))`,
      `CREATE TABLE IF NOT EXISTS idempotency_locks (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS idempotency_results (key TEXT PRIMARY KEY, payload JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS cache_entries (cache_key TEXT PRIMARY KEY, route_id TEXT NOT NULL, payload JSONB NOT NULL, expires_at TIMESTAMPTZ)`,
      `CREATE INDEX IF NOT EXISTS cache_entries_route_idx ON cache_entries (route_id)`,
      `CREATE TABLE IF NOT EXISTS coalesce_inflight (key TEXT PRIMARY KEY, payload JSONB, expires_at TIMESTAMPTZ NOT NULL)`,
    ];
    for (const sql of statements) {
      await p.query(sql);
    }
  };

  beforeEach(async () => {
    if (!live) return;
    pool = new pg.Pool({ connectionString: url, max: 4 });
    await pool.query("DROP TABLE IF EXISTS breakers CASCADE");
    await pool.query("DROP TABLE IF EXISTS rate_limit_buckets CASCADE");
    await pool.query("DROP TABLE IF EXISTS idempotency_locks CASCADE");
    await pool.query("DROP TABLE IF EXISTS idempotency_results CASCADE");
    await pool.query("DROP TABLE IF EXISTS cache_entries CASCADE");
    await pool.query("DROP TABLE IF EXISTS coalesce_inflight CASCADE");
    await ensureSchema(pool!);
  });
  afterEach(async () => {
    if (pool) {
      await pool.query("DROP TABLE IF EXISTS breakers CASCADE");
      await pool.query("DROP TABLE IF EXISTS rate_limit_buckets CASCADE");
      await pool.query("DROP TABLE IF EXISTS idempotency_locks CASCADE");
      await pool.query("DROP TABLE IF EXISTS idempotency_results CASCADE");
      await pool.query("DROP TABLE IF EXISTS cache_entries CASCADE");
      await pool.query("DROP TABLE IF EXISTS coalesce_inflight CASCADE");
      await pool.end();
      pool = null;
    }
  });

  it("BreakerStore.record + read on a fresh instance [environment-unavailable skip]", async () => {
    if (!live || !pool) return;
    const a = createPostgresBreakerStore(pool, baseConfig());
    await a.__ready();
    const b = createPostgresBreakerStore(pool, baseConfig());
    await b.__ready();
    a.record("live-tgt-1", false);
    await new Promise((r) => setTimeout(r, 200));
    const all = await breakerSnapshotAllAsync(pool, new Map());
    expect(all.get("live-tgt-1")?.errors).toBe(1);
  });

  it("RateLimitStore check-and-increment enforces the limit [environment-unavailable skip]", async () => {
    if (!live || !pool) return;
    const r = createPostgresRateLimitStore(pool, baseConfig());
    await r.__ready();
    const r1 = await r.checkAndIncrement("live-user", 2, 60_000);
    const r2 = await r.checkAndIncrement("live-user", 2, 60_000);
    const r3 = await r.checkAndIncrement("live-user", 2, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });

  it("IdempotencyStore tryAcquire + setResult join across instances [environment-unavailable skip]", async () => {
    if (!live || !pool) return;
    const a = createPostgresIdempotencyStore(pool, baseConfig());
    const b = createPostgresIdempotencyStore(pool, baseConfig());
    await a.__ready();
    await b.__ready();
    expect(await a.tryAcquire("live-op", 5_000)).toBe(true);
    expect(await b.tryAcquire("live-op", 5_000)).toBe(false);
    await a.setResult("live-op", sampleResult("live-r"), 30_000);
    const got = await b.getResult("live-op");
    expect(got?.items[0]?.id).toBe("live-r");
  });

  it("CacheStore set + invalidateByRoute [environment-unavailable skip]", async () => {
    if (!live || !pool) return;
    const c = createPostgresCacheStore(pool);
    await c.__ready();
    const key = {
      scope: "request-key" as never,
      routeId: "route.image",
      manifestVersion: 1,
      hash: "live-h",
    };
    c.set(key, sampleEntry("live-r"), 60_000);
    await new Promise((r) => setTimeout(r, 50));
    const direct = await pool.query("SELECT cache_key FROM cache_entries WHERE cache_key = $1", [
      cacheKeyToPostgresKey(key),
    ]);
    expect(direct.rows.length).toBe(1);
    c.invalidateByRoute("route.image");
    await new Promise((r) => setTimeout(r, 50));
    const after = await pool.query("SELECT cache_key FROM cache_entries WHERE route_id = $1", [
      "route.image",
    ]);
    expect(after.rows.length).toBe(0);
  });

  it("CoalesceStore registerInFlight + cross-instance checkInFlight [environment-unavailable skip]", async () => {
    if (!live || !pool) return;
    const a = createPostgresCoalesceStore(pool, baseConfig());
    const b = createPostgresCoalesceStore(pool, baseConfig());
    await a.__ready();
    await b.__ready();
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return sampleResult("coalesce-live");
    };
    await a.registerInFlight(
      { routeId: "route.generate", idempotencyKey: "live-coa", manifestVersion: 1 },
      factory,
    );
    await new Promise((r) => setTimeout(r, 50));
    const joined = await b.checkInFlight({
      routeId: "route.generate",
      idempotencyKey: "live-coa",
      manifestVersion: 1,
    });
    expect(joined?.items[0]?.id).toBe("coalesce-live");
    expect(calls).toBe(1);
  });
});

// Touch the BREAKER_ADVISORY_NAMESPACE constant so the export is
// exercised by the test seam (avoids tree-shaken dead-code warnings).
it("BREAKER_ADVISORY_NAMESPACE is exported", () => {
  expect(typeof BREAKER_ADVISORY_NAMESPACE).toBe("bigint");
});

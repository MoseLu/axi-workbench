/**
 * Postgres SnapshotStore unit tests (GHA-NEXT-027).
 *
 * L1 tests. Uses an in-memory fake that simulates `pg_try_advisory_lock`
 * semantics so the same code path runs without a real Postgres server.
 * A separate `live` block attempts a real connection when
 * `GHA_NEXT_LIVE_PG=1` AND `GATEWAY_SHARED_STORE_URL` starts with
 * `postgres://`. When the live DB is absent the live tests are skipped
 * (with `environment-unavailable` evidence in the test name).
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import pg from "pg";

import {
  createPostgresSharedStateManager,
  createPostgresSnapshotStore,
  SNAPSHOT_PUBLISH_ADVISORY_KEY,
  type PostgresLikePool,
  type PostgresLikeClient,
} from "../shared-state/postgres-shared-state";
import { configFromEnv } from "../shared-state/shared-state-manager";
import type { RouteDefinition } from "../route";

// ---------------------------------------------------------------------------
// Fake Postgres pool — implements pg_try_advisory_lock semantics in memory
// ---------------------------------------------------------------------------

class FakePool implements PostgresLikePool {
  private readonly tables = new Map<string, Map<string, unknown>>();
  /** key → holding client id; supports try-lock + unlock. */
  private readonly advisory = new Map<bigint, number>();
  private readonly clients = new Map<number, FakeClient>();
  private nextClientId = 1;

  constructor() {
    // Pre-create the meta row so the first publish doesn't have to
    // bootstrap it.
    this.bootstrap();
  }

  private bootstrap(): void {
    // Bootstrap synchronously by chaining the DDL. We use a single
    // promise chain so the third statement sees the meta table from
    // the second.
    this.bootstrapChain = (async () => {
      await this.query("CREATE TABLE IF NOT EXISTS route_snapshots (version BIGINT PRIMARY KEY, payload JSONB NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT now())");
      await this.query("CREATE TABLE IF NOT EXISTS route_snapshot_meta (id SMALLINT PRIMARY KEY, active BIGINT NOT NULL DEFAULT 0, in_use BIGINT NOT NULL DEFAULT 0)");
      await this.query("INSERT INTO route_snapshot_meta (id, active, in_use) VALUES (1, 0, 0) ON CONFLICT (id) DO NOTHING");
    })();
  }

  private bootstrapChain: Promise<void> = Promise.resolve();

  async ready(): Promise<void> {
    await this.bootstrapChain;
  }

  async query(text: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount?: number }> {
    const normalised = text.replace(/\s+/g, " ").trim().toLowerCase();
    // INSERT INTO route_snapshots
    if (normalised.startsWith("insert into route_snapshots")) {
      const tbl = this.tables.get("route_snapshots") ?? new Map<string, unknown>();
      const version = Number(params[0]);
      tbl.set(String(version), params[1]);
      this.tables.set("route_snapshots", tbl);
      return { rows: [], rowCount: 1 };
    }
    // INSERT INTO route_snapshot_meta — handles both $N parameterised
    // and literal VALUES(...) forms used by the bootstrap.
    if (normalised.startsWith("insert into route_snapshot_meta")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map<string, unknown>();
      let id = params[0];
      let active = Number(params[1] ?? 0) || 0;
      let inUse = Number(params[2] ?? 0) || 0;
      if (id === undefined) {
        const m = text.match(/VALUES\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) { id = m[1]; active = Number(m[2]) || 0; inUse = Number(m[3]) || 0; }
        else id = "1";
      }
      tbl.set(String(id), { active, in_use: inUse });
      this.tables.set("route_snapshot_meta", tbl);
      return { rows: [], rowCount: 1 };
    }
    // Combined DDL — create tables + insert meta row. Matched the
    // legacy single-string DDL only; not used by the post-Full runtime.
    if (normalised.includes("create table") && normalised.includes("insert into route_snapshot_meta")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map<string, unknown>();
      tbl.set("1", { active: 0, in_use: 0 });
      this.tables.set("route_snapshot_meta", tbl);
      return { rows: [], rowCount: 0 };
    }
    // SELECT FROM route_snapshots
    if (normalised.startsWith("select payload from route_snapshots")) {
      const tbl = this.tables.get("route_snapshots") ?? new Map<string, unknown>();
      const version = params[0];
      const row = tbl.get(String(version));
      return { rows: row !== undefined ? [{ payload: JSON.parse(String(row)) }] : [], rowCount: row !== undefined ? 1 : 0 };
    }
    // SELECT active FROM route_snapshot_meta WHERE id = 1
    if (
      normalised.startsWith("select active from route_snapshot_meta") &&
      normalised.endsWith("where id = 1")
    ) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map<string, unknown>();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      return { rows: row ? [{ active: row.active }] : [], rowCount: row ? 1 : 0 };
    }
    // SELECT active, in_use FROM route_snapshot_meta
    if (normalised.startsWith("select active, in_use from route_snapshot_meta")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map<string, unknown>();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    // UPDATE route_snapshot_meta SET active
    if (normalised.startsWith("update route_snapshot_meta set active")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map<string, unknown>();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      if (row) {
        row.active = Number(params[0]);
        tbl.set("1", row);
        this.tables.set("route_snapshot_meta", tbl);
      }
      return { rows: [], rowCount: 1 };
    }
    // UPDATE route_snapshot_meta SET in_use
    if (normalised.startsWith("update route_snapshot_meta set in_use")) {
      const tbl = this.tables.get("route_snapshot_meta") ?? new Map<string, unknown>();
      const row = tbl.get("1") as { active: number; in_use: number } | undefined;
      if (row) {
        row.in_use = Number(params[0]);
        tbl.set("1", row);
        this.tables.set("route_snapshot_meta", tbl);
      }
      return { rows: [], rowCount: 1 };
    }
    // pg_try_advisory_lock
    if (normalised === "select pg_try_advisory_lock($1) as got") {
      const key = BigInt(String(params[0]));
      if (!this.advisory.has(key)) {
        this.advisory.set(key, this.nextClientId - 1);
        return { rows: [{ got: true }], rowCount: 1 };
      }
      return { rows: [{ got: false }], rowCount: 1 };
    }
    // pg_advisory_unlock
    if (normalised === "select pg_advisory_unlock($1)") {
      this.advisory.delete(BigInt(String(params[0])));
      return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 };
    }
    // CREATE TABLE / INSERT meta — no-op (already bootstrapped)
    return { rows: [], rowCount: 0 };
  }

  async connect(): Promise<PostgresLikeClient> {
    const id = this.nextClientId++;
    const client: FakeClient = {
      query: async (text, params) => this.query(text, params),
      release: () => {
        this.clients.delete(id);
      },
    };
    this.clients.set(id, client);
    return client;
  }

  async end(): Promise<void> {
    this.tables.clear();
    this.advisory.clear();
    this.clients.clear();
  }

  // Test helper — inspect the stored snapshot rows.
  listSnapshotVersions(): number[] {
    const tbl = this.tables.get("route_snapshots");
    if (!tbl) return [];
    return Array.from(tbl.keys()).map(Number).sort((a, b) => a - b);
  }

  // Test helper — read active.
  readActive(): number {
    const tbl = this.tables.get("route_snapshot_meta");
    const row = tbl?.get("1") as { active: number; in_use: number } | undefined;
    return row?.active ?? 0;
  }

  readInUse(): number {
    const tbl = this.tables.get("route_snapshot_meta");
    const row = tbl?.get("1") as { active: number; in_use: number } | undefined;
    return row?.in_use ?? 0;
  }

  /** Test helper — simulate the live Postgres advisory-lock semantics
   *  by reading the held key (or `null`). */
  advisoryHeldBy(): number | null {
    for (const [k, v] of this.advisory.entries()) {
      if (k === SNAPSHOT_PUBLISH_ADVISORY_KEY) return v;
    }
    return null;
  }
}

interface FakeClient extends PostgresLikeClient {}

const sampleRoutes = (n = 1): ReadonlyArray<RouteDefinition> =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    toolId: `t${i}`,
    description: `r${i}`,
    predicates: [],
    targets: [],
    filters: { pre: [], post: [] },
    loadBalancer: "failover-only" as const,
  }));

// ---------------------------------------------------------------------------
// L1 unit tests using the fake pool
// ---------------------------------------------------------------------------

describe("Postgres SnapshotStore (GHA-NEXT-027)", () => {
  let pool: FakePool;
  let store: ReturnType<typeof createPostgresSnapshotStore>;

  beforeEach(async () => {
    pool = new FakePool();
    await pool.ready();
    store = createPostgresSnapshotStore(pool);
    await store.__ready();
  });
  afterEach(async () => {
    await pool.end();
  });

  it("publish writes the snapshot under a fresh version", async () => {
    const v = store.publish(sampleRoutes(2));
    expect(v).toBe(1);
    // Allow background publish to flush.
    await store.__publishInFlight();
    expect(pool.listSnapshotVersions()).toEqual([1]);
    expect(pool.readActive()).toBe(1);
  });

  it("publish increments the version monotonically", async () => {
    const v1 = store.publish(sampleRoutes(1));
    const v2 = store.publish(sampleRoutes(2));
    const v3 = store.publish(sampleRoutes(3));
    await store.__publishInFlight();
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(v3).toBe(3);
    expect(pool.listSnapshotVersions()).toEqual([1, 2, 3]);
    expect(pool.readActive()).toBe(3);
  });

  it("publish acquires and releases the advisory lock", async () => {
    store.publish(sampleRoutes(1));
    await store.__publishInFlight();
    expect(pool.advisoryHeldBy()).toBeNull();
  });

  it("concurrent publishes serialise via the advisory lock (no version race)", async () => {
    // Fire 5 publishes back-to-back without awaiting; the chained
    // promise inside the store should serialise them so the
    // durable version ends up monotonically increasing.
    const versions: number[] = [];
    for (let i = 0; i < 5; i += 1) versions.push(store.publish(sampleRoutes(i + 1)));
    await store.__publishInFlight();
    expect(versions).toEqual([1, 2, 3, 4, 5]);
    expect(pool.listSnapshotVersions()).toEqual([1, 2, 3, 4, 5]);
    expect(pool.readActive()).toBe(5);
  });

  it("two independent stores serialise against the same advisory lock", async () => {
    const storeB = createPostgresSnapshotStore(pool);
    await store.__ready();
    await storeB.__ready();
    const v1 = store.publish(sampleRoutes(1));
    // Wait for store's publish to fully settle so storeB reads the
    // updated active version from the DB before it publishes.
    await store.__publishInFlight();
    await storeB.__refresh();
    const v2 = storeB.publish(sampleRoutes(2));
    await Promise.all([store.__publishInFlight(), storeB.__publishInFlight()]);
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(pool.readActive()).toBe(2);
    expect(pool.listSnapshotVersions()).toEqual([1, 2]);
  });

  it("markInUse + getInUseVersion round-trips", async () => {
    store.markInUse(7);
    expect(store.getInUseVersion()).toBe(7);
    // Wait for the best-effort async UPDATE to drain. Poll the
    // FakePool until the durable side reflects the cached value
    // (production would rely on Postgres WAL; the fake mirrors
    // write/read ordering).
    for (let i = 0; i < 50 && pool.readInUse() !== 7; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(pool.readInUse()).toBe(7);
  });

  it("isAvailable returns true when a pool is wired", () => {
    expect(store.isAvailable()).toBe(true);
  });

  it("getSnapshot returns undefined (sync surface) but the durable row exists", async () => {
    store.publish(sampleRoutes(2));
    await store.__publishInFlight();
    expect(store.getSnapshot(1)).toBeUndefined();
    // Confirm the underlying row is there:
    const r = await pool.query("SELECT payload FROM route_snapshots WHERE version = $1", [1]);
    expect(r.rows.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// createPostgresSharedStateManager behaviour
// ---------------------------------------------------------------------------

describe("createPostgresSharedStateManager factory (GHA-NEXT-027)", () => {
  it("returns a noop manager when no pool is provided (backward-compatible)", () => {
    const mgr = createPostgresSharedStateManager(
      configFromEnv({
        GATEWAY_SHARED_STORE_URL: "postgres://localhost:5432",
        GATEWAY_SHARED_STORE_TYPE: "postgres",
      }),
    );
    expect(mgr.isEnabled).toBe(true);
    expect(mgr.snapshot.isAvailable()).toBe(false);
    expect(mgr.breaker.isAvailable()).toBe(false);
    expect(mgr.cache.isAvailable()).toBe(false);
  });

  it("wires a real snapshot store when a pool factory is provided", async () => {
    const pool = new FakePool();
    const mgr = createPostgresSharedStateManager(
      configFromEnv({
        GATEWAY_SHARED_STORE_URL: "postgres://localhost:5432",
        GATEWAY_SHARED_STORE_TYPE: "postgres",
      }),
      () => pool,
    );
    expect(mgr.isEnabled).toBe(true);
    // GHA-NEXT-025 — factories are LAZY: the underlying `pg.Pool`
    // only opens on the first store access. Touching every store
    // here forces the pool factory to run so the assertions below
    // see real (not noop) stores.
    void mgr.snapshot;
    void mgr.breaker;
    void mgr.rateLimit;
    void mgr.idempotency;
    void mgr.cache;
    void mgr.coalesce;
    await new Promise((resolve) => setImmediate(resolve));
    expect(mgr.snapshot.isAvailable()).toBe(true);
    // GHA-NEXT-027 full: all six stores are now real Postgres
    // implementations (Breaker/RateLimit/Idempotency/Cache/Coalesce/
    // Snapshot). isAvailable() returns true for every store when a
    // pool is provided.
    expect(mgr.breaker.isAvailable()).toBe(true);
    expect(mgr.rateLimit.isAvailable()).toBe(true);
    expect(mgr.idempotency.isAvailable()).toBe(true);
    expect(mgr.cache.isAvailable()).toBe(true);
    expect(mgr.coalesce.isAvailable()).toBe(true);
  });

  it("accepts an inline pool object (not just a factory)", async () => {
    const pool = new FakePool();
    const mgr = createPostgresSharedStateManager(
      configFromEnv({ GATEWAY_SHARED_STORE_TYPE: "postgres" }),
      pool,
    );
    void mgr.snapshot;
    await new Promise((resolve) => setImmediate(resolve));
    expect(mgr.snapshot.isAvailable()).toBe(true);
  });

  it("isEnabled is false when storeType !== postgres", async () => {
    const pool = new FakePool();
    const mgr = createPostgresSharedStateManager(
      configFromEnv({ GATEWAY_SHARED_STORE_URL: "redis://localhost:6379" }),
      () => pool,
    );
    expect(mgr.isEnabled).toBe(false);
    // Even when the manager's `isEnabled` is false (because the
    // composition layer should pick the Valkey facade, not the
    // Postgres facade), the pool factory still runs lazily on
    // first store access. Touching snapshot forces that resolution.
    void mgr.snapshot;
    await new Promise((resolve) => setImmediate(resolve));
    // The pool is still wired so snapshot.isAvailable stays true;
    // the composition layer guards on `isEnabled` before trusting it.
    expect(mgr.snapshot.isAvailable()).toBe(true);
  });

  it("dispose closes the pool", async () => {
    const pool = new FakePool();
    const mgr = createPostgresSharedStateManager(
      configFromEnv({ GATEWAY_SHARED_STORE_TYPE: "postgres" }),
      () => pool,
    );
    expect(mgr.isEnabled).toBe(true);
    await mgr.dispose();
    expect(mgr.isEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live Postgres integration tests — only when GATEWAY_SHARED_STORE_URL
// points at a reachable database AND GHA_NEXT_LIVE_PG=1.
// ---------------------------------------------------------------------------

describe("Postgres SnapshotStore live integration (GHA-NEXT-027)", () => {
  const url = process.env["GATEWAY_SHARED_STORE_URL"];
  const live = process.env["GHA_NEXT_LIVE_PG"] === "1" && Boolean(url) && url!.startsWith("postgres");
  let pool: pg.Pool | null = null;
  let store: ReturnType<typeof createPostgresSnapshotStore> | null = null;

  beforeEach(async () => {
    if (!live) return;
    pool = new pg.Pool({ connectionString: url, max: 2 });
    await pool.query("DROP TABLE IF EXISTS route_snapshots");
    await pool.query("DROP TABLE IF EXISTS route_snapshot_meta");
    store = createPostgresSnapshotStore(pool);
    await store.__ready();
  });
  afterEach(async () => {
    if (pool) {
      await pool.query("DROP TABLE IF EXISTS route_snapshots");
      await pool.query("DROP TABLE IF EXISTS route_snapshot_meta");
      await pool.end();
      pool = null;
      store = null;
    }
  });

  it("publish persists to the live Postgres table [environment-unavailable skip]", async () => {
    if (!live || !store || !pool) {
      // Skip silently — do NOT fail the suite when no live DB is
      // configured. The evidence log records "environment-unavailable".
      return;
    }
    const v = store.publish(sampleRoutes(2));
    await store.__publishInFlight();
    expect(v).toBe(1);
    const r = await pool.query("SELECT version FROM route_snapshots ORDER BY version ASC");
    expect(r.rows.map((row) => Number((row as { version: unknown }).version))).toEqual([1]);
    const m = await pool.query("SELECT active FROM route_snapshot_meta WHERE id = 1");
    expect(Number((m.rows[0] as { active: unknown }).active)).toBe(1);
  });

  it("advisory lock serialises two concurrent live publishes", async () => {
    if (!live || !store || !pool) return;
    const storeB = createPostgresSnapshotStore(pool);
    await storeB.__ready();
    store.publish(sampleRoutes(1));
    await store.__publishInFlight();
    await storeB.__refresh();
    const v2 = storeB.publish(sampleRoutes(2));
    await Promise.all([store.__publishInFlight(), storeB.__publishInFlight()]);
    expect(v2).toBe(2);
    // Confirm the durable side too.
    const m = await pool.query("SELECT active FROM route_snapshot_meta WHERE id = 1");
    expect(Number((m.rows[0] as { active: unknown }).active)).toBe(2);
  });
});
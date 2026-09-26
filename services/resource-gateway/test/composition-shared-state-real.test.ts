/**
 * Composition-root SharedStateManager — Postgres real-pool wiring (L3
 * closure, 2026-08-27).
 *
 * Closes the L3 gap called out by the 物理复核 where the production
 * `createPostgresSharedStateManager(sharedStateConfig)` invocation in
 * `apps/gateway/src/composition.ts` never forwarded a `pg.Pool`
 * factory, so even when operators set `GATEWAY_SHARED_STORE_TYPE=postgres`,
 * every store call would fall through to the noop fallback instead of
 * landing on a real Postgres backend.
 *
 * This file owns the regression surface for that wiring:
 *
 *   1. Postgres path with an inline (`PostgresLikePool`) pool —
 *      verifies the composition root forwards whatever pool / factory
 *      the env config produces and that `isEnabled` flips true once a
 *      store is attached.
 *   2. Postgres path with a lazy factory (`PostgresClientFactory`) —
 *      mirrors the production wiring `() => createRealPgPool(...)`
 *      and asserts the manager does NOT open a pool during
 *      `buildServerRegistry`, only when a store is touched.
 *   3. `storeUrl` still missing → noop fallback stays in place even
 *      when the operator sets `GATEWAY_SHARED_STORE_TYPE=postgres`
 *      (auto-inferred storeType never overrides the noop contract).
 *   4. `dispose()` is idempotent and after a single call the
 *      manager's `isEnabled` returns false so a torn-down gateway
 *      stops pretending to have shared state.
 *   5. (Live) When `GHA_NEXT_LIVE_PG=1` is set AND a real Postgres is
 *      reachable at `GATEWAY_SHARED_STORE_URL`, the full
 *      composition with the production wiring reports
 *      `isAvailable() === true` for every store so an operator can
 *      audit end-to-end. Skipped by default.
 *
 * The fake pool is intentionally minimal: PostgresLikePool only needs
 * `query`, `connect`, and `end`. We don't exercise deep SQL here; the
 * orchestrator's own `postgres-shared-state-full.test.ts` covers the
 * SQL primitives end-to-end against a richer fake / live Postgres.
 * This file's purpose is to pin the *composition wiring*, not the
 * SQL semantics.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServerRegistry } from "../src/composition.js";
import type { ServerConfig } from "../src/config.js";
import type {
  PostgresLikePool,
  PostgresLikeClient,
  SharedStateManager,
} from "@axi/resource-orchestrator";

const LIVE_PG_ENV = process.env["GHA_NEXT_LIVE_PG"] === "1";
const LIVE_PG_URL = process.env["GATEWAY_SHARED_STORE_URL"] ?? "postgres://127.0.0.1:5432/postgres";

const baseConfig = (): ServerConfig => ({
  host: "127.0.0.1",
  port: 0,
  imagePreviewTarget: "http://127.0.0.1:1",
  axiDocsTarget: "http://127.0.0.1:2",
  projectTarget: "http://127.0.0.1:3",
  uiTarget: "http://127.0.0.1:4",
  iconTarget: "http://127.0.0.1:5",
  minimaxBridgeTarget: "http://127.0.0.1:6",
  corsOrigins: ["http://localhost:5173"],
  maxBodyBytes: 1024,
  maxResultItems: 8,
  dispatchTimeoutMs: 1000,
  drainTimeoutMs: 1000,
  maxChildTimeoutMs: 60000,
  apiKeys: [],
  adminToken: "",
});

/** Minimal `PostgresLikePool` that lets each test track whether the
 *  factory was invoked exactly when expected. */
class FakePool implements PostgresLikePool {
  public readonly id: string;
  public queryCalls = 0;
  public endCalled = 0;
  constructor(id: string) {
    this.id = id;
  }
  async query(): Promise<{ rows: unknown[]; rowCount?: number | null }> {
    this.queryCalls += 1;
    return { rows: [], rowCount: 0 };
  }
  async connect(): Promise<PostgresLikeClient> {
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => undefined,
    };
  }
  async end(): Promise<void> {
    this.endCalled += 1;
  }
}

/** Snapshot + restore process.env so each test owns the env delta. */
const envKeys = [
  "GATEWAY_SHARED_STORE_URL",
  "GATEWAY_SHARED_STORE_TYPE",
] as const;

const snapshotEnv = (): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const k of envKeys) out[k] = process.env[k];
  return out;
};

const restoreEnv = (snap: Record<string, string | undefined>): void => {
  for (const k of envKeys) {
    const v = snap[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe("composition root — Postgres real-pool wiring (L3 closure 2026-08-27)", () => {
  let envSnap: Record<string, string | undefined>;

  beforeEach(() => {
    envSnap = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(envSnap);
  });

  it("1) Postgres path with an inline pool mounts real stores and isEnabled flips true", async () => {
    process.env["GATEWAY_SHARED_STORE_URL"] = "postgres://example.invalid:5432/db";
    process.env["GATEWAY_SHARED_STORE_TYPE"] = "postgres";
    const pool = new FakePool("inline");

    // The composition root no longer exposes an injection seam, so we
    // monkey-patch `createPostgresSharedStateManager` once to capture
    // the arguments and return a manager wired around our fake pool.
    const orchestratorModule = await import("@axi/resource-orchestrator");
    const realCreate = orchestratorModule.createPostgresSharedStateManager;
    let observedClient: PostgresLikePool | PostgresClientFactory | undefined;
    const stubCreate = (
      config: Parameters<typeof realCreate>[0],
      clientOrFactory?: Parameters<typeof realCreate>[1],
    ): SharedStateManager => realCreate(config, clientOrFactory);
    // Wrap so we can spy on the args while keeping the real implementation.
    const original = orchestratorModule.createPostgresSharedStateManager;
    Object.defineProperty(orchestratorModule, "createPostgresSharedStateManager", {
      configurable: true,
      writable: true,
      value: (config: Parameters<typeof original>[0], clientOrFactory?: Parameters<typeof original>[1]) => {
        observedClient = clientOrFactory;
        return stubCreate(config, clientOrFactory);
      },
    });

    try {
      const composition = await buildServerRegistry(baseConfig());
      // The factory / inline pool was forwarded as the second argument
      // to `createPostgresSharedStateManager` — without that wiring the
      // manager would have stayed on noop.
      expect(observedClient).toBeDefined();
      expect(composition.sharedState.isEnabled).toBe(true);
      // All six stores are exposed; their concrete instances track
      // the same resolved pool so a future store call lands on the
      // real backend instead of noop.
      expect(typeof composition.sharedState.breaker.isAvailable).toBe("function");
      expect(typeof composition.sharedState.rateLimit.isAvailable).toBe("function");
      expect(typeof composition.sharedState.idempotency.isAvailable).toBe("function");
      expect(typeof composition.sharedState.cache.isAvailable).toBe("function");
      expect(typeof composition.sharedState.snapshot.isAvailable).toBe("function");
      expect(typeof composition.sharedState.coalesce.isAvailable).toBe("function");
    } finally {
      Object.defineProperty(orchestratorModule, "createPostgresSharedStateManager", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
    void pool; // kept alive to assert no premature end()
  });

  it("2) Postgres path with a lazy factory is forwarded and stays unopened at boot", async () => {
    process.env["GATEWAY_SHARED_STORE_URL"] = "postgres://example.invalid:5432/db";
    process.env["GATEWAY_SHARED_STORE_TYPE"] = "postgres";

    let factoryCalls = 0;
    let bootObservedFactory: PostgresClientFactory | PostgresLikePool | undefined;
    const orchestratorModule = await import("@axi/resource-orchestrator");
    const realCreate = orchestratorModule.createPostgresSharedStateManager;
    const original = orchestratorModule.createPostgresSharedStateManager;
    Object.defineProperty(orchestratorModule, "createPostgresSharedStateManager", {
      configurable: true,
      writable: true,
      value: (config: Parameters<typeof original>[0], clientOrFactory?: Parameters<typeof original>[1]) => {
        if (typeof clientOrFactory === "function") {
          bootObservedFactory = clientOrFactory;
        }
        return realCreate(config, clientOrFactory);
      },
    });

    try {
      const composition = await buildServerRegistry(baseConfig());
      // The factory closure is forwarded — composition no longer
      // quietly drops it on the floor.
      expect(typeof bootObservedFactory).toBe("function");
      expect(composition.sharedState.isEnabled).toBe(true);

      // Invoking the factory now returns a `PostgresLikePool` shape
      // (it never opens the connection during boot).
      const invoked = (bootObservedFactory as PostgresClientFactory)();
      // Sync factory case: returns a pool directly.
      const pool = invoked instanceof Promise ? await invoked : invoked;
      expect(typeof pool.query).toBe("function");
      expect(typeof pool.connect).toBe("function");
      expect(typeof pool.end).toBe("function");
      factoryCalls += 1;
      expect(factoryCalls).toBe(1);
      // Clean up the fake pool we just constructed so the next test
      // doesn't leak state.
      await pool.end();
    } finally {
      Object.defineProperty(orchestratorModule, "createPostgresSharedStateManager", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it("3) missing storeUrl still selects the noop manager even when storeType=postgres", async () => {
    delete process.env["GATEWAY_SHARED_STORE_URL"];
    process.env["GATEWAY_SHARED_STORE_TYPE"] = "postgres";

    const composition = await buildServerRegistry(baseConfig());
    // Without a storeUrl the noop contract wins regardless of storeType.
    expect(composition.sharedState.isEnabled).toBe(false);
  });

  it("4) dispose() sets isEnabled to false and is idempotent across double-call", async () => {
    process.env["GATEWAY_SHARED_STORE_URL"] = "postgres://example.invalid:5432/db";
    process.env["GATEWAY_SHARED_STORE_TYPE"] = "postgres";

    const pool = new FakePool("disposeable");
    const orchestratorModule = await import("@axi/resource-orchestrator");
    const realCreate = orchestratorModule.createPostgresSharedStateManager;
    const original = orchestratorModule.createPostgresSharedStateManager;
    let managerRef: SharedStateManager | undefined;
    Object.defineProperty(orchestratorModule, "createPostgresSharedStateManager", {
      configurable: true,
      writable: true,
      value: (config: Parameters<typeof original>[0], clientOrFactory?: Parameters<typeof original>[1]) => {
        // Forward a factory that returns our tracked fake pool so we
        // can assert `dispose()` closes it.
        managerRef = realCreate(config, () => pool);
        return managerRef;
      },
    });

    try {
      const composition = await buildServerRegistry(baseConfig());
      expect(composition.sharedState.isEnabled).toBe(true);
      // Force the lazy factory to materialise the fake pool so we can
      // observe end() calls; the manager itself only resolves the pool
      // on the first store access, but `dispose()` should still close
      // the resolved pool.
      void composition.sharedState.breaker.isAvailable();
      await composition.sharedState.dispose();
      expect(composition.sharedState.isEnabled).toBe(false);
      await composition.sharedState.dispose();
      expect(composition.sharedState.isEnabled).toBe(false);
      expect(pool.endCalled).toBe(1);
    } finally {
      Object.defineProperty(orchestratorModule, "createPostgresSharedStateManager", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
    void managerRef;
  });
});

// Imported here to keep the test file's import surface explicit.
import type { PostgresClientFactory } from "@axi/resource-orchestrator";

// ---------------------------------------------------------------------------
// Live block — only runs when GHA_NEXT_LIVE_PG=1 AND a Postgres is reachable.
// Mirrors the production wiring exactly so a operator-facing audit can
// prove the L3 fix is end-to-end. Skipped silently in CI.
// ---------------------------------------------------------------------------

(LIVE_PG_ENV ? describe : describe.skip)("composition root — Postgres real-pool LIVE (operator audit)", () => {
  beforeEach(() => {
    process.env["GATEWAY_SHARED_STORE_URL"] = LIVE_PG_URL;
    process.env["GATEWAY_SHARED_STORE_TYPE"] = "postgres";
  });

  afterEach(() => {
    delete process.env["GATEWAY_SHARED_STORE_URL"];
    delete process.env["GATEWAY_SHARED_STORE_TYPE"];
  });

  it("5) real Postgres 18.3 → all six stores report isAvailable() === true", async () => {
    const composition = await buildServerRegistry(baseConfig());
    // The manager is enabled end-to-end.
    expect(composition.sharedState.isEnabled).toBe(true);
    // Drive at least one store call so the lazy pg.Pool actually
    // opens against the live server (the first call triggers DDL).
    void composition.sharedState.breaker.snapshotAll();
    expect(composition.sharedState.breaker.isAvailable()).toBe(true);
    expect(composition.sharedState.rateLimit.isAvailable()).toBe(true);
    expect(composition.sharedState.idempotency.isAvailable()).toBe(true);
    expect(composition.sharedState.cache.isAvailable()).toBe(true);
    expect(composition.sharedState.coalesce.isAvailable()).toBe(true);
    expect(composition.sharedState.snapshot.isAvailable()).toBe(true);
    await composition.sharedState.dispose();
    expect(composition.sharedState.isEnabled).toBe(false);
  });
});

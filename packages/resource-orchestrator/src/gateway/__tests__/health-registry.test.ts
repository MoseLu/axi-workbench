import { afterEach, describe, it, expect, vi } from "vitest";
import {
  ActiveHealthRegistry,
  NoopHealthRegistry,
  deriveOverall,
  HEALTH_STATUS_TO_COMPONENT,
  type HealthEndpoint,
  type HealthStatus,
} from "../registries";

/* -------------------------------------------------------------------------- */
/*  Test helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build a fake `fetch` whose response is decided per call.
 * Each entry maps a URL substring to a status (or thrown error).
 * Unmatched URLs throw a network error.
 */
const makeFetchStub = (behaviors: Array<{
  match: (url: string) => boolean;
  status?: number;
  throwWith?: Error;
}>) => {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    for (const b of behaviors) {
      if (b.match(url)) {
        if (b.throwWith) throw b.throwWith;
        const status = b.status ?? 200;
        return new Response(null, { status });
      }
    }
    throw new Error("ECONNREFUSED");
  });
};

const makeAllowlist = (allowedHosts: ReadonlyArray<string>) => {
  const set = new Set(allowedHosts.map((host) => host.toLowerCase()));
  return (raw: string): boolean => {
    let parsed: URL;
    try { parsed = new URL(raw); } catch { return false; }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return set.has(parsed.hostname.toLowerCase());
  };
};

/* -------------------------------------------------------------------------- */
/*  deriveOverall                                                              */
/* -------------------------------------------------------------------------- */

describe("deriveOverall", () => {
  it("returns unknown for an empty list", () => {
    expect(deriveOverall([])).toBe("unknown");
  });

  it("returns ejected if any factory is ejected", () => {
    expect(deriveOverall(["healthy", "ejected", "healthy"])).toBe("ejected");
  });

  it("returns unhealthy if any factory is unhealthy (no ejected)", () => {
    expect(deriveOverall(["healthy", "unhealthy", "degraded"])).toBe("unhealthy");
  });

  it("returns recovering when only recovering entries remain", () => {
    expect(deriveOverall(["healthy", "recovering"])).toBe("recovering");
  });

  it("returns healthy when every entry is healthy", () => {
    expect(deriveOverall(["healthy", "healthy", "healthy"])).toBe("healthy");
  });

  it("returns degraded when no entry is unhealthy but at least one is degraded", () => {
    expect(deriveOverall(["healthy", "degraded"])).toBe("degraded");
  });

  it("returns unknown when all entries are unknown", () => {
    expect(deriveOverall(["unknown", "unknown"])).toBe("unknown");
  });
});

/* -------------------------------------------------------------------------- */
/*  HEALTH_STATUS_TO_COMPONENT mapping                                          */
/* -------------------------------------------------------------------------- */

describe("HEALTH_STATUS_TO_COMPONENT", () => {
  it("maps healthy -> up, ejected/unhealthy -> down, recovering/degraded -> degraded, unknown -> starting", () => {
    expect(HEALTH_STATUS_TO_COMPONENT.healthy).toBe("up");
    expect(HEALTH_STATUS_TO_COMPONENT.ejected).toBe("down");
    expect(HEALTH_STATUS_TO_COMPONENT.unhealthy).toBe("down");
    expect(HEALTH_STATUS_TO_COMPONENT.recovering).toBe("degraded");
    expect(HEALTH_STATUS_TO_COMPONENT.degraded).toBe("degraded");
    expect(HEALTH_STATUS_TO_COMPONENT.unknown).toBe("starting");
  });
});

/* -------------------------------------------------------------------------- */
/*  NoopHealthRegistry stop()                                                   */
/* -------------------------------------------------------------------------- */

describe("NoopHealthRegistry stop()", () => {
  it("is a no-op and does not throw", () => {
    const registry = new NoopHealthRegistry();
    expect(() => registry.stop()).not.toThrow();
    expect(registry.forFactory("axi-docs")).toBe("unknown");
  });
});

/* -------------------------------------------------------------------------- */
/*  ActiveHealthRegistry — passive failure accumulation + ejection              */
/* -------------------------------------------------------------------------- */

describe("ActiveHealthRegistry passive failure accumulation", () => {
  it("starts in unknown state until a probe or passive signal lands", () => {
    const registry = new ActiveHealthRegistry({ noAutoStart: true, allowlisted: makeAllowlist([]) });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    expect(registry.forFactory("axi-docs")).toBe("unknown");
  });

  it("transitions healthy -> unhealthy -> ejected once the failure threshold is reached", () => {
    const registry = new ActiveHealthRegistry({ noAutoStart: true, allowlisted: makeAllowlist([]), failureThreshold: 3 });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    // 1st failure (threshold=3): drops to unhealthy
    registry.recordFailure("axi-docs", "boom");
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    // 2nd failure: stays unhealthy
    registry.recordFailure("axi-docs", "boom");
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    // 3rd failure: ejected
    registry.recordFailure("axi-docs", "boom");
    expect(registry.forFactory("axi-docs")).toBe("ejected");
    registry.stop();
  });

  it("decrements failure counter on a passive success before ejection", () => {
    const registry = new ActiveHealthRegistry({ noAutoStart: true, allowlisted: makeAllowlist([]), failureThreshold: 3 });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    registry.recordFailure("axi-docs");
    registry.recordFailure("axi-docs");
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    registry.recordSuccess("axi-docs");
    // counter went 2 -> 1, status remains unhealthy because we never dropped below the threshold
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    registry.stop();
  });

  it("ejected factory stays ejected until consecutive successes clear the recovery threshold", () => {
    const registry = new ActiveHealthRegistry({ noAutoStart: true, allowlisted: makeAllowlist([]), failureThreshold: 2, recoveryThreshold: 2 });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    registry.recordFailure("axi-docs");
    registry.recordFailure("axi-docs");
    expect(registry.forFactory("axi-docs")).toBe("ejected");
    // single success: transitions to recovering
    registry.recordSuccess("axi-docs");
    expect(registry.forFactory("axi-docs")).toBe("recovering");
    // second consecutive success: back to healthy
    registry.recordSuccess("axi-docs");
    expect(registry.forFactory("axi-docs")).toBe("healthy");
    registry.stop();
  });
});

/* -------------------------------------------------------------------------- */
/*  ActiveHealthRegistry — active probe via fake fetch                          */
/* -------------------------------------------------------------------------- */

describe("ActiveHealthRegistry active probe", () => {
  it("probes the registered endpoint and marks healthy on a 2xx response", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz", method: "HEAD" }],
    ]);
    const fetchStub = makeFetchStub([{ match: (u) => u.includes("/healthz"), status: 200 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("healthy");
    expect(fetchStub).toHaveBeenCalledTimes(1);
    registry.stop();
  });

  it("marks unhealthy on a 5xx probe response and records the error", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz", method: "HEAD" }],
    ]);
    const fetchStub = makeFetchStub([{ match: (u) => u.includes("/healthz"), status: 503 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    const snap = registry.snapshot();
    expect(snap.factories[0].error).toMatch(/503/u);
    registry.stop();
  });

  it("marks unhealthy when the probe fetch throws (network error)", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz" }],
    ]);
    const fetchStub = makeFetchStub([{ match: () => true, throwWith: new Error("ECONNREFUSED") }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    const snap = registry.snapshot();
    expect(snap.factories[0].error).toMatch(/ECONNREFUSED/u);
    registry.stop();
  });

  it("ejects a factory after failureThreshold consecutive 5xx probes", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz" }],
    ]);
    const fetchStub = makeFetchStub([{ match: () => true, status: 500 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
      failureThreshold: 2,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("unhealthy");
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("ejected");
    registry.stop();
  });

  it("recovers an ejected factory after consecutive 2xx probes (recoveryThreshold)", async () => {
    let behaviour = 500;
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz" }],
    ]);
    const fetchStub = vi.fn(async (_input: RequestInfo | URL): Promise<Response> => {
      return new Response(null, { status: behaviour });
    });
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
      failureThreshold: 1,
      recoveryThreshold: 2,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    // Probe once with 5xx → ejected
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("ejected");
    // Switch upstream to healthy, probe once → recovering (1 of 2)
    behaviour = 200;
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("recovering");
    // Probe again → healthy (2 of 2)
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("healthy");
    registry.stop();
  });

  it("uses AbortSignal.timeout so a slow upstream triggers an unhealthy state", async () => {
    // fetch that ignores AbortSignal but takes "forever" — we simulate the
    // call returning a successful Response but with the timeout already fired
    // (the registry's race against AbortSignal.timeout gives the failure).
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz" }],
    ]);
    const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Honour the abort: if the signal aborts, throw AbortError.
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }
        // never resolve normally — the test framework will reject via the
        // AbortSignal.timeout() that ActiveHealthRegistry wires.
        // Safety net so the promise does not hang forever if abort never
        // fires (e.g. older Node runtimes).
        setTimeout(() => reject(new Error("timeout")), 50).unref?.();
      });
    });
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
      probeTimeoutMs: 10,
      failureThreshold: 1,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("ejected");
    registry.stop();
  });
});

/* -------------------------------------------------------------------------- */
/*  SSRF allowlist enforcement                                                  */
/* -------------------------------------------------------------------------- */

describe("ActiveHealthRegistry SSRF allowlist enforcement", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips the probe (no status flip) when the host is not in the allowlist", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://example.com/healthz" }], // not allowlisted
    ]);
    const fetchStub = makeFetchStub([{ match: () => true, status: 200 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1", "localhost"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    // Status remains at the initial "unknown" because the probe never
    // reached the upstream (allowlist refused to dial).
    expect(registry.forFactory("axi-docs")).toBe("unknown");
    // Fetch must not have been called.
    expect(fetchStub).not.toHaveBeenCalled();
    // lastError surfaces the diagnostic but does NOT flip the status.
    const snap = registry.snapshot();
    const entry = snap.factories[0];
    expect(entry.status).toBe<HealthStatus>("unknown");
    expect(entry.error).toMatch(/allowlist|not_allowlisted/u);
    registry.stop();
  });

  it("dials loopback when the allowlist contains it", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz" }],
    ]);
    const fetchStub = makeFetchStub([{ match: () => true, status: 200 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("healthy");
    expect(fetchStub).toHaveBeenCalledTimes(1);
    registry.stop();
  });

  it("treats a throwing allowlist predicate as blocked (no fetch, no status flip)", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["axi-docs", { url: "http://127.0.0.1:3010/healthz" }],
    ]);
    const fetchStub = makeFetchStub([{ match: () => true, status: 200 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: () => { throw new Error("boom"); },
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.registerCheck("axi-docs", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    expect(registry.forFactory("axi-docs")).toBe("unknown");
    expect(fetchStub).not.toHaveBeenCalled();
    registry.stop();
  });
});

/* -------------------------------------------------------------------------- */
/*  Probe loop scheduling                                                       */
/* -------------------------------------------------------------------------- */

describe("ActiveHealthRegistry probe loop scheduling", () => {
  it("start() schedules a setInterval; stop() clears it", () => {
    let scheduled: { cb: () => void; ms: number } | null = null;
    let cleared = 0;
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist([]),
      setIntervalImpl: ((cb: () => void, ms: number) => {
        scheduled = { cb, ms };
        return { handle: 1 };
      }) as unknown as (cb: () => void, ms: number) => unknown,
      clearIntervalImpl: ((_handle: unknown) => { cleared += 1; }) as unknown as (handle: unknown) => void,
    });
    registry.start();
    expect(scheduled).not.toBeNull();
    expect((scheduled as { cb: () => void; ms: number } | null)?.ms).toBe(5000);
    registry.stop();
    expect(cleared).toBe(1);
    // Idempotent: stop again does not double-clear.
    registry.stop();
    expect(cleared).toBe(1);
  });

  it("start() is idempotent — calling it twice does not double-schedule", () => {
    let count = 0;
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist([]),
      setIntervalImpl: ((_cb: () => void, _ms: number) => { count += 1; return { handle: count }; }) as unknown as (cb: () => void, ms: number) => unknown,
      clearIntervalImpl: (() => undefined) as unknown as (handle: unknown) => void,
    });
    registry.start();
    registry.start();
    registry.start();
    expect(count).toBe(1);
    registry.stop();
  });
});

/* -------------------------------------------------------------------------- */
/*  Snapshot shape                                                              */
/* -------------------------------------------------------------------------- */

describe("ActiveHealthRegistry snapshot", () => {
  it("emits per-factory entries with status, lastCheck, error, and an overall rollup", async () => {
    const endpoints = new Map<string, HealthEndpoint>([
      ["alpha", { url: "http://127.0.0.1:3010/a" }],
      ["beta", { url: "http://127.0.0.1:3010/b" }],
    ]);
    const fetchStub = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/a")) return new Response(null, { status: 200 });
      return new Response(null, { status: 500 });
    });
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints,
      fetchImpl: fetchStub as unknown as typeof fetch,
      failureThreshold: 1,
    });
    registry.registerCheck("alpha", { id: "alpha-check", run: async () => "healthy" });
    registry.registerCheck("beta", { id: "beta-check", run: async () => "healthy" });
    await registry.probeAll();
    const snap = registry.snapshot();
    expect(snap.factories).toHaveLength(2);
    const alpha = snap.factories.find((f) => f.factoryId === "alpha");
    const beta = snap.factories.find((f) => f.factoryId === "beta");
    expect(alpha?.status).toBe("healthy");
    expect(beta?.status).toBe("ejected");
    expect(snap.overall).toBe("ejected");
    expect(typeof alpha?.lastCheck).toBe("number");
    registry.stop();
  });

  it("includes factories with status=unknown when only registered, never probed", () => {
    const registry = new ActiveHealthRegistry({ noAutoStart: true, allowlisted: makeAllowlist([]) });
    registry.registerCheck("never-probed", { id: "x", run: async () => "healthy" });
    const snap = registry.snapshot();
    expect(snap.factories).toHaveLength(1);
    expect(snap.factories[0]).toMatchObject({ factoryId: "never-probed", status: "unknown" });
    expect(snap.overall).toBe("unknown");
    registry.stop();
  });
});

/* -------------------------------------------------------------------------- */
/*  setEndpoint override                                                        */
/* -------------------------------------------------------------------------- */

describe("ActiveHealthRegistry setEndpoint override", () => {
  it("overrides the constructor endpoint map at runtime", async () => {
    const initial = new Map<string, HealthEndpoint>([
      ["primary", { url: "http://127.0.0.1:3010/a" }],
    ]);
    const fetchStub = makeFetchStub([{ match: () => true, status: 200 }]);
    const registry = new ActiveHealthRegistry({
      noAutoStart: true,
      allowlisted: makeAllowlist(["127.0.0.1"]),
      endpoints: initial,
      fetchImpl: fetchStub as unknown as typeof fetch,
    });
    registry.setEndpoint("primary", { url: "http://127.0.0.1:3010/overridden" });
    registry.registerCheck("primary", { id: "x", run: async () => "healthy" });
    await registry.probeAll();
    const calledUrl = String((fetchStub.mock.calls[0]?.[0] as URL | string | undefined) ?? "");
    expect(calledUrl).toContain("/overridden");
    registry.stop();
  });
});
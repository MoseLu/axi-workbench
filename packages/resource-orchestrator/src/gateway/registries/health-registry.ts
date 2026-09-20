import type { ResourceAdapter } from "@axi/gateway-contracts";

/**
 * GHA-NEXT-005 / GHA-NEXT-016 — HealthRegistry interface + active/passive
 * implementation.
 *
 * Provides:
 *   - Passive failure accumulation via `recordSuccess` / `recordFailure`
 *     (called by dispatch when a provider call succeeds or fails),
 *   - Active probe loop (`start()`) that periodically sends an HTTP
 *     HEAD/GET to `factory.healthEndpoint`,
 *   - Ejection when passive failures or active probe failures exceed
 *     `failureThreshold`,
 *   - Recovery when consecutive successful probes (after ejection) clear
 *     the ejection and re-enroll the factory in the LB pool.
 *
 * The active probe is gated by an SSRF allowlist: the registry only
 * issues an HTTP request when the resolved health-endpoint URL has
 * already been confirmed as allowlisted. The orchestrator package does
 * not import `apps/gateway/src/allowlist.ts` directly; the gateway
 * composition root wires its own `assertAllowlistedTarget` (or any
 * compatible predicate) into the registry at construction time.
 *
 * The NoopHealthRegistry still exists for backward compatibility — when
 * no registry is injected the orchestrator reports `"unknown"` for
 * every factory and `/health/ready` falls back to the legacy
 * `manifest / registry / bridge` triple.
 */

export type HealthStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "unknown"
  | "ejected"
  | "recovering";

/** Mapping from internal HealthStatus to the readiness contract's
 *  ComponentStatus enum. Surfaced by `/health/ready`. */
export const HEALTH_STATUS_TO_COMPONENT: Readonly<Record<HealthStatus, "up" | "down" | "degraded" | "starting">> = {
  healthy: "up",
  degraded: "degraded",
  unhealthy: "down",
  ejected: "down",
  recovering: "degraded",
  unknown: "starting",
};

export interface FactoryHealth {
  readonly factoryId: string;
  readonly status: HealthStatus;
  readonly lastCheck?: number;
  readonly error?: string;
}

export interface HealthRegistrySnapshot {
  readonly factories: ReadonlyArray<FactoryHealth>;
  readonly overall: HealthStatus;
}

export interface HealthCheck {
  readonly id: string;
  /** Run the check and return the resulting status. */
  run(): Promise<HealthStatus>;
  /** Optional human-readable label for observability. */
  label?: string;
}

/**
 * Factory registry accessor so the health loop can enumerate registered
 * factories. The noop implementation returns an empty map.
 */
export interface FactorySource {
  listFactories(): ReadonlyMap<string, ResourceAdapter>;
}

export interface HealthRegistry {
  /**
   * Register a health check for a factory. The check is stored and
   * included in the snapshot. Duplicate registrations for the same
   * factoryId replace the previous check.
   */
  registerCheck(factoryId: string, check: HealthCheck): void;

  /**
   * Return the health status for a specific factory id, or `"unknown"`
   * when no check has been registered.
   */
  forFactory(factoryId: string): HealthStatus;

  /**
   * GHA-NEXT-016 — passive failure accumulation. Called by the
   * dispatch path after every target invocation so the registry
   * reflects real dispatch outcomes, not just the active probe
   * loop. `reason` is an opaque string the implementation may
   * surface via `forFactory` diagnostics (e.g.
   * `dispatch_timeout`, `dispatch_5xx`).
   *
   * The `NoopHealthRegistry` accepts these calls as no-ops so
   * legacy callers stay unchanged; the `ActiveHealthRegistry`
   * increments its internal counters and may flip the factory to
   * `"ejected"` when the failure threshold is crossed.
   */
  recordOutcome?(factoryId: string, ok: boolean, reason?: string): void;

  /**
   * Build a serialisable snapshot for `/health/ready` and `/metrics`.
   * Includes every registered factory and an overall status derived
   * from the individual states.
   */
  snapshot(): HealthRegistrySnapshot;

  /**
   * GHA-NEXT-016 — stop the periodic probe loop. The NoopHealthRegistry
   * treats this as a no-op; the ActiveHealthRegistry clears the
   * timer so the process can exit cleanly on shutdown.
   */
  stop?(): void;
}

/* -------------------------------------------------------------------------- */
/*  Noop implementation                                                        */
/* -------------------------------------------------------------------------- */

/** Noop implementation: all factories report "unknown" status. */
export class NoopHealthRegistry implements HealthRegistry {
  private readonly checks = new Map<string, HealthCheck>();

  registerCheck(_factoryId: string, _check: HealthCheck): void {
    this.checks.set(_factoryId, _check);
  }

  forFactory(_factoryId: string): HealthStatus {
    return "unknown";
  }

  snapshot(): HealthRegistrySnapshot {
    const factories: FactoryHealth[] = [];
    for (const [factoryId] of this.checks) {
      factories.push({ factoryId, status: "unknown" });
    }
    return {
      factories,
      overall: factories.length === 0 ? "unknown" : factories.some((f) => f.status === "healthy") ? "healthy" : "unknown",
    };
  }

  /**
   * GHA-NEXT-016 — passive outcome adapter. The dispatch path
   * calls `recordOutcome` regardless of which registry backs the
   * gateway; the noop registry accepts the call as a no-op.
   */
  recordOutcome(_factoryId: string, _ok: boolean, _reason?: string): void {
    // intentional no-op
  }

  /** GHA-NEXT-016 — no probe loop in the noop path. */
  stop(): void {
    // intentional no-op
  }
}

/* -------------------------------------------------------------------------- */
/*  Active implementation — GHA-NEXT-016                                       */
/* -------------------------------------------------------------------------- */

/**
 * Per-factory health endpoint descriptor. The orchestrator package
 * only consumes the URL — the gateway composition root is responsible
 * for filling these in from the allowlisted targets + manifest
 * `target.healthEndpoint`. We keep this as a plain interface so the
 * orchestrator package does not have to import gateway-side types.
 */
export interface HealthEndpoint {
  /** Absolute URL the registry should probe (HEAD by default). */
  readonly url: string;
  /** Optional override for the HTTP method; defaults to "HEAD". */
  readonly method?: "HEAD" | "GET";
  /** When false the probe is skipped (e.g. fixture-factory). */
  readonly probe?: boolean;
}

export interface ActiveHealthRegistryOptions {
  /** Interval between probes per factory (default 5000 ms). */
  probeIntervalMs?: number;
  /** Per-probe HTTP timeout in ms (default 2000). */
  probeTimeoutMs?: number;
  /** Passive failure threshold to eject a factory (default 3). */
  failureThreshold?: number;
  /** Consecutive successful probes required to recover (default 2). */
  recoveryThreshold?: number;
  /**
   * SSRF allowlist predicate. Receives the resolved probe URL and
   * must return `true` only when the URL is safe to dial. The gateway
   * composition root wires `assertAllowlistedTarget` from
   * `apps/gateway/src/allowlist.ts` here so the orchestrator never
   * imports gateway-side code.
   */
  allowlisted?: (url: string) => boolean;
  /** Allowlist-derived per-factory endpoint map. */
  endpoints?: ReadonlyMap<string, HealthEndpoint>;
  /** Fetch implementation override (tests inject a mock). */
  fetchImpl?: typeof fetch;
  /** Schedule a periodic callback (tests inject a fake). */
  setIntervalImpl?: (cb: () => void, ms: number) => unknown;
  /** Clear a periodic callback (tests inject a fake). */
  clearIntervalImpl?: (handle: unknown) => void;
  /** Clock for `lastCheck` timestamps. */
  now?: () => number;
  /**
   * When true, `start()` returns immediately and the registry never
   * issues HTTP probes. Tests opt into this to assert pure unit
   * behaviour without a running clock.
   */
  noAutoStart?: boolean;
}

/**
 * Internal per-factory state. Kept private so callers cannot reach
 * into it from the outside; `forFactory()` and `snapshot()` project
 * the public view.
 */
interface FactoryState {
  status: HealthStatus;
  failures: number;
  successes: number;
  /** Consecutive successful probes since the last failure (drives recovery). */
  consecutiveProbeSuccesses: number;
  /** Last probe result error, surfaced on the snapshot. */
  lastError?: string;
  lastCheck?: number;
  /** True when the most recent probe attempt was blocked by the SSRF allowlist. */
  blockedByAllowlist: boolean;
}

/**
 * Default dependency injection seam. Production callers wire real
 * `setInterval` / `fetch` via the option bag; tests inject fakes.
 */
const defaultSetInterval: (cb: () => void, ms: number) => unknown =
  (cb, ms) => setInterval(cb, ms) as unknown;
const defaultClearInterval = (handle: unknown): void => {
  if (handle && typeof (handle as { unref?: () => void }).unref === "function") {
    (handle as { unref: () => void }).unref();
  }
  clearInterval(handle as ReturnType<typeof setInterval>);
};
const defaultNow = (): number => Date.now();

/**
 * Real `HealthRegistry` that combines passive failure accumulation
 * (driven by `recordSuccess` / `recordFailure`) with active probe
 * state (driven by the loop started in `start()`).
 *
 * Lifecycle:
 *   1. Construct with allowlist predicate + endpoint map.
 *   2. `start()` — schedules the periodic probe. Idempotent.
 *   3. `recordSuccess(factoryId)` / `recordFailure(factoryId)` from the
 *      dispatch hot path.
 *   4. `stop()` — clears the timer and drops in-flight handles.
 *
 * Status transitions:
 *
 *   unknown ──probe 2xx──▶ healthy ──recordFailure >= T──▶ ejected
 *      │                                                       │
 *      │                                                       ▼
 *      └─probe timeout/5xx──▶ unhealthy              probe 2xx (>= R consecutive)
 *                                                       │
 *                                                       ▼
 *                                                  recovering
 *                                                       │
 *                                                  probe 2xx or
 *                                                  passive success
 *                                                       ▼
 *                                                   healthy
 */
export class ActiveHealthRegistry implements HealthRegistry {
  private readonly checks = new Map<string, HealthCheck>();
  private readonly states = new Map<string, FactoryState>();
  private readonly endpointOverrides = new Map<string, HealthEndpoint>();
  private readonly options: Required<Omit<ActiveHealthRegistryOptions,
    "endpoints" | "allowlisted" | "fetchImpl" | "setIntervalImpl" | "clearIntervalImpl" | "now" | "noAutoStart"
  >> & {
    endpoints: ReadonlyMap<string, HealthEndpoint>;
    allowlisted?: (url: string) => boolean;
    fetchImpl: typeof fetch;
    setIntervalImpl: (cb: () => void, ms: number) => unknown;
    clearIntervalImpl: (handle: unknown) => void;
    now: () => number;
    noAutoStart: boolean;
  };
  private intervalHandle: unknown = null;
  private running = false;

  constructor(options: ActiveHealthRegistryOptions = {}) {
    this.options = {
      probeIntervalMs: options.probeIntervalMs ?? 5_000,
      probeTimeoutMs: options.probeTimeoutMs ?? 2_000,
      failureThreshold: options.failureThreshold ?? 3,
      recoveryThreshold: options.recoveryThreshold ?? 2,
      allowlisted: options.allowlisted,
      endpoints: options.endpoints ?? new Map(),
      fetchImpl: options.fetchImpl ?? fetch,
      setIntervalImpl: options.setIntervalImpl ?? defaultSetInterval,
      clearIntervalImpl: options.clearIntervalImpl ?? defaultClearInterval,
      now: options.now ?? defaultNow,
      noAutoStart: options.noAutoStart ?? false,
    };
    if (!this.options.noAutoStart) this.start();
  }

  /* -------------------- public API -------------------- */

  registerCheck(factoryId: string, check: HealthCheck): void {
    this.checks.set(factoryId, check);
    if (!this.states.has(factoryId)) {
      this.states.set(factoryId, this.freshState());
    }
  }

  /** Register / replace the probe endpoint for a factory. Tests use this
   *  to swap a static URL at runtime; production callers usually pass
   *  the full endpoint map at construction time. */
  setEndpoint(factoryId: string, endpoint: HealthEndpoint | undefined): void {
    if (endpoint === undefined) {
      this.endpointOverrides.delete(factoryId);
    } else {
      this.endpointOverrides.set(factoryId, endpoint);
    }
  }

  forFactory(factoryId: string): HealthStatus {
    return this.states.get(factoryId)?.status ?? "unknown";
  }

  snapshot(): HealthRegistrySnapshot {
    const factories: FactoryHealth[] = [];
    for (const [factoryId, state] of this.states) {
      const entry: FactoryHealth = {
        factoryId,
        status: state.status,
        ...(state.lastCheck !== undefined ? { lastCheck: state.lastCheck } : {}),
        ...(state.lastError ? { error: state.lastError } : {}),
      };
      factories.push(entry);
    }
    return {
      factories,
      overall: deriveOverall(factories.map((entry) => entry.status)),
    };
  }

  /* -------------------- passive API -------------------- */

  recordSuccess(factoryId: string): void {
    const state = this.ensureState(factoryId);
    state.failures = Math.max(0, state.failures - 1);
    state.consecutiveProbeSuccesses += 1;
    state.lastCheck = this.options.now();
    state.lastError = undefined;
    if (state.status === "ejected" || state.status === "recovering" || state.status === "unhealthy") {
      // Passive success counts toward recovery even before the next
      // probe tick. We require the recovery threshold to be met
      // through passive success OR a probe round.
      if (state.consecutiveProbeSuccesses >= this.options.recoveryThreshold) {
        state.status = "healthy";
      } else if (state.status === "ejected") {
        state.status = "recovering";
      }
    } else if (state.status === "unknown") {
      state.status = "healthy";
    }
  }

  recordFailure(factoryId: string, reason?: string): void {
    const state = this.ensureState(factoryId);
    state.failures += 1;
    state.consecutiveProbeSuccesses = 0;
    state.lastCheck = this.options.now();
    state.lastError = reason;
    if (state.failures >= this.options.failureThreshold) {
      state.status = "ejected";
    } else if (state.status !== "ejected") {
      state.status = "unhealthy";
    }
  }

  /* -------------------- active probe -------------------- */

  /** Start the periodic probe loop. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.intervalHandle = this.options.setIntervalImpl(() => {
      void this.probeAll();
    }, this.options.probeIntervalMs);
  }

  /** Stop the probe loop. Idempotent. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.intervalHandle !== null) {
      this.options.clearIntervalImpl(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * GHA-NEXT-016 — passive outcome adapter. The dispatch path
   * calls this after every target invocation; we route to
   * `recordSuccess` / `recordFailure` so the same counter the
   * active probe loop reads is also driven by real dispatch
   * outcomes. Two instances of the same factoryId in flight on
   * the same instance can race on `failures`; the worst-case
   * outcome is one extra increment, never undercount, which is
   * safe for the `>= failureThreshold` ejection test.
   */
  recordOutcome(factoryId: string, ok: boolean, reason?: string): void {
    if (ok) {
      this.recordSuccess(factoryId);
    } else {
      this.recordFailure(factoryId, reason ?? "dispatch_failure");
    }
  }

  /**
   * Run a single probe round synchronously. Exposed for tests so they
   * can advance the clock manually instead of relying on fake timers.
   */
  async probeAll(): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (const [factoryId, endpoint] of this.endpointsToProbe()) {
      tasks.push(this.probeOne(factoryId, endpoint));
    }
    await Promise.all(tasks);
  }

  /** Resolve the probe URL for a factory, honouring allowlist and probe=false. */
  resolveProbeUrl(factoryId: string): { ok: true; url: string; method: "HEAD" | "GET" } | { ok: false; reason: string } {
    const endpoint = this.endpointOverrides.get(factoryId) ?? this.options.endpoints.get(factoryId);
    if (!endpoint) return { ok: false, reason: "no_endpoint" };
    if (endpoint.probe === false) return { ok: false, reason: "probe_disabled" };
    if (!this.options.allowlisted) {
      return { ok: false, reason: "no_allowlist" };
    }
    let allowed: boolean;
    try {
      allowed = this.options.allowlisted(endpoint.url);
    } catch {
      allowed = false;
    }
    if (!allowed) return { ok: false, reason: "not_allowlisted" };
    return { ok: true, url: endpoint.url, method: endpoint.method ?? "HEAD" };
  }

  /* -------------------- internals -------------------- */

  private async probeOne(factoryId: string, endpoint: HealthEndpoint): Promise<void> {
    const state = this.ensureState(factoryId);
    state.lastCheck = this.options.now();
    if (endpoint.probe === false) return;
    if (!this.options.allowlisted) {
      state.blockedByAllowlist = true;
      state.lastError = "no_allowlist_predicate";
      return;
    }
    let allowed = false;
    try {
      allowed = this.options.allowlisted(endpoint.url);
    } catch (error) {
      allowed = false;
      state.lastError = `allowlist_threw: ${(error as Error).message}`;
    }
    if (!allowed) {
      state.blockedByAllowlist = true;
      // Per spec: a non-allowlisted host probe does NOT change status.
      // Surface the diagnostic via `lastError` so operators can grep
      // the snapshot but do not flip the LB pool.
      if (state.lastError === undefined) state.lastError = "not_allowlisted";
      return;
    }
    state.blockedByAllowlist = false;
    state.lastError = undefined;
    try {
      const signal = AbortSignal.timeout(this.options.probeTimeoutMs);
      const response = await this.options.fetchImpl(endpoint.url, {
        method: endpoint.method ?? "HEAD",
        signal,
      });
      const status = response.status;
      if (status >= 200 && status < 300) {
        this.recordSuccess(factoryId);
      } else if (status >= 500 && status < 600) {
        this.recordFailure(factoryId, `probe_status_${status}`);
      } else {
        // 3xx / 4xx: not a server failure, not a success. Treat as
        // transient degraded state without flipping the LB pool.
        state.status = "degraded";
      }
    } catch (error) {
      const reason = (error as Error).message || "probe_error";
      this.recordFailure(factoryId, `probe_failed: ${reason.slice(0, 200)}`);
    }
  }

  private endpointsToProbe(): Array<[string, HealthEndpoint]> {
    const out: Array<[string, HealthEndpoint]> = [];
    for (const [factoryId, endpoint] of this.endpointOverrides) {
      out.push([factoryId, endpoint]);
    }
    for (const [factoryId, endpoint] of this.options.endpoints) {
      if (!this.endpointOverrides.has(factoryId)) {
        out.push([factoryId, endpoint]);
      }
    }
    return out;
  }

  private ensureState(factoryId: string): FactoryState {
    let state = this.states.get(factoryId);
    if (!state) {
      state = this.freshState();
      this.states.set(factoryId, state);
    }
    return state;
  }

  private freshState(): FactoryState {
    return {
      status: "unknown",
      failures: 0,
      successes: 0,
      consecutiveProbeSuccesses: 0,
      blockedByAllowlist: false,
    };
  }
}

/**
 * Compute the overall status from a list of per-factory statuses.
 * The intent: if any factory is ejected, the overall is ejected;
 * if any factory is unhealthy, the overall is unhealthy; if all are
 * healthy the overall is healthy; unknown registrations leave the
 * overall as `unknown`.
 */
export const deriveOverall = (
  statuses: ReadonlyArray<HealthStatus>,
): HealthStatus => {
  if (statuses.length === 0) return "unknown";
  if (statuses.some((status) => status === "ejected")) return "ejected";
  if (statuses.some((status) => status === "unhealthy")) return "unhealthy";
  if (statuses.some((status) => status === "recovering")) return "recovering";
  if (statuses.every((status) => status === "healthy")) return "healthy";
  if (statuses.some((status) => status === "degraded")) return "degraded";
  return "unknown";
};
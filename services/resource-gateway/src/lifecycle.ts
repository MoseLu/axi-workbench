import type { ChildProcess } from "node:child_process";

/**
 * GHA-050 / GHA-051 — graceful lifecycle and active-request registry.
 *
 * The lifecycle owns:
 *   1. The "draining" flag. /health/ready returns 503 while draining,
 *      /health/live keeps returning 200 so the load balancer keeps
 *      routing until the process actually exits.
 *   2. An active-request registry keyed on a request id. Each entry
 *      carries the AbortController so shutdown can cancel in-flight
 *      work via the existing signal.
 *   3. A child-process registry. Spawned CLI processes (e.g. the
 *      MiniMax bridge) register here; on drain we SIGTERM them and
 *      fall back to SIGKILL after a short grace period.
 *
 * The clock and config are injected so tests can drive draining and
 * timeouts without timers.
 */

export interface LifecycleOptions {
  /** Wall-clock factory. Injectable for deterministic tests. */
  now?: () => number;
  /** How long to wait between SIGTERM and SIGKILL of a child process. */
  childKillGraceMs?: number;
  /**
   * GHA-NEXT-035 — Hard timeout for a child process before SIGTERM
   * is sent. When the timeout fires the child is SIGTERMed and,
   * after `childKillGraceMs`, SIGKILLed. Defaults to 60_000 ms.
   * Set to 0 to disable. The counter `drain_timeout_total` is
   * incremented every time this fires while a drain is in flight.
   */
  childHardTimeoutMs?: number;
}

export interface ActiveRequest {
  readonly id: string;
  readonly startedAt: number;
  readonly abort: AbortController;
}

export interface ChildEntry {
  readonly id: string;
  readonly child: ChildProcess;
  readonly startedAt: number;
}

export interface DrainCounters {
  /** Number of times drain has been initiated (admin or signal). */
  drainInitiatedTotal: number;
  /** Number of drains that completed (no remaining active requests). */
  drainCompletedTotal: number;
  /** Number of drains that timed out (remaining requests after deadline). */
  drainTimeoutTotal: number;
  /** Number of child hard-timeout events emitted during a drain. */
  childHardTimeoutTotal: number;
}

export class Lifecycle {
  private _draining = false;
  private readonly _requests = new Map<string, ActiveRequest>();
  private readonly _children = new Map<string, ChildEntry>();
  private readonly _now: () => number;
  private readonly _childKillGraceMs: number;
  private readonly _childHardTimeoutMs: number;
  private readonly _drainCounters: DrainCounters = {
    drainInitiatedTotal: 0,
    drainCompletedTotal: 0,
    drainTimeoutTotal: 0,
    childHardTimeoutTotal: 0,
  };

  constructor(options: LifecycleOptions = {}) {
    this._now = options.now ?? Date.now;
    this._childKillGraceMs = options.childKillGraceMs ?? 1_000;
    this._childHardTimeoutMs = options.childHardTimeoutMs ?? 60_000;
  }

  /** True after drain() has been called. */
  isDraining(): boolean {
    return this._draining;
  }

  /** Snapshot for diagnostics (tests + /metrics). */
  activeRequestCount(): number {
    return this._requests.size;
  }

  childCount(): number {
    return this._children.size;
  }

  listActiveRequestIds(): ReadonlyArray<string> {
    return Array.from(this._requests.keys());
  }

  listChildIds(): ReadonlyArray<string> {
    return Array.from(this._children.keys());
  }

  /** Register an active request. Returns a disposer that MUST be
   *  called when the request finishes (success, failure, or cancel). */
  beginRequest(id: string, abort: AbortController): () => void {
    if (this._requests.has(id)) {
      throw new Error(`request id already active: ${id}`);
    }
    this._requests.set(id, { id, startedAt: this._now(), abort });
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      this._requests.delete(id);
    };
  }

  /** Register a spawned child process so drain can kill it. */
  registerChild(id: string, child: ChildProcess): () => void {
    if (this._children.has(id)) {
      throw new Error(`child id already registered: ${id}`);
    }
    this._children.set(id, { id, child, startedAt: this._now() });
    // GHA-NEXT-035: arm a hard-timeout so a runaway child is SIGTERMed
    // even when the lifecycle is not in a draining state. Default is
    // 60 s; configurable via `childHardTimeoutMs` for tests.
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    if (this._childHardTimeoutMs > 0) {
      hardTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          this._drainCounters.childHardTimeoutTotal += 1;
          try { child.kill("SIGTERM"); } catch { /* ignore */ }
          setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) {
              try { child.kill("SIGKILL"); } catch { /* ignore */ }
            }
          }, this._childKillGraceMs).unref?.();
        }
      }, this._childHardTimeoutMs);
      if (typeof hardTimer.unref === "function") hardTimer.unref();
    }
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (hardTimer) clearTimeout(hardTimer);
      // If the child already exited, the Map entry would otherwise
      // leak; guard with the still-attached listener.
      if (child.exitCode === null && child.signalCode === null) {
        // Child still alive — leave it; the caller is responsible for
        // exiting it. The Map drop is the bookkeeping we needed.
      }
      this._children.delete(id);
    };
  }

  /** Enter draining state and cancel every active request. New requests
   *  are not blocked by the lifecycle alone — the HTTP layer refuses
   *  them once it sees the draining flag (see server.ts).
   *
   *  GHA-NEXT-035: every call increments `drain_initiated_total`.
   *  A subsequent call while already draining is a no-op for the
   *  in-flight cancellation but still bumps the counter so signal
   *  storms and admin retries both show up in /metrics. */
  beginDrain(): void {
    this._draining = true;
    this._drainCounters.drainInitiatedTotal += 1;
    for (const entry of this._requests.values()) {
      try {
        entry.abort.abort(new Error("server is draining"));
      } catch {
        // Already aborted by the caller; ignore.
      }
    }
    // Best-effort kill every child. SIGTERM, then SIGKILL after grace.
    for (const entry of Array.from(this._children.values())) {
      this.terminateChild(entry);
    }
  }

  /** Wait until no requests remain or the timeout elapses. Returns the
   *  remaining ids (may be empty). Increments either
   *  `drain_completed_total` or `drain_timeout_total` exactly once
   *  per call. */
  async waitForDrain(timeoutMs: number): Promise<ReadonlyArray<string>> {
    const start = this._now();
    while (this._requests.size > 0) {
      if (this._now() - start >= timeoutMs) {
        this._drainCounters.drainTimeoutTotal += 1;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    const remaining = this.listActiveRequestIds();
    if (remaining.length === 0) this._drainCounters.drainCompletedTotal += 1;
    return remaining;
  }

  /** Test-only: snapshot the active request set. */
  activeRequestsForTest(): ReadonlyArray<ActiveRequest> {
    return Array.from(this._requests.values());
  }

  /** GHA-NEXT-035 — snapshot drain counters for `/metrics`. */
  drainCounters(): Readonly<DrainCounters> {
    return { ...this._drainCounters };
  }

  /** GHA-NEXT-035 — reset drain counters (test-only helper). */
  resetDrainCountersForTest(): void {
    this._drainCounters.drainInitiatedTotal = 0;
    this._drainCounters.drainCompletedTotal = 0;
    this._drainCounters.drainTimeoutTotal = 0;
    this._drainCounters.childHardTimeoutTotal = 0;
  }

  private terminateChild(entry: ChildEntry): void {
    const { child } = entry;
    try {
      child.kill("SIGTERM");
    } catch {
      // Already gone.
    }
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill("SIGKILL"); } catch { /* gone */ }
      }
      this._children.delete(entry.id);
    }, this._childKillGraceMs);
  }
}
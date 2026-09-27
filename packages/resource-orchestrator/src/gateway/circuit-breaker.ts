import type { CircuitBreakerConfig } from "./route";

/**
 * Sliding-window circuit breaker with strict half-open single-probe.
 *
 * Tracks the last `windowSize` outcomes and transitions:
 *   closed  --(errorRate >= threshold && samples >= minSamples)--> open
 *   open    --(now - openedAt >= openMs)----------------------------> half-open
 *   half-open --(success)-------------------------------------------> closed
 *   half-open --(failure)-------------------------------------------> open
 *
 * Half-open single-probe invariant (GHA-035): when the breaker is in
 * half-open, EXACTLY ONE in-flight probe is allowed. Subsequent callers
 * receive `false` from canPass() until the probe resolves and the
 * breaker either closes (success) or re-opens (failure). The original
 * implementation returned `true` for every caller in half-open, which
 * let a thundering herd re-open the breaker instantly on a single
 * failing probe.
 *
 * Threading: JS is single-threaded; we don't need locks. The state is
 * kept per-instance, and a single LoadBalancer owns one breaker per target.
 */

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerSnapshot {
  state: BreakerState;
  samples: number;
  errors: number;
  openedAt: number;
  /** True while a single half-open probe is admitted but not yet
   *  resolved. Exposed for tests and metrics. */
  probeInFlight: boolean;
}

const DEFAULT_WINDOW = 20;

export class CircuitBreaker {
  private state: BreakerState = "closed";
  private samples: boolean[] = [];
  private openedAt = 0;
  private probeInFlight = false;

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly now: () => number = Date.now,
    private readonly windowSize = DEFAULT_WINDOW,
  ) {}

  /** Whether the breaker currently allows a call to proceed. While in
   *  half-open, the very first caller that observes the transition
   *  gets through; every subsequent caller blocks (returns false)
   *  until that probe resolves. */
  canPass(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (this.now() - this.openedAt >= this.config.openMs) {
        this.state = "half-open";
        this.probeInFlight = true;
        return true;
      }
      return false;
    }
    // half-open: only the active probe may pass.
    if (!this.probeInFlight) {
      this.probeInFlight = true;
      return true;
    }
    return false;
  }

  record(success: boolean): void {
    this.samples.push(success);
    if (this.samples.length > this.windowSize) this.samples.shift();
    if (this.state === "half-open") {
      this.probeInFlight = false;
      if (success) {
        this.state = "closed";
        this.samples = []; // reset window on recovery
      } else {
        this.state = "open";
        this.openedAt = this.now();
      }
      return;
    }
    if (this.state === "open") return;
    if (this.samples.length < this.config.minSamples) return;
    const errors = this.samples.filter((value) => !value).length;
    const rate = errors / this.samples.length;
    if (rate >= this.config.errorRateThreshold) {
      this.state = "open";
      this.openedAt = this.now();
    }
  }

  snapshot(): BreakerSnapshot {
    return {
      state: this.state,
      samples: this.samples.length,
      errors: this.samples.filter((value) => !value).length,
      openedAt: this.openedAt,
      probeInFlight: this.probeInFlight,
    };
  }
}

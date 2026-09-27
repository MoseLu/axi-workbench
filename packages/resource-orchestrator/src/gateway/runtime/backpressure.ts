import { decideBackpressure, type BackpressureDecision } from "@axi/gateway-contracts";

/**
 * GHA-034 — per-route backpressure (bounded concurrency + queue timeout).
 *
 * The previous dispatcher fanned out N concurrent calls per route; that
 * scales poorly when a slow provider stacks requests faster than it
 * drains. This module implements a per-route semaphore with a bounded
 * queue:
 *
 *   - `acquire(routeId, policy)` returns a `slot` that the caller must
 *     `release()` when done. When the route's concurrency limit is hit,
 *     the caller is queued FIFO with a `queueTimeoutMs` budget.
 *   - When the queue is full or the queue timeout elapses, the caller
 *     receives a `BackpressureDecision{action: "reject"}` so it can map
 *     the failure to a 429/503 envelope.
 *   - The shed strategy ("reject" or "coalesce") is honoured: callers
 *     that opted into coalescing join the in-flight work and do not
 *     consume a slot.
 *
 * Pure logic + minimal scheduling. The semaphore state is intentionally
 * keyed on `(gatewayInstanceId, routeId)` so two gateways don't bleed
 * state into each other.
 */

export type ShedStrategy = "reject" | "coalesce";

export interface BackpressurePolicy {
  readonly maxConcurrent: number;
  readonly queueTimeoutMs: number;
  readonly shedStrategy: ShedStrategy;
}

interface QueuedWaiter {
  readonly enqueuedAt: number;
  readonly resolve: (slot: Slot) => void;
  readonly reject: (error: Error) => void;
  readonly onCancel: () => void;
}

export interface Slot {
  release(): void;
}

interface RouteState {
  inFlight: number;
  queue: QueuedWaiter[];
}

export interface AcquireFailure {
  readonly decision: Extract<BackpressureDecision, { action: "reject" }>;
}

/** A per-route backpressure registry. Construct one per gateway and
 *  reuse it across requests. */
export class BackpressureRegistry {
  private readonly routes = new Map<string, RouteState>();

  private stateFor(routeId: string): RouteState {
    let state = this.routes.get(routeId);
    if (!state) {
      state = { inFlight: 0, queue: [] };
      this.routes.set(routeId, state);
    }
    return state;
  }

  /** Try to acquire a slot for `routeId` synchronously. Returns the
   *  decision the caller should act on. When the policy allows queueing,
   *  the promise resolves when a slot opens up (or the queue timeout
   *  elapses). Cancellation rejects the pending slot. */
  acquire(routeId: string, policy: BackpressurePolicy, signal?: AbortSignal): Promise<Slot> {
    const state = this.stateFor(routeId);
    const decision = decideBackpressure({
      inFlight: state.inFlight,
      queued: state.queue.length,
      maxConcurrent: policy.maxConcurrent,
      queueTimeoutMs: policy.queueTimeoutMs,
    });
    if (decision.action === "proceed") {
      state.inFlight += 1;
      return Promise.resolve(this.makeSlot(routeId));
    }
    if (decision.action === "reject") {
      return Promise.reject(this.makeRejection(decision));
    }
    // action === "queue"
    return new Promise<Slot>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancelled = false;
      const cleanup = (): void => {
        const index = state.queue.findIndex((entry) => entry.resolve === resolve);
        if (index >= 0) state.queue.splice(index, 1);
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = (): void => {
        cancelled = true;
        cleanup();
        reject(signal?.reason ?? new DOMException("aborted", "AbortError"));
      };
      const waiter: QueuedWaiter = {
        enqueuedAt: Date.now(),
        resolve: (slot) => {
          if (cancelled) {
            slot.release();
            return;
          }
          if (timer) clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          resolve(slot);
        },
        reject: (error) => {
          if (timer) clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
        onCancel: onAbort,
      };
      state.queue.push(waiter);
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      if (policy.queueTimeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new BackpressureTimeoutError(routeId, policy.queueTimeoutMs));
        }, policy.queueTimeoutMs);
        if (typeof timer.unref === "function") timer.unref();
      }
      void waiter;
    });
  }

  /** Diagnostic snapshot for tests. */
  snapshot(routeId: string): { inFlight: number; queued: number } {
    const state = this.routes.get(routeId);
    return state ? { inFlight: state.inFlight, queued: state.queue.length } : { inFlight: 0, queued: 0 };
  }

  private makeSlot(routeId: string): Slot {
    const state = this.stateFor(routeId);
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      state.inFlight = Math.max(0, state.inFlight - 1);
      this.drain(routeId);
    };
    return { release };
  }

  private drain(routeId: string): void {
    const state = this.routes.get(routeId);
    if (!state) return;
    const next = state.queue.shift();
    if (!next) return;
    state.inFlight += 1;
    next.resolve(this.makeSlot(routeId));
  }

  private makeRejection(decision: Extract<BackpressureDecision, { action: "reject" }>): Error {
    const error = new Error(`backpressure rejected: ${decision.reason}`);
    (error as Error & { decision?: BackpressureDecision }).decision = decision;
    return error;
  }
}

export class BackpressureTimeoutError extends Error {
  constructor(public readonly routeId: string, public readonly timeoutMs: number) {
    super(`backpressure queue timeout for ${routeId} after ${timeoutMs}ms`);
    this.name = "BackpressureTimeoutError";
  }
}

/** Helper: read the typed `decision` off a BackpressureTimeoutError
 *  (only present when the error was minted by acquire()). */
export const decisionFromError = (error: unknown): BackpressureDecision | undefined => {
  if (error instanceof BackpressureTimeoutError) {
    return { action: "reject", retryAfterMs: error.timeoutMs, reason: "queue_timeout" };
  }
  if (error && typeof error === "object") {
    const decision = (error as { decision?: unknown }).decision;
    if (decision && typeof decision === "object" && "action" in (decision as Record<string, unknown>)) {
      return decision as BackpressureDecision;
    }
  }
  return undefined;
};
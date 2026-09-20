/**
 * GHA-032 — derived AbortSignal helpers.
 *
 * The dispatcher never trusts a caller-supplied AbortSignal on its own.
 * It composes:
 *   1. the caller's signal (so the user can cancel),
 *   2. the route's per-target timeout (so a hung provider can't pin a slot),
 *   3. an optional budget signal for total elapsed time on the request.
 *
 * Cancellation never falls back (handled by the dispatcher's fallback
 * gate, not here) and the derived signal is short-lived — once it fires
 * the caller is responsible for tearing it down.
 */

const noop = (): void => undefined;

const abortedReason = (parent: AbortSignal | undefined): unknown => {
  if (!parent) return undefined;
  return parent.reason;
};

export interface DerivedSignalOptions {
  /** Caller-supplied signal. Optional; when omitted, only the timeout
   *  fires the derivation. */
  readonly parent?: AbortSignal;
  /** Per-target timeout in milliseconds. When <= 0 the timer is skipped. */
  readonly timeoutMs: number;
  /** Optional total budget for the whole route (including retries).
   *  When set, it fires the signal independently of per-target timeouts. */
  readonly budgetMs?: number;
}

export interface DerivedSignal {
  readonly signal: AbortSignal;
  /** Tear the signal down. Safe to call multiple times. */
  dispose(): void;
}

/**
 * Compose parent + timeout + optional budget into a single AbortSignal.
 * The returned signal fires when any of the three triggers abort. The
 * dispose() function detaches every listener so the controller can be
 * garbage-collected.
 */
export const deriveAbortSignal = (options: DerivedSignalOptions): DerivedSignal => {
  const parent = options.parent;
  if (parent?.aborted) {
    return { signal: parent, dispose: noop };
  }
  const controller = new AbortController();
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const onParentAbort = (): void => {
    if (disposed) return;
    controller.abort(abortedReason(parent));
  };
  const onTimeout = (): void => {
    if (disposed) return;
    controller.abort(new Error(`target timeout after ${options.timeoutMs}ms`));
  };
  const onBudget = (): void => {
    if (disposed) return;
    controller.abort(new Error(`total route budget exceeded (${options.budgetMs}ms)`));
  };

  if (parent) parent.addEventListener("abort", onParentAbort, { once: true });
  if (options.timeoutMs > 0) {
    timeoutTimer = setTimeout(onTimeout, options.timeoutMs);
    // Timer-only signals should not keep the event loop alive — the
    // caller's signal (if any) provides the activity source.
    if (typeof timeoutTimer.unref === "function") timeoutTimer.unref();
  }
  if (typeof options.budgetMs === "number" && options.budgetMs > 0) {
    budgetTimer = setTimeout(onBudget, options.budgetMs);
    if (typeof budgetTimer.unref === "function") budgetTimer.unref();
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (parent) parent.removeEventListener("abort", onParentAbort);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (budgetTimer) clearTimeout(budgetTimer);
  };

  return { signal: controller.signal, dispose };
};

/** True when the signal has fired (parent or derived). The dispatcher
 *  consults this at every step so cancellation propagates without
 *  retrying or falling back. */
export const isAborted = (signal: AbortSignal | undefined): boolean => Boolean(signal?.aborted);

/** Wrap a promise so that it rejects with an AbortError when the signal
 *  fires before the underlying work completes. The wrapper does NOT
 *  cancel the underlying promise — that responsibility stays with the
 *  adapter so it can flush cleanup. */
export const abortable = <T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
  });
};
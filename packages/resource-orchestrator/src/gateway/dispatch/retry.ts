import type { AdapterSearchResult, CoalescingKey, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import type { Target } from "../route";
import type { CircuitBreaker } from "../circuit-breaker";
import { classifyFailure, emptyResultFailure, type ProviderFailure } from "../runtime/failure";
import { deriveAbortSignal, abortable } from "../runtime/signal";
import { retryDecisionFor, scheduleRetry } from "../runtime/retry";
import type { CoalescingRegistry } from "../runtime/coalesce";
import { coalescingKeyFor } from "./router";
import { coalesceStoreKeyFor, sharedCoalesceCheck, sharedCoalesceRegister, sharedBreakerRecord } from "./shared-state-hooks";
import type { DispatchOptions, DispatchPolicy, TargetAttempt } from "./types";

export const invokeTargetOnce = async (
  adapter: ResourceAdapter,
  intent: Intent,
  timeoutMs: number,
  parentSignal: AbortSignal | undefined,
  coalescing: CoalescingRegistry | undefined,
  coalescingKey: CoalescingKey | undefined,
  coalescingEnabled: boolean,
): Promise<AdapterSearchResult> => {
  // Shared-work factory: only the per-route timeout is honoured.
  // We deliberately do NOT wire `parentSignal` here — coalescing
  // treats AbortSignals as a join of promises, not of signals. A
  // caller cancelling its own dispatch must not cancel the shared
  // work that other joined callers are still waiting on.
  const sharedFactory = async (): Promise<AdapterSearchResult> => {
    const derived = deriveAbortSignal({ timeoutMs });
    try {
      return await abortable(adapter.search(intent, derived.signal), derived.signal);
    } finally {
      derived.dispose();
    }
  };
  // Per-caller factory: the caller's signal IS honoured so retries,
  // fallbacks, and breaker accounting react to caller cancellation.
  const callerFactory = async (): Promise<AdapterSearchResult> => {
    const derived = deriveAbortSignal({ parent: parentSignal, timeoutMs });
    try {
      return await abortable(adapter.search(intent, derived.signal), derived.signal);
    } finally {
      derived.dispose();
    }
  };
  if (coalescing && coalescingKey && coalescingEnabled) {
    const shared = coalescing.register(coalescingKey, sharedFactory);
    // Per-caller cancellation wrapper. The shared work itself is NOT
    // bound to the caller's signal (other joiners still want the
    // result), but the caller IS allowed to observe its own
    // cancellation. We wrap the joined promise with `abortable` so a
    // cancelling caller rejects with a `cancelled`-classifiable
    // error, which is what makes `runTargetWithRetry` short-circuit
    // (no retry, no fallback, breaker not charged) while the
    // underlying shared promise keeps running for joined callers.
    return abortable(shared, parentSignal);
  }
  return callerFactory();
};

/** Run a target with retry/backoff/breaker accounting. Returns the
 *  final result plus the typed failure (when the final attempt
 *  failed). */
export const runTargetWithRetry = async (
  target: Target,
  intent: Intent,
  signal: AbortSignal | undefined,
  breaker: CircuitBreaker,
  policy: DispatchPolicy,
  routeId: string,
  options: DispatchOptions,
): Promise<TargetAttempt> => {
  // Coalescing is OFF whenever the route's policy says so. The
  // downstream factories then take the per-caller path.
  const coalescingEnabled = policy.coalescingKeyKind !== "none" && policy.idempotent === true;
  // GHA-NEXT-035 — cross-instance coalescing for non-idempotent routes.
  // The local CoalescingRegistry refuses to coalesce generation
  // calls (idempotent=false => coalescingKeyKind="none" => off), so
  // a deploy with two gateway instances can still duplicate the
  // same generation request. The shared CoalesceStore closes that
  // gap for `resource.generate.*` routes ONLY — idempotent routes
  // keep using the local CoalescingRegistry because their key shape
  // and dedup semantics are well-defined there.
  const sharedCoalesceEnabled = policy.idempotent === false && options.sharedState !== undefined;
  let lastFailure: ProviderFailure | null = null;
  for (let attempt = 1; attempt <= policy.retry.maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      const failure = classifyFailure({ error: signal.reason, targetId: target.id, routeId: routeId, attempt, cancelled: true });
      return { target, result: null, failure, attempts: attempt };
    }
    if (!breaker.canPass()) {
      const failure = classifyFailure({ error: new Error("circuit is open"), targetId: target.id, routeId: routeId, attempt, cancelled: signal?.aborted === true });
      // Circuit-open does not count against the breaker — it IS the
      // breaker firing — so we record the caller's view of the slot
      // without recording an additional error.
      return { target, result: null, failure, attempts: attempt };
    }
    try {
      const key = coalescingEnabled ? coalescingKeyFor(options, routeId, target.id) : undefined;
      // Wrap the local coalescing call in a shared-coalesce adapter
      // when this is a non-idempotent route on a multi-instance
      // gateway. addInFlight is checked at the OUTER boundary so two
      // concurrent identical requests on different instances join the
      // SAME in-flight work; the local CoalescingRegistry still runs
      // for within-instance dedup. Shared check is the only place
      // where peer-instance dedup actually happens.
      let result: AdapterSearchResult;
      if (sharedCoalesceEnabled) {
        const sharedKey = coalesceStoreKeyFor(
          routeId,
          options.toolId,
          options.manifestVersion || 1,
          options.requestKey,
        );
        // First check: is a peer instance already running this work?
        const peerResult = await sharedCoalesceCheck(options.sharedState, sharedKey);
        if (peerResult) {
          result = peerResult;
        } else {
          // Register as the owner of this in-flight work. The store
          // removes the entry when the factory resolves; if a peer
          // raced past us, the store returns their result and we
          // never call the adapter.
          result = await sharedCoalesceRegister(
            options.sharedState,
            sharedKey,
            () => invokeTargetOnce(
              target.adapter,
              intent,
              policy.timeoutMs,
              signal,
              options.coalescing,
              key,
              coalescingEnabled,
            ),
          );
        }
      } else {
        result = await invokeTargetOnce(
          target.adapter,
          intent,
          policy.timeoutMs,
          signal,
          options.coalescing,
          key,
          coalescingEnabled,
        );
      }
      // Empty results are not errors — the provider is healthy but has no
      // data. We classify them so the negative TTL is applied and the
      // sliding window records a success entry so empty results do NOT
      // contribute to the error rate and cannot open the circuit.
      if (result.items.length === 0) {
        const emptyFailure = emptyResultFailure(target.id, routeId, attempt);
        // Record as success: empty_result is not a provider failure, and
        // recording it as false (failure) would wrongly inflate the error
        // rate and risk opening the breaker for a healthy provider.
        breaker.record(true);
        // GHA-NEXT-040: mirror the success into the shared breaker so
        // peer instances observe the same circuit state. Fail-open
        // when the store is unreachable.
        sharedBreakerRecord(options.sharedState, target.id, true);
        // GHA-NEXT-016 — mirror the success into the HealthRegistry
        // so passive failure counts AND the active probe loop both
        // see real dispatch outcomes. Without this, the registry's
        // `ejected` state is only reachable via the probe timer and
        // never reflects what dispatch actually observed.
        options.healthRegistry?.recordOutcome?.(target.id, true);
        return { target, result, failure: emptyFailure, attempts: attempt };
      }
      breaker.record(true);
      sharedBreakerRecord(options.sharedState, target.id, true);
      options.healthRegistry?.recordOutcome?.(target.id, true);
      return { target, result, failure: null, attempts: attempt };
    } catch (error) {
      const failure = classifyFailure({ error, targetId: target.id, routeId: routeId, attempt, cancelled: signal?.aborted === true });
      if (failure.kind !== "cancelled" && failure.countsAgainstBreaker) {
        breaker.record(false);
        // GHA-NEXT-040: mirror the failure into the shared breaker.
        sharedBreakerRecord(options.sharedState, target.id, false);
        // GHA-NEXT-016 — mirror the failure into the HealthRegistry
        // so passive counts + active probes jointly drive ejection.
        // The `failure.kind` is recorded for diagnosis.
        options.healthRegistry?.recordOutcome?.(target.id, false, `dispatch_${failure.kind}`);
      }
      lastFailure = failure;
      const decision = retryDecisionFor({
        attempt,
        maxAttempts: policy.retry.maxAttempts,
        backoffMs: policy.retry.backoffMs,
        maxBackoffMs: policy.retry.maxBackoffMs,
        failure,
        routeIdempotent: policy.idempotent,
      });
      if (decision.action !== "retry") break;
      await scheduleRetry({ decision, signal });
    }
  }
  return { target, result: null, failure: lastFailure, attempts: policy.retry.maxAttempts };
};

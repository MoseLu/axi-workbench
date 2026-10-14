import type { AdapterSearchResult } from "@axi/gateway-contracts";
import type { RouteContext, RouteDefinition, Target } from "../route";
import type { CircuitBreaker } from "../circuit-breaker";
import { pickTarget, cachedHealthStatus } from "../load-balancer";
import { summarizeFailure, shouldFallbackFor, type ProviderFailure } from "../runtime/failure";
import type { BackpressureRegistry } from "../runtime/backpressure";
import { decisionFromError } from "../runtime/backpressure";
import { mergeResults, policyForRouteId, breakerFor } from "./router";
import { runTargetWithRetry } from "./retry";
import {
  idempotencyKeyFor,
  sharedCacheKeyFor,
  sharedCacheRead,
  sharedIdempotencyAcquire,
} from "./shared-state-hooks";
import type { DispatchOptions, DispatchRunState } from "./types";

/** Execute a single route (primary or fallback) end-to-end.
 *
 *  Extracted verbatim from the `dispatchRoute` closure: shared-cache
 *  read → non-idempotent idempotency gate → per-target pools
 *  (concurrency 1 failover, or fan-out with merge) → per-route
 *  fallback pool. Mutates `state` (serving route/policy, cache-hit
 *  flag, idempotency bookkeeping) and `ctx.warnings` exactly as the
 *  original closure did.
 *
 *  Returns the route's result, or `null` when the route produced no
 *  usable result (including the typed 409 conflict short-circuit). */
export const tryRoute = async (
  targetRoute: RouteDefinition,
  options: DispatchOptions,
  ctx: RouteContext,
  backpressure: BackpressureRegistry,
  state: DispatchRunState,
): Promise<AdapterSearchResult | null> => {
  // Per-route policy: this is the route-local override of every
  // policy knob (timeout / retry / backpressure / cacheTtlMs /
  // coalescingKeyKind). When policyByRoute is absent we fall back
  // to the single legacy policy for every route.
  const routePolicy = policyForRouteId(options, targetRoute.id);

  // GHA-NEXT-020 / 040 — shared cache read. Runs at the route
  // boundary BEFORE any target is acquired so a cache hit
  // short-circuits without ever paying for backpressure / breaker /
  // retry. We key on the route's own cacheScope so different
  // policies observe different entries; the shared store honours
  // the same TTL contract as the in-process VersionedCache.
  if (routePolicy.cacheTtlMs > 0) {
    const sharedKey = sharedCacheKeyFor(options, targetRoute.id, routePolicy.cacheScope);
    // GHA-NEXT-020 — `sharedCacheRead` is async so a cross-instance
    // hit on a peer instance can actually land. The local
    // VersionedCache mirror in `options.cache` is still consulted
    // by the filter pipeline after a hit so legacy filter reads
    // observe the entry.
    const cached = await sharedCacheRead(options.sharedState, sharedKey);
    if (cached && cached.expiresAt > Date.now()) {
      state.servingRoute = targetRoute;
      state.servingPolicy = routePolicy;
      state.servedFromCache = true;
      return cached.result;
    }
  }

  // GHA-NEXT-035 — non-idempotent-route idempotency gate. The lock
  // is acquired BEFORE any target adapter call so a peer instance
  // holding the lock forces the local caller to either join the
  // already-published result (status=join) or surface 409
  // (status=conflict). Idempotent routes skip this gate entirely
  // — retry / coalesce / cache handle their own dedup.
  if (routePolicy.idempotent === false) {
    const idemKey = idempotencyKeyFor(
      targetRoute.toolId,
      options.requestKey,
      options.manifestVersion || 1,
    );
    // Lock TTL: maxAttempts * timeoutMs + 5s safety margin. Long
    // enough that a healthy generation call NEVER expires before
    // the result is published; short enough that a crashed peer
    // releases the lock within a reasonable window.
    const idemTtlMs = Math.max(
      routePolicy.retry.maxAttempts * routePolicy.timeoutMs + 5_000,
      30_000,
    );
    const outcome = await sharedIdempotencyAcquire(
      options.sharedState,
      idemKey,
      idemTtlMs,
    );
    if (outcome.status === "join") {
      state.servingRoute = targetRoute;
      state.servingPolicy = routePolicy;
      return outcome.result;
    }
    if (outcome.status === "conflict") {
      // Lock held by a peer, no published result yet. Surface a
      // typed 409 marker so the HTTP edge can map it to 409 without
      // an error channel. Do NOT call any target — the peer owns
      // the work.
      ctx.warnings.push(`[shared-state:409:idempotency_conflict] route=${targetRoute.id} key=${idemKey}`);
      return null;
    }
    // outcome.status === "proceed": we hold the lock. Stash the
    // key + TTL in the bookkeeping map so the post-processing tail
    // can release on failure / publish on success.
    state.idempotencyBookkeeping.set(targetRoute.id, { idemKey, idemTtlMs });
  }

  const primary = targetRoute.targets.filter((target) => !target.fallback);
  const fallback = targetRoute.targets.filter((target) => target.fallback);

  const breakersByTarget = new Map<string, CircuitBreaker>();
  for (const target of targetRoute.targets) breakersByTarget.set(target.id, breakerFor(options, target, targetRoute.circuit));

  const concurrency = Math.max(1, targetRoute.concurrency ?? 1);
  // GHA-NEXT-010: track the last failure from this pool so the
  // per-route fallback skip rule can read it without re-parsing the
  // warning strings.
  const tryPool = async (pool: ReadonlyArray<Target>): Promise<{ result: AdapterSearchResult | null; lastFailure: ProviderFailure | null }> => {
    if (!pool.length) return { result: null, lastFailure: null };
    if (concurrency === 1) {
      let lastFailure: ProviderFailure | null = null;
      for (const target of pool) {
        let slot;
        try {
          slot = await backpressure.acquire(targetRoute.id, routePolicy.backpressure, options.signal);
        } catch (error) {
          // GHA-NEXT-018: BackpressureRegistry rejected (queue full
          // or queue timeout). Surface a typed warning that the
          // HTTP edge can read to produce a 429 + Retry-After
          // response. We do NOT throw — the dispatch contract is to
          // return an AdapterSearchResult; the warning marker is
          // `[backpressure:429:retry-after=<ms>]` so the gateway
          // router (Phase C) can map it without needing a separate
          // error channel.
          const decision = decisionFromError(error);
          if (decision && decision.action === "reject") {
            ctx.warnings.push(`[backpressure:429:retry-after=${decision.retryAfterMs}] route=${targetRoute.id} reason=${decision.reason}`);
          } else {
            ctx.warnings.push(`[backpressure:error] route=${targetRoute.id}`);
          }
          return { result: null, lastFailure };
        }
        try {
          if (options.signal?.aborted) break;
          // GHA-NEXT-017: load-balancer strategy is read from
          // targetRoute.loadBalancer so the manifest / route
          // definition actually drives the pickTarget path. With a
          // single-target pool the choice is moot, but we keep the
          // dispatch contract uniform so multi-target pools below
          // can also branch on the same route-level knob.
          // GHA-NEXT-037: pass `options.healthRegistry` so ejected
          // factories are excluded from the candidate pool. If
          // the single candidate is ejected, `pickTarget` returns
          // `undefined`; in that case we must NOT fall back to
          // the original target because that defeats the ejection
          // (the whole point of recording the outcome is to keep
          // the LB from re-routing traffic to a known-bad
          // provider). Surface a typed `provider_error` instead.
          const strategy = targetRoute.loadBalancer ?? "failover-only";
          const picked = pickTarget([target], strategy, ctx, { healthRegistry: options.healthRegistry });
          if (!picked) {
            const failure: ProviderFailure = {
              kind: "server_error",
              code: "provider_error",
              message: `single-target route ${targetRoute.id} is ejected; no fallback candidate`,
              routeId: targetRoute.id,
              targetId: target.id,
              countsAgainstBreaker: false,
              at: new Date().toISOString(),
              retryable: true,
              attempt: 1,
            };
            return { result: null, lastFailure: failure };
          }
          const breaker = breakersByTarget.get(picked.id)!;
          const attempt = await runTargetWithRetry(picked, options.intent, options.signal, breaker, routePolicy, targetRoute.id, options);
          if (attempt.failure) {
            ctx.warnings.push(summarizeFailure(attempt.failure));
            lastFailure = attempt.failure;
            if (!shouldFallbackFor(attempt.failure)) {
              // Cancellation / not_configured / 4xx / invalid_payload: stop right here.
              return { result: null, lastFailure };
            }
            continue;
          }
          if (attempt.result && attempt.result.items.length > 0) {
            state.servingRoute = targetRoute;
            state.servingPolicy = routePolicy;
            return { result: attempt.result, lastFailure };
          }
        } finally {
          slot.release();
        }
      }
      return { result: null, lastFailure };
    }
    // Multi-target concurrency>1 path: same wrap for acquire().
    // GHA-NEXT-037 — drop ejected factories before fanning out so a
    // sick factory doesn't soak up a backpressure slot. Falls back to
    // the unfiltered pool when every target is ejected (matches the
    // pickTarget semantic and prevents deadlock when the only
    // registered factory is sick). Reuses the same 1s TTL cache as
    // pickTarget so both code paths observe consistent status.
    const eligible = (() => {
      if (!options.healthRegistry) return pool;
      const registry = options.healthRegistry;
      const filtered = pool.filter((t) => cachedHealthStatus(registry, t.id) !== "ejected");
      return filtered.length ? filtered : pool;
    })();
    const settled = await Promise.allSettled(eligible.map(async (target) => {
      let slot;
      try {
        slot = await backpressure.acquire(targetRoute.id, routePolicy.backpressure, options.signal);
      } catch (error) {
        const decision = decisionFromError(error);
        if (decision && decision.action === "reject") {
          ctx.warnings.push(`[backpressure:429:retry-after=${decision.retryAfterMs}] route=${targetRoute.id} reason=${decision.reason} target=${target.id}`);
        } else {
          ctx.warnings.push(`[backpressure:error] route=${targetRoute.id} target=${target.id}`);
        }
        // Treat backpressure rejection as a non-retryable, non-fallback
        // condition for this slot; the Promise.allSettled still
        // resolves with null so other slots proceed.
        return null;
      }
      try {
        const breaker = breakersByTarget.get(target.id)!;
        const attempt = await runTargetWithRetry(target, options.intent, options.signal, breaker, routePolicy, targetRoute.id, options);
        if (attempt.failure) {
          ctx.warnings.push(summarizeFailure(attempt.failure));
          if (!shouldFallbackFor(attempt.failure)) {
            throw new Error("cancelled");
          }
          return null;
        }
        return attempt.result;
      } finally {
        slot.release();
      }
    }));
    const successful = settled
      .map((entry) => entry.status === "fulfilled" ? entry.value : null)
      .filter((value): value is AdapterSearchResult => value !== null && value.items.length > 0);
    if (!successful.length) return { result: null, lastFailure: null };
    state.servingRoute = targetRoute;
    state.servingPolicy = routePolicy;
    return { result: mergeResults(successful), lastFailure: null };
  };

  const primaryOutcome = await tryPool(primary);
  if (primaryOutcome.result) return primaryOutcome.result;
  // Cancellation: do NOT fall back. The caller asked to stop.
  if (options.signal?.aborted) return null;
  // GHA-NEXT-010: 4xx (client_error) and invalid_payload are caller /
  // input bugs. The next per-target fallback would face the same
  // payload and almost certainly fail identically. Skip the
  // per-route fallback pool for these so a bad request doesn't
  // cascade to a healthy fallback target. Other transient failures
  // (5xx, timeout, network, rate_limited) still walk the fallback.
  if (primaryOutcome.lastFailure && !shouldFallbackFor(primaryOutcome.lastFailure)) return null;
  const fallbackOutcome = await tryPool(fallback);
  if (fallbackOutcome.result) {
    return {
      ...fallbackOutcome.result,
      warnings: [...ctx.warnings, ...(fallbackOutcome.result.warnings || [])],
    };
  }
  return null;
};

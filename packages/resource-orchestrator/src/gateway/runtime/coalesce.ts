import type { AdapterSearchResult } from "@axi/gateway-contracts";
import { decideCoalescing, type CoalescingKey, type CoalescingDecision } from "@axi/gateway-contracts";

/**
 * GHA-036 — per-gateway request coalescing.
 *
 * Concurrent identical requests share one in-flight call. The previous
 * dispatcher kept a module-level singleton that leaked across gateways
 * and across tests; this version is keyed on `(gatewayInstanceId,
 * CoalescingKey)` so:
 *   - two distinct gateways can dispatch the same request in parallel,
 *   - the test suite can reset per-gateway state via dispose().
 *
 * Coalescing key kinds (idempotency / request-key / none) come from
 * contracts/runtime. Cancellation of one caller does NOT cancel the
 * shared work — the gateway treats coalescing as a "join" of promises,
 * not of AbortSignals.
 */

export type CoalescingKeyKind = "idempotency" | "request-key" | "none";

export interface CoalescingPolicy {
  readonly keyKind: CoalescingKeyKind;
}

interface InFlight<T> {
  readonly key: CoalescingKey;
  readonly promise: Promise<T>;
  shareCount: number;
}

export class CoalescingRegistry {
  private readonly inflight = new Map<string, InFlight<AdapterSearchResult>>();

  /** Decide whether the caller should join an existing in-flight call
   *  or start a new one. */
  decide(input: {
    policy: CoalescingPolicy;
    routeId: string;
    idempotencyKey: string;
    manifestVersion: number;
  }): CoalescingDecision {
    const key: CoalescingKey = {
      routeId: input.routeId,
      idempotencyKey: input.idempotencyKey,
      manifestVersion: input.manifestVersion,
    };
    const list = [...this.inflight.values()].map((entry) => ({
      routeId: entry.key.routeId,
      key: entry.key.idempotencyKey,
      manifestVersion: entry.key.manifestVersion,
    }));
    return decideCoalescing({
      policy: input.policy.keyKind,
      inFlightForKey: list,
      thisRouteId: key.routeId,
      thisKey: key.idempotencyKey,
      thisManifestVersion: key.manifestVersion,
    });
  }

  /** Join an existing in-flight call. The caller receives the same
   *  promise (and the same result) without starting a new adapter
   *  invocation. */
  join(key: CoalescingKey): Promise<AdapterSearchResult> | undefined {
    const entry = this.inflight.get(serializeKey(key));
    if (!entry) return undefined;
    entry.shareCount += 1;
    return entry.promise;
  }

  /** Register an in-flight call. The caller passes a `factory` that
   *  builds the underlying promise; the registry records the result
   *  for any concurrent callers to join, then removes itself when the
   *  promise settles. */
  register<T extends AdapterSearchResult>(key: CoalescingKey, factory: () => Promise<T>): Promise<T> {
    const serialized = serializeKey(key);
    const existing = this.inflight.get(serialized);
    if (existing) {
      existing.shareCount += 1;
      return existing.promise as Promise<T>;
    }
    const entry: InFlight<T> = {
      key,
      shareCount: 1,
      promise: factory().finally(() => this.inflight.delete(serialized)),
    };
    this.inflight.set(serialized, entry as InFlight<AdapterSearchResult>);
    return entry.promise;
  }

  /** Test/diagnostic: how many callers are sharing this in-flight
   *  call? Returns 0 when no in-flight call matches. */
  shareCount(key: CoalescingKey): number {
    return this.inflight.get(serializeKey(key))?.shareCount || 0;
  }

  /** Test-only: clear all in-flight state. */
  reset(): void {
    this.inflight.clear();
  }
}

const serializeKey = (key: CoalescingKey): string => `${key.routeId}|${key.idempotencyKey}|${key.manifestVersion}`;
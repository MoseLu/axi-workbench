import type {
  ProviderFailure,
  ProviderFailureKind,
  Intent,
  AdapterSearchResult,
} from "@axi/gateway-contracts";
import {
  makeProviderFailure,
  isProviderHealthFailure,
  shouldFallback as shouldFallbackForKind,
} from "@axi/gateway-contracts";

/**
 * GHA-031 — typed failure classification for the dispatcher.
 *
 * Adapters throw plain Errors today; the dispatch layer wraps each error
 * into a normalized ProviderFailure so retry, breaker accounting, and
 * fallback all key off the same enum. Errors that already carry a
 * ProviderFailure (e.g. from a manifest validator or a future typed
 * adapter) are passed through unchanged.
 *
 * Pure module — no side effects, no I/O. Tests pin the kind-detection
 * rules so a new heuristic can't drift the wire format.
 */

export interface ClassifyFailureInput {
  readonly error: unknown;
  readonly targetId: string;
  readonly routeId: string;
  readonly attempt: number;
  /** When true, the caller (or AbortSignal) cancelled the request. The
   *  classifier maps this to kind="cancelled" regardless of the error
   *  shape so retry/breaker skip accounting. */
  readonly cancelled: boolean;
}

/** Inspect the error shape and decide which ProviderFailureKind to
 *  mint. The classifier only uses string matching on the error message
 *  for the rare cases where the error type itself carries no signal
 *  (plain `new Error("timeout")`, for instance). */
const classifyFromError = (error: unknown): ProviderFailureKind => {
  if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
  if (error && typeof error === "object") {
    const candidate = error as { name?: unknown; status?: unknown; code?: unknown; cause?: unknown };
    if (candidate.name === "AbortError") return "cancelled";
    if (typeof candidate.status === "number") {
      if (candidate.status === 401 || candidate.status === 403) return "unauthorized";
      if (candidate.status === 404) return "empty_result";
      if (candidate.status === 408) return "timeout";
      if (candidate.status === 429) return "rate_limited";
      if (candidate.status >= 500) return "server_error";
      if (candidate.status >= 400) return "client_error";
    }
    if (candidate.code === "ECONNREFUSED" || candidate.code === "ENOTFOUND" || candidate.code === "ETIMEDOUT") return "network";
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  if (message.includes("aborted")) return "cancelled";
  if (message.includes("circuit is open")) return "circuit_open";
  if (message.includes("timeout")) return "timeout";
  if (message.includes("rate limit")) return "rate_limited";
  if (message.includes("unauthorized") || message.includes("forbidden")) return "unauthorized";
  if (message.includes("not configured") || message.includes("missing secret")) return "not_configured";
  if (message.includes("invalid response") || message.includes("invalid_payload")) return "invalid_payload";
  if (message.includes("network") || message.includes("econnrefused") || message.includes("enotfound")) return "network";
  if (message.includes("server") || message.includes("5xx")) return "server_error";
  if (message.includes("4xx") || message.includes("client")) return "client_error";
  if (message.includes("empty result") || message.includes("no items")) return "empty_result";
  return "internal";
};

const statusFromError = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown };
  return typeof candidate.status === "number" ? candidate.status : undefined;
};

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) return error.message || error.name || "provider failure";
  if (typeof error === "string") return error;
  return "provider failure";
};

/** Wrap any thrown value into a ProviderFailure. If the value already
 *  is a ProviderFailure (e.g. a manifest validator surfaced it), the
 *  classifier returns it verbatim so its `kind`, `retryable`, and
 *  `countsAgainstBreaker` flags survive the boundary. ProviderFailure
 *  is the same Zod schema both sides use, so an instance check is
 *  sufficient and avoids a re-parse round trip. */
const isProviderFailure = (error: unknown): error is ProviderFailure => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.kind === "string"
    && typeof candidate.code === "string"
    && typeof candidate.targetId === "string"
    && typeof candidate.routeId === "string"
    && typeof candidate.attempt === "number";
};

export const classifyFailure = (input: ClassifyFailureInput): ProviderFailure => {
  const { error } = input;
  if (isProviderFailure(error)) {
    // GHA-NEXT-010: even a pre-shaped ProviderFailure that originated
    // from an adapter MUST be normalised so 4xx / invalid_payload /
    // cancelled never penalise the breaker. A misbehaving adapter that
    // set `countsAgainstBreaker: true` on a client_error would otherwise
    // silently trip the breaker for an input-side mistake.
    if (
      (error.kind === "client_error" || error.kind === "invalid_payload" || error.kind === "cancelled")
      && error.countsAgainstBreaker
    ) {
      return makeProviderFailure({
        kind: error.kind,
        message: error.message,
        targetId: error.targetId,
        routeId: error.routeId,
        attempt: error.attempt,
        status: error.status,
        retryAfterMs: error.retryAfterMs,
        countsAgainstBreaker: false,
      });
    }
    return error;
  }
  const kind: ProviderFailureKind = input.cancelled ? "cancelled" : classifyFromError(error);
  // GHA-NEXT-010: 4xx (client_error) and invalid_payload are caller /
  // input bugs. The provider did nothing wrong. They MUST NOT count
  // against the breaker; doing so would let a single buggy request
  // open the breaker for a healthy provider. `cancelled` is already
  // excluded in contracts but we set it explicitly here so the
  // invariant is visible at the orchestrator boundary.
  const countsAgainstBreaker = kind !== "client_error" && kind !== "invalid_payload" && kind !== "cancelled";
  const failure = makeProviderFailure({
    kind,
    message: messageFromError(error),
    targetId: input.targetId,
    routeId: input.routeId,
    attempt: input.attempt,
    status: statusFromError(error),
    countsAgainstBreaker,
  });
  return failure;
};

/** Re-export predicates from contracts so dispatch callers have a single
 *  import surface. */
export { isProviderHealthFailure };

/** Should the dispatcher fall back to the next route when this failure
 *  fires? Per the cancellation contract, cancellation NEVER falls back;
 *  `invalid_payload` (the caller's bug, not a provider health issue)
 *  also NEVER falls back — a bad request to one provider would be
 *  a bad request to the next; `client_error` (provider-returned 4xx)
 *  also does NOT fall back because the next provider would face the
 *  same input and almost certainly fail identically. Every other kind
 *  falls back when the route has a fallback declared. */
export const shouldFallbackFor = (failure: ProviderFailure): boolean => shouldFallbackForKind(failure) && failure.kind !== "invalid_payload" && failure.kind !== "client_error";

/** Compact human-readable summary used in route warnings. Never includes
 *  query text — the caller has the original intent available separately. */
export const summarizeFailure = (failure: ProviderFailure): string => {
  const status = typeof failure.status === "number" ? ` status=${failure.status}` : "";
  const retry = failure.retryAfterMs ? ` retry-after=${failure.retryAfterMs}ms` : "";
  return `${failure.targetId} route=${failure.routeId} attempt=${failure.attempt} kind=${failure.kind} code=${failure.code}${status}${retry}`;
};

/** An empty-result AdapterSearchResult is a normal "no data" signal, not
 *  a failure. This helper returns a typed failure for that case so the
 *  dispatcher can apply the negative-cache TTL without it counting
 *  against the breaker. */
export const emptyResultFailure = (targetId: string, routeId: string, attempt: number): ProviderFailure =>
  makeProviderFailure({
    kind: "empty_result",
    message: "provider returned zero items",
    targetId,
    routeId,
    attempt,
  });

/** Quick predicate for callers that want to test a result without
 *  building a full ProviderFailure envelope. */
export const isEmptyResult = (result: AdapterSearchResult): boolean =>
  !result || !Array.isArray(result.items) || result.items.length === 0;

export type { ProviderFailure, ProviderFailureKind, Intent };
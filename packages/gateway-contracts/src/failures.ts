import { z } from "zod";

/**
 * GHA-030 — typed provider failure taxonomy.
 *
 * Every provider / network / dispatch error is normalised to one of
 * the values in `providerFailureKindSchema`. The dispatch layer uses
 * this to decide retry, failover and breaker accounting. Adding a new
 * kind is a non-breaking change. Renaming one is breaking.
 *
 * Why this lives in contracts:
 *   - It is shared between adapters (where failures are minted) and
 *     the orchestrator (where they are consumed). Putting the taxonomy
 *     in the orchestrator would create a circular dep with adapters.
 *   - The workbench can also inspect `ProviderFailure` envelopes for
 *     diagnostics without depending on the orchestrator package.
 */

/** Current version of the failure taxonomy. Bumped only when a kind
 *  is renamed or removed. */
export const failureContractVersion = 1 as const;

/** Stable, closed enum of failure categories. The dispatch layer's
 *  retry/breaker logic keys off these names; tests pin them so a typo
 *  fails validation at compile time. */
export const providerFailureKindSchema = z.enum([
  /** Provider adapter returned within the budget but its response
   *  failed payload validation (JSON shape, missing required fields,
   *  unsafe content). Not retryable. Does NOT count against the
   *  breaker (it is the caller's bug, not the provider's). */
  "invalid_payload",
  /** Provider adapter returned an empty / zero-item result set. This
   *  is distinct from `provider_error`: the provider is healthy but
   *  has no data. May be cached briefly to prevent thundering herd. */
  "empty_result",
  /** Provider returned a 4xx-class response. The request was malformed
   *  or forbidden; not retryable. Breaker may count it depending on
   *  policy. */
  "client_error",
  /** Provider returned a 5xx-class response. Retryable for idempotent
   *  routes only; counts against the breaker. */
  "server_error",
  /** Provider returned 429 (rate limit). Retryable with backoff,
 *  respecting any Retry-After hint. Counts against the breaker. */
  "rate_limited",
  /** Provider response was slower than the route timeout policy.
   *  Retryable for idempotent routes only. Counts against the
   *  breaker. Distinct from `cancelled` because the caller is still
   *  waiting. */
  "timeout",
  /** Network-level failure (DNS, connection refused, TLS error).
   *  Retryable for idempotent routes only. Counts against the
   *  breaker. */
  "network",
  /** Caller aborted the request (AbortSignal). NEVER retried. NEVER
   *  counted against the breaker — the provider did nothing wrong.
   *  Fallback is also skipped per the cancellation contract. */
  "cancelled",
  /** Provider's circuit breaker is open. Retry is rejected at the
   *  gateway boundary. Counts as a "soft" failure for metrics but
   *  does NOT count against the breaker (we don't penalise ourselves
   *  for our own protection firing). */
  "circuit_open",
  /** Provider returned 401/403 or refused credentials. Not retryable;
   *  re-running with the same token will fail identically. Counts
   *  against the breaker. */
  "unauthorized",
  /** Gateway missing required configuration (secret, base URL,
   *  manifest entry). Not retryable; not counted against the
   *  breaker. Maps to `not_configured` on the wire. */
  "not_configured",
  /** Catch-all for unexpected errors. Treated as retryable for
   *  idempotent routes and counted against the breaker. */
  "internal",
]);
export type ProviderFailureKind = z.infer<typeof providerFailureKindSchema>;

/** A normalized provider failure envelope. Adapters raise one of
 *  these (or a wrapped Error that the dispatch layer maps); the
 *  gateway serializes them for retry/breaker accounting and for
 *  structured logging. */
export const providerFailureSchema = z.object({
  /** The normalized kind. */
  kind: providerFailureKindSchema,
  /** Stable error code suitable for matching in client code. Matches
   *  one of the wire-format GatewayErrorCode values where possible
   *  (e.g. timeout → provider_timeout). */
  code: z.string().min(1).max(80),
  /** Short, human-readable message. Must NOT contain secrets, file
   *  paths, or query text — only the stable cause string and any
   *  numeric identifiers. */
  message: z.string().min(1).max(400),
  /** Target id that produced the failure. Always present so log
   *  pipelines can group by target. */
  targetId: z.string().min(1).max(200),
  /** Route id under which the failure occurred. */
  routeId: z.string().min(1).max(120),
  /** Provider-level retry hint in milliseconds, if the provider
   *  supplied one (e.g. a 503 with Retry-After). */
  retryAfterMs: z.number().int().min(0).max(86_400_000).optional(),
  /** HTTP status code from the provider, if applicable. */
  status: z.number().int().min(100).max(599).optional(),
  /** Whether the failure is safe to retry (the dispatch layer
   *  re-validates against the route policy idempotency flag). */
  retryable: z.boolean(),
  /** Whether this failure should count against the circuit breaker
   *  for the target. Defaults to true; the caller can set it false
   *  for "expected" failures like client_error on an idempotent
   *  search route. */
  countsAgainstBreaker: z.boolean().default(true),
  /** Attempt ordinal (1-indexed) within the current dispatch. */
  attempt: z.number().int().min(1).max(8),
  /** Wall-clock timestamp at which the failure was minted. */
  at: z.string().datetime(),
}).strict();
export type ProviderFailure = z.infer<typeof providerFailureSchema>;

/** Construct a ProviderFailure with sensible defaults. Use this from
 *  adapters so the fields don't drift. The default retryable and
 *  countsAgainstBreaker values come from the failure-kind taxonomy,
 *  not from the caller; callers may override them with an explicit
 *  value when the context demands it (e.g. a 4xx on a known-buggy
 *  route that the provider hasn't fixed yet). */
export const makeProviderFailure = (input: {
  kind: ProviderFailureKind;
  message: string;
  targetId: string;
  routeId: string;
  attempt: number;
  status?: number;
  retryAfterMs?: number;
  retryable?: boolean;
  countsAgainstBreaker?: boolean;
}): ProviderFailure => {
  const kindRetryable: Readonly<Record<ProviderFailureKind, boolean>> = {
    invalid_payload: false,
    empty_result: false,
    client_error: false,
    server_error: true,
    rate_limited: true,
    timeout: true,
    network: true,
    cancelled: false,
    circuit_open: false,
    unauthorized: false,
    not_configured: false,
    internal: true,
  };
  const kindCode: Readonly<Record<ProviderFailureKind, string>> = {
    invalid_payload: "invalid_request",
    empty_result: "empty_result",
    client_error: "provider_error",
    server_error: "provider_error",
    rate_limited: "rate_limited",
    timeout: "provider_timeout",
    network: "provider_error",
    cancelled: "cancelled",
    circuit_open: "circuit_open",
    unauthorized: "provider_error",
    not_configured: "not_configured",
    internal: "internal",
  };
  const kindCountsAgainstBreaker: Readonly<Record<ProviderFailureKind, boolean>> = {
    invalid_payload: false,
    empty_result: false,
    client_error: true,
    server_error: true,
    rate_limited: true,
    timeout: true,
    network: true,
    cancelled: false,
    circuit_open: false,
    unauthorized: true,
    not_configured: false,
    internal: true,
  };
  return providerFailureSchema.parse({
    kind: input.kind,
    code: kindCode[input.kind],
    message: input.message.slice(0, 400),
    targetId: input.targetId,
    routeId: input.routeId,
    attempt: input.attempt,
    at: new Date().toISOString(),
    status: input.status,
    retryAfterMs: input.retryAfterMs,
    retryable: input.retryable ?? kindRetryable[input.kind],
    countsAgainstBreaker: input.countsAgainstBreaker ?? kindCountsAgainstBreaker[input.kind],
  });
};

/** Map a ProviderFailureKind to its wire-format GatewayErrorCode. */
export const gatewayErrorCodeForKind = (kind: ProviderFailureKind): string => {
  const map: Readonly<Record<ProviderFailureKind, string>> = {
    invalid_payload: "invalid_request",
    empty_result: "provider_error",
    client_error: "provider_error",
    server_error: "provider_error",
    rate_limited: "rate_limited",
    timeout: "provider_timeout",
    network: "provider_error",
    cancelled: "cancelled",
    circuit_open: "circuit_open",
    unauthorized: "provider_error",
    not_configured: "not_configured",
    internal: "internal",
  };
  return map[kind];
};

/** Predicate: is this failure a transient one that retry may be
 *  applied to? The dispatch layer further filters by route idempotency. */
export const isTransientFailure = (failure: ProviderFailure): boolean => failure.retryable;

/** Predicate: does this failure reflect a provider health issue that
 *  should count toward the circuit breaker? The dispatch layer uses
 *  this to skip breaker accounting for input-side or configuration
 *  failures that aren't the provider's fault. */
export const isProviderHealthFailure = (failure: ProviderFailure): boolean => failure.countsAgainstBreaker;

/** Predicate: should this failure trigger a fallback route? Per the
 *  cancellation contract, cancellation NEVER falls back; everything
 *  else does when the route policy allows. */
export const shouldFallback = (failure: ProviderFailure): boolean => failure.kind !== "cancelled" && failure.kind !== "not_configured";
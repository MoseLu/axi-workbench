import { z } from "zod";

/**
 * GHA-038 / GHA-039 / GHA-040 — retry, backpressure, cache,
 * coalescing runtime types.
 *
 * These are the runtime decision types the dispatcher uses while a
 * request is in flight. The route policy schema (in routes.ts)
 * declares the configured values; the types in this module declare
 * the in-flight decision (e.g. "this request will be retried after
 * 250ms, attempt 2 of 3"). They are versioned separately from the
 * policy schema because they evolve at different cadences.
 */

export const runtimeContractVersion = 1 as const;

/** Decision returned by the retry/backoff layer after a transient
 *  failure. The dispatcher reads this to decide whether to retry
 *  in-process, defer via setTimeout, or stop. */
export const retryDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("retry"),
    attempt: z.number().int().min(1).max(8),
    delayMs: z.number().int().min(0).max(60_000),
    /** Why this attempt is allowed (transient failure, provider Retry-After, etc). */
    reason: z.string().min(1).max(80),
  }),
  z.object({
    action: z.literal("stop"),
    attempt: z.number().int().min(1).max(8),
    /** Terminal reason: budget exhausted, max attempts reached,
     *  non-idempotent, non-retryable failure, etc. */
    reason: z.string().min(1).max(80),
  }),
]);
export type RetryDecision = z.infer<typeof retryDecisionSchema>;

/** Compute the next retry decision for a given attempt count and
 *  failure. Pure function so the dispatcher and tests stay aligned.
 *  `retryable` comes from the failure envelope; `routeIdempotent`
 *  comes from the route policy; `attempt` is 1-indexed. */
export const decideRetry = (input: {
  attempt: number;
  maxAttempts: number;
  retryable: boolean;
  routeIdempotent: boolean;
  backoffMs: number;
  maxBackoffMs: number;
}): RetryDecision => {
  const nextAttempt = input.attempt + 1;
  if (!input.retryable || !input.routeIdempotent) {
    return { action: "stop", attempt: input.attempt, reason: !input.retryable ? "non_retryable_failure" : "non_idempotent_route" };
  }
  if (nextAttempt > input.maxAttempts) {
    return { action: "stop", attempt: input.attempt, reason: "max_attempts_exceeded" };
  }
  const base = Math.min(input.maxBackoffMs, input.backoffMs * Math.pow(2, input.attempt - 1));
  const delayMs = Math.max(0, Math.min(input.maxBackoffMs, Math.round(base)));
  return { action: "retry", attempt: nextAttempt, delayMs, reason: "transient_failure" };
};

/** Backpressure decision returned by the per-route semaphore. The
 *  dispatcher either runs the call immediately, queues it, or
 *  rejects with a 429/503 envelope. */
export const backpressureDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("proceed"),
    /** Available concurrency slots after this call. */
    remainingSlots: z.number().int().min(0).max(1024),
  }),
  z.object({
    action: z.literal("queue"),
    /** Position in the FIFO queue (1 = next to run). */
    position: z.number().int().min(1).max(1024),
    /** Maximum time this caller will wait before being timed out. */
    queueTimeoutMs: z.number().int().min(0).max(60_000),
  }),
  z.object({
    action: z.literal("reject"),
    /** Suggested Retry-After in milliseconds; clients should honour
     *  this before retrying. */
    retryAfterMs: z.number().int().min(0).max(86_400_000),
    reason: z.enum(["queue_timeout", "queue_full", "shed_strategy"]),
  }),
]);
export type BackpressureDecision = z.infer<typeof backpressureDecisionSchema>;

/** Compute the backpressure decision given the current concurrency,
 *  the queue depth, and the route's backpressure policy. */
export const decideBackpressure = (input: {
  inFlight: number;
  queued: number;
  maxConcurrent: number;
  queueTimeoutMs: number;
}): BackpressureDecision => {
  if (input.inFlight < input.maxConcurrent) {
    return { action: "proceed", remainingSlots: input.maxConcurrent - input.inFlight - 1 };
  }
  if (input.queued >= input.maxConcurrent) {
    return { action: "reject", retryAfterMs: input.queueTimeoutMs, reason: "queue_full" };
  }
  return {
    action: "queue",
    position: input.queued + 1,
    queueTimeoutMs: input.queueTimeoutMs,
  };
};

/** Cache key kinds. The cache filter and the coalescing layer need
 *  to know what scope a key applies to so they don't accidentally
 *  share state across users / intents / config versions. */
export const cacheScopeSchema = z.enum([
  /** Key is scoped to (routeId, payload hash, config version). */
  "route-payload",
  /** Key is scoped to (routeId, requestKey) — caller-supplied
   *  idempotency key, used by the GatewayClient. */
  "request-key",
  /** Key is scoped to (routeId) only — explicit opt-in for routes
   *  whose payload does not affect the response. */
  "route-only",
]);
export type CacheScope = z.infer<typeof cacheScopeSchema>;

/** A versioned cache key. The version field ensures that an old
 *  snapshot's entries don't bleed into a new snapshot. The hash is
 *  computed server-side and never reused across versions. */
export const cacheKeySchema = z.object({
  scope: cacheScopeSchema,
  routeId: z.string().min(1).max(120),
  /** Stable, opaque hash derived from the payload / request key. */
  hash: z.string().min(1).max(120),
  /** Manifest version that produced this key. */
  manifestVersion: z.number().int().min(0).max(1000),
}).strict();
export type CacheKey = z.infer<typeof cacheKeySchema>;

/** Coalescing key. Two concurrent calls with the same coalescing key
 *  share the same in-flight work; cancelling one does NOT cancel the
 *  shared work (per the cancellation contract). */
export const coalescingKeySchema = z.object({
  routeId: z.string().min(1).max(120),
  /** Stable idempotency key. May come from the caller (requestKey)
   *  or be derived from the planner output. */
  idempotencyKey: z.string().min(1).max(120),
  manifestVersion: z.number().int().min(0).max(1000),
}).strict();
export type CoalescingKey = z.infer<typeof coalescingKeySchema>;

/** Coalescing decision: whether to join an existing in-flight call or
 *  start a new one. */
export const coalescingDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("join"),
    /** Number of callers sharing this in-flight call (including this one). */
    shareCount: z.number().int().min(1).max(1024),
  }),
  z.object({
    action: z.literal("start"),
    reason: z.enum(["no_inflight", "different_route", "different_key", "different_version"]),
  }),
  z.object({
    action: z.literal("disabled"),
  }),
]);
export type CoalescingDecision = z.infer<typeof coalescingDecisionSchema>;

/** Compute a coalescing decision. Pure function — the dispatcher
 *  keeps the in-flight map, this function reads it. */
export const decideCoalescing = (input: {
  policy: "idempotency" | "request-key" | "none";
  inFlightForKey: ReadonlyArray<{ routeId: string; key: string; manifestVersion: number }>;
  thisRouteId: string;
  thisKey: string;
  thisManifestVersion: number;
}): CoalescingDecision => {
  if (input.policy === "none") return { action: "disabled" };
  const match = input.inFlightForKey.find((entry) => entry.routeId === input.thisRouteId && entry.key === input.thisKey && entry.manifestVersion === input.thisManifestVersion);
  if (match) return { action: "join", shareCount: input.inFlightForKey.length };
  if (input.inFlightForKey.length === 0) return { action: "start", reason: "no_inflight" };
  const differentRoute = input.inFlightForKey.some((entry) => entry.routeId !== input.thisRouteId);
  if (differentRoute) return { action: "start", reason: "different_route" };
  const differentVersion = input.inFlightForKey.some((entry) => entry.manifestVersion !== input.thisManifestVersion);
  if (differentVersion) return { action: "start", reason: "different_version" };
  return { action: "start", reason: "different_key" };
};

/** Hash a stable string into a 16-hex-digit cache hash. Uses FNV-1a
 *  32-bit so the hash is deterministic and dependency-free. NOT for
 *  cryptographic use. */
export const hashCacheKey = (input: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(2);
};
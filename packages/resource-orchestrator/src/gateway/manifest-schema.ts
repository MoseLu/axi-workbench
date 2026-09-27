import { z } from "zod";
import { builderForPredicateId } from "./predicates";

/**
 * GHA-020 — ProviderManifest Zod schema (manifestVersion=1).
 *
 * The schema is the source of truth for the JSON shape that
 * `apps/gateway/src/providers.manifest.json` and
 * `apps/workbench/src/providers.manifest.json` must satisfy. It is
 * deliberately stricter than the existing TypeScript interfaces in
 * `route.ts` so that hand-edited manifests cannot drift past validation.
 *
 * Parsing rules:
 *   - `manifestVersion` MUST be the literal `1`. A future v2 schema gets
 *     a new field; we do NOT silently coerce here.
 *   - `providers[].id` and `providers[].factory` are required and the
 *     `id` must equal `factory` for self-description. Two providers can
 *     not share the same id.
 *   - `targets[].id` MUST be `<factoryId>.<providerId>` with both halves
 *     non-empty (single dot, no leading/trailing dot).
 *   - `routes[].targetIds` MUST all exist in `targets[].id`.
 *   - `routes[].predicates` MUST all resolve through `builderForPredicateId`.
 *   - `cacheTtlMs` is 0..86_400_000 (24h upper bound); `timeoutMs` is
 *     1..600_000 (10 minutes); `concurrency` is 1..8; `weight` >= 1.
 *   - `healthEndpoint` is optional but must start with "/" or "http(s)://"
 *     when present.
 *   - `fallbackChains[].toolId` must be unique and each chain entry must
 *     exist as a route id.
 *
 * Any failure throws a `z.ZodError` whose `issues[].path` points at the
 * offending node so callers can show a precise error.
 */

const targetIdPattern = /^[^\s.]+\.[^\s.]+$/u;

const healthEndpointSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//iu.test(value),
    { message: "healthEndpoint must start with \"/\" or \"http(s)://\"" },
  );

const loadBalancerStrategySchema = z.enum([
  "round-robin",
  "weighted-round-robin",
  "sticky-by-query",
  "failover-only",
]);

const circuitBreakerConfigSchema = z.object({
  minSamples: z.number().int().min(1),
  errorRateThreshold: z.number().min(0).max(1),
  openMs: z.number().int().min(0),
}).strict();

/** Retry policy for a single route; all fields are optional so
 *  callers can supply only the subset they want to override. */
const retryConfigSchema = z.object({
  // GHA-NEXT-001: maxAttempts must be ≥ 1.  0 would allow a manifest to
  // specify "no attempts" which is indistinguishable from a misconfigured
  // intent that should fail immediately rather than silently succeed.
  maxAttempts: z.number().int().min(1).max(16),
  backoffMs: z.number().int().min(0).max(60_000),
  maxBackoffMs: z.number().int().min(0).max(600_000),
}).strict();

/** Backpressure / concurrency policy for a single route; all fields
 *  are optional so callers can supply only the subset they want to override. */
const backpressureConfigSchema = z.object({
  maxConcurrent: z.number().int().min(1).max(64),
  queueTimeoutMs: z.number().int().min(0).max(120_000),
  // shedStrategy must match runtime BackpressurePolicy.ShedStrategy:
  // "reject" → caller receives a BackpressureTimeoutError immediately;
  // "coalesce" → caller joins the in-flight work and does NOT consume
  // a concurrency slot (backpressure semaphore is NOT incremented until
  // the caller actually enters the adapter call).
  // "queue" is NOT a valid runtime value — it was removed from the
  // schema to prevent a manifest from silently opting into undefined
  // behaviour that the dispatcher would misclassify.
  shedStrategy: z.enum(["reject", "coalesce"]),
}).strict();

const providerSchema = z.object({
  id: z.string().min(1).max(120),
  factory: z.string().min(1).max(120),
}).strict();

const targetSchema = z.object({
  id: z.string().min(1).max(200),
  providerId: z.string().min(1).max(200),
  weight: z.number().int().min(1).max(10_000).optional(),
  fallback: z.boolean().optional(),
  timeoutMs: z.number().int().min(1).max(600_000).optional(),
  healthEndpoint: healthEndpointSchema.optional(),
}).strict();

const predicateIdSchema = z.string().min(1).max(200).superRefine((value, ctx) => {
  if (builderForPredicateId(value) === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `unknown predicate id: ${value}`,
    });
  }
});

const routeSchema = z.object({
  id: z.string().min(1).max(120),
  toolId: z.string().min(1).max(120),
  description: z.string().min(1).max(800),
  predicates: z.array(predicateIdSchema).min(1).max(16),
  targetIds: z.array(z.string().min(1).max(200)).min(1).max(16),
  loadBalancer: loadBalancerStrategySchema.optional(),
  cacheTtlMs: z.number().int().min(0).max(86_400_000).optional(),
  timeoutMs: z.number().int().min(1).max(600_000).optional(),
  concurrency: z.number().int().min(1).max(8).optional(),
  /** Explicit idempotency flag. When absent the gateway derives it from
   *  toolId: resource.generate.* => false, everything else => true. */
  idempotent: z.boolean().optional(),
  /** Explicit retry policy. When absent defaults to { maxAttempts:2, backoffMs:50, maxBackoffMs:500 }. */
  retry: retryConfigSchema.optional(),
  /** Explicit backpressure / concurrency policy. When absent derives from route.concurrency. */
  backpressure: backpressureConfigSchema.optional(),
  circuit: circuitBreakerConfigSchema.optional(),
}).strict();

const fallbackChainSchema = z.object({
  toolId: z.string().min(1).max(120),
  chain: z.array(z.string().min(1).max(120)).min(1).max(16),
}).strict();

export const providerManifestSchema = z.object({
  manifestVersion: z.literal(1),
  providers: z.array(providerSchema).min(1).superRefine((providers, ctx) => {
    const seen = new Set<string>();
    for (const [index, provider] of providers.entries()) {
      if (provider.id !== provider.factory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `provider[${index}].id (${provider.id}) must equal provider[${index}].factory (${provider.factory})`,
          path: [index, "id"],
        });
      }
      if (seen.has(provider.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate provider id: ${provider.id}`,
          path: [index, "id"],
        });
      }
      seen.add(provider.id);
    }
  }),
  targets: z.array(targetSchema).superRefine((targets, ctx) => {
    const seen = new Set<string>();
    for (const [index, target] of targets.entries()) {
      if (!targetIdPattern.test(target.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `target[${index}].id must be "<factoryId>.<providerId>" with both halves non-empty (got "${target.id}")`,
          path: [index, "id"],
        });
      }
      if (seen.has(target.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate target id: ${target.id}`,
          path: [index, "id"],
        });
      }
      seen.add(target.id);
    }
  }),
  routes: z.array(routeSchema).min(1).superRefine((routes, ctx) => {
    const seenRouteIds = new Set<string>();
    const targetIds = new Set<string>();
    for (const route of routes) {
      for (const targetId of route.targetIds) targetIds.add(targetId);
    }
    for (const [index, route] of routes.entries()) {
      if (seenRouteIds.has(route.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate route id: ${route.id}`,
          path: [index, "id"],
        });
      }
      seenRouteIds.add(route.id);
      for (const [targetIndex, targetId] of route.targetIds.entries()) {
        if (!targetIds.has(targetId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `route target id not declared in manifest targets: ${targetId}`,
            path: [index, "targetIds", targetIndex],
          });
        }
      }
    }
  }),
  fallbackChains: z.array(fallbackChainSchema).optional().superRefine((chains, ctx) => {
    if (!chains) return;
    const seenToolIds = new Set<string>();
    for (const [index, entry] of chains.entries()) {
      if (seenToolIds.has(entry.toolId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate fallbackChain toolId: ${entry.toolId}`,
          path: [index, "toolId"],
        });
      }
      seenToolIds.add(entry.toolId);
    }
  }),
}).strict();

export type ProviderManifestInput = z.infer<typeof providerManifestSchema>;

/**
 * Parse a raw JSON value as a ProviderManifest. Throws `z.ZodError` on any
 * shape or rule violation. The error's `issues[].path` identifies the
 * offending node.
 */
export const parseManifest = (raw: unknown): ProviderManifestInput => providerManifestSchema.parse(raw);

/**
 * Validate a raw JSON value as a ProviderManifest. Returns
 * `{ ok: true, manifest }` on success or `{ ok: false, error }` on failure.
 * Never throws.
 */
export const validateManifest = (
  raw: unknown,
): { ok: true; manifest: ProviderManifestInput } | { ok: false; error: z.ZodError } => {
  const result = providerManifestSchema.safeParse(raw);
  if (result.success) return { ok: true, manifest: result.data };
  return { ok: false, error: result.error };
};

/** Re-exported so tests do not need to import zod directly. */
export { loadBalancerStrategySchema, circuitBreakerConfigSchema, retryConfigSchema, backpressureConfigSchema, targetSchema, routeSchema, fallbackChainSchema };

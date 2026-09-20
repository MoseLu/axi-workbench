import { describe, expect, it } from "vitest";
import {
  defaultRoutePolicy,
  fallbackRouteIdForKind,
  primaryRouteIdForKind,
  resourceKindForRouteId,
  resourceKindToRouteId,
  resourceToolIdSchema,
  routeBackpressurePolicySchema,
  routeCachePolicySchema,
  routeCircuitConfigSchema,
  routeCoalescingPolicySchema,
  routeContractVersion,
  routeIdSchema,
  routeLoadBalancerSchema,
  routePolicySchema,
  routePolicySetSchema,
  routeRetryPolicySchema,
  routeTimeoutPolicySchema,
  supportedResourceKindSchema,
} from "./routes";

/**
 * Resource-route contract tests.
 *
 * Every test pins behavior that the dispatcher, manifest validator,
 * and apps/gateway all rely on. A failure here is a contract break
 * that propagates across packages, so the assertions are intentionally
 * strict.
 */

describe("resource-route contract", () => {
  it("pins the route contract version", () => {
    expect(routeContractVersion).toBe(1);
  });

  it("lists the five supported resource kinds", () => {
    const kinds = supportedResourceKindSchema.options;
    expect(kinds).toEqual(["image", "document", "project", "ui", "icon"]);
  });

  it("accepts every supported kind via the kind enum", () => {
    for (const kind of ["image", "document", "project", "ui", "icon"] as const) {
      expect(supportedResourceKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("rejects resource kinds that are not in the closed set", () => {
    expect(supportedResourceKindSchema.safeParse("video").success).toBe(false);
    expect(supportedResourceKindSchema.safeParse("").success).toBe(false);
  });

  it("maps each kind to its canonical primary and fallback route ids", () => {
    expect(primaryRouteIdForKind("image")).toBe("route.image");
    expect(primaryRouteIdForKind("document")).toBe("route.document");
    expect(primaryRouteIdForKind("project")).toBe("route.project");
    expect(primaryRouteIdForKind("ui")).toBe("route.ui");
    expect(primaryRouteIdForKind("icon")).toBe("route.icon");
    expect(fallbackRouteIdForKind("image")).toBe("route.image-fallback");
    expect(fallbackRouteIdForKind("document")).toBe("route.document-fallback");
    expect(fallbackRouteIdForKind("project")).toBe("route.project-fallback");
    expect(fallbackRouteIdForKind("ui")).toBe("route.ui-fallback");
    expect(fallbackRouteIdForKind("icon")).toBe("route.icon-fallback");
    expect(resourceKindToRouteId.image).toBe("route.image");
    expect(resourceKindToRouteId.document).toBe("route.document");
    expect(resourceKindToRouteId.project).toBe("route.project");
    expect(resourceKindToRouteId.ui).toBe("route.ui");
    expect(resourceKindToRouteId.icon).toBe("route.icon");
  });

  it("resolves the resource kind for any known route id", () => {
    expect(resourceKindForRouteId("route.image")).toBe("image");
    expect(resourceKindForRouteId("route.image-fallback")).toBe("image");
    expect(resourceKindForRouteId("route.document")).toBe("document");
    expect(resourceKindForRouteId("route.project")).toBe("project");
    expect(resourceKindForRouteId("route.ui")).toBe("ui");
    expect(resourceKindForRouteId("route.icon")).toBe("icon");
  });

  it("returns null for unknown route ids", () => {
    expect(resourceKindForRouteId("route.video")).toBeNull();
    expect(resourceKindForRouteId("route.image-foo")).toBeNull();
    expect(resourceKindForRouteId("not-a-route")).toBeNull();
  });

  it("accepts canonical tool ids and rejects malformed ones", () => {
    expect(resourceToolIdSchema.safeParse("resource.search.image").success).toBe(true);
    expect(resourceToolIdSchema.safeParse("resource.generate.image").success).toBe(true);
    expect(resourceToolIdSchema.safeParse("resource.search.ui").success).toBe(true);
    expect(resourceToolIdSchema.safeParse("resource.browse.web").success).toBe(false);
    expect(resourceToolIdSchema.safeParse("Resource.search.image").success).toBe(false);
    expect(resourceToolIdSchema.safeParse("resource.search.Image_").success).toBe(false);
  });

  it("accepts canonical route ids and rejects malformed ones", () => {
    expect(routeIdSchema.safeParse("route.image").success).toBe(true);
    expect(routeIdSchema.safeParse("route.image-fallback").success).toBe(true);
    expect(routeIdSchema.safeParse("route.ui").success).toBe(true);
    expect(routeIdSchema.safeParse("route.image-foo").success).toBe(false);
    expect(routeIdSchema.safeParse("Route.image").success).toBe(false);
    expect(routeIdSchema.safeParse("route.video").success).toBe(false);
  });

  it("covers the load balancer strategy enum", () => {
    const expected = ["round-robin", "weighted-round-robin", "sticky-by-query", "failover-only"] as const;
    expect(routeLoadBalancerSchema.options).toEqual([...expected]);
    for (const strategy of expected) {
      expect(routeLoadBalancerSchema.safeParse(strategy).success).toBe(true);
    }
    expect(routeLoadBalancerSchema.safeParse("random").success).toBe(false);
  });

  it("validates the timeout policy", () => {
    const ok = routeTimeoutPolicySchema.safeParse({ firstAttemptMs: 1000, totalBudgetMs: 5000, idempotent: true });
    expect(ok.success).toBe(true);
    const badTotal = routeTimeoutPolicySchema.safeParse({ firstAttemptMs: 1000, totalBudgetMs: 500, idempotent: true });
    expect(badTotal.success).toBe(false);
    const zeroTimeout = routeTimeoutPolicySchema.safeParse({ firstAttemptMs: 0, totalBudgetMs: 0, idempotent: false });
    expect(zeroTimeout.success).toBe(false);
  });

  it("validates the retry policy", () => {
    const ok = routeRetryPolicySchema.safeParse({ maxAttempts: 3, backoffMs: 100, maxBackoffMs: 1000 });
    expect(ok.success).toBe(true);
    const badBackoff = routeRetryPolicySchema.safeParse({ maxAttempts: 3, backoffMs: 1000, maxBackoffMs: 100 });
    expect(badBackoff.success).toBe(false);
    const tooMany = routeRetryPolicySchema.safeParse({ maxAttempts: 100, backoffMs: 1, maxBackoffMs: 1 });
    expect(tooMany.success).toBe(false);
  });

  it("validates the backpressure policy", () => {
    const ok = routeBackpressurePolicySchema.safeParse({ maxConcurrent: 4, queueTimeoutMs: 1000, shedStrategy: "reject" });
    expect(ok.success).toBe(true);
    const zero = routeBackpressurePolicySchema.safeParse({ maxConcurrent: 0, queueTimeoutMs: 0, shedStrategy: "coalesce" });
    expect(zero.success).toBe(false);
    const badStrategy = routeBackpressurePolicySchema.safeParse({ maxConcurrent: 1, queueTimeoutMs: 0, shedStrategy: "drop" });
    expect(badStrategy.success).toBe(false);
  });

  it("validates the cache policy", () => {
    const ok = routeCachePolicySchema.safeParse({ ttlMs: 60000, keyKind: "route-and-payload", negativeTtlMs: 5000, maxEntries: 1024 });
    expect(ok.success).toBe(true);
    const okDisabled = routeCachePolicySchema.safeParse({ ttlMs: 0, keyKind: "route-only", negativeTtlMs: 0, maxEntries: 0 });
    expect(okDisabled.success).toBe(true);
    const badKey = routeCachePolicySchema.safeParse({ ttlMs: 1, keyKind: "global", negativeTtlMs: 0, maxEntries: 0 });
    expect(badKey.success).toBe(false);
  });

  it("validates the coalescing policy", () => {
    for (const kind of ["idempotency", "request-key", "none"] as const) {
      expect(routeCoalescingPolicySchema.safeParse({ keyKind: kind }).success).toBe(true);
    }
    expect(routeCoalescingPolicySchema.safeParse({ keyKind: "random" }).success).toBe(false);
  });

  it("validates the circuit breaker policy", () => {
    const ok = routeCircuitConfigSchema.safeParse({ minSamples: 5, errorRateThreshold: 0.5, openMs: 30000 });
    expect(ok.success).toBe(true);
    expect(routeCircuitConfigSchema.safeParse({ minSamples: 0, errorRateThreshold: 0.5, openMs: 30000 }).success).toBe(false);
    expect(routeCircuitConfigSchema.safeParse({ minSamples: 5, errorRateThreshold: 1.5, openMs: 30000 }).success).toBe(false);
  });

  it("rejects a route policy whose routeId and toolId disagree on the kind", () => {
    const result = routePolicySchema.safeParse({
      ...defaultRoutePolicy("route.image", "image"),
      toolId: "resource.search.document",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete route policy with the agreed kind", () => {
    const policy = defaultRoutePolicy("route.image", "image");
    const result = routePolicySchema.safeParse(policy);
    expect(result.success).toBe(true);
  });

  it("accepts a complete route policy set covering all five kinds", () => {
    const set = {
      contractVersion: routeContractVersion,
      kinds: [
        { kind: "image", primaryRouteId: "route.image", fallbackRouteId: "route.image-fallback" },
        { kind: "document", primaryRouteId: "route.document", fallbackRouteId: "route.document-fallback" },
        { kind: "project", primaryRouteId: "route.project", fallbackRouteId: "route.project-fallback" },
        { kind: "ui", primaryRouteId: "route.ui", fallbackRouteId: "route.ui-fallback" },
        { kind: "icon", primaryRouteId: "route.icon", fallbackRouteId: "route.icon-fallback" },
      ] as const,
      policies: [
        defaultRoutePolicy("route.image", "image"),
        defaultRoutePolicy("route.image-fallback", "image", { loadBalancer: "failover-only" }),
        defaultRoutePolicy("route.document", "document"),
        defaultRoutePolicy("route.document-fallback", "document", { loadBalancer: "failover-only" }),
        defaultRoutePolicy("route.project", "project"),
        defaultRoutePolicy("route.project-fallback", "project", { loadBalancer: "failover-only" }),
        defaultRoutePolicy("route.ui", "ui"),
        defaultRoutePolicy("route.ui-fallback", "ui", { loadBalancer: "failover-only" }),
        defaultRoutePolicy("route.icon", "icon"),
        defaultRoutePolicy("route.icon-fallback", "icon", { loadBalancer: "failover-only" }),
      ],
    };
    const result = routePolicySetSchema.safeParse(set);
    expect(result.success).toBe(true);
  });

  it("rejects a policy set with a missing primary route", () => {
    const set = {
      contractVersion: routeContractVersion,
      kinds: [{ kind: "image", primaryRouteId: "route.image", fallbackRouteId: "route.image-fallback" }],
      policies: [defaultRoutePolicy("route.image-fallback", "image", { loadBalancer: "failover-only" })],
    };
    const result = routePolicySetSchema.safeParse(set);
    expect(result.success).toBe(false);
  });

  it("rejects a policy set whose primaryRouteId does not match the kind", () => {
    const set = {
      contractVersion: routeContractVersion,
      kinds: [{ kind: "document", primaryRouteId: "route.image", fallbackRouteId: "route.document-fallback" }],
      policies: [
        defaultRoutePolicy("route.image", "image"),
        defaultRoutePolicy("route.document-fallback", "document", { loadBalancer: "failover-only" }),
      ],
    };
    const result = routePolicySetSchema.safeParse(set);
    expect(result.success).toBe(false);
  });

  it("rejects a policy set that duplicates route ids", () => {
    const set = {
      contractVersion: routeContractVersion,
      kinds: [{ kind: "image", primaryRouteId: "route.image", fallbackRouteId: "route.image-fallback" }],
      policies: [
        defaultRoutePolicy("route.image", "image"),
        defaultRoutePolicy("route.image", "image", { description: "dupe" }),
        defaultRoutePolicy("route.image-fallback", "image", { loadBalancer: "failover-only" }),
      ],
    };
    const result = routePolicySetSchema.safeParse(set);
    expect(result.success).toBe(false);
  });
});
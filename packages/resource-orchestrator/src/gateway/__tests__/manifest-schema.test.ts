import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseManifest, validateManifest, providerManifestSchema } from "../manifest-schema";

/**
 * GHA-020 — ProviderManifest Zod schema tests.
 * GHA-NEXT-001 — manifest-driven policy field tests.
 *
 * These tests assert every rule documented in
 * `packages/orchestrator/src/gateway/manifest-schema.ts`. The fixture
 * matches the production manifests in apps/gateway and apps/workbench
 * after the route.image fix (search-only target).
 */

const baseManifest = {
  manifestVersion: 1,
  providers: [
    { id: "image-factory", factory: "image-factory" },
    { id: "docs-factory", factory: "docs-factory" },
    { id: "minimax-factory", factory: "minimax-factory" },
    { id: "fixture-factory", factory: "fixture-factory" },
  ],
  targets: [
    { id: "image-factory.axi-image-preview", providerId: "axi-image-preview", weight: 5, timeoutMs: 8000 },
    { id: "image-factory.minimax-tokenplan-image", providerId: "minimax-tokenplan-image", weight: 1, timeoutMs: 180000 },
    { id: "docs-factory.axi-docs", providerId: "axi-docs", weight: 3, timeoutMs: 8000 },
    { id: "minimax-factory.minimax-tokenplan-search", providerId: "minimax-tokenplan-search", weight: 1, timeoutMs: 30000 },
    { id: "docs-factory.axi-workspace-status", providerId: "axi-workspace-status", weight: 1, timeoutMs: 8000 },
    { id: "fixture-factory.fixture-image-preview", providerId: "fixture-image-preview", fallback: true },
    { id: "fixture-factory.fixture-axi-docs", providerId: "fixture-axi-docs", fallback: true },
    { id: "fixture-factory.fixture-workspace", providerId: "fixture-workspace", fallback: true },
  ],
  routes: [
    {
      id: "route.image", toolId: "resource.search.image", description: "本地图库图片搜索",
      predicates: ["by-resource-kind-image"],
      targetIds: ["image-factory.axi-image-preview"],
      loadBalancer: "weighted-round-robin", concurrency: 2, cacheTtlMs: 60000,
    },
    {
      id: "route.image-fallback", toolId: "resource.search.image", description: "本地图片 provider 不可用时降级",
      predicates: ["by-resource-kind-image"],
      targetIds: ["fixture-factory.fixture-image-preview"],
      loadBalancer: "failover-only",
    },
    {
      id: "route.skill", toolId: "resource.search.skill", description: "Axi Skills 工作流检索",
      predicates: ["by-resource-kind-skill"],
      targetIds: ["docs-factory.axi-docs"], cacheTtlMs: 60000,
    },
    {
      id: "route.skill-fallback", toolId: "resource.search.skill", description: "Axi Skills 不可用时降级",
      predicates: ["by-resource-kind-skill"],
      targetIds: ["fixture-factory.fixture-axi-docs"],
    },
    {
      id: "route.document", toolId: "resource.search.document", description: "Axi Docs 文档检索",
      predicates: ["by-resource-kind-document"],
      targetIds: ["docs-factory.axi-docs"], cacheTtlMs: 60000,
    },
    {
      id: "route.document-fallback", toolId: "resource.search.document", description: "Axi Docs 不可用时降级",
      predicates: ["by-resource-kind-document"],
      targetIds: ["fixture-factory.fixture-axi-docs"],
    },
    {
      id: "route.web", toolId: "resource.search.web", description: "MiniMax 全网搜索",
      predicates: ["by-resource-kind-web"],
      targetIds: ["minimax-factory.minimax-tokenplan-search"], timeoutMs: 30000,
    },
    {
      id: "route.workspace", toolId: "resource.search.workspace", description: "Axi 工作区状态",
      predicates: ["by-resource-kind-workspace"],
      targetIds: ["docs-factory.axi-workspace-status"],
    },
    {
      id: "route.generate-image", toolId: "resource.generate.image", description: "MiniMax 图片生成",
      predicates: ["by-resource-kind-image"],
      targetIds: ["image-factory.minimax-tokenplan-image"], timeoutMs: 180000,
    },
  ],
  fallbackChains: [
    { toolId: "resource.search.image", chain: ["route.image-fallback"] },
    { toolId: "resource.search.skill", chain: ["route.skill-fallback"] },
    { toolId: "resource.search.document", chain: ["route.document-fallback"] },
  ],
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const expectFailure = (input: unknown, predicate: (issues: z.ZodIssue[]) => boolean) => {
  const result = providerManifestSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(predicate(result.error.issues)).toBe(true);
};

describe("manifest-schema: GHA-020", () => {
  it("accepts the production-shaped manifest", () => {
    expect(() => parseManifest(clone(baseManifest))).not.toThrow();
    const result = validateManifest(clone(baseManifest));
    expect(result.ok).toBe(true);
  });

  it("rejects unknown manifestVersion", () => {
    expectFailure({ ...clone(baseManifest), manifestVersion: 2 }, (issues) =>
      issues.some((issue) => issue.path.includes("manifestVersion")),
    );
  });

  it("rejects empty providers", () => {
    expectFailure({ ...clone(baseManifest), providers: [] }, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path[0] === "providers"),
    );
  });

  it("rejects empty routes", () => {
    expectFailure({ ...clone(baseManifest), routes: [] }, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path[0] === "routes"),
    );
  });

  it("rejects duplicate provider ids", () => {
    const bad = clone(baseManifest);
    bad.providers[1].id = "image-factory";
    expectFailure(bad, (issues) =>
      issues.some((issue) => issue.code === "custom" && /duplicate provider id/.test(issue.message)),
    );
  });

  it("rejects provider whose factory does not match id", () => {
    const bad = clone(baseManifest);
    bad.providers[0] = { id: "image-factory", factory: "different-factory" };
    expectFailure(bad, (issues) =>
      issues.some((issue) => /must equal provider\[0\]\.factory/.test(issue.message)),
    );
  });

  it("rejects duplicate route ids", () => {
    const bad = clone(baseManifest);
    bad.routes[1].id = "route.image";
    expectFailure(bad, (issues) =>
      issues.some((issue) => /duplicate route id/.test(issue.message)),
    );
  });

  it("accepts two routes sharing a toolId when one is the primary and the other is the fallback", () => {
    // route.image and route.image-fallback intentionally share
    // toolId="resource.search.image" so the gateway can chain a fallback
    // route when the primary one fails. toolId uniqueness is enforced
    // semantically (one primary per toolId) by validateManifestSemantics,
    // not at the Zod layer.
    const good = clone(baseManifest);
    good.routes[1].toolId = good.routes[0].toolId;
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("rejects duplicate fallbackChain.toolId", () => {
    const bad = clone(baseManifest);
    bad.fallbackChains = [
      { toolId: "resource.search.image", chain: ["route.image-fallback"] },
      { toolId: "resource.search.image", chain: ["route.skill-fallback"] },
    ];
    expectFailure(bad, (issues) =>
      issues.some((issue) => /duplicate fallbackChain toolId/.test(issue.message)),
    );
  });

  it("rejects unknown predicate id", () => {
    const bad = clone(baseManifest);
    bad.routes[0].predicates = ["by-resource-kind-unknown"];
    expectFailure(bad, (issues) =>
      issues.some((issue) => /unknown predicate id/.test(issue.message)),
    );
  });

  it("rejects target.id missing the dot", () => {
    const bad = clone(baseManifest);
    bad.targets[0].id = "image-factory-axi-image-preview";
    expectFailure(bad, (issues) =>
      issues.some((issue) => /must be "<factoryId>\.<providerId>"/.test(issue.message)),
    );
  });

  it("rejects target.id with trailing dot", () => {
    const bad = clone(baseManifest);
    bad.targets[0].id = "image-factory.";
    expectFailure(bad, (issues) =>
      issues.some((issue) => /must be "<factoryId>\.<providerId>"/.test(issue.message)),
    );
  });

  it("rejects target.id with leading dot", () => {
    const bad = clone(baseManifest);
    bad.targets[0].id = ".axi-image-preview";
    expectFailure(bad, (issues) =>
      issues.some((issue) => /must be "<factoryId>\.<providerId>"/.test(issue.message)),
    );
  });

  it("rejects unknown loadBalancer strategy", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { loadBalancer: string }).loadBalancer = "magic";
    expectFailure(bad, (issues) =>
      issues.some((issue) => /loadBalancer/i.test(issue.message) || issue.code === "invalid_enum_value"),
    );
  });

  it("rejects timeoutMs=0 on a target", () => {
    const bad = clone(baseManifest);
    (bad.targets[0] as unknown as { timeoutMs: number }).timeoutMs = 0;
    expectFailure(bad, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path.includes("timeoutMs")),
    );
  });

  it("rejects negative timeoutMs on a target", () => {
    const bad = clone(baseManifest);
    (bad.targets[0] as unknown as { timeoutMs: number }).timeoutMs = -1;
    expectFailure(bad, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path.includes("timeoutMs")),
    );
  });

  it("rejects timeoutMs above the 600_000 cap", () => {
    const bad = clone(baseManifest);
    (bad.targets[0] as unknown as { timeoutMs: number }).timeoutMs = 600_001;
    expectFailure(bad, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path.includes("timeoutMs")),
    );
  });

  it("rejects negative cacheTtlMs", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { cacheTtlMs: number }).cacheTtlMs = -1;
    expectFailure(bad, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path.includes("cacheTtlMs")),
    );
  });

  it("rejects concurrency outside 1..8", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { concurrency: number }).concurrency = 9;
    expectFailure(bad, (issues) =>
      issues.some((issue) => Array.isArray(issue.path) && issue.path.includes("concurrency")),
    );
  });

  it("rejects healthEndpoint that is neither a path nor an http(s) url", () => {
    const bad = clone(baseManifest);
    (bad.targets[0] as unknown as { healthEndpoint: string }).healthEndpoint = "ftp://nope";
    expectFailure(bad, (issues) =>
      issues.some((issue) => /healthEndpoint must start/.test(issue.message)),
    );
  });

  it("accepts healthEndpoint as http(s) url", () => {
    const good = clone(baseManifest);
    (good.targets[0] as unknown as { healthEndpoint: string }).healthEndpoint = "https://example.com/health";
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("accepts healthEndpoint as a path", () => {
    const good = clone(baseManifest);
    (good.targets[0] as unknown as { healthEndpoint: string }).healthEndpoint = "/healthz";
    expect(() => parseManifest(good)).not.toThrow();
  });
});

describe("manifest-schema: GHA-NEXT-001 — explicit policy fields", () => {
  it("accepts route with idempotent=true (search-style route)", () => {
    const good = clone(baseManifest);
    (good.routes[0] as unknown as { idempotent: boolean }).idempotent = true;
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("accepts route with idempotent=false (generate-style route)", () => {
    const good = clone(baseManifest);
    (good.routes[0] as unknown as { idempotent: boolean }).idempotent = false;
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("accepts route with full retry policy", () => {
    const good = clone(baseManifest);
    (good.routes[0] as unknown as { retry: object }).retry = {
      maxAttempts: 3,
      backoffMs: 100,
      maxBackoffMs: 2000,
    };
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("rejects retry.maxAttempts below 1 (GHA-NEXT-001 anti-example: 0 means 'no attempts' which is a silent failure)", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { retry: object }).retry = {
      maxAttempts: 0,
      backoffMs: 50,
      maxBackoffMs: 500,
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("retry") &&
        issue.path.includes("maxAttempts"),
      ),
    );
  });

  it("rejects retry.maxAttempts below 0", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { retry: object }).retry = {
      maxAttempts: -1,
      backoffMs: 50,
      maxBackoffMs: 500,
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("retry") &&
        issue.path.includes("maxAttempts"),
      ),
    );
  });

  it("rejects retry.maxAttempts above 16", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { retry: object }).retry = {
      maxAttempts: 17,
      backoffMs: 50,
      maxBackoffMs: 500,
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("retry") &&
        issue.path.includes("maxAttempts"),
      ),
    );
  });

  it("rejects retry.backoffMs above 60_000", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { retry: object }).retry = {
      maxAttempts: 2,
      backoffMs: 60_001,
      maxBackoffMs: 500,
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("retry") &&
        issue.path.includes("backoffMs"),
      ),
    );
  });

  it("accepts route with full backpressure policy", () => {
    const good = clone(baseManifest);
    (good.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 4,
      queueTimeoutMs: 2000,
      shedStrategy: "reject",
    };
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("accepts backpressure with shedStrategy=coalesce", () => {
    const good = clone(baseManifest);
    (good.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 3,
      queueTimeoutMs: 500,
      shedStrategy: "coalesce",
    };
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("rejects backpressure.maxConcurrent below 1", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 0,
      queueTimeoutMs: 1000,
      shedStrategy: "reject",
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("backpressure") &&
        issue.path.includes("maxConcurrent"),
      ),
    );
  });

  it("rejects backpressure.maxConcurrent above 64", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 65,
      queueTimeoutMs: 1000,
      shedStrategy: "reject",
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("backpressure") &&
        issue.path.includes("maxConcurrent"),
      ),
    );
  });

  it("rejects backpressure.queueTimeoutMs above 120_000", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 2,
      queueTimeoutMs: 120_001,
      shedStrategy: "reject",
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("backpressure") &&
        issue.path.includes("queueTimeoutMs"),
      ),
    );
  });

  it("rejects unknown shedStrategy value (including 'queue')", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 2,
      queueTimeoutMs: 1000,
      shedStrategy: "drop",
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("shedStrategy") &&
        (issue.code === "invalid_enum_value" || /shedStrategy/i.test(issue.message || "")),
      ),
    );
    // Also verify "queue" is rejected (it was present in a pre-fix schema
    // but does not exist in the runtime BackpressurePolicy.ShedStrategy type).
    const badQueue = clone(baseManifest);
    (badQueue.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 2,
      queueTimeoutMs: 1000,
      shedStrategy: "queue",
    };
    expectFailure(badQueue, (issues) =>
      issues.some((issue) =>
        Array.isArray(issue.path) &&
        issue.path.includes("shedStrategy") &&
        (issue.code === "invalid_enum_value" || /shedStrategy/i.test(issue.message || "")),
      ),
    );
  });

  it("accepts route with retry + backpressure + idempotent all present", () => {
    const good = clone(baseManifest);
    (good.routes[0] as unknown as { idempotent: boolean; retry: object; backpressure: object }).idempotent = true;
    (good.routes[0] as unknown as { idempotent: boolean; retry: object; backpressure: object }).retry = {
      maxAttempts: 3,
      backoffMs: 100,
      maxBackoffMs: 2000,
    };
    (good.routes[0] as unknown as { idempotent: boolean; retry: object; backpressure: object }).backpressure = {
      maxConcurrent: 4,
      queueTimeoutMs: 3000,
      shedStrategy: "coalesce",
    };
    expect(() => parseManifest(good)).not.toThrow();
    const result = validateManifest(good);
    expect(result.ok).toBe(true);
  });

  it("accepts route with no explicit policy fields (backward-compat default)", () => {
    // Omitting idempotent / retry / backpressure must not throw.
    const good = clone(baseManifest);
    const route = good.routes[0] as Record<string, unknown>;
    delete route.idempotent;
    delete route.retry;
    delete route.backpressure;
    expect(() => parseManifest(good)).not.toThrow();
  });

  it("rejects unknown top-level key in retry object", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { retry: object }).retry = {
      maxAttempts: 2,
      backoffMs: 50,
      maxBackoffMs: 500,
      unknownField: 123,
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) => issue.code === "unrecognized_keys"),
    );
  });

  it("rejects unknown top-level key in backpressure object", () => {
    const bad = clone(baseManifest);
    (bad.routes[0] as unknown as { backpressure: object }).backpressure = {
      maxConcurrent: 2,
      queueTimeoutMs: 1000,
      shedStrategy: "reject",
      extraKey: true,
    };
    expectFailure(bad, (issues) =>
      issues.some((issue) => issue.code === "unrecognized_keys"),
    );
  });
});

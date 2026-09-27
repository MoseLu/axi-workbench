import { describe, expect, it } from "vitest";
import type { AdapterSearchResult, ResourceAdapter } from "@axi/gateway-contracts";
import { ProviderRegistry } from "../provider-registry";
import { validateManifestSemantics, validateTargetCapabilities, formatIssues } from "../manifest-validator";
import type { ManifestRoute, ManifestTarget, ProviderManifest } from "../route";

/**
 * GHA-021 + GHA-022 — manifest-validator tests.
 *
 * These tests cover the semantic reachability check (GHA-021) and the
 * per-target capability check (GHA-022). They use hand-built
 * `ProviderManifest` literals so the test names read like assertions.
 */

const baseManifest = {
  providers: [
    { id: "image-factory", factory: "image-factory" },
    { id: "docs-factory", factory: "docs-factory" },
    { id: "fixture-factory", factory: "fixture-factory" },
  ],
  targets: [
    { id: "image-factory.axi-image-preview", providerId: "axi-image-preview" } as ManifestTarget,
    { id: "image-factory.minimax-tokenplan-image", providerId: "minimax-tokenplan-image" } as ManifestTarget,
    { id: "docs-factory.axi-docs", providerId: "axi-docs" } as ManifestTarget,
    { id: "fixture-factory.fixture-image-preview", providerId: "fixture-image-preview", fallback: true } as ManifestTarget,
  ],
  routes: [
    {
      id: "route.image", toolId: "resource.search.image", description: "本地图库图片搜索",
      predicates: ["by-resource-kind-image"],
      targetIds: ["image-factory.axi-image-preview"],
    } as ManifestRoute,
    {
      id: "route.image-fallback", toolId: "resource.search.image", description: "本地图片 provider 不可用时降级",
      predicates: ["by-resource-kind-image"],
      targetIds: ["fixture-factory.fixture-image-preview"],
    } as ManifestRoute,
    {
      id: "route.skill", toolId: "resource.search.skill", description: "Axi Skills 工作流检索",
      predicates: ["by-resource-kind-skill"],
      targetIds: ["docs-factory.axi-docs"],
    } as ManifestRoute,
    {
      id: "route.generate-image", toolId: "resource.generate.image", description: "MiniMax 图片生成",
      predicates: ["by-resource-kind-image"],
      targetIds: ["image-factory.minimax-tokenplan-image"],
    } as ManifestRoute,
  ],
  fallbackChains: [
    { toolId: "resource.search.image", chain: ["route.image-fallback"] },
  ],
} as ProviderManifest;

const knownFactoryNames = ["image-factory", "docs-factory", "fixture-factory"];

type MutableManifest = {
  -readonly [K in keyof ProviderManifest]: ProviderManifest[K] extends ReadonlyArray<infer Inner>
    ? Inner extends object
      ? Array<{ -readonly [P in keyof Inner]: Inner[P] }>
      : ProviderManifest[K]
    : ProviderManifest[K];
};

const clone = (manifest: ProviderManifest): MutableManifest => JSON.parse(JSON.stringify(manifest)) as MutableManifest;

describe("validateManifestSemantics: GHA-021", () => {
  const pass = (manifest: ProviderManifest) => validateManifestSemantics(manifest, { knownFactoryNames });

  it("accepts a clean manifest", () => {
    expect(pass(clone(baseManifest))).toEqual([]);
  });

  it("reports route.targetId that is not declared in targets", () => {
    const bad = clone(baseManifest);
    bad.routes[0] = { ...bad.routes[0], targetIds: ["image-factory.axi-image-preview", "image-factory.unknown-target"] };
    const issues = pass(bad as ProviderManifest);
    expect(issues.some((issue) => issue.code === "route-target-not-declared"
      && issue.message.includes("unknown-target"))).toBe(true);
    const issue = issues.find((entry) => entry.code === "route-target-not-declared");
    expect(issue?.path).toEqual(expect.arrayContaining(["routes", 0, "targetIds"]));
  });

  it("reports fallbackChain entries that do not exist as route ids", () => {
    const bad = clone(baseManifest);
    bad.fallbackChains = [{ toolId: "resource.search.image", chain: ["route.missing"] }];
    const issues = pass(bad as ProviderManifest);
    expect(issues.some((issue) => issue.code === "fallback-route-not-declared"
      && issue.message.includes("route.missing"))).toBe(true);
  });

  it("reports provider.factory that does not match any known factory", () => {
    const bad = clone(baseManifest);
    bad.providers = [{ id: "image-factory", factory: "ghost-factory" }, ...bad.providers.slice(1)];
    const issues = pass(bad as ProviderManifest);
    expect(issues.some((issue) => issue.code === "unknown-provider-factory"
      && issue.message.includes("ghost-factory"))).toBe(true);
  });

  it("reports target whose factory prefix is not declared in providers", () => {
    const bad = clone(baseManifest);
    bad.targets = [{ id: "ghost-factory.axi-image-preview", providerId: "axi-image-preview" }, ...bad.targets.slice(1)];
    const issues = pass(bad as ProviderManifest);
    expect(issues.some((issue) => issue.code === "target-factory-not-declared"
      && issue.message.includes("ghost-factory"))).toBe(true);
  });

  it("reports fallback chain whose toolId has no primary route", () => {
    const bad = clone(baseManifest);
    bad.fallbackChains = [{ toolId: "resource.search.document", chain: ["route.image-fallback"] }];
    const issues = pass(bad as ProviderManifest);
    expect(issues.some((issue) => issue.code === "fallback-without-primary")).toBe(true);
  });
});

const makeAdapter = (descriptor: ResourceAdapter["descriptor"]): ResourceAdapter => ({
  descriptor,
  search: async (): Promise<AdapterSearchResult> => ({
    items: [], sourceVersion: "test", confidence: "high", mode: "live",
  }),
});

const buildRegistry = (manifest: ProviderManifest): ProviderRegistry => {
  const registry = new ProviderRegistry({ freezeOnBuild: true });
  registry.registerFactory("image-factory", () => [
    makeAdapter({ id: "axi-image-preview", label: "Axi Image Preview", resourceKinds: ["image"], capabilities: ["search", "preview"] }),
    makeAdapter({ id: "minimax-tokenplan-image", label: "MiniMax Image", resourceKinds: ["image"], capabilities: ["preview"], toolId: "resource.generate.image" }),
  ]);
  registry.registerFactory("docs-factory", () => [
    makeAdapter({ id: "axi-docs", label: "Axi Docs", resourceKinds: ["skill", "document"], capabilities: ["search", "preview"] }),
  ]);
  registry.registerFactory("fixture-factory", () => [
    makeAdapter({ id: "fixture-image-preview", label: "Fixture Image", resourceKinds: ["image"], capabilities: ["search", "preview"] }),
  ]);
  registry.buildFromManifest(manifest);
  return registry;
};

describe("validateTargetCapabilities: GHA-022", () => {
  it("accepts the production manifest after the route.image fix", () => {
    const registry = buildRegistry(baseManifest);
    const issues = validateTargetCapabilities(registry, baseManifest);
    expect(issues).toEqual([]);
  });

  it("rejects when a route target adapter does not declare the route's capability", () => {
    const manifest = clone(baseManifest);
    const registry = new ProviderRegistry({ freezeOnBuild: true });
    registry.registerFactory("image-factory", () => [
      makeAdapter({ id: "axi-image-preview", label: "Axi Image Preview", resourceKinds: ["image"], capabilities: ["preview"] }),
      makeAdapter({ id: "minimax-tokenplan-image", label: "MiniMax Image", resourceKinds: ["image"], capabilities: ["preview"], toolId: "resource.generate.image" }),
    ]);
    registry.registerFactory("docs-factory", () => [
      makeAdapter({ id: "axi-docs", label: "Axi Docs", resourceKinds: ["skill", "document"], capabilities: ["search", "preview"] }),
    ]);
    registry.registerFactory("fixture-factory", () => [
      makeAdapter({ id: "fixture-image-preview", label: "Fixture Image", resourceKinds: ["image"], capabilities: ["search", "preview"] }),
    ]);
    registry.buildFromManifest(manifest as ProviderManifest);
    const issues = validateTargetCapabilities(registry, manifest as ProviderManifest);
    expect(issues.some((issue) => issue.code === "target-capability-mismatch"
      && issue.message.includes('requires "search"'))).toBe(true);
  });

  it("rejects when target.descriptor.toolId differs from route.toolId", () => {
    const manifest = clone(baseManifest);
    const registry = new ProviderRegistry({ freezeOnBuild: true });
    registry.registerFactory("image-factory", () => [
      makeAdapter({ id: "axi-image-preview", label: "Axi Image Preview", resourceKinds: ["image"], capabilities: ["search", "preview"] }),
      makeAdapter({ id: "minimax-tokenplan-image", label: "MiniMax Image", resourceKinds: ["image"], capabilities: ["preview"], toolId: "resource.generate.image" }),
    ]);
    registry.registerFactory("docs-factory", () => [
      makeAdapter({ id: "axi-docs", label: "Axi Docs", resourceKinds: ["skill", "document"], capabilities: ["search", "preview"], toolId: "resource.search.document" }),
    ]);
    registry.registerFactory("fixture-factory", () => [
      makeAdapter({ id: "fixture-image-preview", label: "Fixture Image", resourceKinds: ["image"], capabilities: ["search", "preview"] }),
    ]);
    registry.buildFromManifest(manifest as ProviderManifest);
    const issues = validateTargetCapabilities(registry, manifest as ProviderManifest);
    expect(issues.some((issue) => issue.code === "target-toolid-mismatch")).toBe(true);
  });

  it("rejects when a route's toolId does not map to a known capability", () => {
    const manifest = clone(baseManifest);
    manifest.routes[0] = { ...manifest.routes[0], toolId: "resource.banana.image" };
    const registry = buildRegistry(manifest as ProviderManifest);
    const issues = validateTargetCapabilities(registry, manifest as ProviderManifest);
    expect(issues.some((issue) => issue.code === "route-toolid-unknown")).toBe(true);
  });
});

describe("formatIssues", () => {
  it("returns (no issues) for an empty list", () => {
    expect(formatIssues([])).toBe("(no issues)");
  });

  it("renders each issue on its own line with path and code", () => {
    const formatted = formatIssues([
      { code: "route-target-not-declared", path: ["routes", 0, "targetIds", 1], message: "oops" },
      { code: "fallback-route-not-declared", path: ["fallbackChains", 0, "chain", 0], message: "nope" },
    ]);
    expect(formatted).toContain("routes.0.targetIds.1: [route-target-not-declared] oops");
    expect(formatted).toContain("fallbackChains.0.chain.0: [fallback-route-not-declared] nope");
  });
});

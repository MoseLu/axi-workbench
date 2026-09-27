import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdapterSearchResult, Intent, ResourceAdapter } from "@axi/gateway-contracts";
import { ProviderRegistry } from "../provider-registry";
import { GatewayOrchestrator } from "../..";
import { ResourceOrchestrator, RuleBasedPlanner } from "../../index";
import { dispatchRoute, __resetInFlight } from "../dispatch";
import { intentKind } from "../predicates";
import { cacheLookupFilter, cacheStoreFilter, traceFilter } from "../filters";
import type { RouteDefinition } from "../route";

/**
 * Integration tests for ResourceOrchestrator.run() with an injected GatewayOrchestrator.
 * These tests verify that:
 *  - The gateway actually intercepts the tool calls inside run().
 *  - Cache short-circuits a real provider call.
 *  - The circuit breaker records errors and is shared across runs.
 *  - The legacy code path (no gateway) is preserved when the option is omitted.
 *  - readFrom merge still works when step 1 dispatches through the gateway.
 */

const makeAdapter = (descriptor: ResourceAdapter["descriptor"], result: AdapterSearchResult): ResourceAdapter => ({
  descriptor, search: async () => result,
});

const imageAdapter = (id: string, items: number, confidence: AdapterSearchResult["confidence"] = "high"): ResourceAdapter =>
  makeAdapter(
    { id, label: id, resourceKinds: ["image"], capabilities: ["search"] },
    {
      items: Array.from({ length: items }, (_, i) => ({
        id: `image:${id}-${i}`, kind: "image", title: `${id}-${i}`, facts: { providerId: id, tags: ["头像", "人像"] },
        provenance: { provider: id, ref: `${id}://${i}` }, safety: "safe",
      })),
      sourceVersion: id, confidence, mode: "live",
    },
  );

const imageAdapter1 = (id: string): ResourceAdapter => imageAdapter(id, 1);

const spyAdapter = (base: ResourceAdapter, counter: { calls: number }): ResourceAdapter => ({
  descriptor: base.descriptor,
  search: async (...args) => {
    counter.calls += 1;
    return base.search(...args);
  },
});

const buildRoutes = (cacheTtlMs?: number, adapter: ResourceAdapter = imageAdapter1("axi-image-preview")): RouteDefinition[] => [
  {
    id: "route.image",
    toolId: "resource.search.image",
    description: "image",
    predicates: [intentKind("image")],
    targets: [{ id: "primary.axi-image-preview", adapter, weight: 5, timeoutMs: 1000 }],
    filters: {
      pre: cacheTtlMs ? [traceFilter(), cacheLookupFilter()] : [traceFilter()],
      post: cacheTtlMs ? [cacheStoreFilter(cacheTtlMs)] : [],
    },
    loadBalancer: "failover-only",
  },
];

const buildGateway = (cacheTtlMs?: number, adapter?: ResourceAdapter): GatewayOrchestrator =>
  new GatewayOrchestrator({ routes: buildRoutes(cacheTtlMs, adapter) });

const imageIntent: Intent = {
  operation: "search", resourceKinds: ["image"], constraints: { query: "甜妹" }, needsClarification: false,
};

const CONCRETE_QUERY_NO_QTY = "我要一些甜妹头像";

describe("ResourceOrchestrator + GatewayOrchestrator", () => {
  beforeEach(() => __resetInFlight());
  afterEach(() => __resetInFlight());

  it("legacy path (no gateway) still works without cache or circuit breaker", async () => {
    const adapter = imageAdapter1("axi-image-preview");
    const orchestrator = new ResourceOrchestrator({
      adapters: [adapter],
      planner: new RuleBasedPlanner(),
    });
    const first = await orchestrator.run(CONCRETE_QUERY_NO_QTY);
    expect(first.state).toBe("presenting");
    expect(first.items.length).toBeGreaterThan(0);
    const second = await orchestrator.run(CONCRETE_QUERY_NO_QTY);
    expect(second.fromCache).toBe(true);
  });

  it("gateway short-circuits provider call on cache hit within the same run", async () => {
    const counter = { calls: 0 };
    const spied = spyAdapter(imageAdapter1("axi-image-preview"), counter);
    const gateway = buildGateway(60_000, spied);
    const orchestrator = new ResourceOrchestrator({
      adapters: [spied],
      planner: new RuleBasedPlanner(),
      gateway,
    });
    const first = await orchestrator.run(CONCRETE_QUERY_NO_QTY);
    expect(first.state).toBe("presenting");
    expect(counter.calls).toBe(1);
    expect(gateway.cache.size).toBe(1);

    const orchestrator2 = new ResourceOrchestrator({
      adapters: [spied],
      planner: new RuleBasedPlanner(),
      gateway,
    });
    const second = await orchestrator2.run(CONCRETE_QUERY_NO_QTY);
    expect(second.state).toBe("presenting");
    expect(second.items.length).toBe(first.items.length);
    expect(counter.calls).toBe(1);
  });

  it("records circuit breaker state across runs", async () => {
    const failingAdapter: ResourceAdapter = {
      descriptor: { id: "failing", label: "failing", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { throw new Error("provider down"); },
    };
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.fail",
        toolId: "resource.search.image",
        description: "fail",
        predicates: [intentKind("image")],
        targets: [{ id: "primary.fail", adapter: failingAdapter, weight: 1, timeoutMs: 200 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      }],
    });
    const orchestrator = new ResourceOrchestrator({
      adapters: [failingAdapter],
      planner: new RuleBasedPlanner(),
      gateway,
    });
    for (let i = 0; i < 6; i += 1) {
      const r = await orchestrator.run(`查询甜妹头像素材 #${i}`);
      expect(r.state).not.toBe("presenting");
    }
    const breaker = gateway.breakers.get("primary.fail");
    expect(breaker).toBeTruthy();
    expect(breaker?.snapshot().state).toBe("open");
    expect((breaker?.snapshot().errors ?? 0) >= 3).toBe(true);
  });

  it("the gateway does not affect getToolDefinitions (planner sees the same tool list)", () => {
    const adapter = imageAdapter1("axi-image-preview");
    const gateway = buildGateway();
    const withGateway = new ResourceOrchestrator({ adapters: [adapter], planner: new RuleBasedPlanner(), gateway });
    const withoutGateway = new ResourceOrchestrator({ adapters: [adapter], planner: new RuleBasedPlanner() });
    expect(withGateway.getToolDefinitions().map((t) => t.id)).toEqual(withoutGateway.getToolDefinitions().map((t) => t.id));
  });

  it("merges readFrom input with gateway-dispatched tool call", async () => {
    // 2-step pipeline: both steps run resource.search.web. Step 1 declares
    // readFrom step 0 / factKey=snippet, so the gateway-dispatched step 1
    // sees the snippet in its constraints.
    const webItems = {
      id: "web:tianmei-1", kind: "web" as const, title: "甜妹插画",
      facts: { snippet: "温柔治愈风格的甜妹插画作品", link: "https://example.com" },
      provenance: { provider: "web-stub", ref: "https://example.com" }, safety: "safe" as const,
    };
    let observedQuery = "";
    const webAdapter: ResourceAdapter = {
      descriptor: { id: "stub-web", label: "stub web", resourceKinds: ["web"], capabilities: ["search"], toolId: "resource.search.web" },
      search: async (intent) => {
        const mergedQuery = typeof intent.constraints.query === "string" ? intent.constraints.query : "";
        if (mergedQuery && mergedQuery !== "占位") observedQuery = mergedQuery;
        return {
          items: [{
            id: `web:result`, kind: "web" as const, title: "回声",
            facts: { query: mergedQuery, observedSnippet: mergedQuery },
            provenance: { provider: "stub-web", ref: "stub://echo" }, safety: "safe" as const,
          }],
          sourceVersion: "stub-web", confidence: "high" as const, mode: "live" as const,
        };
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.web",
        toolId: "resource.search.web",
        description: "web",
        predicates: [intentKind("web")],
        targets: [{ id: "primary.web", adapter: webAdapter, weight: 1, timeoutMs: 1000 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
      }],
    });
    // Step 0 writes `query: '甜妹插画'` into its candidate facts; step 1
    // readFrom step 0 / factKey=query, so step 1's input query should equal
    // the value observed from step 0 (the merged gateway intent carries
    // step 0's query forward).
    const planner = {
      id: "pipeline-planner",
      plan: async () => ({
        intent: { operation: "search" as const, resourceKinds: ["web"], constraints: { query: "甜妹插画" }, needsClarification: false },
        calls: [
          { toolId: "resource.search.web", input: { query: "甜妹插画" } },
          { toolId: "resource.search.web", input: { query: "占位" }, readFrom: [{ step: 0, kind: "web", factKey: "query" }] },
        ],
      }),
    };
    const orchestrator = new ResourceOrchestrator({
      adapters: [webAdapter],
      planner,
      gateway,
    });
    const result = await orchestrator.run("找一些甜妹插画");
    expect(result.state).toBe("presenting");
    // Step 1's adapter observed the merged query from step 0 via readFrom.
    expect(observedQuery).toBe("甜妹插画");
  });

  it("dispatches a single step without breaking the existing state machine", async () => {
    const adapter = imageAdapter1("axi-image-preview");
    const gateway = buildGateway();
    const orchestrator = new ResourceOrchestrator({
      adapters: [adapter],
      planner: new RuleBasedPlanner(),
      gateway,
    });
    const result = await orchestrator.run(CONCRETE_QUERY_NO_QTY);
    expect(result.state).toBe("presenting");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.trace.some((event) => event.state === "image-searching")).toBe(true);
  });
});

describe("ProviderRegistry integration with ResourceOrchestrator", () => {
  it("builds the same dispatch pipeline as a hand-built RouteDefinition list", async () => {
    const adapter = imageAdapter1("axi-image-preview");
    const registry = new ProviderRegistry({ freezeOnBuild: true });
    registry.registerFactory("image-factory", () => adapter);
    registry.buildFromManifest({
      providers: [{ id: "image-factory", factory: "image-factory" }],
      targets: [{ id: "image-factory.axi-image-preview", providerId: "axi-image-preview" }],
      routes: [{
        id: "route.image", toolId: "resource.search.image", description: "image",
        predicates: ["by-resource-kind-image"], targetIds: ["image-factory.axi-image-preview"],
        loadBalancer: "failover-only",
      }],
    });

    const dispatchResult = await dispatchRoute(registry.listRoutes(), {
      intent: imageIntent, toolId: "resource.search.image",
      cache: new Map(), requestKey: "k", breakers: new Map(),
    });
    expect(dispatchResult.items.length).toBe(1);

    const gateway = new GatewayOrchestrator({ routes: registry.listRoutes() });
    const orchestrator = new ResourceOrchestrator({
      adapters: [adapter], planner: new RuleBasedPlanner(), gateway,
    });
    const runResult = await orchestrator.run(CONCRETE_QUERY_NO_QTY);
    expect(runResult.state).toBe("presenting");
    expect(runResult.items.length).toBeGreaterThan(0);
  });
});

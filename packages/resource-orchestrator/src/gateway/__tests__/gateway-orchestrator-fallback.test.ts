import { describe, expect, it } from "vitest";
import type { ResourceAdapter } from "@axi/gateway-contracts";
import { GatewayOrchestrator } from "../index";
import { intentKind } from "../predicates";

const intent = {
  operation: "search" as const,
  resourceKinds: ["image"],
  constraints: { query: "avatar" },
  needsClarification: false,
};

const result = (provider: string) => ({
  items: [{
    id: `${provider}:avatar`,
    kind: "image" as const,
    title: provider,
    facts: {},
    provenance: { provider, ref: `${provider}://avatar` },
    safety: "safe" as const,
  }],
  sourceVersion: `${provider}:v1`,
  confidence: "high" as const,
  mode: "fixture" as const,
});

describe("GatewayOrchestrator manifest fallback chains", () => {
  it("uses the declared fallback route after the primary target is exhausted", async () => {
    let fallbackCalls = 0;
    const primary: ResourceAdapter = {
      descriptor: { id: "primary", label: "primary", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => { throw new Error("provider unavailable"); },
    };
    const fallback: ResourceAdapter = {
      descriptor: { id: "fallback", label: "fallback", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        fallbackCalls += 1;
        return result("fixture");
      },
    };

    const gateway = new GatewayOrchestrator({
      routes: [
        {
          id: "route.image",
          toolId: "resource.search.image",
          description: "primary image route",
          predicates: [intentKind("image")],
          targets: [{ id: "primary", adapter: primary, weight: 1, timeoutMs: 100 }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
        },
        {
          id: "route.image-fallback",
          toolId: "resource.search.image",
          description: "fixture fallback",
          predicates: [intentKind("image")],
          targets: [{ id: "fallback", adapter: fallback, weight: 1, timeoutMs: 100 }],
          filters: { pre: [], post: [] },
          loadBalancer: "failover-only",
        },
      ],
      fallbackChains: [{ toolId: "resource.search.image", chain: ["route.image-fallback"] }],
    });

    const dispatched = await gateway.dispatch({
      intent,
      toolId: "resource.search.image",
      requestKey: "fallback-smoke",
    });

    expect(dispatched.items).toEqual(result("fixture").items);
    expect(dispatched.warnings?.some((warning) => warning.includes("primary"))).toBe(true);
    expect(fallbackCalls).toBe(1);
  });

  it("shares one backpressure registry across dispatches on the same gateway", async () => {
    let active = 0;
    let maxActive = 0;
    const slow: ResourceAdapter = {
      descriptor: { id: "slow", label: "slow", resourceKinds: ["image"], capabilities: ["search"] },
      search: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return result("slow");
      },
    };
    const gateway = new GatewayOrchestrator({
      routes: [{
        id: "route.image",
        toolId: "resource.search.image",
        description: "single target",
        predicates: [intentKind("image")],
        targets: [{ id: "slow", adapter: slow, weight: 1, timeoutMs: 100 }],
        filters: { pre: [], post: [] },
        loadBalancer: "failover-only",
        concurrency: 1,
      }],
    });

    await Promise.all(["one", "two"].map((requestKey) => gateway.dispatch({
      intent,
      toolId: "resource.search.image",
      requestKey,
    })));

    expect(maxActive).toBe(1);
  });
});

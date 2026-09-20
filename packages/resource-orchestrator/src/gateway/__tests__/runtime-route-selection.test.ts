import { describe, expect, it } from "vitest";
import type { Intent } from "@axi/gateway-contracts";
import type { RouteDefinition, Predicate, Target } from "../route";
import { intentKind, alwaysTrue, expression } from "../predicates";
import { rankRoutes, selectBestRoute, selectFallbackChain } from "../runtime/route-selection";

const dummyTarget = (id: string): Target => ({
  id, adapter: { descriptor: { id, label: id, resourceKinds: ["image"], capabilities: ["search"] }, search: async () => ({ items: [], sourceVersion: "v", confidence: "low", mode: "fixture" as const }) },
  weight: 1, timeoutMs: 1000,
});

const route = (id: string, toolId: string, predicates: Predicate[], targets: Target[] = [dummyTarget("t")]): RouteDefinition => ({
  id, toolId, description: id, predicates, targets, filters: { pre: [], post: [] }, loadBalancer: "failover-only",
});

const imageIntent: Intent = { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false };

describe("selectBestRoute", () => {
  it("picks the route whose predicates all match the intent", () => {
    const a = route("a", "resource.search.image", [intentKind("image")]);
    const b = route("b", "resource.search.image", [intentKind("skill")]);
    expect(selectBestRoute([a, b], "resource.search.image", imageIntent)?.id).toBe("a");
  });

  it("is deterministic when multiple routes match — highest score wins", () => {
    const generic = route("generic", "resource.search.image", [intentKind("image")]);
    const specific = route("specific", "resource.search.image", [intentKind("image"), expression((i) => i.constraints.tag === "wallpaper", "tag-wallpaper")]);
    const intent: Intent = { operation: "search", resourceKinds: ["image"], constraints: { tag: "wallpaper" }, needsClarification: false };
    expect(selectBestRoute([generic, specific], "resource.search.image", intent)?.id).toBe("specific");
    expect(selectBestRoute([specific, generic], "resource.search.image", intent)?.id).toBe("specific");
  });

  it("tie-breaks lexicographically by route id when specificity ties", () => {
    const a = route("alpha", "resource.search.image", [intentKind("image")]);
    const b = route("beta", "resource.search.image", [intentKind("image")]);
    expect(selectBestRoute([a, b], "resource.search.image", imageIntent)?.id).toBe("alpha");
    expect(selectBestRoute([b, a], "resource.search.image", imageIntent)?.id).toBe("alpha");
  });

  it("returns undefined when no route matches the toolId", () => {
    const a = route("a", "resource.search.image", [intentKind("image")]);
    expect(selectBestRoute([a], "resource.search.skill", imageIntent)).toBeUndefined();
  });

  it("returns undefined when predicates don't match", () => {
    const a = route("a", "resource.search.image", [intentKind("skill")]);
    expect(selectBestRoute([a], "resource.search.image", imageIntent)).toBeUndefined();
  });
});

describe("selectFallbackChain", () => {
  it("preserves declared order and skips routes whose toolId differs", () => {
    const primary = route("primary", "resource.search.image", [alwaysTrue()]);
    const chainA = route("chain-a", "resource.search.image", [alwaysTrue()]);
    const chainB = route("chain-b", "resource.search.image", [alwaysTrue()]);
    const other = route("other", "resource.search.skill", [alwaysTrue()]);
    const chain = selectFallbackChain([primary, chainA, chainB, other], "resource.search.image", ["chain-a", "missing", "other", "chain-b"]);
    expect(chain.map((r) => r.id)).toEqual(["chain-a", "chain-b"]);
  });

  it("collapses duplicate ids to a single entry", () => {
    const a = route("a", "resource.search.image", [alwaysTrue()]);
    const b = route("b", "resource.search.image", [alwaysTrue()]);
    const chain = selectFallbackChain([a, b], "resource.search.image", ["a", "a", "b"]);
    expect(chain.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array when no route in the chain matches the toolId", () => {
    const a = route("a", "resource.search.image", [alwaysTrue()]);
    const chain = selectFallbackChain([a], "resource.search.image", ["missing"]);
    expect(chain).toEqual([]);
  });
});

describe("rankRoutes", () => {
  it("returns matching routes in deterministic rank order", () => {
    const a = route("alpha", "resource.search.image", [intentKind("image")]);
    const b = route("bravo", "resource.search.image", [intentKind("image"), intentKind("image")]);
    const ranks = rankRoutes([b, a], "resource.search.image", imageIntent);
    expect(ranks.map((r) => r.route.id)).toEqual(["bravo", "alpha"]);
  });
});
import { describe, expect, it } from "vitest";
import { buildCacheKey, VersionedCache } from "../runtime/cache";
import type { Intent, AdapterSearchResult } from "@axi/gateway-contracts";

const intent = (q: string): Intent => ({
  operation: "search",
  resourceKinds: ["image"],
  constraints: { query: q },
  needsClarification: false,
});

const result = (id: string): AdapterSearchResult => ({
  items: [{ id, kind: "image", title: id, facts: {}, provenance: { provider: "p", ref: "r" }, safety: "safe" }],
  sourceVersion: "v", confidence: "high", mode: "live",
});

const empty: AdapterSearchResult = {
  items: [], sourceVersion: "v", confidence: "low", mode: "fixture",
};

describe("buildCacheKey", () => {
  it("hashes identical intents identically", () => {
    const a = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    const b = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    expect(a.hash).toBe(b.hash);
  });

  it("produces different hashes for different queries", () => {
    const a = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    const b = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("wallpaper"), requestKey: "req-1" });
    expect(a.hash).not.toBe(b.hash);
  });

  it("scopes by manifestVersion so a snapshot bump invalidates the key", () => {
    const a = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    const b = buildCacheKey({ routeId: "r.image", manifestVersion: 2, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    expect(a.manifestVersion).not.toBe(b.manifestVersion);
    expect(a.hash).not.toBe(b.hash);
  });

  it("ignores payload when scope === route-only", () => {
    const a = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-only", intent: intent("avatar"), requestKey: "req-1" });
    const b = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-only", intent: intent("wallpaper"), requestKey: "req-1" });
    expect(a.hash).toBe(b.hash);
  });

  it("uses only the requestKey when scope === request-key", () => {
    const a = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "request-key", intent: intent("avatar"), requestKey: "req-1" });
    const b = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "request-key", intent: intent("wallpaper"), requestKey: "req-1" });
    expect(a.hash).toBe(b.hash);
  });
});

describe("VersionedCache", () => {
  it("stores and retrieves an entry within the TTL", () => {
    const cache = new VersionedCache();
    cache.configure("r.image", 100);
    const key = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    cache.set(key, result("a"), { ttlMs: 5_000, negativeTtlMs: 100 });
    expect(cache.get(key)?.result.items[0].id).toBe("a");
  });

  it("drops expired entries on read", () => {
    const cache = new VersionedCache();
    cache.configure("r.image", 100);
    const key = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    cache.set(key, result("a"), { ttlMs: 5_000, negativeTtlMs: 100 });
    const future = Date.now() + 10_000;
    expect(cache.get(key, future)).toBeUndefined();
  });

  it("uses negativeTtlMs when the result has zero items", () => {
    const cache = new VersionedCache();
    cache.configure("r.image", 100);
    const key = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    cache.set(key, empty, { ttlMs: 60_000, negativeTtlMs: 1_000 });
    const entry = cache.get(key, Date.now() + 30_000);
    expect(entry).toBeUndefined(); // expired because negativeTtlMs kicked in
  });

  it("skips storage when ttlMs === 0", () => {
    const cache = new VersionedCache();
    cache.configure("r.image", 100);
    const key = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    cache.set(key, result("a"), { ttlMs: 0, negativeTtlMs: 0 });
    expect(cache.size()).toBe(0);
  });

  it("evicts oldest entries when maxEntries is reached", () => {
    const cache = new VersionedCache();
    cache.configure("r.image", 2);
    for (const q of ["a", "b", "c"]) {
      const key = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent(q), requestKey: q });
      cache.set(key, result(q), { ttlMs: 60_000, negativeTtlMs: 0 });
    }
    expect(cache.size()).toBe(2);
  });

  it("never serves an entry from a previous manifestVersion", () => {
    const cache = new VersionedCache();
    cache.configure("r.image", 100);
    const oldKey = buildCacheKey({ routeId: "r.image", manifestVersion: 1, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    cache.set(oldKey, result("old"), { ttlMs: 60_000, negativeTtlMs: 0 });
    const newKey = buildCacheKey({ routeId: "r.image", manifestVersion: 2, scope: "route-payload", intent: intent("avatar"), requestKey: "req-1" });
    expect(cache.get(newKey)).toBeUndefined();
  });
});
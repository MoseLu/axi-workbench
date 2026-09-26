import { describe, it, expect, vi, beforeEach } from "vitest";
import { VersionedCache } from "./cache.js";
import type { CacheKey } from "@axi/gateway-contracts";
import type { CacheEntry } from "../route.js";
import type { AdapterSearchResult } from "@axi/gateway-contracts";

describe("VersionedCache", () => {
  let cache: VersionedCache;

  const makeKey = (
    routeId = "route-1",
    manifestVersion = 1,
    scope: "route-payload" | "route-only" | "request-key" = "route-payload",
    hash = "hash-abc"
  ): CacheKey => ({
    routeId,
    manifestVersion,
    scope,
    hash,
  });

  const makeResult = (result = "test-result"): AdapterSearchResult => ({
    items: [{ id: "item-1", preview: result, kind: "test", title: "Test", provenance: { provider: "test", ref: "test" }, safety: "safe", facts: {} }],
    totalItems: 1,
    sourceVersion: "test",
    confidence: "high",
    mode: "live",
  });

  beforeEach(() => {
    cache = new VersionedCache();
  });

  describe("constructor", () => {
    it("creates empty cache", () => {
      expect(cache.size()).toBe(0);
    });
  });

  describe("get", () => {
    it("returns undefined for missing key", () => {
      expect(cache.get(makeKey())).toBeUndefined();
    });

    it("returns entry for existing key", () => {
      const key = makeKey();
      cache.set(key, makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      expect(cache.get(key)).toBeDefined();
    });

    it("returns undefined for expired entry", () => {
      const key = makeKey();
      const past = Date.now() - 10000;
      cache.set(key, makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 }, past);
      expect(cache.get(key)).toBeUndefined();
    });
  });

  describe("set", () => {
    it("stores entry at key", () => {
      const key = makeKey();
      cache.set(key, makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      expect(cache.size()).toBe(1);
    });

    it("ignores entry when ttlMs is 0", () => {
      const key = makeKey();
      cache.set(key, makeResult(), { ttlMs: 0, negativeTtlMs: 0 });
      expect(cache.size()).toBe(0);
    });

    it("respects maxEntries via configure", () => {
      const limitedCache = new VersionedCache();
      limitedCache.configure("route-a", 2);
      
      limitedCache.set(makeKey("route-a", 1, "route-payload", "a"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      limitedCache.set(makeKey("route-a", 1, "route-payload", "b"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      limitedCache.set(makeKey("route-a", 1, "route-payload", "c"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      
      expect(limitedCache.size()).toBeLessThanOrEqual(2);
    });
  });

  describe("clear", () => {
    it("clears all entries", () => {
      cache.set(makeKey("a"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      cache.set(makeKey("b"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe("size", () => {
    it("returns 0 for empty cache", () => {
      expect(cache.size()).toBe(0);
    });

    it("returns correct count", () => {
      cache.set(makeKey("a"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      cache.set(makeKey("b"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      expect(cache.size()).toBe(2);
    });
  });

  describe("asMap", () => {
    it("returns snapshot of entries", () => {
      cache.set(makeKey("a"), makeResult("a"), { ttlMs: 5000, negativeTtlMs: 1000 });
      cache.set(makeKey("b"), makeResult("b"), { ttlMs: 5000, negativeTtlMs: 1000 });
      
      const map = cache.asMap();
      expect(map.size).toBe(2);
    });
  });

  describe("entries", () => {
    it("returns iterator of all entries", () => {
      cache.set(makeKey("a"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      cache.set(makeKey("b"), makeResult(), { ttlMs: 5000, negativeTtlMs: 1000 });
      
      const entries = Array.from(cache.entries());
      expect(entries.length).toBe(2);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CoalescingRegistry,
  type CoalescingKeyKind,
  type CoalescingPolicy,
} from "./coalesce.js";
import type { CoalescingKey, AdapterSearchResult } from "@axi/gateway-contracts";

describe("CoalescingRegistry", () => {
  let registry: CoalescingRegistry;

  const makeKey = (routeId = "route-1", idempotencyKey = "key-1", manifestVersion = 1): CoalescingKey => ({
    routeId,
    idempotencyKey,
    manifestVersion,
  });

  const makePolicy = (keyKind: "idempotency" | "request-key" | "none" = "idempotency"): CoalescingPolicy => ({
    keyKind,
  });

  const makeResult = (value: string): AdapterSearchResult => ({
    items: [],
    sourceVersion: "test",
    confidence: "high",
    mode: "live",
  });

  beforeEach(() => {
    registry = new CoalescingRegistry();
  });

  describe("constructor", () => {
    it("creates empty registry", () => {
      expect(registry).toBeDefined();
      expect(registry.shareCount(makeKey())).toBe(0);
    });
  });

  describe("decide", () => {
    it("returns 'start' when no in-flight requests", () => {
      const decision = registry.decide({
        policy: makePolicy("idempotency"),
        routeId: "route-1",
        idempotencyKey: "key-1",
        manifestVersion: 1,
      });
      expect(decision.action).toBe("start");
    });

    it("returns 'start' for different idempotency key", () => {
      const decision = registry.decide({
        policy: makePolicy("idempotency"),
        routeId: "route-1",
        idempotencyKey: "key-2",
        manifestVersion: 1,
      });
      expect(decision.action).toBe("start");
    });

    it("returns 'disabled' when policy is 'none'", () => {
      const decision = registry.decide({
        policy: makePolicy("none"),
        routeId: "route-1",
        idempotencyKey: "key-1",
        manifestVersion: 1,
      });
      expect(decision.action).toBe("disabled");
    });
  });

  describe("register", () => {
    it("registers a new in-flight request via factory", async () => {
      const key = makeKey();
      const factory = async () => makeResult("result");

      const result = await registry.register(key, factory);
      expect(result.items).toEqual([]);
    });

    it("returns same promise for duplicate key", async () => {
      const key = makeKey();

      const factory = async () => makeResult("result");

      const p1 = registry.register(key, factory);
      const p2 = registry.register(key, factory);

      expect(p1).toBe(p2);
    });

    it("treats different idempotency keys as separate", async () => {
      const key1 = makeKey("route", "key-a");
      const key2 = makeKey("route", "key-b");

      const r1 = registry.register(key1, async () => makeResult("a"));
      const r2 = registry.register(key2, async () => makeResult("b"));

      expect(await r1).not.toBe(await r2);
    });

    it("treats different route ids as separate", async () => {
      const key1 = makeKey("route-a");
      const key2 = makeKey("route-b");

      const r1 = registry.register(key1, async () => makeResult("a"));
      const r2 = registry.register(key2, async () => makeResult("b"));

      expect(await r1).not.toBe(await r2);
    });

    it("treats different manifest versions as separate", async () => {
      const key1 = makeKey("route", "key", 1);
      const key2 = makeKey("route", "key", 2);

      const r1 = registry.register(key1, async () => makeResult("v1"));
      const r2 = registry.register(key2, async () => makeResult("v2"));

      expect(await r1).not.toBe(await r2);
    });
  });

  describe("join", () => {
    it("returns undefined when no matching in-flight request", () => {
      expect(registry.join(makeKey())).toBeUndefined();
    });
  });

  describe("shareCount", () => {
    it("returns 0 for unknown key", () => {
      expect(registry.shareCount(makeKey())).toBe(0);
    });

    it("returns count after register", async () => {
      const key = makeKey();
      await registry.register(key, async () => makeResult("result"));
      expect(typeof registry.shareCount(key)).toBe("number");
    });
  });

  describe("reset", () => {
    it("clears all registrations", async () => {
      registry.register(makeKey("a"), async () => makeResult("a"));
      registry.register(makeKey("b"), async () => makeResult("b"));

      registry.reset();

      expect(registry.shareCount(makeKey("a"))).toBe(0);
      expect(registry.shareCount(makeKey("b"))).toBe(0);
    });
  });
});

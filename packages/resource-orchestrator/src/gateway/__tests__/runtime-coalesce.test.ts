import { describe, expect, it } from "vitest";
import { CoalescingRegistry } from "../runtime/coalesce";
import type { AdapterSearchResult } from "@axi/gateway-contracts";

const stub = (id: string): AdapterSearchResult => ({
  items: [{ id, kind: "image", title: id, facts: {}, provenance: { provider: "p", ref: "r" }, safety: "safe" }],
  sourceVersion: "v", confidence: "high", mode: "live",
});

describe("CoalescingRegistry", () => {
  it("returns disabled when policy.keyKind === none", () => {
    const reg = new CoalescingRegistry();
    const decision = reg.decide({ policy: { keyKind: "none" }, routeId: "r", idempotencyKey: "k", manifestVersion: 1 });
    expect(decision.action).toBe("disabled");
  });

  it("returns start when no in-flight call shares the key", () => {
    const reg = new CoalescingRegistry();
    const decision = reg.decide({ policy: { keyKind: "idempotency" }, routeId: "r", idempotencyKey: "k", manifestVersion: 1 });
    expect(decision.action).toBe("start");
    if (decision.action === "start") {
      expect(decision.reason).toBe("no_inflight");
    }
  });

  it("returns join when an in-flight call matches routeId + key + manifestVersion", async () => {
    const reg = new CoalescingRegistry();
    let calls = 0;
    const promise = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return stub("first");
    });
    const second = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => stub("second"));
    expect(calls).toBe(1);
    const [a, b] = await Promise.all([promise, second]);
    expect(a).toBe(b);
    expect(b.items[0].id).toBe("first");
  });

  it("returns start with different_key when the key differs", async () => {
    const reg = new CoalescingRegistry();
    const inFlight = reg.register({ routeId: "r", idempotencyKey: "k1", manifestVersion: 1 }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return stub("first");
    });
    const decision = reg.decide({ policy: { keyKind: "idempotency" }, routeId: "r", idempotencyKey: "k2", manifestVersion: 1 });
    expect(decision.action).toBe("start");
    if (decision.action === "start") {
      expect(decision.reason).toBe("different_key");
    }
    await inFlight;
  });

  it("returns start with different_route when the route differs", async () => {
    const reg = new CoalescingRegistry();
    const inFlight = reg.register({ routeId: "r1", idempotencyKey: "k", manifestVersion: 1 }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return stub("first");
    });
    const decision = reg.decide({ policy: { keyKind: "idempotency" }, routeId: "r2", idempotencyKey: "k", manifestVersion: 1 });
    expect(decision.action).toBe("start");
    if (decision.action === "start") {
      expect(decision.reason).toBe("different_route");
    }
    await inFlight;
  });

  it("returns start with different_version when manifestVersion differs", async () => {
    const reg = new CoalescingRegistry();
    const inFlight = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return stub("first");
    });
    const decision = reg.decide({ policy: { keyKind: "idempotency" }, routeId: "r", idempotencyKey: "k", manifestVersion: 2 });
    expect(decision.action).toBe("start");
    if (decision.action === "start") {
      expect(decision.reason).toBe("different_version");
    }
    await inFlight;
  });

  it("tracks shareCount across concurrent callers", async () => {
    const reg = new CoalescingRegistry();
    const promise = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return stub("shared");
    });
    const second = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => stub("other"));
    expect(reg.shareCount({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 })).toBe(2);
    await Promise.all([promise, second]);
    expect(reg.shareCount({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 })).toBe(0);
  });

  it("reset() clears every in-flight call", async () => {
    const reg = new CoalescingRegistry();
    const promise = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return stub("first");
    });
    reg.reset();
    const after = reg.register({ routeId: "r", idempotencyKey: "k", manifestVersion: 1 }, async () => stub("fresh"));
    await Promise.all([promise, after]);
  });
});
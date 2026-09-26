import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BackpressureRegistry,
  BackpressureTimeoutError,
  type BackpressurePolicy,
} from "./backpressure.js";

describe("BackpressureRegistry", () => {
  let registry: BackpressureRegistry;

  const defaultPolicy: BackpressurePolicy = {
    maxConcurrent: 4,
    queueTimeoutMs: 1000,
    shedStrategy: "reject",
  };

  beforeEach(() => {
    registry = new BackpressureRegistry();
  });

  describe("constructor", () => {
    it("creates empty registry", () => {
      const snap = registry.snapshot("test-route");
      expect(snap.inFlight).toBe(0);
      expect(snap.queued).toBe(0);
    });
  });

  describe("acquire", () => {
    it("acquires slot when under limit", async () => {
      const slot = await registry.acquire("test-route", defaultPolicy);
      expect(typeof slot.release).toBe("function");
      const snap = registry.snapshot("test-route");
      expect(snap.inFlight).toBe(1);
    });

    it("allows up to maxConcurrent concurrent acquisitions", async () => {
      const slots: Array<{ release: () => void }> = [];
      for (let i = 0; i < defaultPolicy.maxConcurrent; i++) {
        const slot = await registry.acquire("test-route", defaultPolicy);
        slots.push(slot);
      }
      const snap = registry.snapshot("test-route");
      expect(snap.inFlight).toBe(defaultPolicy.maxConcurrent);
      expect(snap.queued).toBe(0);
      slots.forEach((s) => s.release());
    });

    it("queues request when at limit", async () => {
      const slots: Array<{ release: () => void }> = [];
      for (let i = 0; i < defaultPolicy.maxConcurrent; i++) {
        const slot = await registry.acquire("test-route", defaultPolicy);
        slots.push(slot);
      }
      const queuePromise = registry.acquire("test-route", defaultPolicy);
      const snap = registry.snapshot("test-route");
      expect(snap.queued).toBe(1);
      slots[0].release();
      await queuePromise;
      slots.forEach((s) => s.release());
    });

    it("rejects when queue timeout expires", async () => {
      const shortTimeoutPolicy: BackpressurePolicy = {
        maxConcurrent: 1,
        queueTimeoutMs: 50,
        shedStrategy: "reject",
      };
      const slot = await registry.acquire("test-route", shortTimeoutPolicy);
      await expect(
        registry.acquire("test-route", shortTimeoutPolicy)
      ).rejects.toThrow(BackpressureTimeoutError);
      slot.release();
    });

    it("isolates different routes", async () => {
      const slot1 = await registry.acquire("route-a", defaultPolicy);
      const slot2 = await registry.acquire("route-b", defaultPolicy);
      expect(registry.snapshot("route-a").inFlight).toBe(1);
      expect(registry.snapshot("route-b").inFlight).toBe(1);
      slot1.release();
      expect(registry.snapshot("route-a").inFlight).toBe(0);
      expect(registry.snapshot("route-b").inFlight).toBe(1);
      slot2.release();
    });

    it("releases slot via callback", async () => {
      const slot = await registry.acquire("test-route", defaultPolicy);
      expect(registry.snapshot("test-route").inFlight).toBe(1);
      slot.release();
      expect(registry.snapshot("test-route").inFlight).toBe(0);
    });

    it("handles release idempotently", async () => {
      const slot = await registry.acquire("test-route", defaultPolicy);
      slot.release();
      slot.release();
      expect(registry.snapshot("test-route").inFlight).toBe(0);
    });
  });

  describe("snapshot", () => {
    it("returns zeros for unknown route", () => {
      const snap = registry.snapshot("unknown-route");
      expect(snap.inFlight).toBe(0);
      expect(snap.queued).toBe(0);
    });

    it("returns correct stats after acquire", async () => {
      const slot = await registry.acquire("test-route", defaultPolicy);
      const snap = registry.snapshot("test-route");
      expect(snap.inFlight).toBe(1);
      expect(snap.queued).toBe(0);
      slot.release();
    });
  });
});

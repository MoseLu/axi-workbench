import { afterEach, describe, expect, it, vi } from "vitest";
import { BackpressureRegistry, BackpressureTimeoutError, decisionFromError } from "../runtime/backpressure";

const policy = { maxConcurrent: 2, queueTimeoutMs: 100, shedStrategy: "reject" as const };

describe("BackpressureRegistry", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("admits callers up to maxConcurrent", async () => {
    const reg = new BackpressureRegistry();
    const a = await reg.acquire("r", policy);
    const b = await reg.acquire("r", policy);
    expect(reg.snapshot("r").inFlight).toBe(2);
    a.release();
    b.release();
    expect(reg.snapshot("r").inFlight).toBe(0);
  });

  it("queues callers when at capacity and drains in FIFO order", async () => {
    vi.useFakeTimers();
    const reg = new BackpressureRegistry();
    const a = await reg.acquire("r", policy);
    const b = await reg.acquire("r", policy);
    let thirdResolved = false;
    const third = reg.acquire("r", policy).then((slot) => { thirdResolved = true; return slot; });
    expect(reg.snapshot("r").queued).toBe(1);
    a.release();
    b.release();
    const slot = await third;
    expect(thirdResolved).toBe(true);
    slot.release();
  });

  it("rejects with queue_timeout when queueTimeoutMs elapses", async () => {
    vi.useFakeTimers();
    const reg = new BackpressureRegistry();
    const a = await reg.acquire("r", policy);
    const b = await reg.acquire("r", policy);
    const third = reg.acquire("r", policy);
    vi.advanceTimersByTime(150);
    await expect(third).rejects.toBeInstanceOf(BackpressureTimeoutError);
    a.release();
    b.release();
  });

  it("rejects immediately when the queue is at capacity", async () => {
    const tight = { maxConcurrent: 1, queueTimeoutMs: 1000, shedStrategy: "reject" as const };
    const reg = new BackpressureRegistry();
    const a = await reg.acquire("r", tight);
    const queued = reg.acquire("r", tight); // position 1 (queue)
    const overflow = reg.acquire("r", tight); // queue full -> reject
    await expect(overflow).rejects.toThrow(/queue[ _]full/);
    a.release();
    await queued;
  });

  it("aborts a queued caller when the signal fires", async () => {
    vi.useFakeTimers();
    const reg = new BackpressureRegistry();
    const a = await reg.acquire("r", policy);
    const b = await reg.acquire("r", policy);
    const ctrl = new AbortController();
    const third = reg.acquire("r", policy, ctrl.signal);
    setTimeout(() => ctrl.abort(new Error("client-cancelled")), 5);
    vi.advanceTimersByTime(10);
    await expect(third).rejects.toThrow("client-cancelled");
    a.release();
    b.release();
  });

  it("decisionFromError reads the rejection reason", async () => {
    const reg = new BackpressureRegistry();
    const tight = { maxConcurrent: 1, queueTimeoutMs: 1000, shedStrategy: "reject" as const };
    const a = await reg.acquire("r", tight);
    const queued = reg.acquire("r", tight);
    try {
      await reg.acquire("r", tight);
      throw new Error("expected reject");
    } catch (error) {
      const decision = decisionFromError(error);
      expect(decision?.action).toBe("reject");
      if (decision?.action === "reject") {
        expect(decision.reason).toBe("queue_full");
      }
    }
    a.release();
    await queued;
  });
});
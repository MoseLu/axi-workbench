import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker — half-open single probe (GHA-035)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("admits only the first caller while half-open and blocks the rest", () => {
    let now = 0;
    const b = new CircuitBreaker({ minSamples: 2, errorRateThreshold: 0.5, openMs: 100 }, () => now);
    b.record(false);
    b.record(false);
    expect(b.canPass()).toBe(false);
    now = 200;
    // First caller after cooldown enters half-open as the probe.
    expect(b.canPass()).toBe(true);
    expect(b.snapshot().state).toBe("half-open");
    expect(b.snapshot().probeInFlight).toBe(true);
    // Subsequent callers block while the probe is in flight.
    expect(b.canPass()).toBe(false);
    expect(b.canPass()).toBe(false);
  });

  it("releases the half-open gate once the probe resolves (success → closed)", () => {
    let now = 0;
    const b = new CircuitBreaker({ minSamples: 2, errorRateThreshold: 0.5, openMs: 100 }, () => now);
    b.record(false);
    b.record(false);
    now = 200;
    expect(b.canPass()).toBe(true);
    b.record(true);
    expect(b.snapshot().state).toBe("closed");
    // Gate released: any caller may pass while closed.
    expect(b.canPass()).toBe(true);
  });

  it("re-opens and releases the gate when the probe fails", () => {
    let now = 0;
    const b = new CircuitBreaker({ minSamples: 2, errorRateThreshold: 0.5, openMs: 100 }, () => now);
    b.record(false);
    b.record(false);
    now = 200;
    expect(b.canPass()).toBe(true);
    b.record(false);
    expect(b.snapshot().state).toBe("open");
    // After a failed probe, gate is released but state is open — canPass
    // will only re-enter half-open once openMs elapses again.
    now = 250;
    expect(b.canPass()).toBe(false);
    now = 400;
    expect(b.canPass()).toBe(true);
  });

  it("prevents a thundering herd from re-opening instantly", () => {
    let now = 0;
    const b = new CircuitBreaker({ minSamples: 2, errorRateThreshold: 0.5, openMs: 100 }, () => now);
    b.record(false);
    b.record(false);
    now = 200;
    // The first caller is the probe.
    expect(b.canPass()).toBe(true);
    // All other callers block while the probe is in flight.
    for (let i = 0; i < 10; i += 1) {
      expect(b.canPass()).toBe(false);
    }
    b.record(false); // probe fails
    expect(b.snapshot().state).toBe("open");
  });
});
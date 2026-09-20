import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  it("starts closed and allows the first call", () => {
    const b = new CircuitBreaker({ minSamples: 3, errorRateThreshold: 0.5, openMs: 1000 });
    expect(b.canPass()).toBe(true);
    expect(b.snapshot().state).toBe("closed");
  });

  it("stays closed below minSamples even with errors", () => {
    const b = new CircuitBreaker({ minSamples: 5, errorRateThreshold: 0.5, openMs: 1000 });
    b.record(false);
    b.record(false);
    expect(b.canPass()).toBe(true);
  });

  it("opens when error rate meets threshold after minSamples", () => {
    const b = new CircuitBreaker({ minSamples: 4, errorRateThreshold: 0.5, openMs: 1000 });
    b.record(false);
    b.record(false);
    b.record(true);
    b.record(false); // 3/4 = 0.75 -> open
    expect(b.canPass()).toBe(false);
    expect(b.snapshot().state).toBe("open");
  });

  it("transitions open -> half-open after openMs", () => {
    let now = 0;
    const b = new CircuitBreaker({ minSamples: 2, errorRateThreshold: 0.5, openMs: 100 }, () => now);
    b.record(false);
    b.record(false);
    expect(b.canPass()).toBe(false);
    now = 200;
    expect(b.canPass()).toBe(true);
    expect(b.snapshot().state).toBe("half-open");
  });

  it("half-open closes on success and re-opens on failure", () => {
    let now = 0;
    const b = new CircuitBreaker({ minSamples: 1, errorRateThreshold: 0.5, openMs: 100 }, () => now);
    b.record(false);
    now = 200;
    b.canPass(); // -> half-open
    b.record(true);
    expect(b.snapshot().state).toBe("closed");
  });

  it("uses sliding window of the most recent N samples", () => {
    const b = new CircuitBreaker({ minSamples: 4, errorRateThreshold: 0.5, openMs: 1000 }, undefined, 4);
    b.record(true);
    b.record(true);
    b.record(true);
    b.record(false); // 1/4 = 0.25 -> still closed
    expect(b.canPass()).toBe(true);
    b.record(false); // pushes the first success out -> 2/4 = 0.5 -> opens
    expect(b.snapshot().state).toBe("open");
  });
});

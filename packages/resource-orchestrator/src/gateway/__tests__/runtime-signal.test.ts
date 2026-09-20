import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abortable, deriveAbortSignal, isAborted } from "../runtime/signal";

describe("deriveAbortSignal", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns the parent signal when it has already aborted", () => {
    const parent = new AbortController();
    parent.abort(new Error("user-cancelled"));
    const derived = deriveAbortSignal({ parent: parent.signal, timeoutMs: 1000 });
    expect(derived.signal.aborted).toBe(true);
    expect(isAborted(derived.signal)).toBe(true);
  });

  it("fires the derived signal when timeoutMs elapses", () => {
    const derived = deriveAbortSignal({ timeoutMs: 1000 });
    expect(derived.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(derived.signal.aborted).toBe(true);
    expect((derived.signal.reason as Error)?.message).toContain("timeout");
    derived.dispose();
  });

  it("fires when the parent aborts before the timeout", () => {
    const parent = new AbortController();
    const derived = deriveAbortSignal({ parent: parent.signal, timeoutMs: 10_000 });
    parent.abort(new Error("client-cancelled"));
    expect(derived.signal.aborted).toBe(true);
    expect((derived.signal.reason as Error).message).toBe("client-cancelled");
    derived.dispose();
  });

  it("fires on the budget timer independently of timeoutMs", () => {
    const derived = deriveAbortSignal({ timeoutMs: 0, budgetMs: 500 });
    vi.advanceTimersByTime(500);
    expect(derived.signal.aborted).toBe(true);
    expect((derived.signal.reason as Error).message).toContain("budget");
    derived.dispose();
  });

  it("dispose() clears timers and detaches listeners", () => {
    const parent = new AbortController();
    const derived = deriveAbortSignal({ parent: parent.signal, timeoutMs: 10_000 });
    derived.dispose();
    parent.abort(new Error("after-dispose"));
    expect(derived.signal.aborted).toBe(false);
  });
});

describe("abortable", () => {
  it("rejects when the signal has already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort(new Error("pre-aborted"));
    await expect(abortable(Promise.resolve("never"), ctrl.signal)).rejects.toThrow("pre-aborted");
  });

  it("rejects when the signal aborts before the promise resolves", async () => {
    const ctrl = new AbortController();
    const promise = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 100));
    const wrapped = abortable(promise, ctrl.signal);
    setTimeout(() => ctrl.abort(new Error("aborted-mid-flight")), 10);
    await expect(wrapped).rejects.toThrow("aborted-mid-flight");
  });

  it("resolves with the value when neither timer nor signal fires", async () => {
    await expect(abortable(Promise.resolve("ok"), undefined)).resolves.toBe("ok");
  });
});
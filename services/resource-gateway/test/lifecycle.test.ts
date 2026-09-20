import { describe, expect, it } from "vitest";

import { Lifecycle } from "../src/lifecycle";

describe("apps/gateway Lifecycle", () => {
  it("tracks active requests and disposes them", () => {
    const lifecycle = new Lifecycle();
    expect(lifecycle.activeRequestCount()).toBe(0);
    const abort = new AbortController();
    const dispose = lifecycle.beginRequest("req-1", abort);
    expect(lifecycle.activeRequestCount()).toBe(1);
    expect(lifecycle.listActiveRequestIds()).toEqual(["req-1"]);
    dispose();
    expect(lifecycle.activeRequestCount()).toBe(0);
  });

  it("refuses duplicate ids", () => {
    const lifecycle = new Lifecycle();
    const dispose = lifecycle.beginRequest("req-1", new AbortController());
    expect(() => lifecycle.beginRequest("req-1", new AbortController())).toThrow();
    dispose();
  });

  it("aborts every active request when draining", () => {
    const lifecycle = new Lifecycle();
    const a1 = new AbortController();
    const a2 = new AbortController();
    lifecycle.beginRequest("a", a1);
    lifecycle.beginRequest("b", a2);
    lifecycle.beginDrain();
    expect(a1.signal.aborted).toBe(true);
    expect(a2.signal.aborted).toBe(true);
    expect(lifecycle.isDraining()).toBe(true);
  });

  it("waitForDrain returns empty when nothing is active", async () => {
    const lifecycle = new Lifecycle();
    const remaining = await lifecycle.waitForDrain(50);
    expect(remaining).toEqual([]);
  });

  it("waitForDrain returns the remaining ids after timeout", async () => {
    const lifecycle = new Lifecycle();
    const abort = new AbortController();
    lifecycle.beginRequest("stuck", abort);
    const remaining = await lifecycle.waitForDrain(10);
    expect(remaining).toEqual(["stuck"]);
  });

  it("ignores already-aborted controllers when draining", () => {
    const lifecycle = new Lifecycle();
    const abort = new AbortController();
    abort.abort();
    lifecycle.beginRequest("pre", abort);
    expect(() => lifecycle.beginDrain()).not.toThrow();
  });

  // GHA-NEXT-035 — drain counters
  it("tracks drainInitiatedTotal + drainCompletedTotal on a clean drain", async () => {
    const lifecycle = new Lifecycle();
    expect(lifecycle.drainCounters().drainInitiatedTotal).toBe(0);
    lifecycle.beginDrain();
    expect(lifecycle.drainCounters().drainInitiatedTotal).toBe(1);
    await lifecycle.waitForDrain(50);
    expect(lifecycle.drainCounters().drainCompletedTotal).toBe(1);
    expect(lifecycle.drainCounters().drainTimeoutTotal).toBe(0);
  });

  it("counts a second drain beginDrain as an additional initiated event", () => {
    const lifecycle = new Lifecycle();
    lifecycle.beginDrain();
    lifecycle.beginDrain();
    expect(lifecycle.drainCounters().drainInitiatedTotal).toBe(2);
  });

  it("counts drainTimeoutTotal when waitForDrain elapses with stuck requests", async () => {
    const lifecycle = new Lifecycle();
    lifecycle.beginRequest("stuck", new AbortController());
    lifecycle.beginDrain();
    await lifecycle.waitForDrain(10);
    const c = lifecycle.drainCounters();
    expect(c.drainInitiatedTotal).toBe(1);
    expect(c.drainTimeoutTotal).toBe(1);
    expect(c.drainCompletedTotal).toBe(0);
  });

  it("childHardTimeoutTotal stays at zero when no child is registered", () => {
    const lifecycle = new Lifecycle();
    expect(lifecycle.drainCounters().childHardTimeoutTotal).toBe(0);
  });

  it("registerChild increments childHardTimeoutTotal when the hard timeout fires", async () => {
    const lifecycle = new Lifecycle({ childHardTimeoutMs: 5 });
    const child = new FakeHangingChild();
    lifecycle.registerChild("hung", child as unknown as import("node:child_process").ChildProcess);
    await new Promise((r) => setTimeout(r, 30));
    expect(child.sigtermSent).toBe(true);
    expect(lifecycle.drainCounters().childHardTimeoutTotal).toBe(1);
  });

  it("disposing a child cancels the hard-timeout so it does not fire", async () => {
    const lifecycle = new Lifecycle({ childHardTimeoutMs: 5 });
    const child = new FakeHangingChild();
    const dispose = lifecycle.registerChild("v", child as unknown as import("node:child_process").ChildProcess);
    dispose();
    await new Promise((r) => setTimeout(r, 30));
    expect(child.sigtermSent).toBe(false);
    expect(lifecycle.drainCounters().childHardTimeoutTotal).toBe(0);
  });

  it("childHardTimeoutMs=0 disables the hard timeout", async () => {
    const lifecycle = new Lifecycle({ childHardTimeoutMs: 0 });
    const child = new FakeHangingChild();
    lifecycle.registerChild("v", child as unknown as import("node:child_process").ChildProcess);
    await new Promise((r) => setTimeout(r, 30));
    expect(child.sigtermSent).toBe(false);
    expect(lifecycle.drainCounters().childHardTimeoutTotal).toBe(0);
  });
});

class FakeHangingChild {
  public sigtermSent = false;
  public exitCode: number | null = null;
  public signalCode: NodeJS.Signals | null = null;
  public killed = false;
  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    if (signal === "SIGTERM" || signal === "SIGKILL") this.sigtermSent = true;
    this.signalCode = (signal as NodeJS.Signals) ?? "SIGTERM";
    return true;
  }
}
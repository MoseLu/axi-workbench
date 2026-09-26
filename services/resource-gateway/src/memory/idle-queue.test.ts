import { describe, expect, it } from "vitest";
import { buildIdleQueue } from "./idle-queue";

describe("idle extraction queue", () => {
  it("coalesces per-session runs", async () => {
    let now = 0;
    const handles = new Map<number, () => void>();
    let counter = 0;
    const queue = buildIdleQueue({
      delayMs: 100,
      scheduler: {
        setTimeout: (handler) => {
          counter += 1;
          handles.set(counter, handler);
          return counter as unknown as NodeJS.Timeout;
        },
        clearTimeout: (handle) => {
          handles.delete(Number(handle));
        },
      },
    });

    let calls = 0;
    queue.schedule("session-1", () => { calls += 1; });
    queue.schedule("session-1", () => { calls += 1; });

    expect(queue.pendingCount()).toBe(1);
    // Fire the latest scheduled task only.
    handles.get(counter)!();
    expect(calls).toBe(1);
    expect(queue.pendingCount()).toBe(0);
    queue.dispose();
    void now;
  });

  it("keeps separate timers per session", () => {
    const queue = buildIdleQueue({ delayMs: 0, scheduler: { setTimeout: () => 0 as unknown as NodeJS.Timeout, clearTimeout: () => undefined } });
    queue.schedule("session-a", () => undefined);
    queue.schedule("session-b", () => undefined);
    expect(queue.pendingCount()).toBe(2);
    queue.cancel("session-a");
    expect(queue.pendingCount()).toBe(1);
    queue.dispose();
  });

  it("dispose drops pending tasks", () => {
    const queue = buildIdleQueue({ delayMs: 0, scheduler: { setTimeout: () => 0 as unknown as NodeJS.Timeout, clearTimeout: () => undefined } });
    queue.schedule("session", () => undefined);
    queue.dispose();
    expect(queue.pendingCount()).toBe(0);
    // Subsequent schedule is a no-op while disposed.
    queue.schedule("session", () => undefined);
    expect(queue.pendingCount()).toBe(0);
  });
});

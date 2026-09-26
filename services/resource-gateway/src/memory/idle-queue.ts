/**
 * MEM-MVP-010 — Idle extraction queue.
 *
 * Lightweight per-session coalescing timer. When a contribution
 * request arrives we schedule a debounced task; if another
 * contribution arrives before the timer fires for the same session,
 * the older task is cancelled. The handler that schedules the task
 * is responsible for honouring the `MemoryPolicy` (generate on/off,
 * external context, etc.) so this queue only owns timing + lifecycle.
 *
 * The queue also exposes `dispose()` so the gateway shutdown hook
 * can clear pending timers without waiting for the OS to drop them.
 */

export interface IdleQueueOptions {
  /** Default delay in ms. Tests can inject a tiny value. */
  readonly delayMs?: number;
  /** Provide the runtime timer APIs so tests can stub them out. */
  readonly scheduler?: {
    readonly setTimeout: (handler: () => void, ms: number) => NodeJS.Timeout;
    readonly clearTimeout: (handle: NodeJS.Timeout) => void;
  };
}

export interface ScheduledTask {
  readonly id: string;
  cancel(): void;
}

export const buildIdleQueue = (options: IdleQueueOptions = {}) => {
  const scheduler = options.scheduler ?? {
    setTimeout: (handler, ms) => setTimeout(handler, ms),
    clearTimeout: (handle) => clearTimeout(handle),
  };
  const tasks = new Map<string, { handle: NodeJS.Timeout; run: () => Promise<void> | void }>();
  let disposed = false;

  const schedule = (sessionId: string, run: () => Promise<void> | void, delayMs?: number): ScheduledTask => {
    if (disposed) {
      // Shutting down — drop the task on the floor.
      return { id: sessionId, cancel: () => undefined };
    }
    const existing = tasks.get(sessionId);
    if (existing) {
      scheduler.clearTimeout(existing.handle);
      tasks.delete(sessionId);
    }
    const delay = Math.max(0, delayMs ?? options.delayMs ?? 30_000);
    const handle = scheduler.setTimeout(() => {
      tasks.delete(sessionId);
      void run();
    }, delay);
    tasks.set(sessionId, { handle, run });
    return {
      id: sessionId,
      cancel: () => {
        const current = tasks.get(sessionId);
        if (current) {
          scheduler.clearTimeout(current.handle);
          tasks.delete(sessionId);
        }
      },
    };
  };

  const cancel = (sessionId: string): void => {
    const current = tasks.get(sessionId);
    if (current) {
      scheduler.clearTimeout(current.handle);
      tasks.delete(sessionId);
    }
  };

  const dispose = (): void => {
    disposed = true;
    for (const [, current] of tasks) scheduler.clearTimeout(current.handle);
    tasks.clear();
  };

  const pendingCount = (): number => tasks.size;

  return { schedule, cancel, dispose, pendingCount };
};

export type IdleQueue = ReturnType<typeof buildIdleQueue>;

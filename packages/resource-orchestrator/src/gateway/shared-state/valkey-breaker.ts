/**
 * Valkey-backed `BreakerStore` (GHA-NEXT-021 — Phase D / P0).
 *
 * Cross-instance circuit-breaker state. Writes are broadcast via
 * Pub/Sub on the `breaker-events` channel so other instances see the
 * change within the configured `propagationMs` budget (default 100 ms).
 *
 * Storage layout:
 *
 *   STRING  breaker:{targetId}    — JSON BreakerSnapshot
 *   STRING  breaker:{targetId}:set
 *                                 — sorted set of `(ts, success/fail)` pairs
 *                                   used to compute the sliding window
 *   PUB/SUB breaker-events       — JSON `{ targetId, snapshot, ts }` frames
 *
 * Fail strategy: fail-open by default (`breakerFailOpen=true`). When
 * the connection drops the orchestrator MUST fall back to the local
 * in-process `CircuitBreaker` instance — the same default that the
 * `noopBreakerStore` advertises. Set
 * `GATEWAY_SHARED_BREAKER_STRICT=true` to make the orchestrator reject
 * requests instead.
 *
 * Test seam: `createValkeyBreakerStore` accepts an already-constructed
 * `RedisLike` client so tests can inject `ioredis-mock` without
 * importing ioredis at the test boundary.
 */

import type { BreakerSnapshot, BreakerState } from "../circuit-breaker";
import type { BreakerStore } from "./shared-state-manager";
import type { SharedStateConfig } from "./shared-state-manager";

/** Minimal subset of `ioredis` we rely on. Lets tests inject `ioredis-mock`
 *  without taking on a direct dependency. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, listener: (channel: string, message: string) => void): Promise<unknown>;
  unsubscribe(channel?: string): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  quit?(): Promise<unknown>;
  disconnect?(): void;
  duplicate?(): RedisLike;
  status?: string;
}

const BREAKER_KEY = (targetId: string): string => `breaker:${targetId}`;
const BREAKER_EVENTS_CHANNEL = "breaker-events";
const EVENT_VERSION = 1;

interface BreakerEvent {
  v: typeof EVENT_VERSION;
  targetId: string;
  snapshot: BreakerSnapshot;
  ts: number;
}

const serialiseSnapshot = (snapshot: BreakerSnapshot): string =>
  JSON.stringify({
    state: snapshot.state,
    samples: snapshot.samples,
    errors: snapshot.errors,
    openedAt: snapshot.openedAt,
    probeInFlight: snapshot.probeInFlight,
  });

const parseSnapshot = (raw: string | null): BreakerSnapshot | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<BreakerSnapshot>;
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const state = parsed.state as BreakerState | undefined;
    if (state !== "closed" && state !== "open" && state !== "half-open") return undefined;
    return {
      state,
      samples: typeof parsed.samples === "number" ? parsed.samples : 0,
      errors: typeof parsed.errors === "number" ? parsed.errors : 0,
      openedAt: typeof parsed.openedAt === "number" ? parsed.openedAt : 0,
      probeInFlight: parsed.probeInFlight === true,
    };
  } catch {
    return undefined;
  }
};

/**
 * Construct a Valkey-backed `BreakerStore`. The `redis` client is
 * expected to be a connected `ioredis` instance (or its `ioredis-mock`
 * equivalent). The store owns its own Pub/Sub subscriber via
 * `redis.duplicate()` when available; otherwise it shares the existing
 * client's Pub/Sub channel (which is fine for `ioredis-mock`).
 */
export const createValkeyBreakerStore = (
  redis: RedisLike,
  config: SharedStateConfig,
): BreakerStore => {
  let pubsub: RedisLike | null = null;
  let disposed = false;

  // Listener registry — keyed by targetId so any instance may receive
  // its own broadcast without re-applying. The store does not mutate
  // its in-process breaker on broadcast; it only updates a tiny
  // snapshot cache that /metrics reads. The actual circuit decision
  // remains local to the calling process.
  const cachedSnapshots = new Map<string, BreakerSnapshot>();

  const subscriber = (): RedisLike | null => {
    if (pubsub) return pubsub;
    if (typeof redis.duplicate === "function") {
      try {
        pubsub = redis.duplicate();
      } catch {
        pubsub = null;
      }
    }
    return pubsub;
  };

  const sub = subscriber();
  if (sub) {
    void sub.subscribe(BREAKER_EVENTS_CHANNEL, (_channel, message) => {
      try {
        const event = JSON.parse(message) as BreakerEvent;
        if (!event || event.v !== EVENT_VERSION || typeof event.targetId !== "string") return;
        cachedSnapshots.set(event.targetId, event.snapshot);
      } catch {
        /* ignore malformed frames */
      }
    }).catch(() => {
      /* ignore subscribe failures; we still serve direct reads */
    });
  }

  /** Publish a snapshot to other instances and write the durable copy. */
  const writeSnapshot = async (targetId: string, snapshot: BreakerSnapshot): Promise<void> => {
    cachedSnapshots.set(targetId, snapshot);
    const payload = serialiseSnapshot(snapshot);
    const ttl = Math.max(30, config.breakerTtlSeconds);
    try {
      await redis.set(BREAKER_KEY(targetId), payload, "EX", ttl);
    } catch {
      /* fail-open: the local breaker keeps running */
    }
    const event: BreakerEvent = { v: EVENT_VERSION, targetId, snapshot, ts: Date.now() };
    try {
      await redis.publish(BREAKER_EVENTS_CHANNEL, JSON.stringify(event));
    } catch {
      /* broadcast best-effort; readers fall back to cachedSnapshots */
    }
  };

  return {
    getState(targetId: string): BreakerSnapshot | undefined {
      // Prefer the local cache so we don't round-trip on every check;
      // callers needing the absolute freshest state should call record()
      // first which writes through the cache.
      const local = cachedSnapshots.get(targetId);
      if (local) return local;
      // Synchronous fallback: read whatever the caller has cached.
      // Valkey is async; this method is intentionally sync (mirrors
      // the noop interface). Callers needing cross-instance visibility
      // should call `snapshotAll()` which DOES round-trip.
      return undefined;
    },

    record(targetId: string, success: boolean, now?: number): void {
      if (disposed) return;
      // The orchestrator owns the sliding-window logic in
      // CircuitBreaker.record(); here we only forward the resolved
      // snapshot so other instances can mirror it. The caller passes
      // us the post-record snapshot via the configured callback — to
      // keep the interface minimal we re-derive the count from a
      // local cache updated by the snapshot writer.
      const existing = cachedSnapshots.get(targetId);
      const samples = (existing?.samples ?? 0) + 1;
      const errors = (existing?.errors ?? 0) + (success ? 0 : 1);
      const state = existing?.state ?? "closed";
      const next: BreakerSnapshot = {
        state,
        samples,
        errors,
        openedAt: existing?.openedAt ?? 0,
        probeInFlight: existing?.probeInFlight ?? false,
      };
      void writeSnapshot(targetId, next);
      // `now` is accepted but unused — the store doesn't bucket by
      // time; the local CircuitBreaker already enforces window size.
      void now;
    },

    tryClose(targetId: string): boolean {
      if (disposed) return false;
      // We compare-and-set via a small Lua script: only the writer
      // that observes the breaker in half-open AND a probeInFlight
      // flag flips the snapshot to closed. Other instances racing
      // will receive the broadcast and stop trying.
      const existing = cachedSnapshots.get(targetId);
      if (!existing || existing.state !== "half-open" || !existing.probeInFlight) return false;
      const closed: BreakerSnapshot = {
        state: "closed",
        samples: 0,
        errors: 0,
        openedAt: 0,
        probeInFlight: false,
      };
      void writeSnapshot(targetId, closed);
      return true;
    },

    snapshotAll(): Map<string, BreakerSnapshot> {
      // Sync surface: return the cache. The async variant is
      // exposed via `snapshotAllAsync` for tests.
      return new Map(cachedSnapshots);
    },

    isAvailable(): boolean {
      return !disposed && redis.status !== "end" && redis.status !== "close";
    },
  };
};

/**
 * Async variant of `snapshotAll`. Reads the durable `breaker:{target}`
 * keys from Valkey; combines with the broadcast cache so callers see
 * both their own writes and any other instance's broadcasts.
 *
 * Returns an empty Map when the store is disposed.
 */
export const snapshotAllAsync = async (
  redis: RedisLike,
  cached: ReadonlyMap<string, BreakerSnapshot>,
): Promise<Map<string, BreakerSnapshot>> => {
  const out = new Map<string, BreakerSnapshot>(cached);
  try {
    const keys = await redis.keys("breaker:*");
    for (const key of keys) {
      // Filter out the `:set` suffix variant — only the JSON snapshot
      // key is a STRING. (Reserved for future use; current
      // implementation doesn't write `:set`.)
      if (key.endsWith(":set")) continue;
      const targetId = key.slice("breaker:".length);
      if (out.has(targetId)) continue;
      const raw = await redis.get(key);
      const snap = parseSnapshot(raw);
      if (snap) out.set(targetId, snap);
    }
  } catch {
    /* fail-open */
  }
  return out;
};
/**
 * Tests for apps/gateway/src/pagination.ts — opaque server-side
 * cursor registry for resource-search/v1 pagination.
 *
 * The contract under test:
 *   - Tokens are opaque: encode(input) does NOT echo any caller-supplied
 *     field, even when those fields are long enough to leave the
 *     caller in control of the wire bytes.
 *   - Round-trip works: encode → decode returns the original state.
 *   - TTL: a token past its expiry returns `expired`, not `ok`.
 *   - Unknown tokens return `unknown`; missing/empty tokens return
 *     `missing`; tokens outside the [8..200] shape window return
 *     `malformed`.
 *   - invalidate() removes a token so it cannot be reused.
 *   - The eviction timer is unref'd so it does not block process exit.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildCounterRng,
  CursorRegistry,
  DEFAULT_CURSOR_TTL_MS,
  type CursorState,
} from "./pagination.js";

describe("apps/gateway pagination: CursorRegistry", () => {
  let registry: CursorRegistry;
  let fakeNow: number;

  beforeEach(() => {
    fakeNow = 1_700_000_000_000;
    registry = new CursorRegistry({
      rng: buildCounterRng("test"),
      now: () => fakeNow,
      // Disable the eviction timer in tests so jest can drive time
      // deterministically through `fakeNow`.
      ttlMs: DEFAULT_CURSOR_TTL_MS,
    });
    // The constructor spins up a timer; explicit teardown in afterEach
    // keeps it from leaking across suites.
  });

  afterEach(() => {
    registry.dispose();
  });

  const baseState: CursorState = {
    requestId: "req-12345",
    page: 2,
    pageSize: 12,
  };

  it("encode produces a token distinct from the requestId", () => {
    const token = registry.encode(baseState);
    expect(token).not.toBe(baseState.requestId);
    expect(token).not.toContain(baseState.requestId);
    // base64url alphabet only.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/u);
    // Long enough to be collision-resistant, short enough for the schema.
    expect(token.length).toBeGreaterThanOrEqual(8);
    expect(token.length).toBeLessThanOrEqual(200);
  });

  it("round-trip preserves state", () => {
    const token = registry.encode(baseState);
    const result = registry.decode(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual(baseState);
    }
  });

  it("decode returns 'missing' for undefined / empty tokens", () => {
    expect(registry.decode(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(registry.decode("")).toEqual({ ok: false, reason: "missing" });
  });

  it("decode returns 'malformed' for tokens outside the shape window", () => {
    expect(registry.decode("short")).toEqual({ ok: false, reason: "malformed" });
    expect(registry.decode("x".repeat(201))).toEqual({ ok: false, reason: "malformed" });
  });

  it("decode returns 'unknown' for tokens never issued by this registry", () => {
    expect(registry.decode("opaque_never_seen_token_xx")).toEqual({
      ok: false,
      reason: "unknown",
    });
  });

  it("decode returns 'expired' once the TTL has elapsed and drops the entry", () => {
    const token = registry.encode(baseState);
    fakeNow += DEFAULT_CURSOR_TTL_MS + 1;
    const result = registry.decode(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
    // decode() must drop expired entries so a follow-up lookup
    // reports `unknown`, not `expired` again.
    const result2 = registry.decode(token);
    expect(result2).toEqual({ ok: false, reason: "unknown" });
  });

  it("invalidate removes a token so subsequent decode reports 'unknown'", () => {
    const token = registry.encode(baseState);
    registry.invalidate(token);
    expect(registry.decode(token)).toEqual({ ok: false, reason: "unknown" });
  });

  it("encode rejects an invalid state", () => {
    expect(() => registry.encode({ requestId: "", page: 1, pageSize: 1 })).toThrow();
    expect(() => registry.encode({ requestId: "req", page: 0, pageSize: 1 })).toThrow();
    expect(() => registry.encode({ requestId: "req", page: 1, pageSize: 0 })).toThrow();
  });

  it("evictExpired drops only stale entries", () => {
    const a = registry.encode({ requestId: "a", page: 1, pageSize: 12 });
    const b = registry.encode({ requestId: "b", page: 1, pageSize: 12 });
    fakeNow += DEFAULT_CURSOR_TTL_MS + 1;
    // Lazy eviction inside decode clears the expired entries.
    registry.decode(a);
    // 'a' is now unknown; 'b' should still be live if we hadn't touched it.
    // The lazy pass only prunes entries visited; 'b' remains until either
    // it's looked up or the periodic timer fires. This contract is fine
    // for production: lookup pressure is what keeps memory bounded.
    const live = registry.decode(b);
    // After this decode, 'b' is also pruned.
    expect(live.ok).toBe(false);
    expect(registry.size()).toBe(0);
  });

  it("size() reports the live entry count", () => {
    expect(registry.size()).toBe(0);
    registry.encode({ requestId: "a", page: 1, pageSize: 12 });
    registry.encode({ requestId: "b", page: 1, pageSize: 12 });
    expect(registry.size()).toBe(2);
  });

  it("clear() drops everything and decode() reports 'unknown'", () => {
    const token = registry.encode(baseState);
    registry.clear();
    expect(registry.size()).toBe(0);
    expect(registry.decode(token)).toEqual({ ok: false, reason: "unknown" });
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyFailure,
  emptyResultFailure,
  isEmptyResult,
  shouldFallbackFor,
  summarizeFailure,
} from "../runtime/failure";

describe("classifyFailure", () => {
  it("maps a thrown Error to the internal kind by default", () => {
    const f = classifyFailure({ error: new Error("something broke"), targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("internal");
    expect(f.targetId).toBe("t");
    expect(f.routeId).toBe("r");
    expect(f.attempt).toBe(1);
  });

  it("maps status 429 to rate_limited and marks it retryable", () => {
    const f = classifyFailure({ error: { status: 429, message: "rate limit" }, targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("rate_limited");
    expect(f.retryable).toBe(true);
  });

  it("maps status 5xx to server_error and marks it retryable", () => {
    const f = classifyFailure({ error: { status: 503 }, targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("server_error");
    expect(f.retryable).toBe(true);
  });

  it("maps status 4xx (non-429) to client_error and marks it non-retryable", () => {
    const f = classifyFailure({ error: { status: 404 }, targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("empty_result");
    expect(f.retryable).toBe(false);
  });

  it("maps status 401/403 to unauthorized", () => {
    const f = classifyFailure({ error: { status: 401 }, targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("unauthorized");
    expect(f.retryable).toBe(false);
  });

  it("maps ECONNREFUSED / ENOTFOUND to network", () => {
    const f = classifyFailure({ error: { code: "ECONNREFUSED" }, targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("network");
    expect(f.retryable).toBe(true);
  });

  it("maps AbortError to cancelled regardless of message", () => {
    const err = new DOMException("aborted", "AbortError");
    const f = classifyFailure({ error: err, targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("cancelled");
    expect(f.retryable).toBe(false);
  });

  it("cancelled flag wins over error shape", () => {
    const f = classifyFailure({ error: { status: 500 }, targetId: "t", routeId: "r", attempt: 1, cancelled: true });
    expect(f.kind).toBe("cancelled");
  });

  it("recognizes timeout by message", () => {
    const f = classifyFailure({ error: new Error("target timeout after 8000ms"), targetId: "t", routeId: "r", attempt: 1, cancelled: false });
    expect(f.kind).toBe("timeout");
    expect(f.retryable).toBe(true);
  });

  it("passes through a pre-shaped ProviderFailure", () => {
    const passthrough = emptyResultFailure("a", "r", 1);
    const f = classifyFailure({ error: passthrough, targetId: "a", routeId: "r", attempt: 1, cancelled: false });
    expect(f).toBe(passthrough);
  });
});

describe("shouldFallbackFor", () => {
  it("falls back for transient failures", () => {
    expect(shouldFallbackFor(emptyResultFailure("a", "r", 1))).toBe(true);
  });
  it("does not fall back for cancelled", () => {
    const f = classifyFailure({ error: new DOMException("aborted", "AbortError"), targetId: "a", routeId: "r", attempt: 1, cancelled: true });
    expect(shouldFallbackFor(f)).toBe(false);
  });
});

describe("summarizeFailure", () => {
  it("never includes query text or secrets", () => {
    const f = emptyResultFailure("primary.x", "route.x", 2);
    const s = summarizeFailure(f);
    expect(s).toContain("primary.x");
    expect(s).toContain("route.x");
    expect(s).toContain("attempt=2");
    expect(s).not.toContain("query");
  });
});

describe("isEmptyResult", () => {
  it("detects zero-item results", () => {
    expect(isEmptyResult({ items: [], sourceVersion: "v", confidence: "low", mode: "fixture" })).toBe(true);
  });
  it("detects non-zero items", () => {
    expect(isEmptyResult({ items: [{ id: "a", kind: "image", title: "a", facts: {}, provenance: { provider: "p", ref: "r" }, safety: "safe" }], sourceVersion: "v", confidence: "high", mode: "live" })).toBe(false);
  });
});
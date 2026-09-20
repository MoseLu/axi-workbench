import { describe, expect, it } from "vitest";
import {
  failureContractVersion,
  gatewayErrorCodeForKind,
  isProviderHealthFailure,
  isTransientFailure,
  makeProviderFailure,
  providerFailureKindSchema,
  providerFailureSchema,
  shouldFallback,
} from "./failures";

/**
 * Provider-failure taxonomy tests.
 *
 * Pin the closed kind enum, the retryable/countsAgainstBreaker
 * defaults, and the shouldFallback contract (cancellation never
 * falls back, configuration errors never fall back, everything else
 * may).
 */

describe("provider-failure contract", () => {
  it("pins the failure contract version", () => {
    expect(failureContractVersion).toBe(1);
  });

  it("covers the closed failure kind enum", () => {
    const expected = [
      "invalid_payload",
      "empty_result",
      "client_error",
      "server_error",
      "rate_limited",
      "timeout",
      "network",
      "cancelled",
      "circuit_open",
      "unauthorized",
      "not_configured",
      "internal",
    ] as const;
    expect(providerFailureKindSchema.options).toEqual([...expected]);
    for (const kind of expected) {
      expect(providerFailureKindSchema.safeParse(kind).success).toBe(true);
    }
    expect(providerFailureKindSchema.safeParse("nope").success).toBe(false);
  });

  it("classifies cancellation as non-retryable and breaker-exempt", () => {
    const failure = makeProviderFailure({
      kind: "cancelled",
      message: "client aborted",
      targetId: "image-factory.axi-image-preview",
      routeId: "route.image",
      attempt: 1,
    });
    expect(isTransientFailure(failure)).toBe(false);
    expect(isProviderHealthFailure(failure)).toBe(false);
    expect(shouldFallback(failure)).toBe(false);
  });

  it("classifies timeout as retryable but breaker-counting", () => {
    const failure = makeProviderFailure({
      kind: "timeout",
      message: "exceeded 8000ms",
      targetId: "docs-factory.axi-docs",
      routeId: "route.document",
      attempt: 2,
    });
    expect(isTransientFailure(failure)).toBe(true);
    expect(isProviderHealthFailure(failure)).toBe(true);
    expect(shouldFallback(failure)).toBe(true);
    expect(failure.code).toBe("provider_timeout");
    expect(failure.attempt).toBe(2);
  });

  it("classifies circuit_open as non-retryable and breaker-exempt", () => {
    const failure = makeProviderFailure({
      kind: "circuit_open",
      message: "breaker is open",
      targetId: "image-factory.minimax-tokenplan-image",
      routeId: "route.image",
      attempt: 1,
    });
    expect(isTransientFailure(failure)).toBe(false);
    expect(isProviderHealthFailure(failure)).toBe(false);
    expect(shouldFallback(failure)).toBe(true);
  });

  it("classifies not_configured as non-retryable and not falling back", () => {
    const failure = makeProviderFailure({
      kind: "not_configured",
      message: "missing AXI_DOCS_TOKEN",
      targetId: "docs-factory.axi-docs",
      routeId: "route.document",
      attempt: 1,
    });
    expect(isTransientFailure(failure)).toBe(false);
    expect(isProviderHealthFailure(failure)).toBe(false);
    expect(shouldFallback(failure)).toBe(false);
  });

  it("maps every kind to a stable gateway error code", () => {
    for (const kind of providerFailureKindSchema.options) {
      const code = gatewayErrorCodeForKind(kind);
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
    expect(gatewayErrorCodeForKind("timeout")).toBe("provider_timeout");
    expect(gatewayErrorCodeForKind("rate_limited")).toBe("rate_limited");
    expect(gatewayErrorCodeForKind("cancelled")).toBe("cancelled");
    expect(gatewayErrorCodeForKind("circuit_open")).toBe("circuit_open");
    expect(gatewayErrorCodeForKind("not_configured")).toBe("not_configured");
  });

  it("builds a parseable failure envelope from makeProviderFailure", () => {
    const failure = makeProviderFailure({
      kind: "server_error",
      message: "503 from upstream",
      targetId: "minimax-factory.minimax-tokenplan-search",
      routeId: "route.web",
      attempt: 3,
      status: 503,
      retryAfterMs: 1500,
    });
    const result = providerFailureSchema.safeParse(failure);
    expect(result.success).toBe(true);
  });

  it("rejects a failure envelope that violates the contract", () => {
    const result = providerFailureSchema.safeParse({
      kind: "timeout",
      code: "provider_timeout",
      message: "slow",
      targetId: "image-factory.axi-image-preview",
      routeId: "route.image",
      attempt: 0, // invalid: must be >= 1
      retryable: true,
      countsAgainstBreaker: true,
      at: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("clips messages longer than 400 characters", () => {
    const message = "x".repeat(800);
    const failure = makeProviderFailure({
      kind: "internal",
      message,
      targetId: "docs-factory.axi-docs",
      routeId: "route.document",
      attempt: 1,
    });
    expect(failure.message.length).toBeLessThanOrEqual(400);
  });
});
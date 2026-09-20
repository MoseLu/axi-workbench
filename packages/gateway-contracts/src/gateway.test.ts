import { describe, expect, it } from "vitest";
import {
  errorEnvelopeSchema,
  gatewayRequestSchema,
  gatewayResponseSchema,
  gatewayContractVersion,
  httpStatusForErrorCode,
} from "./gateway";

describe("gateway runtime contract", () => {
  it("pins the contract version", () => {
    expect(gatewayContractVersion).toBe(1);
  });

  it("accepts a minimal gateway request", () => {
    const result = gatewayRequestSchema.safeParse({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [] } });
    expect(result.success).toBe(true);
  });

  it("rejects an oversized request id", () => {
    const result = gatewayRequestSchema.safeParse({ planner: {}, requestId: "a".repeat(81) });
    expect(result.success).toBe(false);
  });

  it("keeps the planner field as opaque unknown and preserves its shape", () => {
    const result = gatewayRequestSchema.safeParse({ planner: { custom: 1, nested: { ok: true } } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.planner).toEqual({ custom: 1, nested: { ok: true } });
  });

  it("rounds a response with trace and warnings", () => {
    const result = gatewayResponseSchema.safeParse({
      contractVersion: gatewayContractVersion,
      requestId: "r-1",
      fromCache: false,
      trace: ["[route.image] start", "[route.image] done (3 items)"],
      planner: { calls: [] },
      result: { items: [], sourceVersion: "gateway:merged", confidence: "low", mode: "live" },
      warnings: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response with the wrong contract version", () => {
    const result = gatewayResponseSchema.safeParse({
      contractVersion: 99,
      requestId: "r-1",
      fromCache: false,
      trace: [],
      planner: {},
      result: {},
      warnings: [],
    });
    expect(result.success).toBe(false);
  });

  it("covers every stable error code", () => {
    const cases = [
      ["invalid_request", 400],
      ["unknown_tool", 404],
      ["not_configured", 503],
      ["provider_timeout", 504],
      ["circuit_open", 503],
      ["provider_error", 502],
      ["rate_limited", 429],
      ["cancelled", 499],
      ["internal", 500],
    ] as const;
    for (const [code, expected] of cases) {
      expect(httpStatusForErrorCode(code)).toBe(expected);
      const envelope = errorEnvelopeSchema.safeParse({
        contractVersion: gatewayContractVersion,
        requestId: "r-1",
        code,
        message: "boom",
      });
      expect(envelope.success).toBe(true);
    }
  });

  it("rejects an envelope whose code is not in the stable enum", () => {
    const result = errorEnvelopeSchema.safeParse({
      contractVersion: gatewayContractVersion,
      requestId: "r-1",
      code: "sneaky_code",
      message: "boom",
    });
    expect(result.success).toBe(false);
  });

  it("clamps the trace and warning arrays", () => {
    const result = gatewayResponseSchema.safeParse({
      contractVersion: gatewayContractVersion,
      requestId: "r-1",
      fromCache: false,
      trace: Array.from({ length: 65 }, () => "x"),
      planner: {},
      result: {},
      warnings: [],
    });
    expect(result.success).toBe(false);
  });
});
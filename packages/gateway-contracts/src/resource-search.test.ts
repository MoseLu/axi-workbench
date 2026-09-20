import { describe, it, expect } from "vitest";
import {
  resourceSearchContractVersion,
  resourceSearchErrorCodeSchema,
  resourceSearchItemSchema,
  resourceSearchModeSchema,
  resourceSearchRequestSchema,
  resourceSearchResponseSchema,
  resourceSearchSafetySchema,
  resourceSearchStateSchema,
  resourceSearchKindSchema,
  httpStatusForResourceSearchErrorCode,
} from "./resource-search";

describe("resource-search/v1 schema", () => {
  it("exports contractVersion=1", () => {
    expect(resourceSearchContractVersion).toBe(1);
  });

  it("rejects unknown kinds", () => {
    const ok = resourceSearchKindSchema.safeParse("image");
    expect(ok.success).toBe(true);
    const bad = resourceSearchKindSchema.safeParse("secrets");
    expect(bad.success).toBe(false);
  });

  it("rejects safety=blocked at the item boundary", () => {
    const blocked = resourceSearchItemSchema.safeParse({
      id: "fixture-image-x",
      kind: "image",
      title: "x",
      safety: "blocked",
      provenance: { provider: "fixture", ref: "fixture://x" },
    });
    expect(blocked.success).toBe(false);
  });

  it("accepts a minimal valid request", () => {
    const parsed = resourceSearchRequestSchema.parse({ query: "猫" });
    expect(parsed.query).toBe("猫");
    expect(parsed.pageSize).toBe(12);
    expect(parsed.resourceKinds).toBeUndefined();
  });

  it("rejects oversize query", () => {
    const big = "x".repeat(501);
    const r = resourceSearchRequestSchema.safeParse({ query: big });
    expect(r.success).toBe(false);
  });

  it("rejects oversize pageSize", () => {
    const r = resourceSearchRequestSchema.safeParse({ query: "x", pageSize: 51 });
    expect(r.success).toBe(false);
  });

  it("clamps pageSize via default", () => {
    const r = resourceSearchRequestSchema.parse({ query: "x", pageSize: 25 });
    expect(r.pageSize).toBe(25);
  });

  it("response schema forces contractVersion=1", () => {
    const r = resourceSearchResponseSchema.safeParse({
      contractVersion: 2,
      requestId: "abc",
      mode: "fixture",
      state: "clarifying",
      items: [],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("response schema accepts a single safe item", () => {
    const r = resourceSearchResponseSchema.parse({
      contractVersion: 1,
      requestId: "abc",
      mode: "live",
      state: "presenting",
      items: [{
        id: "image:1",
        kind: "image",
        title: "kitten",
        preview: null,
        safety: "safe",
        provenance: { provider: "axi-image-preview", ref: "/wallpapers/a.webp" },
      }],
      warnings: [],
    });
    expect(r.items).toHaveLength(1);
  });

  it("narrows mode to fixture|live", () => {
    expect(resourceSearchModeSchema.parse("live")).toBe("live");
    expect(resourceSearchModeSchema.parse("fixture")).toBe("fixture");
    expect(resourceSearchModeSchema.safeParse("hybrid").success).toBe(false);
  });

  it("narrows state to presenting|clarifying|failed", () => {
    expect(resourceSearchStateSchema.parse("presenting")).toBe("presenting");
    expect(resourceSearchStateSchema.parse("clarifying")).toBe("clarifying");
    expect(resourceSearchStateSchema.safeParse("idle").success).toBe(false);
  });

  it("narrows safety enum", () => {
    expect(resourceSearchSafetySchema.parse("safe")).toBe("safe");
    expect(resourceSearchSafetySchema.parse("flagged")).toBe("flagged");
    expect(resourceSearchSafetySchema.parse("blocked")).toBe("blocked");
    expect(resourceSearchSafetySchema.safeParse("unknown").success).toBe(false);
  });

  it("error code namespace is a subset of the wide gateway", () => {
    const ok = resourceSearchErrorCodeSchema.parse("provider_error");
    expect(ok).toBe("provider_error");
    const nope = resourceSearchErrorCodeSchema.safeParse("session_not_found");
    expect(nope.success).toBe(false);
  });

  it("httpStatusForResourceSearchErrorCode mirrors the wide namespace", () => {
    expect(httpStatusForResourceSearchErrorCode("invalid_request")).toBe(400);
    expect(httpStatusForResourceSearchErrorCode("unauthorized")).toBe(401);
    expect(httpStatusForResourceSearchErrorCode("provider_timeout")).toBe(504);
    expect(httpStatusForResourceSearchErrorCode("not_configured")).toBe(503);
    expect(httpStatusForResourceSearchErrorCode("internal")).toBe(500);
  });
});
import { describe, expect, it } from "vitest";
import { imageOrientationSchema, intentSchema, plannerResultSchema, resourceCandidateSchema } from "./index";

describe("resource broker contracts", () => {
  it("accepts the smallest structured intent", () => {
    const result = intentSchema.safeParse({
      operation: "search",
      resourceKinds: ["image"],
      constraints: { query: "头像" },
      needsClarification: false,
    });

    expect(result.success).toBe(true);
  });

  it("requires provenance for every candidate", () => {
    const result = resourceCandidateSchema.safeParse({
      id: "image:1",
      kind: "image",
      title: "candidate",
      facts: {},
      safety: "safe",
    });

    expect(result.success).toBe(false);
  });

  it("keeps planner calls bounded", () => {
    const result = plannerResultSchema.safeParse({
      intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
      calls: Array.from({ length: 4 }, (_, index) => ({ toolId: `tool-${index}`, input: {} })),
    });

    expect(result.success).toBe(false);
  });

  it("limits image presentation to the three supported orientations", () => {
    expect(imageOrientationSchema.safeParse("landscape").success).toBe(true);
    expect(imageOrientationSchema.safeParse("portrait").success).toBe(true);
    expect(imageOrientationSchema.safeParse("freeform").success).toBe(false);
  });

  it("accepts a multi-step pipeline from the planner", () => {
    const result = plannerResultSchema.safeParse({
      intent: { operation: "search", resourceKinds: ["image"], constraints: { query: "甜妹" }, needsClarification: false },
      calls: [],
      pipeline: [
        { toolId: "resource.search.image", input: { query: "甜妹" } },
        { toolId: "resource.search.web", input: { query: "甜妹" }, readFrom: [{ step: 0, kind: "image", factKey: "catalogEmpty" }] },
        { toolId: "resource.generate.image", input: { composedPrompt: "甜妹 柔光" }, readFrom: [{ step: 1, kind: "web", factKey: "keywords" }] },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects planner output that mixes calls and pipeline", () => {
    const result = plannerResultSchema.safeParse({
      intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
      calls: [{ toolId: "resource.search.image", input: {} }],
      pipeline: [{ toolId: "resource.search.web", input: {} }],
    });

    expect(result.success).toBe(false);
  });

  it("bounds each pipeline step to the allowlist of read references", () => {
    const result = plannerResultSchema.safeParse({
      intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
      calls: [],
      pipeline: [
        { toolId: "resource.search.image", input: {} },
        { toolId: "resource.search.web", input: {}, readFrom: Array.from({ length: 9 }, () => ({ step: 0, kind: "image", factKey: "k" })) },
      ],
    });

    expect(result.success).toBe(false);
  });
});

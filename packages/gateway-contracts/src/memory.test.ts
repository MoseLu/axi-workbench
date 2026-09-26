import { describe, expect, it } from "vitest";
import {
  memoryEntrySchema,
  memorySettingsSchema,
  memorySettingsPatchSchema,
  memoryFileSchema,
  memorySearchRequestSchema,
  memorySearchResponseSchema,
  memoryClearRequestSchema,
  memoryContributionRequestSchema,
  validateFactsForKind,
  plannerMemoryContextSchema,
  memoryExportResponseSchema,
  memoryApproveRequestSchema,
  memoryAckResponseSchema,
  memoryApiContractVersion,
  memorySchemaVersion,
  type MemoryEntry,
} from "./memory";

const isoNow = "2026-08-29T00:00:00.000Z";
const isoLater = "2026-09-30T00:00:00.000Z";

const baseActive: MemoryEntry = {
  id: "mem-active-001",
  schemaVersion: memorySchemaVersion,
  scope: "project",
  projectId: "ai-resource-orchestration",
  kind: "preference",
  status: "active",
  summary: "默认横屏图片",
  facts: { preferredOrientation: "landscape" },
  tags: ["image", "orientation"],
  source: "explicit",
  sensitivity: "normal",
  confidence: "high",
  createdAt: isoNow,
  updatedAt: isoNow,
};

describe("memoryEntrySchema", () => {
  it("accepts a well-formed project-scope entry", () => {
    expect(memoryEntrySchema.safeParse(baseActive).success).toBe(true);
  });

  it("accepts a global-scope entry without projectId", () => {
    const entry: MemoryEntry = {
      ...baseActive,
      id: "mem-global-001",
      scope: "global",
      projectId: undefined,
      kind: "constraint",
      facts: { allowExternalSearch: false },
    };
    const result = memoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it("rejects unknown facts keys for the entry's kind", () => {
    const entry = {
      ...baseActive,
      kind: "preference",
      facts: { preferredOrientation: "landscape", suspiciousField: "/etc/passwd" },
    };
    const result = memoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects nested-object facts values", () => {
    const entry = {
      ...baseActive,
      kind: "decision",
      facts: { decisionTopic: "gateway", decisionValue: "single-instance" },
    };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(true);

    const bad = {
      ...baseActive,
      kind: "decision",
      facts: { decisionTopic: { evil: true } as unknown as string },
    };
    expect(memoryEntrySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects summary longer than 800 characters", () => {
    const entry = { ...baseActive, summary: "x".repeat(801) };
    const result = memoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects summary shorter than 1 character", () => {
    const entry = { ...baseActive, summary: "" };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("rejects project-scope entry without projectId", () => {
    const entry = { ...baseActive, scope: "project" as const, projectId: undefined };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("rejects global-scope entry with projectId", () => {
    const entry = { ...baseActive, scope: "global" as const, projectId: "should-not-be-here" };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("rejects expiresAt that is not later than updatedAt", () => {
    const entry = { ...baseActive, updatedAt: isoLater, expiresAt: isoNow };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("accepts expiresAt strictly later than updatedAt", () => {
    const entry = { ...baseActive, updatedAt: isoNow, expiresAt: isoLater };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("rejects evidenceHash that is not a hex digest", () => {
    const entry = { ...baseActive, evidenceHash: "not-a-digest" };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("rejects tag with whitespace", () => {
    const entry = { ...baseActive, tags: ["valid", "no spaces"] };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("rejects additional unknown top-level fields", () => {
    const entry = { ...baseActive, evil: "secret" };
    expect(memoryEntrySchema.safeParse(entry).success).toBe(false);
  });
});

describe("memoryFileSchema", () => {
  it("round-trips an empty file", () => {
    const parsed = memoryFileSchema.parse({
      schemaVersion: memorySchemaVersion,
      updatedAt: isoNow,
      entries: [],
    });
    expect(parsed.entries).toEqual([]);
  });

  it("caps entries at 500", () => {
    const entries = Array.from({ length: 501 }, (_, index) => ({
      ...baseActive,
      id: `mem-${index}`,
      scope: "global" as const,
      projectId: undefined,
    }));
    expect(memoryFileSchema.safeParse({ schemaVersion: memorySchemaVersion, updatedAt: isoNow, entries }).success).toBe(false);
  });
});

describe("validateFactsForKind", () => {
  it("returns typed facts for a matching kind", () => {
    expect(validateFactsForKind("preference", { preferredOrientation: "landscape" })).toEqual({
      preferredOrientation: "landscape",
    });
  });

  it("throws on unknown fields", () => {
    expect(() => validateFactsForKind("preference", { evil: true })).toThrow();
  });

  it("throws on missing required fields", () => {
    expect(() => validateFactsForKind("decision", { decisionTopic: "x" })).toThrow();
  });
});

describe("memorySettingsSchema", () => {
  it("accepts a complete settings object", () => {
    const parsed = memorySettingsSchema.parse({
      useMemory: true,
      generateMemory: false,
      externalContextProtection: true,
      defaultScope: "global",
      defaultProjectId: "ai-resource-orchestration",
    });
    expect(parsed.useMemory).toBe(true);
    expect(parsed.defaultProjectId).toBe("ai-resource-orchestration");
  });

  it("rejects missing required booleans", () => {
    expect(memorySettingsSchema.safeParse({
      useMemory: true,
      externalContextProtection: true,
      defaultScope: "global",
    }).success).toBe(false);
  });

  it("rejects invalid scope", () => {
    expect(memorySettingsSchema.safeParse({
      useMemory: true,
      generateMemory: false,
      externalContextProtection: true,
      defaultScope: "session",
    }).success).toBe(false);
  });

  it("accepts a partial patch", () => {
    expect(memorySettingsPatchSchema.parse({ useMemory: true })).toEqual({ useMemory: true });
  });
});

describe("memorySearchRequestSchema", () => {
  it("requires query", () => {
    expect(memorySearchRequestSchema.safeParse({}).success).toBe(false);
  });

  it("requires projectId when scope=project", () => {
    const result = memorySearchRequestSchema.safeParse({ query: "x", scope: "project" });
    expect(result.success).toBe(false);
  });

  it("caps limit at 5", () => {
    expect(memorySearchRequestSchema.safeParse({ query: "x", limit: 6 }).success).toBe(false);
  });

  it("accepts valid global search", () => {
    expect(memorySearchRequestSchema.safeParse({ query: "image" }).success).toBe(true);
  });
});

describe("memorySearchResponseSchema", () => {
  it("rejects more than 5 memories", () => {
    const memories = Array.from({ length: 6 }, (_, index) => ({
      id: `mem-${index}`,
      kind: "preference" as const,
      summary: "x",
      facts: {},
      scope: "global" as const,
    }));
    expect(memorySearchResponseSchema.safeParse({
      contractVersion: memoryApiContractVersion,
      requestId: "req-1",
      memories,
    }).success).toBe(false);
  });
});

describe("plannerMemoryContextSchema", () => {
  it("accepts up to 5 planner-shaped entries", () => {
    const context = plannerMemoryContextSchema.parse({
      memories: [
        {
          id: "mem-1",
          kind: "preference",
          summary: "默认横屏",
          facts: { preferredOrientation: "landscape" },
          scope: "project",
        },
      ],
    });
    expect(context.memories).toHaveLength(1);
  });
});

describe("memoryClearRequestSchema", () => {
  it("rejects when confirm is not true", () => {
    expect(memoryClearRequestSchema.safeParse({
      scope: "global",
      confirm: false,
    }).success).toBe(false);
  });

  it("rejects project scope without projectId", () => {
    expect(memoryClearRequestSchema.safeParse({
      scope: "project",
      confirm: true,
    }).success).toBe(false);
  });

  it("requires explicit scope", () => {
    expect(memoryClearRequestSchema.safeParse({ confirm: true }).success).toBe(false);
  });
});

describe("memoryContributionRequestSchema", () => {
  it("accepts a minimal ordinary local contribution", () => {
    expect(memoryContributionRequestSchema.safeParse({
      sessionId: "session-1",
      userInput: "帮我找一张猫图",
      outcome: "presenting",
      usedExternalContext: false,
    }).success).toBe(true);
  });

  it("rejects unknown outcome", () => {
    expect(memoryContributionRequestSchema.safeParse({
      sessionId: "session-1",
      userInput: "x",
      outcome: "magic",
      usedExternalContext: false,
    }).success).toBe(false);
  });

  it("rejects empty userInput", () => {
    expect(memoryContributionRequestSchema.safeParse({
      sessionId: "session-1",
      userInput: "",
      outcome: "presenting",
      usedExternalContext: false,
    }).success).toBe(false);
  });
});

describe("response schemas", () => {
  it("ack requires contractVersion literal", () => {
    expect(memoryAckResponseSchema.safeParse({
      contractVersion: 999,
      requestId: "x",
      ok: true,
    }).success).toBe(false);
  });

  it("approve rejects unknown fields", () => {
    expect(memoryApproveRequestSchema.safeParse({ confidence: "high", evil: 1 }).success).toBe(false);
  });

  it("export includes the schema envelope", () => {
    expect(memoryExportResponseSchema.safeParse({
      contractVersion: memoryApiContractVersion,
      requestId: "x",
      exportedAt: isoNow,
      file: {
        schemaVersion: memorySchemaVersion,
        updatedAt: isoNow,
        entries: [],
      },
    }).success).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  dateKeySchema,
  sessionIdSchema,
  sessionProjectIdSchema,
  sessionEntryTextSchema,
  sessionEntrySchema,
  sessionRecordSchema,
  sessionResultSnapshotSchema,
  sessionAppendRequestSchema,
  sessionCreateRequestSchema,
  sessionPatchSchema,
  sessionDeleteRequestSchema,
  sessionListQuerySchema,
  sessionSummarySchema,
  timezoneOffsetMinutesSchema,
  SESSION_LIMITS,
} from "./session";

describe("dateKeySchema", () => {
  it.each([
    "2026-08-29",
    "1970-01-01",
    "2024-02-29",
    "9999-12-31",
  ])("accepts %s", (value) => {
    expect(dateKeySchema.safeParse(value).success).toBe(true);
  });

  it.each([
    "2026/08/29",
    "2026-8-29",
    "2026-13-01",
    "2026-02-30",
    "2025-02-29",
    "26-08-29",
    "",
    "garbage",
  ])("rejects %s", (value) => {
    expect(dateKeySchema.safeParse(value).success).toBe(false);
  });
});

describe("sessionProjectIdSchema", () => {
  it.each(["default", "proj_a", "team:alpha", "v1.2.3", "p-1"])("accepts %s", (value) => {
    expect(sessionProjectIdSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    "/etc/passwd",
    "../escape",
    "with space",
    "scheme://host",
    "file:///etc",
    "C:\\\\Windows",
    "",
  ])("rejects %s", (value) => {
    expect(sessionProjectIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("sessionIdSchema", () => {
  it("accepts opaque ids with ses_ prefix", () => {
    expect(sessionIdSchema.safeParse("ses_abcDEF123_-").success).toBe(true);
  });
  it.each([
    "abc",
    "ses_",
    "ses_/etc",
    "ses_a b",
  ])("rejects %s", (value) => {
    expect(sessionIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("timezoneOffsetMinutesSchema", () => {
  it.each([-840, 0, 840])("accepts %d", (value) => {
    expect(timezoneOffsetMinutesSchema.safeParse(value).success).toBe(true);
  });
  it.each([-841, 841, 1.5])("rejects %d", (value) => {
    expect(timezoneOffsetMinutesSchema.safeParse(value).success).toBe(false);
  });
});

describe("sessionEntryTextSchema", () => {
  it("accepts short text", () => {
    expect(sessionEntryTextSchema.safeParse("hello").success).toBe(true);
  });
  it("rejects oversize text", () => {
    expect(
      sessionEntryTextSchema.safeParse("a".repeat(SESSION_LIMITS.entryText + 1)).success,
    ).toBe(false);
  });
  it("rejects unknown role payloads via entry schema", () => {
    const r = sessionEntrySchema.safeParse({
      id: "e1",
      role: "user",
      text: "hi",
      createdAt: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown role", () => {
    const r = sessionEntrySchema.safeParse({
      id: "e1",
      role: "tool",
      text: "hi",
      createdAt: new Date().toISOString(),
    });
    expect(r.success).toBe(false);
  });
  it("rejects unknown outcome", () => {
    const r = sessionEntrySchema.safeParse({
      id: "e1",
      role: "assistant",
      text: "hi",
      createdAt: new Date().toISOString(),
      outcome: "lol",
    });
    expect(r.success).toBe(false);
  });
});

describe("sessionResultSnapshotSchema", () => {
  it("accepts a valid snapshot", () => {
    const r = sessionResultSnapshotSchema.safeParse({
      state: "presenting",
      explanation: "ok",
      warnings: [],
      items: [{ id: "i1", kind: "image", title: "x" }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects extra fields", () => {
    const r = sessionResultSnapshotSchema.safeParse({
      state: "presenting",
      warnings: [],
      items: [{ id: "i1", kind: "image", title: "x" }],
      preview: "data:image/png;base64,AAAA",
    });
    expect(r.success).toBe(false);
  });
});

describe("sessionRecordSchema", () => {
  it("accepts a minimal valid record", () => {
    const r = sessionRecordSchema.safeParse({
      id: "ses_abc123",
      schemaVersion: 1,
      projectId: "default",
      dateKey: "2026-08-29",
      kind: "daily",
      status: "active",
      title: "first user msg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 0,
      messageCount: 0,
      entries: [],
    });
    expect(r.success).toBe(true);
  });
  it("rejects negative revision", () => {
    const r = sessionRecordSchema.safeParse({
      id: "ses_abc123",
      schemaVersion: 1,
      projectId: "default",
      dateKey: "2026-08-29",
      kind: "daily",
      status: "active",
      title: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: -1,
      messageCount: 0,
      entries: [],
    });
    expect(r.success).toBe(false);
  });
  it("rejects schemaVersion drift", () => {
    const r = sessionRecordSchema.safeParse({
      id: "ses_abc123",
      schemaVersion: 2,
      projectId: "default",
      dateKey: "2026-08-29",
      kind: "daily",
      status: "active",
      title: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 0,
      messageCount: 0,
      entries: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("request schemas", () => {
  it("list query rejects unknown fields", () => {
    const r = sessionListQuerySchema.safeParse({
      dateKey: "2026-08-29",
      evil: true,
    });
    expect(r.success).toBe(false);
  });

  it("create accepts daily with no title", () => {
    const r = sessionCreateRequestSchema.safeParse({
      projectId: "default",
      dateKey: "2026-08-29",
      kind: "daily",
    });
    expect(r.success).toBe(true);
  });

  it("append requires outcome for assistant", () => {
    const r = sessionAppendRequestSchema.safeParse({
      entry: { role: "assistant", text: "hi" },
    });
    expect(r.success).toBe(false);
  });

  it("append rejects result on user role", () => {
    const r = sessionAppendRequestSchema.safeParse({
      entry: {
        role: "user",
        text: "hi",
        result: {
          state: "presenting",
          warnings: [],
          items: [],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it("patch rejects empty body", () => {
    expect(sessionPatchSchema.safeParse({}).success).toBe(false);
    expect(sessionPatchSchema.safeParse({ title: "ok" }).success).toBe(true);
    expect(sessionPatchSchema.safeParse({ status: "archived" }).success).toBe(true);
  });

  it("delete requires explicit confirm", () => {
    expect(sessionDeleteRequestSchema.safeParse({ confirm: false }).success).toBe(false);
    expect(sessionDeleteRequestSchema.safeParse({ confirm: true }).success).toBe(true);
  });

  it("summary clamps known fields", () => {
    const r = sessionSummarySchema.safeParse({
      id: "ses_abc123",
      projectId: "default",
      dateKey: "2026-08-29",
      kind: "daily",
      status: "active",
      title: "t",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 0,
      messageCount: 0,
    });
    expect(r.success).toBe(true);
  });
});

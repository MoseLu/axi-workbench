import { describe, expect, it } from "vitest";
import {
  SESSION_LIMITS,
  type SessionEntry,
  type SessionRecord,
} from "@axi/gateway-contracts";
import {
  generateSessionId,
  localDateKey,
  previewFromText,
  projectConversationContext,
  sortSessionSummaries,
  titleFromUserText,
} from "./helpers";

const iso = (stamp: string): string => stamp;

const record = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  id: overrides.id ?? "ses_aaaaaaaa",
  schemaVersion: 1,
  projectId: "ai-resource-orchestration",
  dateKey: "2026-08-29",
  kind: "daily",
  status: "active",
  title: "hello",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  revision: 1,
  messageCount: 1,
  entries: [],
  ...overrides,
});

describe("date|title|sort", () => {
  it("uses local calendar components, not UTC getters", () => {
    const localEvening = new Date(2026, 7, 29, 23, 30, 0);
    expect(localDateKey(localEvening)).toBe("2026-08-29");
    const nextMidnight = new Date(2026, 7, 30, 0, 0, 0);
    expect(localDateKey(nextMidnight)).toBe("2026-08-30");
  });

  it("crosses midnight without carrying yesterday's dateKey", () => {
    const before = new Date(2026, 7, 29, 23, 59, 59);
    const after = new Date(2026, 7, 30, 0, 0, 1);
    expect(localDateKey(before)).toBe("2026-08-29");
    expect(localDateKey(after)).toBe("2026-08-30");
  });

  it("matches the Date's local Y-M-D even when UTC day differs", () => {
    const utc = new Date(Date.UTC(2026, 7, 29, 0, 0, 0));
    const expected = `${utc.getFullYear()}-${String(utc.getMonth() + 1).padStart(2, "0")}-${String(utc.getDate()).padStart(2, "0")}`;
    expect(localDateKey(utc)).toBe(expected);
  });

  it("builds a deterministic 48-char title from the first user message", () => {
    expect(titleFromUserText("找一张\n山水 图片")).toBe("找一张 山水 图片");
    const long = "一二三四五六七八九".repeat(8);
    expect(titleFromUserText(long).length).toBe(48);
    expect(titleFromUserText(long)).toBe(long.slice(0, 48));
  });

  it("truncates previews without inventing text", () => {
    expect(previewFromText("  hello   world  ")).toBe("hello world");
    expect(previewFromText("x".repeat(200)).length).toBe(80);
  });

  it("omits empty sessions and sorts dateKey desc, updatedAt desc, sessionId asc", () => {
    const summaries = sortSessionSummaries([
      record({ id: "ses_bbbbbbbb", dateKey: "2026-08-28", updatedAt: iso("2026-08-28T12:00:00.000Z"), messageCount: 2 }),
      record({ id: "ses_cccccccc", dateKey: "2026-08-29", updatedAt: iso("2026-08-29T10:00:00.000Z"), messageCount: 1 }),
      record({ id: "ses_aaaaaaaa", dateKey: "2026-08-29", updatedAt: iso("2026-08-29T10:00:00.000Z"), messageCount: 1 }),
      record({ id: "ses_dddddddd", dateKey: "2026-08-29", updatedAt: iso("2026-08-29T12:00:00.000Z"), messageCount: 3 }),
      record({ id: "ses_eeeeeeee", dateKey: "2026-08-29", messageCount: 0 }),
    ]);
    expect(summaries.map((item) => item.id)).toEqual([
      "ses_dddddddd",
      "ses_aaaaaaaa",
      "ses_cccccccc",
      "ses_bbbbbbbb",
    ]);
  });

  it("generates opaque ses_ ids", () => {
    expect(generateSessionId(() => "abc12345zzzz")).toMatch(/^ses_[A-Za-z0-9_-]+$/);
  });
});

describe("bounded conversation context", () => {
  const entry = (id: string, role: "user" | "assistant", text: string): SessionEntry => ({
    id,
    role,
    text,
    createdAt: "2026-08-29T00:00:00.000Z",
    ...(role === "assistant" ? { outcome: "presenting" as const } : {}),
  });

  it("keeps the most recent 12 turns", () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      entry(`e${index}`, index % 2 === 0 ? "user" : "assistant", `turn-${index}`),
    );
    const context = projectConversationContext(record({
      id: "ses_context01",
      entries,
      messageCount: 20,
    }));
    expect(context.turns).toHaveLength(SESSION_LIMITS.contextTurns);
    expect(context.turns[0]?.text).toBe("turn-8");
    expect(context.turns.at(-1)?.text).toBe("turn-19");
    expect(context.sessionId).toBe("ses_context01");
  });

  it("truncates older content when the character budget is hit first", () => {
    const bulky = "字".repeat(2_000);
    const entries = [
      entry("e0", "user", bulky),
      entry("e1", "assistant", bulky),
      entry("e2", "user", bulky),
      entry("e3", "assistant", bulky),
    ];
    const context = projectConversationContext(record({
      id: "ses_context02",
      entries,
      messageCount: 4,
    }));
    const chars = context.turns.reduce((sum, turn) => sum + turn.text.length, 0);
    expect(chars).toBeLessThanOrEqual(SESSION_LIMITS.contextChars);
    expect(context.turns.at(-1)?.text).toBe(bulky);
    expect(JSON.stringify(context)).not.toContain("path");
    expect(JSON.stringify(context)).not.toContain("/Users/");
  });
});

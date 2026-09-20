import { describe, expect, it } from "vitest";
import { rankMemories } from "./ranker";
import type { MemoryEntry } from "@axi/gateway-contracts";

const now = new Date("2026-08-29T00:00:00.000Z");

const entry = (overrides: Partial<MemoryEntry> & { id: string }): MemoryEntry => ({
  schemaVersion: 1,
  scope: "global",
  kind: "preference",
  status: "active",
  summary: "默认横屏",
  facts: { preferredOrientation: "landscape" },
  tags: ["image"],
  source: "explicit",
  sensitivity: "normal",
  confidence: "high",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...overrides,
});

describe("rankMemories", () => {
  it("returns an empty context when no entries match", () => {
    const context = rankMemories({ entries: [], query: "anything" });
    expect(context.memories).toEqual([]);
  });

  it("ranks project scope above global for the same query", () => {
    const projectEntry = entry({ id: "p1", scope: "project", projectId: "ai-resource-orchestration", summary: "默认横屏 image 偏好", facts: { preferredOrientation: "landscape" } });
    const globalEntry = entry({ id: "g1", scope: "global", kind: "constraint", summary: "默认横屏 image 偏好", facts: { safetyPreference: "strict" } });
    const context = rankMemories({
      entries: [globalEntry, projectEntry],
      query: "横屏 image 偏好",
      scope: "project",
      projectId: "ai-resource-orchestration",
      now,
    });
    expect(context.memories[0].id).toBe("p1");
    expect(context.memories[1].id).toBe("g1");
  });

  it("filters out pending and archived entries", () => {
    const entries = [
      entry({ id: "active", summary: "image 偏好 横屏", facts: { preferredOrientation: "landscape" } }),
      entry({ id: "pending", status: "pending", summary: "image 偏好 横屏", facts: { preferredOrientation: "landscape" } }),
      entry({ id: "archived", status: "archived", summary: "image 偏好 横屏", facts: { preferredOrientation: "landscape" } }),
    ];
    const context = rankMemories({ entries, query: "image 横屏 偏好", now });
    expect(context.memories.map((m) => m.id)).toEqual(["active"]);
  });

  it("filters out expired task entries", () => {
    const entries = [
      entry({ id: "expired", kind: "task", summary: "plan image rollout", facts: { taskTitle: "image rollout plan", taskStatus: "open" }, expiresAt: "2026-08-01T00:00:00.000Z" }),
      entry({ id: "alive", kind: "task", summary: "image rollout refresh", facts: { taskTitle: "image rollout refresh", taskStatus: "open" }, expiresAt: "2027-01-01T00:00:00.000Z" }),
    ];
    const context = rankMemories({ entries, query: "image rollout refresh", now });
    expect(context.memories.map((m) => m.id)).toEqual(["alive"]);
  });

  it("does not return entries scoring below threshold", () => {
    const entries = [entry({ id: "weak", summary: "无关偏好", facts: { preferredOrientation: "landscape" } })];
    // Use a long english query that shares no characters with the
    // entry's summary; overlap is 0 so the entry scores 10 below the
    // 20 threshold.
    const context = rankMemories({ entries, query: "completely unrelated items from another workspace please", now });
    expect(context.memories).toEqual([]);
  });

  it("dedups conflicting decisionTopic entries", () => {
    const entries = [
      entry({ id: "old", kind: "decision", summary: "shared gateway approach", facts: { decisionTopic: "gateway", decisionValue: "shared" }, updatedAt: "2026-01-01T00:00:00.000Z" }),
      entry({ id: "new", kind: "decision", summary: "independent gateway approach", facts: { decisionTopic: "gateway", decisionValue: "independent" }, updatedAt: "2026-08-01T00:00:00.000Z" }),
    ];
    const context = rankMemories({ entries, query: "gateway approach independent shared", now });
    expect(context.memories.map((m) => m.id)).toEqual(["new"]);
  });

  it("caps results at 5 entries", () => {
    // Mix facts keys so the conflict dedup does not collapse everything
    // into a single surviving entry.
    const entries = [
      entry({ id: "e0", summary: "横屏偏好 image", facts: { preferredOrientation: "landscape" } }),
      entry({ id: "e1", summary: "image 偏好 文档", kind: "preference", facts: { preferredResultCount: 5 } }),
      entry({ id: "e2", summary: "image 偏好 技能", kind: "constraint", facts: { avoidProvider: "minimax" } }),
      entry({ id: "e3", summary: "image 偏好 项目", kind: "decision", facts: { decisionTopic: "topic-3", decisionValue: "value-3" } }),
      entry({ id: "e4", summary: "image 偏好 任务", kind: "task", facts: { taskTitle: "task-4", taskStatus: "open" } }),
      entry({ id: "e5", summary: "image 偏好 横屏", facts: { preferredOrientation: "portrait" } }),
      entry({ id: "e6", summary: "image 偏好 任务b", kind: "task", facts: { taskTitle: "task-6", taskStatus: "open" } }),
      entry({ id: "e7", summary: "image 偏好 任务c", kind: "task", facts: { taskTitle: "task-7", taskStatus: "open" } }),
    ];
    const context = rankMemories({ entries, query: "image 横屏 偏好", now });
    expect(context.memories).toHaveLength(5);
  });

  it("breaks ties deterministically by updatedAt desc, id asc", () => {
    const entries = [
      entry({ id: "b", kind: "task", summary: "image 偏好", facts: { taskTitle: "b task", taskStatus: "open" }, updatedAt: "2026-08-29T00:00:00.000Z" }),
      entry({ id: "a", kind: "task", summary: "image 偏好", facts: { taskTitle: "a task", taskStatus: "open" }, updatedAt: "2026-08-29T00:00:00.000Z" }),
      entry({ id: "c", kind: "task", summary: "image 偏好", facts: { taskTitle: "c task", taskStatus: "open" }, updatedAt: "2026-08-30T00:00:00.000Z" }),
    ];
    const context = rankMemories({ entries, query: "image 偏好 task", now });
    expect(context.memories.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });
});

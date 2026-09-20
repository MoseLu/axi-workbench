import { describe, expect, it } from "vitest";
import type { SessionRecord } from "@axi/gateway-contracts";
import { conversationFromSession } from "./session-snapshot";

const record: SessionRecord = {
  id: "ses_snap0001",
  schemaVersion: 1,
  projectId: "ai-resource-orchestration",
  dateKey: "2026-08-29",
  kind: "daily",
  status: "active",
  title: "找一张山水图片",
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:01:00.000Z",
  revision: 2,
  messageCount: 2,
  entries: [
    { id: "ent_u1", role: "user", text: "找一张山水图片", createdAt: "2026-08-29T00:00:00.000Z", runId: "run-1" },
    {
      id: "ent_a1",
      role: "assistant",
      text: "1 个结果已找到。",
      createdAt: "2026-08-29T00:01:00.000Z",
      runId: "run-1",
      outcome: "presenting",
      result: {
        state: "presenting",
        warnings: [],
        items: [{ id: "img-1", kind: "image", title: "山水", previewAvailable: false }],
      },
    },
  ],
};

describe("session snapshot adapter", () => {
  it("restores user history and a presenting run without data URLs", () => {
    const { history, runs } = conversationFromSession(record);
    expect(history.map((item) => item.role)).toEqual(["user"]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.result?.items[0]?.title).toBe("山水");
    expect(JSON.stringify(runs[0]?.result)).not.toContain("data:");
    expect(runs[0]?.result?.warnings).toContain("资源已不可用");
  });
});

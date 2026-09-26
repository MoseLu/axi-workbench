import { describe, expect, it } from "vitest";
import { conversationTurnsFor, type ConversationRun } from "./conversation-turns";
import type { ConversationMessage } from "./format";

const user = (id: string, at = 1_000): ConversationMessage => ({ id, role: "user", text: "找图", at });
const assistant = (id: string, text: string, at = 2_000): ConversationMessage => ({ id, role: "assistant", text, at });

const runFor = (id: string, userMessageId: string, completedAt: number | null = 3_000): ConversationRun => ({
  id,
  userMessageId,
  input: "找图",
  result: { runId: id, requestKey: "k", state: "presenting", planner: "p", items: [], warnings: [], trace: [] },
  completedAt,
});

describe("conversation turns", () => {
  it("folds a result block and the lines that follow it into one assistant turn", () => {
    const turns = conversationTurnsFor(
      [user("u-1"), assistant("a-1", "请补充一点描述。"), assistant("a-2", "另外一句。")],
      [runFor("run-1", "u-1")],
    );
    expect(turns.map((turn) => turn.kind)).toEqual(["user", "assistant"]);
    const reply = turns[1];
    if (reply.kind !== "assistant") throw new Error("expected an assistant turn");
    expect(reply.id).toBe("run-1");
    expect(reply.run?.id).toBe("run-1");
    expect(reply.replies.map((item) => item.id)).toEqual(["a-1", "a-2"]);
  });

  it("emits an assistant turn for a result with no conversational line", () => {
    const turns = conversationTurnsFor([user("u-1")], [runFor("run-1", "u-1")]);
    const reply = turns[1];
    if (reply.kind !== "assistant") throw new Error("expected an assistant turn");
    expect(reply.replies).toEqual([]);
    expect(reply.at).toBe(3_000);
  });

  it("emits an assistant turn for a bare line when no run produced a result", () => {
    const turns = conversationTurnsFor([user("u-1"), assistant("a-1", "请补充一点描述。")], []);
    const reply = turns[1];
    if (reply.kind !== "assistant") throw new Error("expected an assistant turn");
    expect(reply.id).toBe("a-1");
    expect(reply.run).toBeUndefined();
    expect(reply.replies).toHaveLength(1);
  });

  it("keeps separate exchanges in separate turns", () => {
    const turns = conversationTurnsFor(
      [user("u-1"), assistant("a-1", "第一轮"), user("u-2", 4_000), assistant("a-2", "第二轮", 5_000)],
      [runFor("run-1", "u-1"), runFor("run-2", "u-2", 6_000)],
    );
    expect(turns.map((turn) => turn.kind)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(turns.filter((turn) => turn.kind === "assistant")).toHaveLength(2);
  });

  it("does not open an assistant turn for a run that has not produced a result", () => {
    const pending: ConversationRun = { ...runFor("run-1", "u-1"), result: null, completedAt: null };
    expect(conversationTurnsFor([user("u-1")], [pending]).map((turn) => turn.kind)).toEqual(["user"]);
  });

  it("timestamps the turn from the latest piece that arrived", () => {
    const turns = conversationTurnsFor([user("u-1"), assistant("a-1", "稍后到达", 9_000)], [runFor("run-1", "u-1")]);
    const reply = turns[1];
    if (reply.kind !== "assistant") throw new Error("expected an assistant turn");
    expect(reply.at).toBe(9_000);
  });
});

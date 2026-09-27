import { describe, expect, it, vi } from "vitest";
import type { PlannerMemoryContext } from "@axi/gateway-contracts";
import { OpenAICompatiblePlanner, RuleBasedPlanner, stateLabel } from "./browser";

describe("browser-safe orchestrator entry", () => {
  it("plans without loading the server-only gateway surface", async () => {
    const result = await new RuleBasedPlanner().plan("帮我找一张山水图片参考", []);

    expect(result.calls[0]?.toolId).toBe("resource.search.image");
    expect(result.intent.resourceKinds).toEqual(["image"]);
  });

  it("recognizes a concrete scene request as an image search", async () => {
    const result = await new RuleBasedPlanner().plan("我想要一张浴室场景", []);

    expect(result.intent.resourceKinds).toEqual(["image"]);
    expect(result.intent.needsClarification).toBe(false);
    expect(result.calls[0]?.toolId).toBe("resource.search.image");
  });

  it("applies a remembered orientation only when the current request does not override it", async () => {
    const context: PlannerMemoryContext = {
      memories: [{
        id: "memory-orientation",
        kind: "preference",
        summary: "默认横屏图片",
        facts: { preferredOrientation: "landscape" },
        scope: "global",
      }],
    };
    const remembered = await new RuleBasedPlanner().plan("帮我找一张山景图片", [], undefined, context);
    expect(remembered.intent.constraints.orientation).toBe("landscape");

    const explicit = await new RuleBasedPlanner().plan("帮我找一张竖屏山景图片", [], undefined, context);
    expect(explicit.intent.constraints.orientation).toBe("portrait");
  });

  it("keeps current input ahead of bounded conversation history", async () => {
    const withHistory = await new RuleBasedPlanner().plan("帮我找一张山水图片", [], undefined, undefined, {
      sessionId: "ses_context01",
      dateKey: "2026-08-29",
      turns: [
        { role: "user", text: "找技能" },
        { role: "assistant", text: "这是技能结果" },
      ],
    });
    expect(withHistory.intent.resourceKinds).toEqual(["image"]);
    const without = await new RuleBasedPlanner().plan("帮我找一张山水图片", []);
    expect(without.intent.resourceKinds).toEqual(withHistory.intent.resourceKinds);
  });

  it("passes the actual redacted memory projection to an OpenAI-compatible planner", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          intent: { operation: "search", resourceKinds: ["image"], constraints: { query: "山景" }, needsClarification: false },
          calls: [{ toolId: "resource.search.image", input: { query: "山景" } }],
        }) } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const context: PlannerMemoryContext = {
        memories: [{
          id: "memory-orientation",
          kind: "preference",
          summary: "默认横屏图片",
          facts: { preferredOrientation: "landscape" },
          scope: "global",
        }],
      };
      await new OpenAICompatiblePlanner({ baseUrl: "http://llm.test/v1", model: "local" }).plan("山景", [], undefined, context);
      const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
        messages: Array<{ content: string }>;
      };
      expect(body.messages[0]?.content).toContain("默认横屏图片");
      expect(body.messages[0]?.content).toContain("preferredOrientation");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps trace labels available to the workbench", () => {
    expect(stateLabel("presenting")).toBe("结果就绪");
  });
});

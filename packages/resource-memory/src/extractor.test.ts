import { describe, expect, it } from "vitest";
import { extractMemoryCandidates } from "./extractor";

describe("extractMemoryCandidates", () => {
  it("recognises an explicit horizontal preference", () => {
    const result = extractMemoryCandidates("记住我以后默认横屏图片");
    expect(result.recognised).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].facts.preferredOrientation).toBe("landscape");
    expect(result.candidates[0].status).toBe("active");
  });

  it("recognises an explicit vertical preference", () => {
    const result = extractMemoryCandidates("以后默认用竖屏");
    expect(result.recognised).toBe(true);
    expect(result.candidates[0].facts.preferredOrientation).toBe("portrait");
  });

  it("recognises an explicit project decision", () => {
    const result = extractMemoryCandidates("这个项目决定使用独立 gateway");
    expect(result.recognised).toBe(true);
    expect(result.candidates[0].kind).toBe("decision");
    expect(result.candidates[0].facts.decisionTopic).toBe("gateway");
  });

  it("recognises an explicit no-external-search constraint", () => {
    const result = extractMemoryCandidates("这个项目暂时不要使用外部搜索");
    expect(result.recognised).toBe(true);
    expect(result.candidates[0].kind).toBe("constraint");
    expect(result.candidates[0].facts.allowExternalSearch).toBe(false);
  });

  it("does NOT produce a preference for a one-off image search", () => {
    const result = extractMemoryCandidates("帮我找一张猫的图片");
    expect(result.recognised).toBe(false);
    expect(result.candidates).toEqual([]);
  });

  it("does NOT produce a preference for a one-off document search", () => {
    const result = extractMemoryCandidates("查一下最近的文档");
    expect(result.recognised).toBe(false);
  });

  it("drops candidates whose summary would carry a banned token", () => {
    const result = extractMemoryCandidates("记住 token=abc123");
    expect(result.candidates).toEqual([]);
  });

  it("emits an active candidate with stable kind + tags", () => {
    const result = extractMemoryCandidates("记住我以后优先使用图片资源", { defaultScope: "project", defaultProjectId: "ai-resource-orchestration" });
    expect(result.candidates[0].scope).toBe("project");
    expect(result.candidates[0].projectId).toBe("ai-resource-orchestration");
  });
});

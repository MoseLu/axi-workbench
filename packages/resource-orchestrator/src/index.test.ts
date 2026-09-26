import { describe, expect, it } from "vitest";
import { MiniMaxTokenPlanImageAdapter, MiniMaxTokenPlanWebSearchAdapter, createFixtureAdapters } from "@axi/resource-adapters";
import { ResourceOrchestrator, RuleBasedPlanner } from "./index";

describe("ResourceOrchestrator", () => {
  const createOrchestrator = () => new ResourceOrchestrator({
    adapters: createFixtureAdapters(),
    planner: new RuleBasedPlanner(),
  });

  it("returns provider-backed candidates for an image request", async () => {
    const result = await createOrchestrator().run("找一张适合头像的风景图片");

    expect(result.state).toBe("presenting");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.provenance.provider === "fixture:image-preview")).toBe(true);
    expect(result.trace.map((event) => event.state)).toEqual([
      "interpreting",
      "planning",
      "image-searching",
      "validating",
      "presenting",
    ]);
  });

  it("routes a natural-language scenery photo request to the image provider", async () => {
    const result = await createOrchestrator().run("帮我找一张好看的风景照");

    expect(result.state).toBe("presenting");
    expect(result.intent?.resourceKinds).toContain("image");
  });

  it("recognizes a sweet-girl image request without asking for a resource type", async () => {
    const result = await createOrchestrator().run("我需要一张甜妹图片");

    expect(result.state).toBe("presenting");
    expect(result.intent?.resourceKinds).toContain("image");
  });

  it("exposes MiniMax search and generation as controlled planner tools", () => {
    const orchestrator = new ResourceOrchestrator({
      adapters: [new MiniMaxTokenPlanImageAdapter("http://minimax"), new MiniMaxTokenPlanWebSearchAdapter("http://minimax")],
      planner: new RuleBasedPlanner(),
    });

    expect(orchestrator.getToolDefinitions().map((tool) => tool.id)).toEqual([
      "resource.generate.image",
      "resource.search.web",
    ]);
  });

  it("extracts a requested orientation and applies the controlled image presentation tool", async () => {
    const result = await createOrchestrator().run("帮我找一张横屏的山景照片");

    expect(result.state).toBe("presenting");
    expect(result.intent?.constraints.orientation).toBe("landscape");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.facts.presentationOrientation === "landscape")).toBe(true);
    expect(result.trace.some((event) => event.detail?.includes("resource.present.image"))).toBe(true);
  });

  it("keeps the original presentation policy when orientation is not specified", async () => {
    const result = await createOrchestrator().run("帮我找一张山景照片");

    expect(result.state).toBe("presenting");
    expect(result.items.every((item) => item.facts.presentationOrientation === "original")).toBe(true);
  });

  it("confirms before showing more candidates than the requested quantity", async () => {
    const orchestrator = new ResourceOrchestrator({
      adapters: [{
        descriptor: { id: "overflow-test", label: "Overflow test", resourceKinds: ["image"], capabilities: ["search"] },
        search: async () => ({
          items: ["one", "two", "three"].map((id) => ({
            id: `image:${id}`,
            kind: "image",
            title: `候选 ${id}`,
            facts: {},
            provenance: { provider: "overflow-test", ref: `fixture://${id}` },
            safety: "safe" as const,
          })),
          sourceVersion: "overflow-test-v1",
          confidence: "high" as const,
          mode: "fixture" as const,
        }),
      }],
      planner: new RuleBasedPlanner(),
    });
    const first = await orchestrator.run("帮我找一张好看的风景照");

    expect(first.state).toBe("clarifying");
    expect(first.items).toHaveLength(0);
    expect(first.clarification?.some((option) => option.id === "confirm-requested-quantity")).toBe(true);

    const confirmed = await orchestrator.run("帮我找一张好看的风景照；确认只展示1张");
    expect(confirmed.state).toBe("presenting");
    expect(confirmed.items).toHaveLength(1);
  });

  it("requires explicit confirmation before returning flagged image candidates", async () => {
    const orchestrator = new ResourceOrchestrator({
      adapters: [{
        descriptor: { id: "flagged-test", label: "Flagged test", resourceKinds: ["image"], capabilities: ["search"] },
        search: async () => ({
          items: [{
            id: "image:flagged-test",
            kind: "image",
            title: "性感美女测试候选",
            facts: { tags: ["性感", "美女"] },
            provenance: { provider: "flagged-test", ref: "fixture://flagged-test" },
            safety: "flagged" as const,
          }],
          sourceVersion: "flagged-test-v1",
          confidence: "high" as const,
          mode: "fixture" as const,
        }),
      }],
      planner: new RuleBasedPlanner(),
    });
    const first = await orchestrator.run("帮我找一张性感美女照片");

    expect(first.state).toBe("clarifying");
    expect(first.clarification?.some((option) => option.id === "allow-flagged")).toBe(true);

    const confirmed = await orchestrator.run("帮我找一张性感美女照片；我确认查看标记为敏感的候选", { allowFlagged: true });
    expect(confirmed.state).toBe("presenting");
    expect(confirmed.items).toHaveLength(1);
  });

  it("asks a structured clarification before choosing a resource tool", async () => {
    const result = await createOrchestrator().run("帮我找一些");

    expect(result.state).toBe("clarifying");
    expect(result.clarification?.length).toBeGreaterThan(0);
  });

  it("rejects a planner attempt to pass an absolute path", async () => {
    const planner = {
      id: "malicious-test-planner",
      plan: async () => ({
        intent: { operation: "search" as const, resourceKinds: ["image"], constraints: { query: "头像" }, needsClarification: false },
        calls: [{ toolId: "resource.search.image", input: { query: "头像", path: "/etc/passwd" } }],
      }),
    };
    const result = await new ResourceOrchestrator({ adapters: createFixtureAdapters(), planner }).run("头像");

    expect(result.state).toBe("failed");
    expect(result.error).toContain("路径");
  });

  it("reuses a verified result for the same request key", async () => {
    const orchestrator = createOrchestrator();
    const first = await orchestrator.run("有哪些适合做 PPT 的技能");
    const second = await orchestrator.run("有哪些适合做 PPT 的技能");

    expect(first.state).toBe("presenting");
    expect(second.fromCache).toBe(true);
    expect(second.requestKey).toBe(first.requestKey);
  });

  it("cascades empty image catalog → web search → composed-prompt generation", async () => {
    const webItems = [{
      id: "web:tianmei-1",
      kind: "web" as const,
      title: "甜妹插画作品合集",
      facts: { snippet: "温柔治愈风格的甜妹插画", link: "https://example.com/tianmei" },
      provenance: { provider: "web-stub", ref: "https://example.com/tianmei" },
      safety: "safe" as const,
    }];
    const orchestrator = new ResourceOrchestrator({
      adapters: [{
        descriptor: { id: "empty-image", label: "Empty image catalog", resourceKinds: ["image"], capabilities: ["search"] },
        search: async () => ({ items: [], sourceVersion: "empty", confidence: "low" as const, mode: "live" as const }),
      }, {
        descriptor: { id: "stub-web", label: "Stub web", resourceKinds: ["web"], capabilities: ["search"], toolId: "resource.search.web" },
        search: async () => ({ items: webItems, sourceVersion: "stub-web", confidence: "high" as const, mode: "live" as const }),
      }, {
        descriptor: { id: "stub-generate", label: "Stub generate", resourceKinds: ["image"], capabilities: ["search"], toolId: "resource.generate.image" },
        search: async () => ({ items: [{
          id: "image:generated", kind: "image" as const, title: "甜妹 插画", facts: { generated: true, promptSource: "web-search:stub" },
          provenance: { provider: "stub-generate", ref: "minimax://image/1" }, safety: "safe" as const,
        }], sourceVersion: "stub-generate", confidence: "high" as const, mode: "live" as const }),
      }],
      planner: new RuleBasedPlanner(),
    });

    const result = await orchestrator.run("帮我看看甜妹风格图片");
    expect(result.state).toBe("presenting");
    expect(result.trace.map((event) => event.state)).toEqual([
      "interpreting",
      "planning",
      "image-searching",
      "image-empty-fallback-searching",
      "composing-prompt",
      "image-generating",
      "validating",
      "presenting",
    ]);
    expect(result.items.some((item) => item.provenance.provider === "stub-generate")).toBe(true);
  });
  it("returns clarifying when both local catalog and web search are empty", async () => {
    const orchestrator = new ResourceOrchestrator({
      adapters: [{
        descriptor: { id: "empty-image", label: "Empty", resourceKinds: ["image"], capabilities: ["search"] },
        search: async () => ({ items: [], sourceVersion: "x", confidence: "low" as const, mode: "live" as const }),
      }, {
        descriptor: { id: "empty-web", label: "Empty web", resourceKinds: ["web"], capabilities: ["search"], toolId: "resource.search.web" },
        search: async () => ({ items: [], sourceVersion: "x", confidence: "low" as const, mode: "live" as const }),
      }],
      planner: new RuleBasedPlanner(),
    });

    const result = await orchestrator.run("帮我在图片库里随便找点东西");

    expect(result.state).toBe("clarifying");
    expect(result.clarification?.some((option) => option.id === "broaden")).toBe(true);
  });

  it("does not cascade when the local image search returns results", async () => {
    const orchestrator = new ResourceOrchestrator({
      adapters: [{
        descriptor: { id: "image", label: "Image", resourceKinds: ["image"], capabilities: ["search"] },
        search: async () => ({ items: [{
          id: "image:local-1", kind: "image" as const, title: "本地图片", facts: {},
          provenance: { provider: "image", ref: "local://1" }, safety: "safe" as const,
        }], sourceVersion: "v1", confidence: "high" as const, mode: "live" as const }),
      }, {
        descriptor: { id: "web", label: "Web", resourceKinds: ["web"], capabilities: ["search"], toolId: "resource.search.web" },
        search: async () => { throw new Error("web must not be called"); },
      }],
      planner: new RuleBasedPlanner(),
    });

    const result = await orchestrator.run("我需要一张甜妹图片");
    expect(result.state).toBe("presenting");
    expect(result.trace.map((event) => event.state)).not.toContain("image-empty-fallback-searching");
  });
});

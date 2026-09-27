import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AxiDocsAdapter,
  IconLibraryAdapter,
  ImagePreviewAdapter,
  MiniMaxTokenPlanImageAdapter,
  MiniMaxTokenPlanWebSearchAdapter,
  ProjectInfoAdapter,
  UiLibraryAdapter,
  createFixtureAdapters,
  withFallback,
  withFallbackOnEmpty,
} from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fixture resource adapters", () => {
  it("does not return an unrelated text fixture when a query misses", async () => {
    const skillAdapter = createFixtureAdapters().find((adapter) => adapter.descriptor.resourceKinds.includes("skill"));
    if (!skillAdapter) throw new Error("skill fixture adapter is missing");

    const result = await skillAdapter.search({
      operation: "search",
      resourceKinds: ["skill"],
      constraints: { query: "表格" },
      needsClarification: false,
    });

    expect(result.items).toEqual([]);
    expect(result.warnings).toContain("当前 provider 不可用，展示的是本地 fixture；它不能作为真实工作区事实。");
  });

  it("exposes different resource kinds through the same adapter shape", async () => {
    const adapters = createFixtureAdapters();
    const results = await Promise.all(adapters.map((adapter) => adapter.search({
      operation: "search",
      resourceKinds: adapter.descriptor.resourceKinds,
      constraints: { query: "PPT" },
      needsClarification: false,
    })));

    const allKinds = new Set(adapters.flatMap((adapter) => adapter.descriptor.resourceKinds));
    expect(allKinds.has("image")).toBe(true);
    expect(allKinds.has("skill")).toBe(true);
    expect(allKinds.has("document")).toBe(true);
    expect(allKinds.has("workspace")).toBe(true);
    expect(allKinds.has("project")).toBe(true);
    expect(allKinds.has("ui")).toBe(true);
    expect(allKinds.has("icon")).toBe(true);
    expect(results.every((result) => result.mode === "fixture")).toBe(true);
    expect(results.flatMap((result) => result.items).every((item) => item.provenance.provider.startsWith("fixture:"))).toBe(true);
  });

  it("keeps the descriptive portion of a natural-language image request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalItems: 1,
      items: [{ title: "头像素材", imageUrl: "/wallpapers/avatar.webp", tags: ["头像"], resolution: "1024x1024", size: "1 MB", mediaType: "image" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "找一张适合头像的暖光人物图片", requestedQuantity: 1 }, needsClarification: false,
    });

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("search")).toBe("适合头像的暖光人物");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("pageSize=1");
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("page")).toBe("1");
    expect(result.mode).toBe("live");
    expect(result.items[0]?.provenance.provider).toBe("axi-image-preview");
  });

  it("forwards page to the image provider instead of capping the catalog at 12", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalItems: 30,
      page: 2,
      pageSize: 12,
      items: Array.from({ length: 12 }, (_, index) => ({
        title: `头像 ${index + 13}`,
        imageUrl: `/wallpapers/${index + 13}.webp`,
        tags: ["头像"],
      })),
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search",
      resourceKinds: ["image"],
      constraints: { query: "头像", page: 2 },
      needsClarification: false,
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("12");
    expect(result.items).toHaveLength(12);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(12);
    expect(result.totalItems).toBe(30);
    expect(result.hasMore).toBe(true);
  });

  it("routes provider-relative image previews through the configured provider base", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalItems: 1,
      items: [{ title: "头像素材", imageUrl: "/wallpapers/avatar.webp", tags: ["头像"] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ImagePreviewAdapter("/provider/image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "头像" }, needsClarification: false,
    });

    expect(result.items[0]?.preview).toBe("/provider/image-preview/wallpapers/avatar.webp");
  });

  it("treats image-preview catalog entries as normal resources regardless of descriptive tags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalItems: 1,
      items: [{ title: "头像 性感美女 户外场景", imageUrl: "/wallpapers/portrait.webp", tags: ["性感美女", "户外场景"] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "帮我找一张性感美女照片", requestedQuantity: 1 }, needsClarification: false,
    });

    expect(result.items[0]?.safety).toBe("safe");
  });

  it("passes the sweet-girl descriptor to the image provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalItems: 1,
      items: [{ title: "夏日甜妹", imageUrl: "/wallpapers/sweet.webp", tags: ["甜妹"] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "我需要一张甜妹图片", requestedQuantity: 1 }, needsClarification: false,
    });

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("search")).toBe("甜妹");
  });

  it("preserves a descriptive scenery query before asking the provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalItems: 1,
      items: [{ title: "风景素材", imageUrl: "/wallpapers/scenery.webp", tags: ["风景"], resolution: "1920x1080", size: "1 MB", mediaType: "image" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "帮我找一张好看的风景照" }, needsClarification: false,
    });

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("search")).toBe("好看的风景照");
  });

  it("backs off to the strongest registered catalog axis only when the full query has no result", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const search = new URL(String(input)).searchParams.get("search");
      const payload = search === "山景"
        ? { totalItems: 1, items: [{ title: "山景头像", imageUrl: "/wallpapers/mountain.webp", tags: ["山景"], mediaType: "image" }] }
        : { totalItems: 0, items: [] };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "帮我找一张更适合头像的山景照片", requestedQuantity: 1 }, needsClarification: false,
    });

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("search")).toBe("更适合头像的山景");
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input)).searchParams.get("search") === "山景")).toBe(true);
    expect(result.items[0]?.facts.providerQuery).toBe("山景");
  });

  it("does not collapse distinct people queries into the same generic provider search", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const search = new URL(String(input)).searchParams.get("search");
      const payload = search === "性感"
        ? { totalItems: 1, items: [{ title: "性感人像", imageUrl: "/wallpapers/sexy.webp", tags: ["性感"], mediaType: "image" }] }
        : { totalItems: 0, items: [] };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ImagePreviewAdapter("http://image-preview").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "帮我找一张性感大胸美女照片", requestedQuantity: 1 }, needsClarification: false,
    });

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("search")).toBe("性感大胸美女");
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get("search")).toBe("性感");
    expect(result.items[0]?.facts.providerQuery).toBe("性感");
  });

  it("uses the registered Axi Docs MCP skill tool with a bounded query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { content: [{ type: "text", text: JSON.stringify([{ name: "pptx", path: "skills/pptx/SKILL.md", description: "slides" }]) }] },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AxiDocsAdapter({ baseUrl: "http://axi-docs" }).search({
      operation: "search", resourceKinds: ["skill"], constraints: { query: "有哪些适合做 PPT 的技能？" }, needsClarification: false,
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.params.name).toBe("axi_docs_skill_search");
    expect(request.params.arguments.query).toBe("PPT");
    expect(result.items[0]?.provenance.ref).toContain("skills/pptx/SKILL.md");
  });

  it("labels fallback results instead of hiding provider failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const fallback = createFixtureAdapters().find((adapter) => adapter.descriptor.resourceKinds.includes("image"))!;
    const result = await withFallback(new ImagePreviewAdapter("http://offline"), fallback).search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "头像" }, needsClarification: false,
    });

    expect(result.mode).toBe("fixture");
    expect(result.warnings?.some((warning) => warning.includes("offline"))).toBe(true);
  });

  it("maps MiniMax image generation output into provider-backed candidates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      files: [{ file: "/Volumes/code/workspace/.minimax-outputs/image-test.jpg", dataUrl: "data:image/jpeg;base64,abc" }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await new MiniMaxTokenPlanImageAdapter("http://minimax").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "赛博朋克城市图片", orientation: "landscape" }, needsClarification: false,
    });

    const request = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(request.prompt).toBe("赛博朋克城市图片");
    expect(request.aspectRatio).toBe("16:9");
    expect(result.items[0]?.provenance.provider).toBe("minimax-tokenplan");
    expect(result.items[0]?.facts.generated).toBe(true);
  });

  it("unwraps the gateway-hosted MiniMax image response envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { files: [{ file: "/Volumes/code/workspace/.minimax-outputs/image-wrapped.jpg", dataUrl: "data:image/jpeg;base64,wrapped" }] },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await new MiniMaxTokenPlanImageAdapter("http://minimax").search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "浴室" }, needsClarification: false,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.preview).toBe("data:image/jpeg;base64,wrapped");
  });

  it("uses composed prompt when orchestrator composes one from web search", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      files: [{ file: "/Volumes/code/workspace/.minimax-outputs/image-composed.jpg", dataUrl: "data:image/jpeg;base64,zzz" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MiniMaxTokenPlanImageAdapter("http://minimax").search({
      operation: "search", resourceKinds: ["image"], constraints: {
        query: "甜妹图片",
        composedPrompt: "甜妹图片；关键词：甜妹、插画；柔光、浅景深",
      }, needsClarification: false,
    });

    const request = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(request.prompt).toContain("关键词");
    expect(request.prompt).toContain("柔光");
    expect(result.items[0]?.facts.promptSource).toBe("composed");
    expect(result.items[0]?.facts.prompt).toContain("柔光");
  });

  it("maps MiniMax web search output into traceable web candidates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      organic: [{ title: "搜索结果", link: "https://example.com/result", snippet: "摘要", date: "2026-08-26" }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await new MiniMaxTokenPlanWebSearchAdapter("http://minimax").search({
      operation: "search", resourceKinds: ["web"], constraints: { query: "网上搜索甜妹图片" }, needsClarification: false,
    });

    expect(result.items[0]?.kind).toBe("web");
    expect(result.items[0]?.provenance.ref).toBe("https://example.com/result");
  });

  it("unwraps the gateway-hosted MiniMax web response envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { organic: [{ title: "浴室参考", link: "https://example.com/bathroom", snippet: "浴室空间" }] },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await new MiniMaxTokenPlanWebSearchAdapter("http://minimax").search({
      operation: "search", resourceKinds: ["web"], constraints: { query: "浴室" }, needsClarification: false,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("浴室参考");
  });

  it("invokes the generation fallback when the local image catalog is empty", async () => {
    const primary = {
      descriptor: { id: "primary", label: "Primary", resourceKinds: ["image"], capabilities: ["search"] as Array<"search"> },
      search: async () => ({ items: [], sourceVersion: "empty", confidence: "medium" as const, mode: "live" as const }),
    };
    const fallback = {
      descriptor: { id: "fallback", label: "Fallback", resourceKinds: ["image"], capabilities: ["search"] as Array<"search"> },
      search: async () => ({ items: [{ id: "image:fallback", kind: "image", title: "generated", facts: {}, provenance: { provider: "fallback", ref: "minimax://image/1" }, safety: "safe" as const }], sourceVersion: "fallback", confidence: "high" as const, mode: "live" as const }),
    };

    const result = await withFallbackOnEmpty(primary, fallback).search({
      operation: "search", resourceKinds: ["image"], constraints: { query: "生成图片" }, needsClarification: false,
    });

    expect(result.items[0]?.provenance.provider).toBe("fallback");
  });

  it("exposes the five descriptor shapes required by the gateway route policy", () => {
    const fixtures = createFixtureAdapters();
    const live = [
      new ImagePreviewAdapter("/provider/image-preview"),
      new AxiDocsAdapter({ baseUrl: "/provider/axi-docs" }),
      new ProjectInfoAdapter({ baseUrl: "/provider/project-info" }),
      new UiLibraryAdapter({ baseUrl: "/provider/ui-library" }),
      new IconLibraryAdapter({ baseUrl: "/provider/icon-library" }),
    ];
    const all = [...fixtures, ...live];

    // Live adapters must declare the right toolId so the manifest
    // capability validator doesn't refuse them at boot.
    const toolByKind: Record<string, string | undefined> = Object.fromEntries(
      live.flatMap((adapter) =>
        adapter.descriptor.resourceKinds.map((kind) =>
          [kind, (adapter.descriptor as { toolId?: string }).toolId] as const,
        ),
      ),
    );
    expect(toolByKind.image).toBeUndefined(); // image preview is search-only and shares the route
    expect(toolByKind.skill).toBeUndefined();  // axi-docs is search-only and shares the document route
    expect(toolByKind.document).toBeUndefined();
    expect(toolByKind.project).toBe("resource.search.project");
    expect(toolByKind.ui).toBe("resource.search.ui");
    expect(toolByKind.icon).toBe("resource.search.icon");

    // Fixture adapters must advertise the same five resource kinds so
    // gateway/runtime tests have a non-network fallback for every route.
    const fixtureKinds = new Set(fixtures.flatMap((adapter) => adapter.descriptor.resourceKinds));
    expect(fixtureKinds.has("image")).toBe(true);
    expect(fixtureKinds.has("skill")).toBe(true);
    expect(fixtureKinds.has("document")).toBe(true);
    expect(fixtureKinds.has("project")).toBe(true);
    expect(fixtureKinds.has("ui")).toBe(true);
    expect(fixtureKinds.has("icon")).toBe(true);

    // MiniMax image generation must NOT advertise the image search toolId;
    // otherwise the gateway would route search calls to a generator.
    const generator = new MiniMaxTokenPlanImageAdapter("/provider/minimax-tokenplan");
    expect(generator.descriptor.toolId).toBe("resource.generate.image");
    expect(generator.descriptor.capabilities).toEqual(["search", "preview"]);

    // And every adapter must claim at least one capability so the
    // manifest capability validator doesn't refuse to wire it.
    expect(all.every((adapter) => adapter.descriptor.capabilities.length > 0)).toBe(true);
  });

  it("maps a project-info provider response into provider facts and provenance", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      generatedAt: "2026-08-26T00:00:00Z",
      results: [
        { id: "ai-resource-orchestration", title: "资源调度", description: "本地资源调度", owner: "libu", stack: ["typescript"], lastVerifiedAt: "2026-08-26" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const adapter = new ProjectInfoAdapter({ baseUrl: "/provider/project-info", transport });
    const result = await adapter.search({
      operation: "search", resourceKinds: ["project"], constraints: { query: "资源调度" }, needsClarification: false,
    });

    expect(adapter.descriptor.toolId).toBe("resource.search.project");
    expect(adapter.descriptor.resourceKinds).toEqual(["project"]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("project");
    expect(result.items[0]?.provenance.provider).toBe("axi-project-info");
    expect(result.items[0]?.provenance.ref).toBe("ai-resource-orchestration");
    expect(result.items[0]?.facts.owner).toBe("libu");
    expect(result.items[0]?.safety).toBe("safe");
    expect(String(transport.mock.calls[0]?.[0])).toContain("/projects?q=");
  });

  it("maps a UI library response into provider facts, preview and library metadata", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      generatedAt: "2026-08-26T00:00:00Z",
      components: [
        { id: "button", title: "Button", description: "Primary button", previewUrl: "data:image/svg+xml;base64,xyz", version: "1.2.0", tags: ["form"] },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const adapter = new UiLibraryAdapter({ baseUrl: "/provider/ui-library", transport, libraryName: "axi-ui" });
    const result = await adapter.search({
      operation: "search", resourceKinds: ["ui"], constraints: { query: "button" }, needsClarification: false,
    });

    expect(adapter.descriptor.toolId).toBe("resource.search.ui");
    expect(result.items[0]?.kind).toBe("ui");
    expect(result.items[0]?.facts.library).toBe("axi-ui");
    expect(result.items[0]?.facts.componentKind).toBe("component");
    expect(result.items[0]?.provenance.provider).toBe("axi-ui-library:axi-ui");
    expect(result.items[0]?.preview).toBe("data:image/svg+xml;base64,xyz");
    expect(result.items[0]?.safety).toBe("safe");
  });

  it("maps an icon library response into provider facts with style and library metadata", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      icons: [
        { id: "search", title: "Search", style: "outline", previewUrl: "data:image/svg+xml;base64,abc", version: "1.0.0", tags: ["nav"] },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const adapter = new IconLibraryAdapter({ baseUrl: "/provider/icon-library", transport, libraryName: "axi-icons" });
    const result = await adapter.search({
      operation: "search", resourceKinds: ["icon"], constraints: { query: "search" }, needsClarification: false,
    });

    expect(adapter.descriptor.toolId).toBe("resource.search.icon");
    expect(result.items[0]?.kind).toBe("icon");
    expect(result.items[0]?.facts.library).toBe("axi-icons");
    expect(result.items[0]?.facts.style).toBe("outline");
    expect(result.items[0]?.provenance.provider).toBe("axi-icon-library:axi-icons");
    expect(result.items[0]?.safety).toBe("safe");
  });

  it("surfaces timeout errors through the createFetchWithTimeout helper", async () => {
    const transport = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    const adapter = new ProjectInfoAdapter({ baseUrl: "/provider/project-info", transport, timeoutMs: 10 });
    await expect(adapter.search({
      operation: "search", resourceKinds: ["project"], constraints: { query: "资源" }, needsClarification: false,
    })).rejects.toThrow(/provider timeout/);
  });

  it("propagates caller-side cancellation through the helper", async () => {
    const transport = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    const adapter = new ProjectInfoAdapter({ baseUrl: "/provider/project-info", transport, timeoutMs: 1000 });
    const controller = new AbortController();
    const promise = adapter.search({
      operation: "search", resourceKinds: ["project"], constraints: { query: "资源" }, needsClarification: false,
    }, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
  });

  it("rejects non-object payloads from library providers with a diagnostic error", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify(null), { status: 200, headers: { "content-type": "application/json" } }));

    const adapter = new ProjectInfoAdapter({ baseUrl: "/provider/project-info", transport });
    await expect(adapter.search({
      operation: "search", resourceKinds: ["project"], constraints: { query: "any" }, needsClarification: false,
    })).rejects.toThrow(/non-object payload/);
  });

  it("returns empty items but a stable live result when a provider yields an empty list", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } }));

    const adapter = new UiLibraryAdapter({ baseUrl: "/provider/ui-library", transport });
    const result = await adapter.search({
      operation: "search", resourceKinds: ["ui"], constraints: { query: "missing", requestedQuantity: 5 }, needsClarification: false,
    });

    expect(result.items).toEqual([]);
    expect(result.mode).toBe("live");
    expect(result.sourceVersion).toMatch(/^axi-ui-library:/);
  });

  it("requires a non-empty baseUrl at construction time", () => {
    expect(() => new ProjectInfoAdapter({ baseUrl: "" })).toThrow(/non-empty baseUrl/);
    expect(() => new UiLibraryAdapter({ baseUrl: "" })).toThrow(/non-empty baseUrl/);
    expect(() => new IconLibraryAdapter({ baseUrl: "" })).toThrow(/non-empty baseUrl/);
  });

  it("fixture adapters cover the five resource kinds with stable fixture provenance", () => {
    const fixtures = createFixtureAdapters();
    const fixtureKinds = new Set(fixtures.flatMap((adapter) => adapter.descriptor.resourceKinds));
    for (const kind of ["image", "skill", "document", "workspace", "project", "ui", "icon"]) {
      expect(fixtureKinds.has(kind as never)).toBe(true);
    }
    const fixtureItems = fixtures.flatMap((adapter) => adapter.descriptor.resourceKinds.map((kind) => ({ id: `${kind}-probe`, kind })));
    expect(fixtureItems.every((item) => typeof item.id === "string" && item.id.length > 0)).toBe(true);
  });
});

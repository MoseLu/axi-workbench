import { describe, expect, it, vi } from "vitest";
import type { PlannerResult, ResourceCandidate } from "@axi/gateway-contracts";
import type { Planner } from "@axi/resource-orchestrator/browser";
import { KindHintPlanner } from "./lib/planner";
import { dispatchPlannerResult, gatewayBaseUrl, runPlanner } from "./gateway-client";

const makePlanner = (overrides: Partial<PlannerResult> = {}): Planner => ({
  id: "test-planner",
  async plan(input: string) {
    return {
      intent: {
        operation: "search",
        resourceKinds: ["image"],
        constraints: { query: input },
        needsClarification: false,
      },
      calls: [{ toolId: "resource.search.image", input: { query: input } }],
      explanation: "stub",
      ...overrides,
    } satisfies PlannerResult;
  },
});

const makeClarifyingPlanner = (): Planner => ({
  id: "test-clarifying-planner",
  async plan(_input: string) {
    return {
      intent: {
        operation: "search",
        resourceKinds: [],
        constraints: {},
        needsClarification: true,
        clarificationReason: "需要补充资源类型",
      },
      calls: [],
      clarification: [{ id: "image", label: "图片资源", value: "图片" }],
      explanation: "请先确认资源类型",
    } satisfies PlannerResult;
  },
});

const fakeItem = (overrides: Partial<ResourceCandidate> = {}): ResourceCandidate => ({
  id: "fixture-image-sunlit",
  kind: "image",
  title: "暖光头像构图示例",
  preview: "/wallpapers/sample.webp",
  facts: { tags: ["头像", "暖光"] },
  provenance: { provider: "fixture:image-preview", ref: "fixture://image/sunlit", version: "fixture-v1" },
  safety: "safe",
  ...overrides,
});

const makeGatewayResponse = (overrides: Partial<{ items: ResourceCandidate[]; warnings: string[]; trace: string[]; mode: "live" | "fixture"; sourceVersion: string }> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    contractVersion: 1,
    requestId: "gw-test-1",
    fromCache: false,
    trace: overrides.trace ?? [],
    planner: {},
    result: {
      items: overrides.items ?? [fakeItem()],
      sourceVersion: overrides.sourceVersion ?? "fixture-v1",
      confidence: "high",
      mode: overrides.mode ?? "fixture",
      warnings: overrides.warnings ?? [],
    },
    warnings: [],
  }),
});

describe("gateway-client (GHA-012)", () => {
  it("posts the planner output to /gateway/run and rebuilds a RunResult", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({ items: [fakeItem({ id: "img-1", preview: "/wallpapers/one.webp" })] }));
    const planner = makePlanner();

    const result = await runPlanner(planner, {
      input: "找一张暖光头像",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gateway.test/gateway/run");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "content-type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body.planner.calls[0].toolId).toBe("resource.search.image");
    expect(result.state).toBe("presenting");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("img-1");
    expect(result.trace.some((event) => event.state === "interpreting")).toBe(true);
    expect(result.trace.some((event) => event.state === "planning")).toBe(true);
    expect(result.trace.some((event) => event.state === "executing")).toBe(true);
    expect(result.trace.some((event) => event.state === "presenting")).toBe(true);
  });

  it("replays the gateway-owned image cascade trace in dispatch order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({
      trace: [
        "image-searching|本地图库搜索中",
        "image-empty-fallback-searching|图库为空，正在全网搜索",
        "composing-prompt|合成生成 prompt|网络参考不足，使用原始需求生成",
        "image-generating|图片生成中",
      ],
    }));

    const result = await runPlanner(makePlanner(), {
      input: "我想要一张浴室场景",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });

    const states = result.trace.map((event) => event.state);
    expect(states.indexOf("image-searching")).toBeGreaterThan(states.indexOf("executing"));
    expect(states.indexOf("image-empty-fallback-searching")).toBeGreaterThan(states.indexOf("image-searching"));
    expect(states.indexOf("composing-prompt")).toBeGreaterThan(states.indexOf("image-empty-fallback-searching"));
    expect(states.indexOf("image-generating")).toBeGreaterThan(states.indexOf("composing-prompt"));
    expect(result.state).toBe("presenting");
  });

  it("returns a clarifying RunResult without calling fetch when the planner asks for clarification", async () => {
    const fetchMock = vi.fn();
    const planner = makeClarifyingPlanner();

    const result = await runPlanner(planner, {
      input: "随便找点东西",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.state).toBe("clarifying");
    expect(result.clarification).toEqual([{ id: "image", label: "图片资源", value: "图片" }]);
    expect(result.items).toEqual([]);
  });

  it("maps a gateway 502 / invalid response to a failed RunResult", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ contractVersion: 1, requestId: "gw-test-2", code: "provider_error", message: "image-preview 不可用" }),
    });
    const planner = makePlanner();

    const result = await runPlanner(planner, {
      input: "一张图",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });

    expect(result.state).toBe("failed");
    expect(result.error).toBe("image-preview 不可用");
    expect(result.items).toEqual([]);
  });

  it("filters flagged candidates unless allowFlagged is true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({
      items: [fakeItem({ id: "flagged-1", safety: "flagged" })],
      warnings: [],
    }));
    const planner = makePlanner();

    const blocked = await runPlanner(planner, {
      input: "头像",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    expect(blocked.state).toBe("clarifying");
    expect(blocked.clarification?.[0]?.id).toBe("allow-flagged");

    const fetchMockAllowed = vi.fn().mockResolvedValue(makeGatewayResponse({
      items: [fakeItem({ id: "flagged-1", safety: "flagged" })],
    }));
    const allowed = await runPlanner(planner, {
      input: "头像",
      baseUrl: "http://gateway.test",
      fetcher: fetchMockAllowed as unknown as typeof fetch,
      allowFlagged: true,
    });
    expect(allowed.state).toBe("presenting");
    expect(allowed.items.map((item) => item.id)).toEqual(["flagged-1"]);
  });

  it("propagates the AbortSignal into the fetch call", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init: RequestInit = {}) => {
      expect(init.signal).toBeDefined();
      return makeGatewayResponse();
    });
    const planner = makePlanner();
    const controller = new AbortController();
    await runPlanner(planner, {
      input: "image",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
      signal: controller.signal,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a cancelled RunResult when the planner is aborted before planning", async () => {
    const fetchMock = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const result = await runPlanner(makePlanner(), {
      input: "x",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
      signal: controller.signal,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.state).toBe("cancelled");
  });

  it("uses the override baseUrl when supplied", () => {
    expect(gatewayBaseUrl("http://override.example:9000")).toBe("http://override.example:9000");
  });

  it("strips a trailing slash from the override", () => {
    expect(gatewayBaseUrl("http://override.example:9000/")).toBe("http://override.example:9000");
  });

  it("returns the default baseUrl when nothing is configured", () => {
    const resolved = gatewayBaseUrl();
    expect(typeof resolved).toBe("string");
    expect(resolved).toBe(import.meta.env.DEV ? "" : "http://127.0.0.1:8787");
  });

  it("dispatchPlannerResult sends the supplied planner output verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse());
    const planner = makePlanner();
    const fixedPlan: PlannerResult = {
      intent: {
        operation: "search",
        resourceKinds: ["skill"],
        constraints: { query: "PPT" },
        needsClarification: false,
      },
      calls: [{ toolId: "resource.search.skill", input: { query: "PPT" } }],
      explanation: "use skill route",
    };
    const result = await dispatchPlannerResult(planner, fixedPlan, {
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.planner.calls[0].toolId).toBe("resource.search.skill");
    expect(result.state).toBe("presenting");
  });
});

describe("gateway-client (lane-workbench: project/ui/icon)", () => {
  it("sends resource.search.project when the user asks about a project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({ items: [] }));
    const planner = new KindHintPlanner(makePlanner());
    const result = await runPlanner(planner, {
      input: "查一下 gateway-ha 项目的状态",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.planner.calls[0].toolId).toBe("resource.search.project");
    expect(body.planner.intent.resourceKinds).toEqual(["project"]);
    expect(result.state).toBe("clarifying");
  });

  it("sends resource.search.ui when the user asks for a UI component", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({ items: [] }));
    const planner = new KindHintPlanner(makePlanner());
    await runPlanner(planner, {
      input: "找一个 UI 组件：日期选择器",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.planner.calls[0].toolId).toBe("resource.search.ui");
    expect(body.planner.intent.resourceKinds).toEqual(["ui"]);
  });

  it("sends resource.search.icon when the user asks for an icon", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({ items: [] }));
    const planner = new KindHintPlanner(makePlanner());
    await runPlanner(planner, {
      input: "找图标：warning",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.planner.calls[0].toolId).toBe("resource.search.icon");
    expect(body.planner.intent.resourceKinds).toEqual(["icon"]);
  });

  it("keeps the existing image tool for legacy queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({ items: [] }));
    const planner = new KindHintPlanner(makePlanner());
    await runPlanner(planner, {
      input: "找一张暖光头像",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.planner.calls[0].toolId).toBe("resource.search.image");
  });

  it("surfaces the gateway error envelope without leaking provider details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ contractVersion: 1, requestId: "gw-proj-1", code: "provider_error", message: "项目 provider 不可用" }),
    });
    const planner = new KindHintPlanner(makePlanner());
    const result = await runPlanner(planner, {
      input: "查一下项目",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    expect(result.state).toBe("failed");
    expect(result.error).toBe("项目 provider 不可用");
    expect(result.warnings).toEqual([]);
  });

  it("propagates abort into the gateway fetch for project queries", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit = {}) => {
      expect(init.signal).toBeDefined();
      return Promise.resolve(makeGatewayResponse({ items: [] }));
    });
    const planner = new KindHintPlanner(makePlanner());
    const controller = new AbortController();
    await runPlanner(planner, {
      input: "查项目",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
      signal: controller.signal,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a gateway-supplied degradation warning for icon queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeGatewayResponse({
      items: [fakeItem({ id: "icon-1", kind: "icon", title: "warning", preview: undefined, facts: { tags: ["warning"] }, provenance: { provider: "fixture:icons", ref: "fixture://icon/warning", version: "fixture-v1" }, safety: "safe" })],
      warnings: ["图标 provider 不可用，结果来自 fallback。"],
    }));
    const planner = new KindHintPlanner(makePlanner());
    const result = await runPlanner(planner, {
      input: "找图标 warning",
      baseUrl: "http://gateway.test",
      fetcher: fetchMock as unknown as typeof fetch,
    });
    expect(result.state).toBe("presenting");
    expect(result.warnings.some((warning) => /provider 不可用/u.test(warning))).toBe(true);
    expect(result.items[0].kind).toBe("icon");
  });
});

import {
  fetchDocsMetadata,
  fetchHealthLive,
  fetchHealthReady,
  fetchOpenApiDocument,
  fetchRoutes,
  GatewayProbeError,
} from "./gateway-client";

/**
 * Behaviour tests for the public gateway probe surface (GHA-012 / GHA-080).
 * These exercise success, error-envelope, shape, cancellation, and metadata
 * paths with real `fetch` mocks. They never assert on string substrings of
 * the request body to avoid coupling to incidental JSON whitespace.
 */
describe("gateway-client probes (GHA-012 / GHA-080)", () => {
  const makeJsonResponse = (status: number, body: unknown, contentType = "application/json"): Response => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name.toLowerCase() === "content-type" ? contentType : null },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response);

  it("fetchHealthLive returns parsed uptime + status and emits x-request-id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      contractVersion: 1,
      status: "ok",
      uptimeMs: 12345,
    }));
    const result = await fetchHealthLive({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch, requestId: "req-live-1" });
    expect(result).toEqual({ contractVersion: 1, status: "ok", uptimeMs: 12345 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gateway.test/health/live");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ "x-request-id": "req-live-1" });
    expect((init.headers as Record<string, string>).accept).toMatch(/application\/json/u);
  });

  it("fetchHealthLive throws GatewayProbeError when the body is missing uptimeMs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, { status: "ok" }));
    await expect(fetchHealthLive({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "invalid_response",
    });
  });

  it("fetchHealthLive throws GatewayProbeError when contractVersion is not 1 (instead of silently falling back)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      contractVersion: 99,
      status: "ok",
      uptimeMs: 12345,
    }));
    await expect(fetchHealthLive({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "invalid_response",
    });
    await expect(fetchHealthLive({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toThrow(/contractVersion/u);
  });

  it("fetchHealthLive throws GatewayProbeError when contractVersion is missing (instead of silently falling back to 1)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      status: "ok",
      uptimeMs: 12345,
    }));
    await expect(fetchHealthLive({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "invalid_response",
    });
  });

  it("fetchHealthReady throws GatewayProbeError when contractVersion is not 1 (instead of silently falling back)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      contractVersion: 99,
      status: "ready",
      manifestVersion: 7,
      routeCount: 9,
      components: [
        { id: "manifest", status: "up", lastCheckedAt: "2026-08-26T00:00:00.000Z" },
      ],
    }));
    await expect(fetchHealthReady({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "invalid_response",
    });
    await expect(fetchHealthReady({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toThrow(/contractVersion/u);
  });

  it("fetchHealthReady throws GatewayProbeError when contractVersion is missing (instead of silently falling back to 1)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      status: "ready",
      manifestVersion: 7,
      routeCount: 9,
      components: [
        { id: "manifest", status: "up", lastCheckedAt: "2026-08-26T00:00:00.000Z" },
      ],
    }));
    await expect(fetchHealthReady({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "invalid_response",
    });
  });

  it("fetchHealthReady maps readiness components without leaking provider details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      contractVersion: 1,
      status: "ready",
      manifestVersion: 7,
      routeCount: 9,
      components: [
        { id: "manifest", status: "up", lastCheckedAt: "2026-08-26T00:00:00.000Z" },
        { id: "registry", status: "degraded", detail: "1 target missing", lastCheckedAt: "2026-08-26T00:00:01.000Z" },
        { id: "provider:image", status: "down", lastCheckedAt: "2026-08-26T00:00:02.000Z" },
      ],
    }));
    const result = await fetchHealthReady({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    expect(result.status).toBe("ready");
    expect(result.routeCount).toBe(9);
    expect(result.components).toHaveLength(3);
    expect(result.components[1]).toMatchObject({ id: "registry", status: "degraded", detail: "1 target missing" });
    expect(result.components[2].status).toBe("down");
    // Sanity: server secrets never appear in the workbench-shaped output.
    for (const component of result.components) {
      expect(component).not.toHaveProperty("path");
      expect(component).not.toHaveProperty("token");
    }
  });

  it("fetchRoutes returns the redacted routes projection verbatim", async () => {
    const capturedAt = "2026-08-26T00:00:00.000Z";
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      manifestVersion: 7,
      capturedAt,
      routes: [
        {
          id: "route.image",
          toolId: "resource.search.image",
          description: "image search",
          targetIds: ["target.image.preview", "target.image.fallback"],
          loadBalancer: "weighted-round-robin",
          capabilities: ["image.search"],
        },
        {
          id: "route.document-fallback",
          toolId: "resource.search.document",
          description: "document fallback",
          targetIds: ["target.document.fallback"],
          loadBalancer: "failover-only",
          capabilities: ["document.search"],
        },
      ],
    }));
    const result = await fetchRoutes({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    expect(result.manifestVersion).toBe(7);
    expect(result.capturedAt).toBe(capturedAt);
    expect(result.routes).toHaveLength(2);
    expect(result.routes[0]).toEqual({
      id: "route.image",
      toolId: "resource.search.image",
      description: "image search",
      targetIds: ["target.image.preview", "target.image.fallback"],
      loadBalancer: "weighted-round-robin",
      capabilities: ["image.search"],
    });
    expect(result.routes[1].loadBalancer).toBe("failover-only");
    // Sanity: the workbench does not invent fields the gateway never emitted.
    for (const route of result.routes) {
      expect(route).not.toHaveProperty("path");
      expect(route).not.toHaveProperty("token");
      expect(route).not.toHaveProperty("adapter");
      expect(route).not.toHaveProperty("provider");
    }
  });

  it("fetchRoutes rejects payloads that look like the legacy kinds/policies contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      contractVersion: 1,
      kinds: [{ kind: "image", primaryRouteId: "route.image", fallbackRouteId: "route.image-fallback" }],
      policies: [{ routeId: "route.image", toolId: "resource.search.image" }],
    }));
    let caught: unknown;
    try {
      await fetchRoutes({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GatewayProbeError);
    expect(caught).toMatchObject({ name: "GatewayProbeError", code: "invalid_response" });
    const message = (caught as GatewayProbeError).message;
    expect(message).toMatch(/manifestVersion|routes/);
  });

  it("fetchRoutes rejects an unknown loadBalancer strategy instead of inventing one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      manifestVersion: 1,
      capturedAt: "2026-08-26T00:00:00.000Z",
      routes: [
        {
          id: "route.image",
          toolId: "resource.search.image",
          description: "image search",
          targetIds: ["target.image.preview"],
          loadBalancer: "random-pick",
          capabilities: ["image.search"],
        },
      ],
    }));
    let caught: unknown;
    try {
      await fetchRoutes({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GatewayProbeError);
    expect(caught).toMatchObject({ code: "invalid_response" });
    expect((caught as GatewayProbeError).message).toMatch(/loadBalancer/);
  });

  it("fetchRoutes requires capturedAt to be an ISO timestamp string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      manifestVersion: 1,
      capturedAt: 12345,
      routes: [],
    }));
    let caught: unknown;
    try {
      await fetchRoutes({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GatewayProbeError);
    expect(caught).toMatchObject({ code: "invalid_response" });
    expect((caught as GatewayProbeError).message).toMatch(/capturedAt/);
  });

  it("fetchOpenApiDocument surfaces the gateway's openapi field verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      openapi: "3.1.0",
      info: { title: "gateway", version: "1.0.0" },
      paths: { "/health/live": { get: {} } },
    }));
    const doc = await fetchOpenApiDocument({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toMatchObject({ title: "gateway" });
    expect(doc.paths?.["/health/live"]).toBeDefined();
  });

  it("fetchDocsMetadata returns url + content-type + byte length without embedding HTML", async () => {
    const html = "<!doctype html><html><body>docs page</body></html>";
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, html, "text/html; charset=utf-8"));
    const meta = await fetchDocsMetadata({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    expect(meta.url).toBe("http://gateway.test/docs");
    expect(meta.contentType).toBe("text/html; charset=utf-8");
    expect(meta.byteLength).toBe(html.length);
    // The workbench never embeds raw HTML into UI state.
    expect(meta).not.toHaveProperty("html");
    expect(meta).not.toHaveProperty("body");
  });

  it("fetchDocsMetadata still returns metadata when the gateway returns a non-2xx status with html", async () => {
    const html = "<!doctype html><html><body>unavailable</body></html>";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: (name: string) => name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null },
      text: async () => html,
    } as unknown as Response);
    const meta = await fetchDocsMetadata({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    expect(meta.status).toBe(503);
    expect(meta.byteLength).toBe(html.length);
  });

  it("maps a gateway ErrorEnvelope to GatewayProbeError with envelopeCode + requestId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(503, {
      contractVersion: 1,
      requestId: "gw-envelope-1",
      code: "not_configured",
      message: "provider image-preview is not configured",
    }));
    let caught: unknown;
    try {
      await fetchHealthLive({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GatewayProbeError);
    expect(caught).toMatchObject({
      name: "GatewayProbeError",
      code: "envelope",
      status: 503,
      envelopeCode: "not_configured",
      requestId: "gw-envelope-1",
    });
    // Sanity: the gateway message reaches the UI, but the workbench never
    // re-emits provider-only error details in a separate field.
    const err = caught as GatewayProbeError;
    expect(err.message).toContain("not configured");
    expect(err).not.toHaveProperty("details");
  });

  it("treats a non-json 5xx as invalid_response and does not silently succeed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => "text/plain" },
      text: async () => "Bad Gateway",
    } as unknown as Response);
    await expect(fetchHealthReady({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "invalid_response",
      status: 502,
    });
  });

  it("propagates AbortSignal into the probe fetch and maps AbortError to code=aborted", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
      expect(init.signal).toBeDefined();
      const error = new DOMException("aborted by test", "AbortError");
      return Promise.reject(error);
    });
    const controller = new AbortController();
    await expect(
      fetchRoutes({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch, signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "aborted",
    });
  });

  it("maps a network failure to GatewayProbeError(code=network)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:8787"));
    await expect(fetchOpenApiDocument({ baseUrl: "http://gateway.test", fetcher: fetchMock as unknown as typeof fetch })).rejects.toMatchObject({
      name: "GatewayProbeError",
      code: "network",
    });
  });

  it("never reads or forwards secret env vars (sanity)", () => {
    // The probe surface resolves baseUrl only through GatewayProbeOptions.baseUrl
    // or VITE_GATEWAY_BASE_URL. Anything else would be a contract violation.
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse(200, {
      contractVersion: 1, status: "ok", uptimeMs: 1,
    }));
    const originalEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
    // The test deliberately does NOT touch provider secret env vars.
    expect(originalEnv?.VITE_AXI_DOCS_TOKEN).toBeUndefined();
    expect(originalEnv?.VITE_LLM_API_KEY).toBeUndefined();
    // Probe still works with no env override.
    return fetchHealthLive({ fetcher: fetchMock as unknown as typeof fetch }).then((result) => {
      expect(result.status).toBe("ok");
    });
  });
});

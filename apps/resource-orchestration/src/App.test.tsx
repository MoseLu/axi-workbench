import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

/**
 * App.tsx drives the workbench through `runPlanner` → POST /gateway/run.
 * Tests stub `globalThis.fetch` and return a gateway-shaped response
 * (`{ result: { items, ... }, ... }`).
 */
const gatewayJsonResponse = (items: Array<{
  id: string;
  title: string;
  kind?: "image" | "document" | "project" | "ui" | "icon";
  preview?: string;
  facts?: Record<string, unknown>;
  safety?: "safe" | "flagged" | "blocked";
}>, warnings: string[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({
    contractVersion: 1,
    requestId: "gw-test",
    fromCache: false,
    trace: [],
    planner: {},
    result: {
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind ?? "image",
        title: item.title,
        preview: item.preview,
        facts: item.facts ?? { tags: ["test"] },
        provenance: { provider: `fixture:${item.kind ?? "image"}`, ref: `fixture://${item.kind ?? "image"}/${item.id}`, version: "fixture-v1" },
        safety: item.safety ?? "safe",
      })),
      sourceVersion: "fixture-v1",
      confidence: "high",
      mode: "fixture",
      warnings,
    },
    warnings,
  }),
});

const gatewayJsonResponseWithWarnings = (warnings: string[]) => ({
  ok: true,
  status: 200,
  json: async () => ({
    contractVersion: 1,
    requestId: "gw-warn",
    fromCache: false,
    trace: [],
    planner: {},
    result: {
      items: [{
        id: "warn-1",
        kind: "icon",
        title: "warning icon",
        facts: { style: "outline" },
        provenance: { provider: "fixture:icons", ref: "fixture://icon/warning", version: "fixture-v1" },
        safety: "safe",
      }],
      sourceVersion: "fixture-v1",
      confidence: "high",
      mode: "fixture",
      warnings,
    },
    warnings,
  }),
});

const memorySettingsJsonResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    contractVersion: 1,
    requestId: "memory-settings-test",
    settings: {
      useMemory: false,
      generateMemory: false,
      externalContextProtection: true,
      defaultScope: "global",
    },
  }),
});

/** Keep the automatic settings bootstrap out of gateway-run response queues. */
const sessionListJsonResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    summaries: [],
    contractVersion: 1,
  }),
});

const sessionCreateJsonResponse = () => ({
  ok: true,
  status: 201,
  json: async () => ({
    created: true,
    contractVersion: 1,
    session: {
      id: "ses_test0001",
      projectId: "ai-resource-orchestration",
      dateKey: new Date().toISOString().slice(0, 10),
      kind: "daily",
      status: "active",
      title: "",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
      revision: 0,
      messageCount: 0,
    },
  }),
});

const sessionAppendJsonResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    contractVersion: 1,
    summary: {
      id: "ses_test0001",
      projectId: "ai-resource-orchestration",
      dateKey: new Date().toISOString().slice(0, 10),
      kind: "daily",
      status: "active",
      title: "hello",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
      revision: 1,
      messageCount: 1,
    },
    entry: {
      id: "ent_test0001",
      role: "user",
      text: "hello",
      createdAt: "2026-08-29T00:00:00.000Z",
    },
  }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const installFetch = (gatewayFetcher: any, settingsResponse = memorySettingsJsonResponse()) => {
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url.endsWith("/memory/settings")) {
      return Promise.resolve(settingsResponse as unknown as Response);
    }
    const path = url.replace(/^https?:\/\/[^/]+/u, "").split("?")[0];
    if (path === "/sessions" && method === "GET") {
      return Promise.resolve(sessionListJsonResponse() as unknown as Response);
    }
    if (path === "/sessions" && method === "POST") {
      return Promise.resolve(sessionCreateJsonResponse() as unknown as Response);
    }
    if (path.startsWith("/sessions/") && path.endsWith("/entries") && method === "POST") {
      return Promise.resolve(sessionAppendJsonResponse() as unknown as Response);
    }
    if (path.startsWith("/sessions/") && method === "GET") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: 1,
          session: {
            id: "ses_test0001",
            schemaVersion: 1,
            projectId: "ai-resource-orchestration",
            dateKey: new Date().toISOString().slice(0, 10),
            kind: "daily",
            status: "active",
            title: "",
            createdAt: "2026-08-29T00:00:00.000Z",
            updatedAt: "2026-08-29T00:00:00.000Z",
            revision: 0,
            messageCount: 0,
            entries: [],
          },
        }),
      } as unknown as Response);
    }
    if (path.startsWith("/sessions/")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ contractVersion: 1 }) } as unknown as Response);
    }
    return gatewayFetcher(input, init);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const collectRequestBodies = (fetchMock: any): Array<Record<string, unknown>> => {
  const bodies: Array<Record<string, unknown>> = [];
  for (const call of fetchMock.mock.calls) {
    const init = call[1] as RequestInit | undefined;
    if (init?.body && typeof init.body === "string") {
      bodies.push(JSON.parse(init.body));
    }
  }
  return bodies;
};

describe("resource broker workbench", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends with Enter and keeps the composer open for Shift+Enter", async () => {
    installFetch(vi.fn().mockRejectedValue(new Error("offline in browser test")));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "按回车发送" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(screen.getByText("按回车发送", { selector: "p" })).toBeInTheDocument());
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "保留换行" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
    expect(input).toHaveValue("保留换行");
  });

  it("loads persisted memory settings before a run and applies scoped memory facts", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).endsWith("/memory/search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            contractVersion: 1,
            requestId: "memory-search-test",
            memories: [{
              id: "memory-orientation",
              kind: "preference",
              summary: "默认横屏图片",
              facts: { preferredOrientation: "landscape" },
              scope: "project",
            }],
          }),
        });
      }
      return Promise.resolve(gatewayJsonResponse([{
        id: "scoped-image",
        title: "山景图片",
        preview: "/wallpapers/mountain.webp",
      }]));
    });
    const settingsResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        contractVersion: 1,
        requestId: "memory-settings-project",
        settings: {
          useMemory: true,
          generateMemory: false,
          externalContextProtection: true,
          defaultScope: "project",
          defaultProjectId: "ai-resource-orchestration",
        },
      }),
    };
    installFetch(fetchMock, settingsResponse);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张山景图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /预览山景图片/ })).toBeInTheDocument());

    const memoryCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/memory/search"));
    expect(memoryCall).toBeDefined();
    expect(JSON.parse((memoryCall?.[1] as RequestInit).body as string)).toEqual({
      query: "帮我找一张山景图片",
      scope: "project",
      projectId: "ai-resource-orchestration",
    });
    const gatewayCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/gateway/run"));
    const gatewayBody = JSON.parse((gatewayCall?.[1] as RequestInit).body as string) as {
      planner: { intent: { constraints: Record<string, unknown> } };
    };
    expect(gatewayBody.planner.intent.constraints.orientation).toBe("landscape");
  });

  it("keeps generation independent from reading and sends only a concise contribution", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/memory/contribute")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "x-memory-contribution": "scheduled" }),
          json: async () => ({ contractVersion: 1, requestId: "memory-contribute-test", ok: true }),
        });
      }
      return Promise.resolve(gatewayJsonResponse([{
        id: "generated-memory-run",
        title: "横屏山景图片",
        preview: "/wallpapers/landscape.webp",
      }]));
    });
    const settingsResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        contractVersion: 1,
        requestId: "memory-settings-generate",
        settings: {
          useMemory: false,
          generateMemory: true,
          externalContextProtection: true,
          defaultScope: "global",
        },
      }),
    };
    installFetch(fetchMock, settingsResponse);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "记住以后横屏图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /预览横屏山景图片/ })).toBeInTheDocument());
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/memory/contribute"))).toBe(true));

    const contributionCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/memory/contribute"));
    const contributionBody = JSON.parse((contributionCall?.[1] as RequestInit).body as string) as Record<string, unknown>;
    expect(contributionBody.userInput).toBe("记住以后横屏图片");
    expect(contributionBody.summary).toBe("记住以后横屏图片");
    expect(contributionBody.usedExternalContext).toBe(false);
    expect(contributionBody.toolIds).toEqual(["resource.search.image"]);
  });

  it("shows a stop icon and live elapsed time while a request is running", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_input: RequestInfo | URL, init: RequestInit = {}) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("request aborted", "AbortError")), { once: true });
      }));
      installFetch(fetchMock);
      render(<App />);

      const input = screen.getByRole("textbox", { name: "输入消息" });
      fireEvent.change(input, { target: { value: "等待中的图片请求" } });
      fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByRole("button", { name: "停止请求" })).toHaveAttribute("title", "停止请求");
      expect(screen.queryByText("取消请求")).not.toBeInTheDocument();
      expect(screen.getByText("用时 1 秒")).toBeInTheDocument();
      expect(screen.getByLabelText("正在加载")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1250);
      });
      expect(screen.getByText("用时 1 秒")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "停止请求" }));
      expect(screen.getByRole("button", { name: "开始查找" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats curated image-preview catalog results as normal images", async () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "preview-1",
      title: "头像 性感美女 户外场景",
      preview: "/wallpapers/flagged.webp",
    }])));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张性感美女照片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /预览头像 性感美女/ })).toBeInTheDocument());
    expect(screen.queryByText("结果已就绪")).not.toBeInTheDocument();
    expect(screen.queryByText("1 个结果已找到。")).not.toBeInTheDocument();
    const processDetails = screen.getByText(/^用时 \d+ 秒$/u).closest("details");
    const imageButton = screen.getByRole("button", { name: /预览头像 性感美女/ });
    expect(processDetails).not.toBeNull();
    expect(processDetails).not.toHaveAttribute("open");
    if (!processDetails) throw new Error("elapsed disclosure is missing");
    expect(processDetails.querySelector(".run-trace-drawer")).toBeInTheDocument();
    const processSummary = processDetails.querySelector("summary");
    expect(processSummary).not.toBeNull();
    if (!processSummary) throw new Error("elapsed summary is missing");
    fireEvent.click(processSummary);
    expect(processDetails).toHaveAttribute("open");
    expect(processDetails.parentElement?.firstElementChild).toBe(processDetails);
    expect(processDetails.compareDocumentPosition(imageButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByLabelText("来源")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看标记候选" })).not.toBeInTheDocument();
    expect(screen.queryByText("安全确认")).not.toBeInTheDocument();

    fireEvent.click(imageButton);
    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "上一张图片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一张图片" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭预览" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();
  });

  it("keeps each image result attached to its own user message", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(gatewayJsonResponse([{
        id: "cat-1",
        title: "小猫结果",
        preview: "/wallpapers/cat.webp",
      }]))
      .mockResolvedValueOnce(gatewayJsonResponse([{
        id: "dog-1",
        title: "小狗结果",
        preview: "/wallpapers/dog.webp",
      }]));
    installFetch(fetchMock);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "给我一张小猫的图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /预览小猫结果/ })).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "给我一张小狗的图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /预览小狗结果/ })).toBeInTheDocument());

    const imageButtons = screen.getAllByRole("button", { name: /预览小猫结果|预览小狗结果/ });
    expect(imageButtons).toHaveLength(2);
    expect(imageButtons[0]).toHaveAccessibleName("预览小猫结果");
    expect(imageButtons[1]).toHaveAccessibleName("预览小狗结果");
    const catMessage = screen.getByText("给我一张小猫的图片", { selector: "p" });
    const dogMessage = screen.getByText("给我一张小狗的图片", { selector: "p" });
    expect(catMessage.compareDocumentPosition(imageButtons[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(imageButtons[0].compareDocumentPosition(dogMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dogMessage.compareDocumentPosition(imageButtons[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(imageButtons[0]);
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "上一张图片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一张图片" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭预览" }));
  });

  it("routes a concrete bathroom scene request to the image gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "bathroom-1",
      title: "浴室场景",
      preview: "/wallpapers/bathroom.webp",
    }]));
    installFetch(fetchMock);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "我想要一张浴室场景" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /预览浴室场景/ })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      planner?: { intent?: { resourceKinds?: string[] }; calls?: Array<{ toolId?: string }> };
    };
    expect(body.planner?.intent?.resourceKinds).toEqual(["image"]);
    expect(body.planner?.calls?.[0]?.toolId).toBe("resource.search.image");
  });

  it("formats an unavailable image fallback as a Codex-style error response", async () => {
    const warning = "image-factory.axi-image-preview route=route.image attempt=2 kind=internal code=internal";
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "fallback-1",
      title: "图片占位结果",
    }], [warning])));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张山水图片参考" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    const alert = await screen.findByRole("alert");
    expect(alert.tagName).toBe("P");
    expect(alert).toHaveTextContent("图片服务暂时不可用，当前没有可预览的图片结果。");
    expect(alert.closest("details")).toBeNull();
    expect(screen.queryByText("这次没有拿到可用结果")).not.toBeInTheDocument();
    expect(screen.queryByText("图片暂不可用")).not.toBeInTheDocument();
    expect(screen.queryByText("查看诊断信息")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("run-trace-step").length).toBeGreaterThan(0);
    const processDetails = screen.getByText(/^用时 \d+ 秒$/u).closest("details");
    expect(processDetails).not.toBeNull();
    expect(processDetails).not.toHaveAttribute("open");
    expect(screen.queryByText("1 个图片候选已就绪")).not.toBeInTheDocument();
    expect(screen.queryByText("图片占位结果")).not.toBeInTheDocument();
    expect(screen.queryByText("fixture:image-preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试这次请求" })).not.toBeInTheDocument();
  });

  it("renders the trace steps with stable states when the gateway is unreachable", async () => {
    installFetch(vi.fn().mockRejectedValue(new Error("offline in browser test")));
    render(<App />);

    expect(screen.getByRole("img", { name: "资源调度中心" })).toBeInTheDocument();
    expect(screen.getByText("资源调度中心", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("输入需求开始搜索。")).not.toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "找一张适合头像的暖光人物图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "重试这次请求" })).toBeInTheDocument());

    const traceSteps = screen.getAllByTestId("run-trace-step");
    expect(traceSteps.length).toBeGreaterThan(0);
    const states = traceSteps.map((node) => node.getAttribute("data-state"));
    expect(states).toContain("interpreting");
    expect(states).toContain("planning");
    expect(states).toContain("executing");
    expect(states).toContain("failed");

    expect(screen.queryByText("RESOURCE SEARCH")).not.toBeInTheDocument();
    expect(screen.queryByText("结果就绪")).not.toBeInTheDocument();
    expect(screen.queryByText("YOU")).not.toBeInTheDocument();
    expect(screen.queryByText("BROKER")).not.toBeInTheDocument();
    expect(screen.queryByText("只读资源查询")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "复制消息" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑消息" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑消息" }));
    expect(screen.getByRole("textbox", { name: "编辑消息" })).toHaveValue("找一张适合头像的暖光人物图片");
    expect(screen.getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("cancels an in-flight image search and restores the composer", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    installFetch(vi.fn(() => new Promise<unknown>((resolve) => {
      resolveFetch = resolve;
    })));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张适合头像的暖光人物图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "停止请求" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "停止请求" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "开始查找" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "重试这次请求" })).not.toBeInTheDocument();

    resolveFetch?.({ ok: true, json: async () => ({ result: { items: [], warnings: [] } }) });
  });

  it("retries a failed gateway run and renders new candidates on success", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValueOnce(new Error("offline in browser test"));
    fetchMock.mockResolvedValueOnce(gatewayJsonResponse([{
      id: "retry-1",
      title: "暖光人物头像",
      preview: "/wallpapers/retry.webp",
    }]));
    installFetch(fetchMock);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张适合头像的暖光人物图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "重试这次请求" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "重试这次请求" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /预览暖光人物头像/ })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows exactly one hover copy + timestamp bar per assistant reply", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "hover-1",
      title: "暖光人物头像",
      preview: "/wallpapers/hover.webp",
    }])));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张适合头像的暖光人物图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /预览暖光人物头像/ })).toBeInTheDocument());

    // One reply → one bar, even though the reply may render as a result block
    // plus conversational lines.
    const bars = document.querySelectorAll(".message-actions-assistant");
    expect(bars).toHaveLength(1);
    const actions = bars[0];
    expect(actions.closest(".assistant-turn")).toBeInTheDocument();
    expect(actions.querySelector("time")).toBeInTheDocument();
    // Copy + timestamp only: no edit / vote / share controls.
    expect(actions.querySelectorAll("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "编辑回答" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "复制回答" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("暖光人物头像");
  });

  it("keeps one bar when a reply pairs a result block with a conversational line", async () => {
    // A flagged-only candidate halts in `clarifying`: the run renders a result
    // block (safety confirmation) *and* appends an assistant line. Both belong
    // to one reply and must share a single bar.
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "flagged-1",
      title: "标记候选",
      preview: "/wallpapers/flagged.webp",
      safety: "flagged",
    }])));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "帮我找一张适合头像的暖光人物图片" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(document.querySelector(".assistant-turn")).toBeInTheDocument());

    const turns = document.querySelectorAll(".assistant-turn");
    expect(turns).toHaveLength(1);
    // Guard against the assertion passing trivially: both pieces must be here.
    expect(turns[0].querySelector(".assistant-result")).toBeInTheDocument();
    expect(turns[0].querySelectorAll(".message-assistant").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".message-actions-assistant")).toHaveLength(1);
  });

  it("routes '查项目' to resource.search.project through the gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "project-1",
      title: "ai-resource-orchestration",
      kind: "project",
      facts: { description: "本地资源中介", repoPath: "products/ai-resource-orchestration" },
    }]));
    installFetch(fetchMock);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "查项目 ai-resource-orchestration 的状态" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByText("ai-resource-orchestration", { selector: "h3" })).toBeInTheDocument());

    const bodies = collectRequestBodies(fetchMock);
    expect(bodies).toHaveLength(1);
    const plan = bodies[0].planner as { calls: Array<{ toolId: string }>; intent: { resourceKinds: string[] } };
    expect(plan.calls[0].toolId).toBe("resource.search.project");
    expect(plan.intent.resourceKinds).toEqual(["project"]);
  });

  it("routes '找 UI 组件' to resource.search.ui without a secondary details control", async () => {
    const fetchMock = vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "ui-1",
      title: "DatePicker 日期选择器",
      kind: "ui",
      facts: { framework: "react", category: "form-control", tags: ["date", "picker"] },
    }]));
    installFetch(fetchMock);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "找 UI 组件：日期选择器" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByText("DatePicker 日期选择器", { selector: "h3" })).toBeInTheDocument());
    expect(screen.getByText("UI 组件")).toBeInTheDocument();
    expect(document.querySelector(".candidate-result")).toBeInTheDocument();
    expect(document.querySelector(".candidate-card")).toBeNull();
    expect(screen.queryByText("查看详情")).not.toBeInTheDocument();

    const bodies = collectRequestBodies(fetchMock);
    expect((bodies[0].planner as { calls: Array<{ toolId: string }> }).calls[0].toolId).toBe("resource.search.ui");
  });

  it("routes '找图标' to resource.search.icon through the gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "icon-1",
      title: "warning",
      kind: "icon",
      facts: { style: "outline", size: 24 },
    }]));
    installFetch(fetchMock);
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "找图标 warning" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByText("warning", { selector: "h3" })).toBeInTheDocument());

    const bodies = collectRequestBodies(fetchMock);
    expect((bodies[0].planner as { calls: Array<{ toolId: string }> }).calls[0].toolId).toBe("resource.search.icon");
  });

  it("surfaces the gateway error envelope in the workbench UI without retry affordance", async () => {
    installFetch(vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ contractVersion: 1, requestId: "gw-proj-fail", code: "provider_error", message: "项目 provider 不可用" }),
    }));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "查一下项目" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "重试这次请求" })).toBeInTheDocument());
    expect(screen.getAllByText("项目 provider 不可用").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector(".assistant-response")).toBeNull();
  });

  it("surfaces provider degradation warnings for non-image queries", async () => {
    installFetch(vi.fn().mockResolvedValue({
      ...gatewayJsonResponseWithWarnings(["图标 provider 不可用，结果来自 fallback。"]),
      json: async () => ({
        contractVersion: 1,
        requestId: "gw-icon-fallback",
        fromCache: false,
        trace: [],
        planner: {},
        result: {
          items: [{
            id: "icon-fallback",
            kind: "icon",
            title: "Search",
            facts: { style: "outline" },
            provenance: { provider: "fixture:icons", ref: "fixture://icon/search", version: "fixture-v1" },
            safety: "safe",
          }],
          sourceVersion: "fixture-v1",
          confidence: "high",
          mode: "fixture",
          warnings: ["图标 provider 不可用，结果来自 fallback。"],
        },
        warnings: ["图标 provider 不可用，结果来自 fallback。"],
      }),
    }));
    render(<App />);

    const input = screen.getByRole("textbox", { name: "输入消息" });
    fireEvent.change(input, { target: { value: "找图标 warning" } });
    fireEvent.click(screen.getByRole("button", { name: "开始查找" }));

    await waitFor(() => expect(screen.getByText("图标服务暂时不可用，当前没有可用的图标结果。")).toBeInTheDocument());
    const resultMessage = screen.getByText("图标服务暂时不可用，当前没有可用的图标结果。");
    expect(resultMessage.closest("details")).toBeNull();
    expect(document.querySelector(".run-trace-notice")).toBeNull();
    expect(screen.queryByText("图标服务部分不可用，以下结果来自当前可用的降级路径。")).not.toBeInTheDocument();
    expect(screen.queryByText("Search", { selector: "h3" })).not.toBeInTheDocument();
    expect(screen.queryByText("查看详情")).not.toBeInTheDocument();
    expect(screen.queryByText("请补充一点描述。")).not.toBeInTheDocument();
    expect(document.querySelector(".assistant-response")).toBeNull();
    expect(document.querySelector(".result-callout")).toBeNull();
  });
});

describe("workbench source invariants (lane-workbench)", () => {
  const workbenchSrc = join(process.cwd(), "src");
  const listSourceFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        if (entry === "test") continue;
        out.push(...listSourceFiles(path));
      } else if (/\.(ts|tsx)$/u.test(entry) && !/\.test\.tsx?$/u.test(entry)) {
        out.push(path);
      }
    }
    return out;
  };

  it("never imports @axi/resource-adapters from non-test source", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(workbenchSrc)) {
      const content = readFileSync(file, "utf8");
      if (/@resource-broker\/adapters/u.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("never references provider secret env vars (VITE_AXI_*, VITE_LLM_API_KEY, VITE_IMAGE_PREVIEW_TOKEN, VITE_DOCS_TOKEN)", () => {
    const offenders: string[] = [];
    const forbidden = /\b(VITE_AXI_[A-Z_]+|VITE_LLM_API_KEY|VITE_IMAGE_PREVIEW_TOKEN|VITE_DOCS_TOKEN)\b/u;
    for (const file of listSourceFiles(workbenchSrc)) {
      const content = readFileSync(file, "utf8");
      if (forbidden.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("vite.config.ts only exposes a UI dev server and gateway-owned API proxies", () => {
    const vitePath = join(workbenchSrc, "..", "vite.config.ts");
    const content = readFileSync(vitePath, "utf8");
    expect(content).toContain("/gateway");
    expect(content).toContain("/health");
    expect(content).toContain("removeHeader");
    expect(content).not.toMatch(/child_process|spawn\(/u);
    expect(content).not.toMatch(/\/provider\//u);
  });

  it("defines separate light and dark tokens with readable dark-mode text", () => {
    const content = readFileSync(join(workbenchSrc, "styles.scss"), "utf8");
    expect(content).toContain(":root[data-theme=\"dark\"]");
    expect(content).toContain(":root[data-theme=\"light\"]");
    expect(content).toContain("--axi-text-secondary: #E7EDF4");
    expect(content).toContain("--axi-text-muted: #C7D1DC");
    expect(content).toContain("--axi-text-placeholder: #C7D1DC");
    expect(content).toContain("--axi-send-button-bg: #F8FAFC");
    expect(content).toContain("--axi-send-button-disabled-bg: #C4CEDA");
    expect(content).toContain("--axi-send-button-disabled-fg: #455468");
    expect(content).toContain("--axi-send-button-bg: #16202A");
    expect(content).toContain("--axi-send-button-disabled-bg: #D5DCE5");
    expect(content).toContain("--axi-send-button-disabled-fg: #5B6877");
  });
});

describe("workbench unified settings dialog", () => {
  beforeEach(() => {
    window.localStorage.removeItem("axi.theme");
    document.documentElement.dataset.theme = "dark";
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem("axi.theme");
    document.documentElement.dataset.theme = "dark";
  });

  it("keeps only the settings icon in the topbar", () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([{
      id: "img-1", kind: "image", title: "demo",
    }])));
    render(<App />);
    const topbar = document.querySelector<HTMLElement>(".app-topbar");
    expect(topbar).not.toBeNull();
    const settingsTrigger = within(topbar!).getByRole("button", { name: "设置" });
    expect(within(topbar!).getAllByRole("button")).toHaveLength(1);
    expect(settingsTrigger).toHaveClass("app-topbar-icon-button");
    expect(settingsTrigger.querySelector(".axi-svg-icon__settings")).toBeInTheDocument();
    expect(settingsTrigger).toHaveTextContent(/^$/u);
    expect(screen.queryByRole("button", { name: "记忆设置" })).toBeNull();
    expect(screen.queryByRole("button", { name: "记忆管理" })).toBeNull();
  });

  it("opens a centered modal with sessions inside by default", () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const dialog = screen.getByRole("dialog", { name: "设置" });
    expect(dialog).toBeInTheDocument();
    const sessionNav = within(dialog).getByRole("button", { name: "会话" });
    const memoryNav = within(dialog).getByRole("button", { name: "记忆" });
    const themeNav = within(dialog).getByRole("button", { name: "主题" });
    expect(sessionNav).toHaveClass("is-active");
    expect(memoryNav).not.toHaveClass("is-active");
    expect(themeNav).not.toHaveClass("is-active");
    expect(within(dialog).getByRole("region", { name: "会话" })).toBeInTheDocument();
  });

  it("switches to the theme section and emits onThemeChange on icon choice", () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    // Shared Axi theme section renders three icon-backed choices; memory settings form should not.
    const themeDialog = screen.getByRole("dialog", { name: "设置" });
    expect(within(themeDialog).getAllByRole("button", { name: /^(跟随系统|浅色|深色)$/u })).toHaveLength(3);
    fireEvent.click(within(themeDialog).getByRole("button", { name: "浅色" }));
    expect(window.localStorage.getItem("axi.theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("dismisses the dialog when the close button is clicked", () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([])));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("dialog", { name: "设置" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "设置" })).toBeNull();
  });

  it("persists the chosen theme across remount", () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([])));
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "设置" })).getByRole("button", { name: "浅色" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    unmount();
    cleanup();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("keeps session management inside the settings modal", () => {
    installFetch(vi.fn().mockResolvedValue(gatewayJsonResponse([])));
    render(<App />);
    const topbar = document.querySelector<HTMLElement>(".app-topbar");
    expect(topbar).not.toBeNull();
    expect(within(topbar!).queryByRole("button", { name: "会话" })).toBeNull();
    fireEvent.click(within(topbar!).getByRole("button", { name: "设置" }));
    const dialog = screen.getByRole("dialog", { name: "设置" });
    expect(within(dialog).getByRole("region", { name: "会话" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "新建会话" })).toBeInTheDocument();
  });
});

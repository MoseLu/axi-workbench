import { describe, expect, it, vi } from "vitest";
import type { AdapterSearchResult, Intent, ResourceCandidate } from "@axi/gateway-contracts";
import { runImageSearchCascade } from "./image-search-cascade";
import type { RouterDispatchInput, RouterDispatchOutcome } from "./router";

const intentFor = (query: string): Intent => ({
  operation: "search",
  resourceKinds: ["image"],
  constraints: { query },
  needsClarification: false,
});

const image = (id: string, title: string, tags: string[]): ResourceCandidate => ({
  id,
  kind: "image",
  title,
  preview: `https://example.test/${id}.webp`,
  facts: { tags },
  provenance: { provider: "test", ref: `https://example.test/${id}` },
  safety: "safe",
});

const web = (id: string, title: string, snippet: string): ResourceCandidate => ({
  id,
  kind: "web",
  title,
  facts: { snippet },
  provenance: { provider: "test-web", ref: `https://example.test/${id}` },
  safety: "safe",
});

const resultFor = (items: ResourceCandidate[], sourceVersion: string): AdapterSearchResult => ({
  items,
  sourceVersion,
  confidence: items.length ? "high" : "low",
  warnings: [],
  mode: "live",
});

const success = (result: AdapterSearchResult): RouterDispatchOutcome => ({
  kind: "success",
  result,
  fromCache: false,
});

const run = (
  query: string,
  responses: Record<string, RouterDispatchOutcome>,
) => {
  const calls: RouterDispatchInput[] = [];
  const dispatch = vi.fn(async (input: RouterDispatchInput) => {
    calls.push(input);
    const response = responses[input.toolId];
    if (!response) throw new Error(`missing test response for ${input.toolId}`);
    return response;
  });
  return {
    calls,
    dispatch,
    promise: runImageSearchCascade({
      intent: intentFor(query),
      requestKey: "cascade-test",
      signal: new AbortController().signal,
      dispatch,
    }),
  };
};

describe("image search cascade", () => {
  it("does not treat an orange kitten as a local 蓝色小猫 hit", async () => {
    const orange = image("orange", "头像 三只小猫 偷看 可爱", ["三只小猫"]);
    const generated = image("generated-blue", "蓝色小猫 毛色", ["蓝色小猫"]);
    const execution = run("蓝色小猫", {
      "resource.search.image": success(resultFor([orange], "local")),
      "resource.search.web": success(resultFor([], "web")),
      "resource.generate.image": success(resultFor([generated], "minimax")),
    });
    const outcome = await execution.promise;
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(execution.calls.map((call) => call.toolId)).toEqual([
      "resource.search.image",
      "resource.search.web",
      "resource.generate.image",
    ]);
    expect(execution.calls[0].intent.constraints.query).toBe("小猫");
    expect(execution.calls[1].intent.constraints.query).toBe("蓝色小猫");
    expect(execution.calls[2].intent.constraints.composedPrompt).toContain("主体动物本身必须是该颜色");
    expect(outcome.result.items.map((item) => item.id)).toEqual(["generated-blue"]);
  });

  it("returns relevant local images without invoking web or generation", async () => {
    const localImage = image("local-bathroom", "现代浴室空间", ["浴室", "室内"]);
    const execution = run("我想要一张浴室场景", {
      "resource.search.image": success(resultFor([localImage], "local")),
    });

    const outcome = await execution.promise;

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.result.items).toEqual([localImage]);
    expect(execution.calls.map((call) => call.toolId)).toEqual(["resource.search.image"]);
    expect(outcome.trace.map((event) => event.state)).toEqual(["image-searching"]);
  });

  it("treats weak local matches as empty, then searches web and generates", async () => {
    const generated = image("generated-bathroom", "MiniMax 生成：我想要一张浴室场景", ["浴室"]);
    const execution = run("我想要一张浴室场景", {
      "resource.search.image": success(resultFor([image("bedroom", "卧室场景", ["卧室"])], "local")),
      "resource.search.web": success(resultFor([web("bathroom-ref", "浴室设计参考", "现代浴室空间与灯光布局")], "web")),
      "resource.generate.image": success(resultFor([generated], "minimax")),
    });

    const outcome = await execution.promise;

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(execution.calls.map((call) => call.toolId)).toEqual([
      "resource.search.image",
      "resource.search.web",
      "resource.generate.image",
    ]);
    expect(execution.calls[1].intent.resourceKinds).toEqual(["web"]);
    expect(execution.calls[1].intent.constraints.query).toBe("浴室");
    expect(execution.calls[2].intent.resourceKinds).toEqual(["image"]);
    expect(execution.calls[2].intent.constraints.composedPrompt).toContain("浴室");
    expect(outcome.result.items).toEqual([generated]);
    expect(outcome.trace.map((event) => event.state)).toEqual([
      "image-searching",
      "image-empty-fallback-searching",
      "composing-prompt",
      "image-generating",
    ]);
  });

  it("uses a strongly relevant previewable web image without generating", async () => {
    const webImage = image("web-bathroom", "浴室空间参考", ["浴室", "室内"]);
    const execution = run("浴室场景", {
      "resource.search.image": success(resultFor([], "local-empty")),
      "resource.search.web": success(resultFor([webImage], "web-image")),
      "resource.generate.image": success(resultFor([], "must-not-run")),
    });

    const outcome = await execution.promise;

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(execution.calls.map((call) => call.toolId)).toEqual([
      "resource.search.image",
      "resource.search.web",
    ]);
    expect(outcome.result.items).toEqual([webImage]);
  });

  it("runs the visual filter only when an explicit embedder is provided", async () => {
    const generated = image("generated-bathroom", "MiniMax 生成：浴室场景", ["浴室"]);
    const execution = run("浴室场景", {
      "resource.search.image": success(resultFor([], "local-empty")),
      "resource.search.web": success(resultFor([], "web-empty")),
      "resource.generate.image": success(resultFor([generated], "minimax")),
    });

    const outcome = await execution.promise;

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    // No embedder -> placeholder, behavior unchanged.
    expect(outcome.result.items).toEqual([generated]);
    expect(outcome.trace.some((event) => event.label === "视觉相关性二次过滤")).toBe(false);
  });

  it("drops generated images that fail the visual embedder and surfaces the warning", async () => {
    const samoyed = image("generated-samoyed", "MiniMax 生成：小猫", ["小猫"]);
    samoyed.preview = "data:image/png;base64,AAA";
    const execution = (() => {
      const calls: RouterDispatchInput[] = [];
      const dispatch = vi.fn(async (input: RouterDispatchInput) => {
        calls.push(input);
        const response: Record<string, RouterDispatchOutcome> = {
          "resource.search.image": success(resultFor([], "local-empty")),
          "resource.search.web": success(resultFor([], "web-empty")),
          "resource.generate.image": success(resultFor([samoyed], "minimax")),
        };
        return response[input.toolId]!;
      });
      return {
        calls,
        dispatch,
        promise: runImageSearchCascade({
          intent: intentFor("小猫"),
          requestKey: "cascade-vision",
          signal: new AbortController().signal,
          dispatch,
          embedder: {
            id: "stub-clip",
            async score(query, preview) {
              // Pretend the Samoyed the generator returned is unrelated to
              // the "小猫" query. The visual filter must drop it.
              if (!preview) return null;
              return query === "小猫" ? 0.1 : 0.9;
            },
          },
          visualMinKeep: 0,
        }),
      };
    })();

    const outcome = await execution.promise;

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.result.items).toEqual([]);
    expect(outcome.result.warnings?.some((warning) => warning.includes("视觉相关性全部低于阈值"))).toBe(true);
    const traceLabels = outcome.trace.map((event) => event.label);
    expect(traceLabels).toContain("视觉相关性二次过滤");
    expect(traceLabels).toContain("视觉过滤命中");
  });

  it("keeps at least one generated image as a floor even when the embedder rejects all", async () => {
    const samoyed = image("generated-samoyed", "MiniMax 生成：小猫", ["小猫"]);
    samoyed.preview = "data:image/png;base64,AAA";
    const execution = (() => {
      const dispatch = vi.fn(async (input: RouterDispatchInput): Promise<RouterDispatchOutcome> => {
        const response: Record<string, RouterDispatchOutcome> = {
          "resource.search.image": success(resultFor([], "local-empty")),
          "resource.search.web": success(resultFor([], "web-empty")),
          "resource.generate.image": success(resultFor([samoyed], "minimax")),
        };
        return response[input.toolId]!;
      });
      return {
        dispatch,
        promise: runImageSearchCascade({
          intent: intentFor("小猫"),
          requestKey: "cascade-vision-floor",
          signal: new AbortController().signal,
          dispatch,
          embedder: {
            id: "stub-clip",
            async score() { return 0.05; },
          },
        }),
      };
    })();

    const outcome = await execution.promise;

    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    // The default visualMinKeep=1 must save one image so the user still
    // sees something rather than an empty result.
    expect(outcome.result.items).toEqual([samoyed]);
    const traceLabels = outcome.trace.map((event) => event.label);
    expect(traceLabels).toContain("视觉过滤命中");
  });
});

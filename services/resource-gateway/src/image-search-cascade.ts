import { makeProviderFailure, type AdapterSearchResult, type Intent, type ProviderFailure, type RunEvent } from "@axi/gateway-contracts";
import {
  composeImagePrompt,
  hasStrongPreviewImageMatchFor,
  imageProviderQueryFor,
  imageSearchQueryFor,
  placeholderImageEmbedder,
  filterByVisualRelevance,
  relevantCandidatesFor,
  type ImageEmbedder,
} from "@axi/resource-orchestrator";

import type { RouterDispatchInput, RouterDispatchOutcome } from "./router.js";

const IMAGE_SEARCH_TOOL = "resource.search.image" as const;
const WEB_SEARCH_TOOL = "resource.search.web" as const;
const IMAGE_GENERATE_TOOL = "resource.generate.image" as const;

export interface ImageSearchCascadeOptions {
  readonly intent: Intent;
  readonly requestKey: string;
  readonly signal: AbortSignal;
  readonly dispatch: (input: RouterDispatchInput) => Promise<RouterDispatchOutcome>;
  /**
   * Optional image-text embedder used to filter the generated result pool.
   * When omitted, the placeholder embedder passes everything through so the
   * cascade keeps its existing text-only contract. Wiring a real backend
   * (CLIP/Ollama llava) is opt-in and lives outside this module.
   */
  readonly embedder?: ImageEmbedder;
  /** Threshold passed through to `filterByVisualRelevance`. Defaults to
   *  `VISUAL_RELEVANCE_THRESHOLD` from the orchestrator package. */
  readonly visualThreshold?: number;
  /** Minimum number of generated images to keep even if the visual filter
   *  would empty the pool. Defaults to 1 so the cascade can still surface
   *  something rather than dropping the request silently. */
  readonly visualMinKeep?: number;
}

export interface ImageSearchCascadeSuccess {
  readonly kind: "success";
  readonly result: AdapterSearchResult;
  readonly fromCache: boolean;
  readonly trace: ReadonlyArray<RunEvent>;
}

export interface ImageSearchCascadeFailure {
  readonly kind: "failure";
  readonly failure: ProviderFailure;
  readonly trace: ReadonlyArray<RunEvent>;
}

export type ImageSearchCascadeOutcome = ImageSearchCascadeSuccess | ImageSearchCascadeFailure;

const now = (): string => new Date().toISOString();

const makeCancelledFailure = (): ProviderFailure => makeProviderFailure({
  kind: "cancelled",
  message: "request aborted by client",
  targetId: "image-search-cascade",
  routeId: "image-search-cascade",
  attempt: 1,
});

const uniqueStrings = (values: readonly string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const imageIntentFor = (intent: Intent): Intent => ({
  ...intent,
  resourceKinds: ["image"],
  needsClarification: false,
});

const webIntentFor = (intent: Intent, query: string): Intent => ({
  ...intent,
  resourceKinds: ["web"],
  needsClarification: false,
  constraints: { ...intent.constraints, query },
});

const generationIntentFor = (intent: Intent, query: string, composedPrompt: string): Intent => ({
  ...intent,
  resourceKinds: ["image"],
  needsClarification: false,
  constraints: { ...intent.constraints, query, composedPrompt },
});

const mergedResult = (
  finalResult: AdapterSearchResult,
  intermediateResults: readonly (AdapterSearchResult | undefined)[],
): AdapterSearchResult => ({
  ...finalResult,
  warnings: uniqueStrings([
    ...intermediateResults.flatMap((result) => result?.warnings || []),
    ...(finalResult.warnings || []),
  ]),
});

/**
 * Execute the provider-driven image fallback policy at the HTTP gateway
 * boundary. The browser only asks for `resource.search.image`; this function
 * owns the server-side sequence:
 *
 *   local image catalog → web reference search → relevance/preview check
 *   → composed prompt → MiniMax image generation → (optional) visual filter
 *
 * Web results are context, not automatically presentable image results. A
 * web result is returned directly only when it is both strongly relevant and
 * already contains a previewable image candidate. The current MiniMax web
 * adapter returns organic web pages, so it normally proceeds to generation.
 *
 * The optional `embedder` re-ranks the generated image pool against the
 * query (e.g. CLIP ViT-B/32 or a local Ollama llava). When omitted, the
 * placeholder passes everything through so the cascade keeps its existing
 * text-only contract.
 */
export const runImageSearchCascade = async (
  options: ImageSearchCascadeOptions,
): Promise<ImageSearchCascadeOutcome> => {
  const trace: RunEvent[] = [];
  const emit = (state: RunEvent["state"], label: string, detail?: string): void => {
    trace.push({ state, label, ...(detail ? { detail } : {}), at: now() });
  };
  const failure = (value: ProviderFailure): ImageSearchCascadeFailure => ({
    kind: "failure",
    failure: value,
    trace,
  });
  const success = (result: AdapterSearchResult, fromCache: boolean): ImageSearchCascadeSuccess => ({
    kind: "success",
    result,
    fromCache,
    trace,
  });
  const dispatch = (toolId: string, intent: Intent, suffix: string): Promise<RouterDispatchOutcome> => options.dispatch({
    intent,
    toolId,
    signal: options.signal,
    requestKey: `${options.requestKey}:image-cascade:${suffix}`,
  });

  if (options.signal.aborted) return failure(makeCancelledFailure());

  const query = String(options.intent.constraints.query || "").trim();
  if (!query) return failure(makeProviderFailure({
    kind: "invalid_payload",
    message: "image search query is required",
    targetId: "image-search-cascade",
    routeId: "image-search-cascade",
    attempt: 1,
    countsAgainstBreaker: false,
  }));
  const providerQuery = imageProviderQueryFor(query) || imageSearchQueryFor(query) || query;

  emit("image-searching", "本地图库搜索中");
  const local = await dispatch(
    IMAGE_SEARCH_TOOL,
    {
      ...imageIntentFor(options.intent),
      constraints: { ...options.intent.constraints, query: providerQuery },
    },
    "local",
  );
  if (local.kind === "failure" && local.failure.kind === "cancelled") return failure(local.failure);
  if (local.kind === "success") {
    const relevantLocalItems = relevantCandidatesFor(query, local.result.items)
      .filter((item) => item.kind === "image");
    if (relevantLocalItems.length > 0) {
      return success({ ...local.result, items: relevantLocalItems }, local.fromCache);
    }
  }

  if (options.signal.aborted) return failure(makeCancelledFailure());
  emit("image-empty-fallback-searching", "图库为空，正在全网搜索");
  const web = await dispatch(
    WEB_SEARCH_TOOL,
    webIntentFor(options.intent, imageSearchQueryFor(query) || query),
    "web",
  );
  if (web.kind === "failure" && web.failure.kind === "cancelled") return failure(web.failure);
  const webResult = web.kind === "success" ? web.result : undefined;
  const relevantWebItems = webResult ? relevantCandidatesFor(query, webResult.items) : [];

  if (hasStrongPreviewImageMatchFor(query, relevantWebItems)) {
    const previewItems = relevantWebItems.filter((item) => item.kind === "image" && Boolean(item.preview));
    emit("validating", "网络结果相关性足够，采用可预览图片");
    return success({
      ...(webResult as AdapterSearchResult),
      items: previewItems,
    }, web.kind === "success" && web.fromCache);
  }

  if (options.signal.aborted) return failure(makeCancelledFailure());
  emit(
    "composing-prompt",
    "合成生成 prompt",
    relevantWebItems.length ? "使用相关网络参考补充生成上下文" : "网络参考不足，使用原始需求生成",
  );
  const composedPrompt = composeImagePrompt(query, relevantWebItems);
  emit("image-generating", "图片生成中");
  const generated = await dispatch(
    IMAGE_GENERATE_TOOL,
    generationIntentFor(options.intent, query, composedPrompt),
    "generate",
  );
  if (generated.kind === "failure") return failure(generated.failure);
  const generatedResult = generated.result;

  const embedder = options.embedder ?? placeholderImageEmbedder;
  if (embedder.id !== placeholderImageEmbedder.id) {
    emit("validating", "视觉相关性二次过滤", `视觉后端 ${embedder.id}`);
    const visual = await filterByVisualRelevance(query, generatedResult.items, embedder, options.visualThreshold, {
      minKeep: options.visualMinKeep ?? 1,
      signal: options.signal,
    });
    const below = visual.decisions.filter((decision) => !decision.kept).length;
    emit(
      "validating",
      "视觉过滤命中",
      `${visual.kept.length}/${generatedResult.items.length} 通过（淘汰 ${below}）`,
    );
    if (visual.kept.length === 0) {
      return success(
        { ...generatedResult, items: [], warnings: [...(generatedResult.warnings || []), `视觉相关性全部低于阈值 (${embedder.id})`] },
        generated.fromCache,
      );
    }
    return success(
      mergedResult({ ...generatedResult, items: visual.kept }, [webResult]),
      generated.fromCache,
    );
  }

  return success(
    mergedResult(generatedResult, [webResult]),
    generated.fromCache,
  );
};

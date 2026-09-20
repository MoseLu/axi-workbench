import type {
  AdapterSearchResult,
  ClarificationOption,
  ConversationContext,
  Intent,
  PlannerMemoryContext,
  PlannerResult,
  ResourceCandidate,
  RouteLoadBalancer,
  RunEvent,
  RunResult,
  RunState,
  SupportedResourceKind,
  ToolDefinition,
} from "@axi/gateway-contracts";
import { livenessResponseSchema, readinessResponseSchema, resourceToolIds } from "@axi/gateway-contracts";
import type { Planner } from "@axi/resource-orchestrator/browser";
import { searchMemory } from "./memory-client";

/**
 * Workbench GatewayClient (GHA-012).
 *
 * The browser's only contract for reaching provider-backed resources is
 * the gateway HTTP API at `${VITE_GATEWAY_BASE_URL}/gateway/run`. Adapter
 * construction, secret handling, manifest wiring and ProviderRegistry live
 * server-side in `apps/gateway`; this module must never read provider
 * secret env vars.
 *
 * Flow:
 *   1. Run the planner in the browser (RuleBased / OpenAI-compatible LLM).
 *   2. POST the planner output to the gateway `/gateway/run`.
 *   3. The gateway dispatches through its ProviderRegistry and returns an
 *      `AdapterSearchResult` merged with the planner output. We rebuild the
 *      UI-shaped `RunResult` here so the existing App.tsx trace / warning /
 *      clarification / items / preview UI keeps working unchanged.
 *
 * The Planner is intentionally browser-side today because the LLM call is
 * cheap, has no provider secret (the public base URL is enough), and the
 * intent JSON must be available to drive the UI's clarification flow before
 * the network round-trip. GHA-013 keeps that contract; future work that
 * needs to keep provider secrets entirely server-side should move planner
 * execution behind the gateway without changing this client surface.
 */

// In Vite dev, use the same-origin proxy so the gateway can keep its default
// closed CORS posture. Production-like/static runs retain the direct local
// default unless VITE_GATEWAY_BASE_URL is supplied explicitly.
const DEFAULT_GATEWAY_BASE_URL = import.meta.env.DEV ? "" : "http://127.0.0.1:8787";
const RUN_PATH = "/gateway/run";

export interface RunPlannerOptions {
  /** The user-typed natural-language request. Required by `runPlanner`,
   *  ignored by `dispatchPlannerResult` (which takes a precomputed plan). */
  input?: string;
  /** AbortSignal propagated to the planner call and the gateway fetch. */
  signal?: AbortSignal;
  /** Override the gateway base URL (defaults to VITE_GATEWAY_BASE_URL or the
   *  Vite dev proxy). Provided so tests can point at a stub. */
  baseUrl?: string;
  /** Optional fetch override (defaults to `globalThis.fetch`). */
  fetcher?: typeof fetch;
  /** Optional request id; the gateway keeps it if it matches the contract. */
  requestId?: string;
  /** Tools offered to the planner; defaults to the four resource.search
   *  tool ids the workbench understands today. */
  tools?: ToolDefinition[];
  /** Allow flagged candidates to be displayed without re-clarifying. */
  allowFlagged?: boolean;
  /** MEM-MVP-014 — when true, fetch the planner-context projection from
   *  the gateway and forward it to the planner. When undefined the
   *  client reads `MemorySettings.useMemory` via a one-shot fetch and
   *  defaults to false when the gateway is unreachable. Tests pass
   *  `false` to keep the fetch spy count predictable. */
  memoryEnabled?: boolean;
  /** Scope used for memory retrieval. */
  memoryScope?: "global" | "project";
  /** Opaque registered project id used for project-scoped retrieval. */
  memoryProjectId?: string;
  /** Bounded recent dialogue; omitted keeps legacy planner behaviour. */
  conversation?: ConversationContext;
}

const buildToolDefinitions = (): ToolDefinition[] => {
  // The browser only knows tool id, description and resourceKinds — the
  // server-side gateway enforces the real Zod input schema, validates the
  // intent and dispatches through ProviderRegistry. We expose every
  // (operation, kind) tool id from `resourceToolIds` so the planner can
  // route user input to image / document / project / ui / icon (and
  // inspect / preview / generate for image). The description text is what
  // the in-browser LLM planner actually reads; it must therefore reflect
  // what the gateway server advertises, not anything we know about the
  // provider implementations. Resource facts themselves stay out of this
  // file: only the gateway / adapter layer is allowed to mint them.
  const passthrough = {} as ToolDefinition["inputSchema"];
  const searchKey = (kind: SupportedResourceKind) =>
    `search${capitalize(kind)}` as keyof typeof resourceToolIds;
  const inspectKey = (kind: SupportedResourceKind) =>
    `inspect${capitalize(kind)}` as keyof typeof resourceToolIds;
  const previewKey = (kind: SupportedResourceKind) =>
    `preview${capitalize(kind)}` as keyof typeof resourceToolIds;

  const describe = (kind: SupportedResourceKind, operation: "search" | "inspect" | "preview"): ToolDefinition => ({
    id: resourceToolIds[operation === "search" ? searchKey(kind) : operation === "inspect" ? inspectKey(kind) : previewKey(kind)],
    description: operation === "search"
      ? `在受控 provider 中检索 ${kind} 资源候选，事实由 provider 返回。`
      : operation === "inspect"
      ? `查看 ${kind} 候选的 provider facts / provenance / 安全分类。`
      : `${kind} 候选的本地预览，由 gateway 返回。`,
    inputSchema: passthrough,
    access: "read_only",
    resourceKinds: [kind],
  });

  return [
    describe("image", "search"),
    describe("image", "inspect"),
    describe("image", "preview"),
    describe("document", "search"),
    describe("document", "inspect"),
    describe("document", "preview"),
    describe("project", "search"),
    describe("project", "inspect"),
    describe("project", "preview"),
    describe("ui", "search"),
    describe("ui", "inspect"),
    describe("ui", "preview"),
    describe("icon", "search"),
    describe("icon", "inspect"),
    describe("icon", "preview"),
    {
      id: resourceToolIds.generateImage,
      description: "通过 gateway 调用受控 provider 生成图片。",
      inputSchema: passthrough,
      access: "read_only",
      resourceKinds: ["image"],
    },
  ];
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const resolveBaseUrl = (override?: string): string => {
  if (typeof override === "string" && override.length > 0) return override.replace(/\/$/u, "");
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GATEWAY_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv.replace(/\/$/u, "");
  return DEFAULT_GATEWAY_BASE_URL;
};

const newRequestId = (): string => `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const makeRunId = (): string => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toolIdsForPlan = (plan: PlannerResult): string[] => [
  ...plan.calls.map((call) => call.toolId),
  ...(plan.pipeline?.map((call) => call.toolId) ?? []),
];

const externalContextPattern = /(?:resource\.search\.web|resource\.generate\.image|^mcp\.|axi-docs|axi-skills|minimax-tokenplan)/iu;

const memoryMetadataFor = (plan: PlannerResult, payload?: Record<string, unknown> | null, items: ResourceCandidate[] = []) => {
  const toolIds = toolIdsForPlan(plan);
  const providerText = JSON.stringify({
    trace: payload?.trace,
    providers: items.map((item) => item.provenance.provider),
  });
  return {
    toolIds,
    usedExternalContext: toolIds.some((toolId) => externalContextPattern.test(toolId)) || externalContextPattern.test(providerText),
  };
};

const isAdapterSearchResult = (value: unknown): value is AdapterSearchResult => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.items) && typeof candidate.sourceVersion === "string" && typeof candidate.mode === "string";
};

const isRenderableCandidate = (item: ResourceCandidate): boolean =>
  item.kind !== "image" || Boolean(item.preview);

const friendlyGatewayNetworkError = (message: string): string =>
  message === "Failed to fetch" ? "暂时无法连接到资源网关，请确认本地 gateway 正在运行。" : "资源网关请求失败：" + message;

const friendlyUnavailableImageResult = (): string =>
  "图片服务暂时不可用，当前没有可预览的图片结果。";

const pushTrace = (trace: RunEvent[], state: RunState, label: string, detail?: string): void => {
  trace.push({ state, label, ...(detail ? { detail } : {}), at: new Date().toISOString() });
};

const GATEWAY_TRACE_STATES = new Set<RunState>([
  "image-searching",
  "image-empty-fallback-searching",
  "composing-prompt",
  "image-generating",
  "validating",
  "presenting",
]);

/** Decode the gateway's compact string trace without widening its v1 wire contract. */
const appendGatewayTrace = (trace: RunEvent[], value: unknown): void => {
  if (!Array.isArray(value)) return;
  for (const line of value) {
    if (typeof line !== "string") continue;
    const [rawState, label, ...detailParts] = line.split("|");
    if (!label || !GATEWAY_TRACE_STATES.has(rawState as RunState)) continue;
    const state = rawState as RunState;
    const detail = detailParts.join("|");
    pushTrace(trace, state, label, detail || undefined);
  }
};

const buildClarificationResult = (
  plan: PlannerResult,
  intent: Intent,
  plannerId: string,
  trace: RunEvent[],
  explanation?: string,
  clarification?: ClarificationOption[],
  warnings: string[] = [],
): RunResult => {
  pushTrace(trace, "clarifying", "需要补充约束", explanation || intent.clarificationReason);
  return {
    runId: makeRunId(),
    requestKey: plan.calls[0]?.toolId || intent.operation,
    state: "clarifying",
    planner: plannerId,
    intent,
    explanation,
    items: [],
    clarification: clarification && clarification.length ? clarification : [{ id: "broaden", label: "放宽关键词", value: "请换一个更具体的关键词" }],
    warnings,
    trace,
  };
};

/**
 * Run the planner in the browser, then dispatch through the gateway.
 *
 * @returns A `RunResult` shaped exactly like the legacy `ResourceOrchestrator`
 *          output, so the App.tsx UI keeps rendering trace / warnings /
 *          clarification / items / preview without code changes.
 */
export const runPlanner = async (
  planner: Planner,
  options: RunPlannerOptions = {},
): Promise<RunResult> => {
  if (typeof options.input !== "string") throw new Error("runPlanner requires options.input");
  const input = options.input;
  const signal = options.signal;
  const fetcher = options.fetcher ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetcher) throw new Error("fetch is unavailable in this runtime");
  const tools = options.tools && options.tools.length ? options.tools : buildToolDefinitions();
  const requestId = options.requestId ?? newRequestId();
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const trace: RunEvent[] = [];
  pushTrace(trace, "interpreting", "理解自然语言需求");

  if (signal?.aborted) {
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "cancelled",
      planner: planner.id,
      items: [],
      warnings: [],
      trace,
      error: "请求已取消。",
    };
  }

  // MEM-MVP-014 — fetch a redacted planner-context projection from
  // the gateway before invoking the planner. Only happens when the
  // caller opts in (the workbench reads `MemorySettings.useMemory`
  // before submitting). Any failure collapses to an empty context
  // so the workbench keeps working with the legacy planner
  // behaviour.
  let memoryContext: PlannerMemoryContext = { memories: [] };
  if (options.memoryEnabled === true) {
    try {
      const result = await searchMemory(input, {
        signal,
        baseUrl: options.baseUrl,
        fetcher: options.fetcher,
        scope: options.memoryScope,
        projectId: options.memoryProjectId,
      });
      if (result) memoryContext = result;
      if (memoryContext.memories.length) {
        pushTrace(trace, "planning", "读取本地记忆命中", `${memoryContext.memories.length} 条`);
      }
    } catch {
      memoryContext = { memories: [] };
    }
  }

  const rawPlan = await planner.plan(input, tools, signal, memoryContext, options.conversation).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DOMException("request aborted", "AbortError");
    }
    throw error;
  });
  pushTrace(trace, "planning", "校验工具选择", rawPlan.explanation);
  const planMemoryMetadata = memoryMetadataFor(rawPlan);

  if (signal?.aborted) {
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "cancelled",
      planner: planner.id,
      items: [],
      warnings: [],
      trace,
      error: "请求已取消。",
      memoryMetadata: planMemoryMetadata,
    };
  }

  const intent: Intent = rawPlan.intent;
  if (intent.needsClarification || (!rawPlan.calls.length && !rawPlan.pipeline?.length)) {
    return buildClarificationResult(rawPlan, intent, planner.id, trace, rawPlan.explanation, rawPlan.clarification);
  }

  pushTrace(trace, "executing", "通过 gateway dispatch provider", `gateway=${baseUrl}${RUN_PATH}`);
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}${RUN_PATH}`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ planner: rawPlan, requestId }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        runId: makeRunId(),
        requestKey: requestId,
        state: "cancelled",
        planner: planner.id,
        intent,
        items: [],
        warnings: [],
        trace,
        error: "请求已取消。",
        memoryMetadata: planMemoryMetadata,
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    const friendlyMessage = friendlyGatewayNetworkError(message);
    pushTrace(trace, "failed", "资源网关暂时不可达", friendlyMessage);
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "failed",
      planner: planner.id,
      intent,
      items: [],
      warnings: [],
      trace,
      error: friendlyMessage,
      memoryMetadata: planMemoryMetadata,
    };
  }

  if (signal?.aborted) {
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "cancelled",
      planner: planner.id,
      intent,
      items: [],
      warnings: [],
      trace,
      error: "请求已取消。",
      memoryMetadata: planMemoryMetadata,
    };
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || !isAdapterSearchResult(payload.result)) {
    const message = payload && typeof payload.message === "string"
      ? payload.message
      : `gateway returned ${response.status}`;
    pushTrace(trace, "failed", "gateway dispatch 失败", message);
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "failed",
      planner: planner.id,
      intent,
      items: [],
      warnings: [],
      trace,
      error: message,
      memoryMetadata: planMemoryMetadata,
    };
  }

  const searchResult = payload.result;
  appendGatewayTrace(trace, payload.trace);
  const items: ResourceCandidate[] = searchResult.items;
  const runMemoryMetadata = memoryMetadataFor(rawPlan, payload, items);
  const warnings = [...(searchResult.warnings || [])];
  pushTrace(trace, "validating", "验证候选来源与安全分类");

  const visibleItems = items.filter((item) => item.safety !== "blocked" && (options.allowFlagged || item.safety !== "flagged"));
  const flaggedCount = items.filter((item) => item.safety === "flagged").length;
  const renderableItems = visibleItems.filter(isRenderableCandidate);

  if (!visibleItems.length) {
    pushTrace(trace, "clarifying", "候选需要更明确的安全确认");
    const clarification: ClarificationOption[] = flaggedCount
      ? [{ id: "allow-flagged", label: "查看标记候选", value: "我确认查看标记为敏感的候选" }]
      : [{ id: "broaden", label: "放宽关键词", value: "请换一个更具体的关键词" }];
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "clarifying",
      planner: planner.id,
      intent,
      explanation: rawPlan.explanation,
      items: [],
      warnings: [...warnings, ...(flaggedCount ? [`${flaggedCount} 个候选被标记为敏感，默认不展示。`] : [])],
      clarification,
      trace,
      memoryMetadata: runMemoryMetadata,
    };
  }

  if (!renderableItems.length && visibleItems.some((item) => item.kind === "image")) {
    const error = friendlyUnavailableImageResult();
    pushTrace(trace, "failed", "图片结果不可用", error);
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "failed",
      planner: planner.id,
      intent,
      explanation: rawPlan.explanation,
      items: visibleItems,
      warnings,
      trace,
      error,
      memoryMetadata: runMemoryMetadata,
    };
  }

  pushTrace(trace, "presenting", "候选已通过验证", `${renderableItems.length} 个候选通过验证`);
  return {
    runId: makeRunId(),
    requestKey: requestId,
    state: "presenting",
    planner: planner.id,
    intent,
    explanation: rawPlan.explanation,
    items: renderableItems.slice(0, 12),
    warnings,
    trace,
    fromCache: Boolean(payload.fromCache),
    memoryMetadata: runMemoryMetadata,
  };
};

/**
 * Lower-level helper: take a precomputed `PlannerResult` and dispatch it
 * through the gateway. Exposed for tests and for callers that already have a
 * planner output cached locally.
 */
export const dispatchPlannerResult = async (
  planner: Planner,
  plan: PlannerResult,
  options: RunPlannerOptions = {},
): Promise<RunResult> => {
  const signal = options.signal;
  const fetcher = options.fetcher ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetcher) throw new Error("fetch is unavailable in this runtime");
  const requestId = options.requestId ?? newRequestId();
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const trace: RunEvent[] = [];
  pushTrace(trace, "interpreting", "理解自然语言需求");
  pushTrace(trace, "planning", "校验工具选择", plan.explanation);
  const planMemoryMetadata = memoryMetadataFor(plan);

  if (signal?.aborted) {
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "cancelled",
      planner: planner.id,
      items: [],
      warnings: [],
      trace,
      error: "请求已取消。",
    };
  }

  const intent = plan.intent;
  if (intent.needsClarification || (!plan.calls.length && !plan.pipeline?.length)) {
    return buildClarificationResult(plan, intent, planner.id, trace, plan.explanation, plan.clarification);
  }

  pushTrace(trace, "executing", "通过 gateway dispatch provider", `gateway=${baseUrl}${RUN_PATH}`);  let response: Response;
  try {
    response = await fetcher(`${baseUrl}${RUN_PATH}`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ planner: plan, requestId }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        runId: makeRunId(),
        requestKey: requestId,
        state: "cancelled",
        planner: planner.id,
        intent,
        items: [],
        warnings: [],
        trace,
        error: "请求已取消。",
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    const friendlyMessage = friendlyGatewayNetworkError(message);
    pushTrace(trace, "failed", "资源网关暂时不可达", friendlyMessage);
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "failed",
      planner: planner.id,
      intent,
      items: [],
      warnings: [],
      trace,
      error: friendlyMessage,
      memoryMetadata: planMemoryMetadata,
    };
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || !isAdapterSearchResult(payload.result)) {
    const message = payload && typeof payload.message === "string"
      ? payload.message
      : `gateway returned ${response.status}`;
    pushTrace(trace, "failed", "gateway dispatch 失败", message);
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "failed",
      planner: planner.id,
      intent,
      items: [],
      warnings: [],
      trace,
      error: message,
      memoryMetadata: planMemoryMetadata,
    };
  }

  const searchResult = payload.result;
  appendGatewayTrace(trace, payload.trace);
  const visibleItems = searchResult.items.filter((item) => item.safety !== "blocked" && (options.allowFlagged || item.safety !== "flagged"));
  const renderableItems = visibleItems.filter(isRenderableCandidate);
  const runMemoryMetadata = memoryMetadataFor(plan, payload, searchResult.items);
  pushTrace(trace, "validating", "验证候选来源与安全分类");
  if (!renderableItems.length && visibleItems.some((item) => item.kind === "image")) {
    const error = friendlyUnavailableImageResult();
    pushTrace(trace, "failed", "图片结果不可用", error);
    return {
      runId: makeRunId(),
      requestKey: requestId,
      state: "failed",
      planner: planner.id,
      intent,
      explanation: plan.explanation,
      items: visibleItems,
      warnings: searchResult.warnings || [],
      trace,
      error,
      memoryMetadata: runMemoryMetadata,
    };
  }
  pushTrace(trace, "presenting", "候选已通过验证", `${renderableItems.length} 个候选通过验证`);
  return {
    runId: makeRunId(),
    requestKey: requestId,
    state: "presenting",
    planner: planner.id,
    intent,
    explanation: plan.explanation,
    items: renderableItems.slice(0, 12),
    warnings: searchResult.warnings || [],
    trace,
    fromCache: Boolean(payload.fromCache),
    memoryMetadata: runMemoryMetadata,
  };
};

export const gatewayBaseUrl = (override?: string): string => resolveBaseUrl(override);

/**
 * GHA-012 / GHA-080 public introspection surface for the standalone gateway.
 *
 * Extends `runPlanner` / `dispatchPlannerResult` with five read-only probes
 * the workbench (or any external monitor) needs to integrate with the new
 * gateway HTTP surface:
 *
 *   GET /health/live     process liveness
 *   GET /health/ready    composition-root readiness + per-component status
 *   GET /routes          redacted route registry projection (routes only)
 *   GET /openapi.json    OpenAPI 3.1 document (machine-readable contract)
 *   GET /docs            human-readable docs page (HTML bootstrap)
 *
 * Behaviour contract (GHA-012):
 *   - All five methods honour `signal`, `baseUrl`, `fetcher`, and `requestId`
 *     exactly like `runPlanner` does today.
 *   - They emit an `x-request-id` header on every request.
 *   - They treat the gateway ErrorEnvelope as the only failure shape:
 *     a non-2xx response, an invalid JSON body, or a body that does not
 *     satisfy the endpoint's stable shape becomes a `GatewayProbeError`
 *     with the parsed `code` and `message`. Provider-only error codes are
 *     never treated as success.
 *   - They never read or expose server secrets. VITE_AXI_<docs-or-skills>_TOKEN
 *     and other sensitive env vars stay in `apps/gateway`; this module only
 *     consumes the non-secret `VITE_GATEWAY_BASE_URL`.
 *
 * They do NOT change `runPlanner` / `dispatchPlannerResult` / the existing
 * `RunResult` UI surface. A future UI consumer can call them independently
 * of any user-driven plan because the methods are self-contained.
 */

const PROBE_PATHS = {
  healthLive: "/health/live",
  healthReady: "/health/ready",
  routes: "/routes",
  openapi: "/openapi.json",
  docs: "/docs",
} as const;

/** Wire shape of GET /health/live. Mirrors `LivenessResponse`. */
export interface GatewayHealthLive {
  contractVersion: number;
  status: "ok";
  uptimeMs: number;
}

/** Wire shape of GET /health/ready. Mirrors `ReadinessResponse`. */
export interface GatewayHealthReady {
  contractVersion: number;
  status: "ready" | "not_ready";
  manifestVersion: number;
  routeCount: number;
  components: ReadonlyArray<{
    id: string;
    status: "up" | "down" | "degraded" | "starting";
    detail?: string;
    lastCheckedAt: string;
  }>;
}

/** Wire shape of GET /routes. The gateway is the source of truth: it
 *  returns the redacted registry projection `{ manifestVersion, capturedAt,
 *  routes }` where every route exposes only the public-safe fields
 *  (id, toolId, description, targetIds, loadBalancer, capabilities).
 *  The workbench never invents policy, derives kinds, or reconstructs
 *  provider URLs / tokens / paths from this payload. */
export interface GatewayRouteEntry {
  id: string;
  toolId: string;
  description: string;
  targetIds: ReadonlyArray<string>;
  loadBalancer: RouteLoadBalancer;
  capabilities: ReadonlyArray<string>;
}

export interface GatewayRoutesResponse {
  manifestVersion: number;
  capturedAt: string;
  routes: ReadonlyArray<GatewayRouteEntry>;
}

/** Wire shape of GET /openapi.json. Loose; we only check the `openapi`
 *  field and forward the rest to a viewer. */
export interface GatewayOpenApiDocument {
  openapi: string;
  info?: Record<string, unknown>;
  paths?: Record<string, unknown>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Public metadata for GET /docs. We never embed the raw HTML; the workbench
 *  only needs URL, content-type, and byte length so the status panel can
 *  offer an "open docs" affordance. */
export interface GatewayDocsMetadata {
  url: string;
  contentType: string;
  byteLength: number;
  /** When the gateway returned a non-2xx status but still emitted a
   *  meaningful content-type. The workbench surfaces this in the UI
   *  rather than throwing so an ops dashboard can stay informative. */
  status?: number;
}

/** Stable error type for probe failures. Modeled as a class so callers can
 *  `instanceof`-check and so future gateway error codes stay one source of truth. */
export type GatewayProbeErrorCode =
  | "invalid_response"
  | "envelope"
  | "network"
  | "aborted";

export class GatewayProbeError extends Error {
  readonly code: GatewayProbeErrorCode;
  readonly status?: number;
  readonly envelopeCode?: string;
  readonly requestId?: string;

  constructor(
    code: GatewayProbeErrorCode,
    message: string,
    options: { status?: number; envelopeCode?: string; requestId?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "GatewayProbeError";
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
    if (options.envelopeCode !== undefined) this.envelopeCode = options.envelopeCode;
    if (options.requestId !== undefined) this.requestId = options.requestId;
  }
}

export interface GatewayProbeOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  fetcher?: typeof fetch;
  requestId?: string;
}

const isErrorEnvelope = (value: unknown): value is { code: string; message: string; requestId?: string; details?: Record<string, unknown> } => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
};

/** Internal shared helper. Honours the GHA-012 contract:
 *   - honours `signal` (maps AbortError to GatewayProbeError("aborted"))
 *   - emits `x-request-id`
 *   - returns parsed body + content-type + raw text so callers can decide
 *     whether to parse a payload or report metadata; never silently treats
 *     an envelope as success.
 */
const gatewayFetch = async (
  path: string,
  options: GatewayProbeOptions & { rawResponse?: boolean } = {},
): Promise<{ ok: true; status: number; body: unknown; requestId: string; contentType: string; rawText: string } | { ok: false; status: number; body: unknown; requestId: string; contentType: string; rawText: string; envelope: { code: string; message: string; requestId?: string } | null }> => {
  const fetcher = options.fetcher ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetcher) throw new GatewayProbeError("network", "fetch is unavailable in this runtime");
  const requestId = options.requestId ?? newRequestId();
  const baseUrl = resolveBaseUrl(options.baseUrl);
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}${path}`, {
      method: "GET",
      signal: options.signal,
      headers: {
        accept: "application/json, text/html; q=0.9, */*; q=0.5",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GatewayProbeError("aborted", `request cancelled (${path})`, { requestId, cause: error });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new GatewayProbeError("network", `gateway unreachable: ${message}`, { requestId, cause: error });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();
  const trimmed = rawText.length ? safeParseJson(rawText) : null;
  const envelope = trimmed && isErrorEnvelope(trimmed) ? { code: trimmed.code, message: trimmed.message, requestId: trimmed.requestId } : null;
  // When rawResponse is set (e.g. /docs returns HTML), we skip JSON
  // parsing entirely so callers can read the raw body without tripping
  // the "empty body" guard. The envelope short-circuit still wins
  // because an ErrorEnvelope is always JSON.
  const body = options.rawResponse ? trimmed ?? rawText : trimmed;

  if (!response.ok) {
    if (envelope) {
      throw new GatewayProbeError("envelope", envelope.message, {
        status: response.status,
        envelopeCode: envelope.code,
        requestId: envelope.requestId ?? requestId,
      });
    }
    throw new GatewayProbeError(
      "invalid_response",
      `gateway returned ${response.status} for ${path}`,
      { status: response.status, requestId },
    );
  }

  if (body === null) {
    throw new GatewayProbeError("invalid_response", `gateway returned an empty body for ${path}`, {
      status: response.status,
      requestId,
    });
  }

  return { ok: true, status: response.status, body, requestId, contentType, rawText };
};

const safeParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const assertObject = (value: unknown, path: string, requestId: string): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    throw new GatewayProbeError("invalid_response", `${path} response is not a JSON object`, { requestId });
  }
  return value as Record<string, unknown>;
};

/** Probe the gateway's process liveness. The shape mirrors
 *  `LivenessResponse` so a future UI badge can render "uptime Xs" without
 *  re-parsing. */
export const fetchHealthLive = async (options: GatewayProbeOptions = {}): Promise<GatewayHealthLive> => {
  const probe = await gatewayFetch(PROBE_PATHS.healthLive, options);
  if (!probe.ok) throw new GatewayProbeError("invalid_response", `unexpected non-ok branch`, { requestId: probe.requestId });
  const obj = assertObject(probe.body, PROBE_PATHS.healthLive, probe.requestId);
  const parsed = livenessResponseSchema.safeParse(obj);
  if (!parsed.success) {
    throw new GatewayProbeError(
      "invalid_response",
      `${PROBE_PATHS.healthLive} failed schema validation: ${parsed.error.issues.map((i) => i.path.join(".") || "<root>").join(", ")}`,
      { status: probe.status, requestId: probe.requestId, cause: parsed.error },
    );
  }
  return {
    contractVersion: parsed.data.contractVersion,
    status: "ok",
    uptimeMs: parsed.data.uptimeMs,
  };
};

/** Probe the gateway's composition-root readiness. Returns the readiness
 *  document whether the gateway says "ready" or "not_ready"; the helper
 *  only throws on transport / envelope / shape failures. */
export const fetchHealthReady = async (options: GatewayProbeOptions = {}): Promise<GatewayHealthReady> => {
  const probe = await gatewayFetch(PROBE_PATHS.healthReady, options);
  if (!probe.ok) throw new GatewayProbeError("invalid_response", `unexpected non-ok branch`, { requestId: probe.requestId });
  const obj = assertObject(probe.body, PROBE_PATHS.healthReady, probe.requestId);
  const parsed = readinessResponseSchema.safeParse(obj);
  if (!parsed.success) {
    throw new GatewayProbeError(
      "invalid_response",
      `${PROBE_PATHS.healthReady} failed schema validation: ${parsed.error.issues.map((i) => i.path.join(".") || "<root>").join(", ")}`,
      { status: probe.status, requestId: probe.requestId, cause: parsed.error },
    );
  }
  const components = parsed.data.components.map((component) => {
    const status: "up" | "down" | "degraded" | "starting" =
      component.status === "down" || component.status === "degraded" || component.status === "starting"
        ? component.status
        : "up";
    return {
      id: component.id,
      status,
      ...(component.detail ? { detail: component.detail } : {}),
      lastCheckedAt: component.lastCheckedAt,
    };
  });
  return {
    contractVersion: parsed.data.contractVersion,
    status: parsed.data.status,
    manifestVersion: parsed.data.manifestVersion,
    routeCount: parsed.data.routeCount,
    components,
  };
};

/** Fetch the versioned route registry. The gateway is the source of truth;
 *  the workbench only renders it. */
const ROUTE_LOAD_BALANCERS: ReadonlySet<RouteLoadBalancer> = new Set<RouteLoadBalancer>([
  "round-robin",
  "weighted-round-robin",
  "sticky-by-query",
  "failover-only",
]);

const parseRoute = (raw: unknown, requestId: string, index: number): GatewayRouteEntry => {
  if (!raw || typeof raw !== "object") {
    throw new GatewayProbeError(
      "invalid_response",
      `${PROBE_PATHS.routes} routes[${index}] is not an object`,
      { requestId },
    );
  }
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== "string" || entry.id.length === 0) {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} routes[${index}].id missing`, { requestId });
  }
  if (typeof entry.toolId !== "string" || entry.toolId.length === 0) {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} routes[${index}].toolId missing`, { requestId });
  }
  if (typeof entry.description !== "string") {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} routes[${index}].description missing`, { requestId });
  }
  if (!Array.isArray(entry.targetIds) || entry.targetIds.some((value) => typeof value !== "string")) {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} routes[${index}].targetIds missing`, { requestId });
  }
  if (!Array.isArray(entry.capabilities) || entry.capabilities.some((value) => typeof value !== "string")) {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} routes[${index}].capabilities missing`, { requestId });
  }
  if (typeof entry.loadBalancer !== "string" || !ROUTE_LOAD_BALANCERS.has(entry.loadBalancer as RouteLoadBalancer)) {
    throw new GatewayProbeError(
      "invalid_response",
      `${PROBE_PATHS.routes} routes[${index}].loadBalancer must be a known strategy`,
      { requestId },
    );
  }
  return {
    id: entry.id,
    toolId: entry.toolId,
    description: entry.description,
    targetIds: entry.targetIds.slice() as ReadonlyArray<string>,
    loadBalancer: entry.loadBalancer as RouteLoadBalancer,
    capabilities: entry.capabilities.slice() as ReadonlyArray<string>,
  };
};

/** Fetch the redacted route registry projection. The gateway strips adapter
 *  references, URLs, secrets and provider payloads server-side; the
 *  workbench only validates shape and renders the public fields. */
export const fetchRoutes = async (options: GatewayProbeOptions = {}): Promise<GatewayRoutesResponse> => {
  const probe = await gatewayFetch(PROBE_PATHS.routes, options);
  if (!probe.ok) throw new GatewayProbeError("invalid_response", `unexpected non-ok branch`, { requestId: probe.requestId });
  const obj = assertObject(probe.body, PROBE_PATHS.routes, probe.requestId);
  if (typeof obj.manifestVersion !== "number") {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} missing manifestVersion`, {
      status: probe.status,
      requestId: probe.requestId,
    });
  }
  if (typeof obj.capturedAt !== "string" || Number.isNaN(Date.parse(obj.capturedAt))) {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} missing capturedAt`, {
      status: probe.status,
      requestId: probe.requestId,
    });
  }
  if (!Array.isArray(obj.routes)) {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.routes} missing routes array`, {
      status: probe.status,
      requestId: probe.requestId,
    });
  }
  return {
    manifestVersion: obj.manifestVersion,
    capturedAt: obj.capturedAt,
    routes: obj.routes.map((entry, index) => parseRoute(entry, probe.requestId, index)),
  };
};

/** Fetch the OpenAPI 3.1 document. Returned as a typed object so a future
 *  UI viewer can introspect it without re-parsing; the workbench never
 *  generates or modifies the document. */
export const fetchOpenApiDocument = async (options: GatewayProbeOptions = {}): Promise<GatewayOpenApiDocument> => {
  const probe = await gatewayFetch(PROBE_PATHS.openapi, options);
  if (!probe.ok) throw new GatewayProbeError("invalid_response", `unexpected non-ok branch`, { requestId: probe.requestId });
  const obj = assertObject(probe.body, PROBE_PATHS.openapi, probe.requestId);
  if (typeof obj.openapi !== "string") {
    throw new GatewayProbeError("invalid_response", `${PROBE_PATHS.openapi} response is not a valid OpenAPI 3.1 document`, {
      status: probe.status,
      requestId: probe.requestId,
    });
  }
  return obj as GatewayOpenApiDocument;
};

/** Fetch metadata for the human-readable docs page. Never embeds the raw
 *  HTML; returns URL, content-type, and byte length so the status panel
 *  can offer an "open docs" affordance. */
export const fetchDocsMetadata = async (options: GatewayProbeOptions = {}): Promise<GatewayDocsMetadata> => {
  // /docs is HTML, not JSON, so we deliberately skip the JSON envelope
  // short-circuit. The status panel needs the byte length and content
  // type regardless of HTTP status, so we do NOT promote non-2xx to a
  // thrown GatewayProbeError here. Provider secrets never appear in
  // the response, and we never embed the raw HTML.
  const fetcher = options.fetcher ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetcher) throw new GatewayProbeError("network", "fetch is unavailable in this runtime");
  const requestId = options.requestId ?? newRequestId();
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const url = `${baseUrl}${PROBE_PATHS.docs}`;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      signal: options.signal,
      headers: {
        accept: "text/html, application/json; q=0.5, */*; q=0.1",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GatewayProbeError("aborted", `request cancelled (${PROBE_PATHS.docs})`, { requestId, cause: error });
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new GatewayProbeError("network", `gateway unreachable: ${message}`, { requestId, cause: error });
  }
  const contentType = response.headers.get("content-type") ?? "text/html; charset=utf-8";
  const rawText = await response.text();
  return {
    url,
    contentType,
    byteLength: rawText.length,
    ...(response.ok ? {} : { status: response.status }),
  };
};

/** Convenience: enumerate the public gateway probe methods so a future
 *  status panel can iterate without hand-coding the list. */
export const gatewayProbePaths = PROBE_PATHS;

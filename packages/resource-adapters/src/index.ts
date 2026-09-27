import type {
  AdapterSearchResult,
  Intent,
  ResourceAdapter,
  ResourceCandidate,
} from "@axi/gateway-contracts";

export {
  MAX_REDIRECTS,
  RedirectLimitExceededError,
  RedirectSsrfRejectedError,
  fetchWithRedirectLimit,
  type FetchWithRedirectLimitOptions,
} from "./redirect-limit.js";

export type ResourceTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Default transport — delegates to the global `fetch`. Tests inject a fake
 * transport via the adapter constructor so we never touch the network or the
 * filesystem. Adapters must NOT shell out, read arbitrary paths or walk the
 * workspace; they only consume JSON the transport returns.
 */
const defaultTransport: ResourceTransport = (input, init) => fetch(input, init);

const asTransport = (transport: ResourceTransport | undefined): ResourceTransport => transport ?? defaultTransport;

const browserBase = (value: string) => {
  if (/^https?:\/\//u.test(value)) return value.replace(/\/$/u, "");
  if (typeof window !== "undefined") return new URL(value, window.location.origin).toString().replace(/\/$/u, "");
  return `http://127.0.0.1:5177${value.startsWith("/") ? value : `/${value}`}`.replace(/\/$/u, "");
};

const assetUrlFor = (baseUrl: string, value: string) => {
  if (/^(?:https?:|data:|blob:)/iu.test(value)) return value;
  const normalizedValue = value.startsWith("/") ? value : `/${value}`;
  if (/^https?:\/\//u.test(baseUrl)) return new URL(normalizedValue, `${baseUrl.replace(/\/$/u, "")}/`).toString();
  return `${baseUrl.replace(/\/$/u, "")}${normalizedValue}`;
};

const hash = (value: string) => {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) || 0;
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
};

const queryFrom = (intent: Intent) => String(intent.constraints.query || "").trim();

const PAGE_SIZE = 12;
const PAGE_MAX = 100;

const resultLimitFor = (intent: Intent) => {
  if (intent.constraints.showAllCandidates === true) return PAGE_SIZE;
  const raw = intent.constraints.requestedQuantity ?? intent.constraints.quantity ?? intent.constraints.pageSize ?? intent.constraints.count;
  const quantity = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/u.test(raw) ? Number(raw) : undefined;
  return quantity && quantity > 0 ? Math.min(quantity, PAGE_SIZE) : PAGE_SIZE;
};

const pageFrom = (intent: Intent) => {
  const raw = intent.constraints.page;
  const page = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/u.test(raw) ? Number(raw) : 1;
  return Number.isInteger(page) && page > 0 ? Math.min(page, PAGE_MAX) : 1;
};

const imageCatalogAxes = [
  { query: "山景", matches: /山景|雪山|山脉|山间|高山/iu },
  { query: "风景", matches: /风景|景色|风光|自然|山水|天空|海边|scenery|landscape/iu },
  { query: "头像", matches: /头像|avatar/iu },
  { query: "壁纸", matches: /壁纸|wallpaper/iu },
  { query: "美女", matches: /美女|人像|人物/iu },
];

const uniqueTerms = (terms: string[]) => Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean)));

const imageDescriptorFor = (query: string) => query
  .replace(/帮我|请|麻烦|给我|我需要|需要|想要|一张|几张|找一张|找一些|查一下|看一下|有哪些|可以用作|用作|当前|里面的|里的|相关的/giu, " ")
  .replace(/图片|图像|照片|壁纸|素材|资源/giu, " ")
  .replace(/[，,。！!？?；;\s]+/gu, "")
  .trim();

const descriptiveImageTermsFor = (descriptor: string) => {
  const catalogAxisTerms = new Set(imageCatalogAxes.map((axis) => axis.query));
  const terms = Array.from(descriptor.matchAll(/[㐀-鿿]{2,}/gu)).flatMap((match) => {
    const characters = Array.from(match[0]);
    const paired = Array.from({ length: Math.floor(characters.length / 2) }, (_, index) => characters.slice(index * 2, index * 2 + 2).join(""));
    const trailing = characters.length > 2 ? [characters.slice(-2).join("")] : [];
    return [...paired, ...trailing];
  });
  return uniqueTerms(terms.filter((term) => !catalogAxisTerms.has(term))).slice(0, 3);
};

const imageProviderQueriesFor = (query: string) => {
  const descriptor = imageDescriptorFor(query) || query.trim();
  const catalogFallback = imageCatalogAxes.find((axis) => axis.matches.test(query))?.query;
  return uniqueTerms([descriptor, ...descriptiveImageTermsFor(descriptor), catalogFallback || ""]);
};

const providerQueryFor = (query: string, kind: "image" | "skill" | "document") => {
  if (kind === "image") return imageProviderQueriesFor(query)[0] || query;
  if (kind === "skill" && /ppt|演示文稿|presentation/iu.test(query)) return "PPT";
  if (kind === "skill" && /excel|表格|数据/iu.test(query)) return "Excel";
  if (kind === "document" && /工作区|workspace/iu.test(query)) return "工作区";
  const terms = query
    .replace(/帮我|请|找一张|找一些|查一下|看一下|有哪些|适合|用作|可以用作|当前|里的|里面的|相关的|资源|图片|文档|技能/giu, " ")
    .split(/[\s,，。！？!?]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  return terms.slice(0, 3).join(" ") || query;
};

const confidenceFor = (query: string, itemCount: number): AdapterSearchResult["confidence"] => {
  if (itemCount === 1) return "high";
  if (query.replace(/\s+/gu, "").length >= 4 || query.trim().split(/\s+/u).filter(Boolean).length >= 2) return "medium";
  return "low";
};

const safeJson = async (response: Response) => {
  if (!response.ok) throw new Error(`provider returned ${response.status}`);
  return response.json() as Promise<unknown>;
};

/**
 * The gateway-hosted MiniMax bridge wraps successful provider data in
 * `{ ok: true, data }`. Keep accepting the raw provider payload as well so
 * adapters remain usable with direct transports and existing provider tests.
 */
const unwrapMiniMaxBridgeResponse = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object" || !("data" in payload)) return payload;
  const data = (payload as { data?: unknown }).data;
  return data && typeof data === "object" ? data : payload;
};

/**
 * Build a `fetch`-shaped helper that:
 *   - uses the caller-supplied transport (defaults to global `fetch`)
 *   - enforces a hard wall-clock timeout (default 8s)
 *   - propagates the caller's AbortSignal
 *
 * Throws `Error("provider timeout after Xms")` when the timeout elapses
 * before the transport resolves. Adapters must wrap their network calls
 * in this helper so the gateway can map timeouts onto its error code.
 */
export const createFetchWithTimeout = (
  transport: ResourceTransport = defaultTransport,
  defaultTimeoutMs = 8000,
) => async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = defaultTimeoutMs) => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    return await transport(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error(`provider timeout after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
};

export class ImagePreviewAdapter implements ResourceAdapter {
  descriptor = {
    id: "axi-image-preview",
    label: "Axi Image Preview",
    resourceKinds: ["image"],
    capabilities: ["search", "preview"] as Array<"search" | "preview">,
  };

  constructor(
    private readonly baseUrl = "/provider/image-preview",
    private readonly transport?: ResourceTransport,
  ) {}

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const providerQueries = imageProviderQueriesFor(query);
    let providerQuery = providerQueries[0] || query;
    let payload: {
      items?: Array<Record<string, unknown>>;
      totalItems?: number;
    } = {};
    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.transport));

    const page = pageFrom(intent);
    const pageSize = resultLimitFor(intent);
    for (const candidateQuery of providerQueries) {
      const url = new URL(`${browserBase(this.baseUrl)}/api/wallpapers`);
      url.searchParams.set("navId", "avatar");
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("search", candidateQuery);
      payload = await safeJson(await fetchWithTimeout(url, { signal })) as typeof payload;
      providerQuery = candidateQuery;
      if (payload.items?.length) break;
    }

    const items = (payload.items || []).flatMap((item) => {
      const imageUrl = typeof item.imageUrl === "string" ? item.imageUrl : "";
      const title = typeof item.title === "string" ? item.title : "未命名图片";
      if (!imageUrl) return [];
      const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [];
      return [{
        id: `image:${hash(imageUrl)}`,
        kind: "image",
        title,
        preview: assetUrlFor(this.baseUrl, typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : imageUrl),
        facts: {
          tags,
          resolution: item.resolution,
          size: item.size,
          mediaType: item.mediaType,
          requestedQuery: query,
          providerQuery,
          providerQueriesTried: providerQueries,
        },
        provenance: {
          provider: "axi-image-preview",
          ref: imageUrl,
          version: typeof item.fingerprint === "string" ? item.fingerprint : undefined,
        },
        // Axi Image Preview is a curated local catalog. Its entries are normal
        // library resources; text labels such as “性感” must not invent a safety state.
        safety: "safe" as const,
      } satisfies ResourceCandidate];
    });
    const totalItems = payload.totalItems ?? items.length;
    return {
      items,
      sourceVersion: `axi-image-preview:${totalItems}`,
      confidence: confidenceFor(query, items.length),
      clarification: [
        { id: "portrait", label: "更偏向正面头像构图", value: "请优先正面头像构图" },
        { id: "style", label: "更偏向插画或真人风格", value: "请区分插画或真人风格" },
      ],
      mode: "live",
      page,
      pageSize,
      totalItems,
      hasMore: page * pageSize < totalItems,
    };
  }
}

type MiniMaxImageResponse = {
  files?: Array<{ file?: string; dataUrl?: string; sourceUrl?: string }>;
};

const aspectRatioFor = (intent: Intent) => intent.constraints.orientation === "landscape"
  ? "16:9"
  : intent.constraints.orientation === "portrait" ? "3:4" : "1:1";

export class MiniMaxTokenPlanImageAdapter implements ResourceAdapter {
  descriptor = {
    id: "minimax-tokenplan-image",
    label: "MiniMax Token Plan Image Generation",
    resourceKinds: ["image"],
    capabilities: ["search", "preview"] as Array<"search" | "preview">,
    toolId: "resource.generate.image",
  };

  constructor(
    private readonly baseUrl = "/provider/minimax-tokenplan",
    private readonly transport?: ResourceTransport,
  ) {}

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const composedPrompt = typeof intent.constraints.composedPrompt === "string"
      ? intent.constraints.composedPrompt.trim()
      : "";
    const prompt = composedPrompt || query;
    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.transport));
    const response = await fetchWithTimeout(`${browserBase(this.baseUrl)}/image`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, aspectRatio: aspectRatioFor(intent), n: resultLimitFor(intent) }),
    }, 180000);
    const payload = unwrapMiniMaxBridgeResponse(await safeJson(response)) as MiniMaxImageResponse;
    const images = (payload.files || []).filter((file) => typeof file.dataUrl === "string" && file.dataUrl.length > 0);
    if (!images.length) throw new Error("MiniMax image generation returned no preview");
    const promptSource = composedPrompt && composedPrompt !== query ? "composed" : "user-query";
    return {
      items: images.map((file, index) => ({
        id: `image:minimax-${hash(file.file || file.dataUrl || `${prompt}:${index}`)}`,
        kind: "image",
        title: `MiniMax 生成：${query}`,
        preview: file.dataUrl,
        facts: {
          requestedQuery: query,
          providerQuery: "minimax-tokenplan.image",
          generated: true,
          aspectRatio: aspectRatioFor(intent),
          prompt,
          promptSource,
        },
        provenance: {
          provider: "minimax-tokenplan",
          ref: file.file || file.sourceUrl || `minimax://image/${hash(`${prompt}:${index}`)}`,
          version: "image-01",
        },
        safety: "safe" as const,
      } satisfies ResourceCandidate)),
      sourceVersion: "minimax-tokenplan:image-01",
      confidence: "high",
      mode: "live",
    };
  }
}

type MiniMaxSearchResponse = {
  organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
};

export class MiniMaxTokenPlanWebSearchAdapter implements ResourceAdapter {
  descriptor = {
    id: "minimax-tokenplan-search",
    label: "MiniMax Token Plan Web Search",
    resourceKinds: ["web"],
    capabilities: ["search"] as Array<"search">,
    toolId: "resource.search.web",
  };

  constructor(
    private readonly baseUrl = "/provider/minimax-tokenplan",
    private readonly transport?: ResourceTransport,
  ) {}

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.transport));
    const response = await fetchWithTimeout(`${browserBase(this.baseUrl)}/search`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    }, 30000);
    const payload = unwrapMiniMaxBridgeResponse(await safeJson(response)) as MiniMaxSearchResponse;
    const items = (payload.organic || []).flatMap((entry, index) => {
      const link = typeof entry.link === "string" ? entry.link : "";
      const title = typeof entry.title === "string" ? entry.title : "未命名网页结果";
      if (!link) return [];
      return [{
        id: `web:${hash(link)}`,
        kind: "web",
        title,
        facts: {
          snippet: typeof entry.snippet === "string" ? entry.snippet : "",
          date: entry.date,
          requestedQuery: query,
          rank: index + 1,
        },
        provenance: { provider: "minimax-tokenplan", ref: link, version: "web-search" },
        safety: "safe" as const,
      } satisfies ResourceCandidate];
    });
    return {
      items,
      sourceVersion: "minimax-tokenplan:web-search",
      confidence: confidenceFor(query, items.length),
      mode: "live",
    };
  }
}

type McpResponse = {
  result?: { content?: Array<{ type?: string; text?: string }> };
  error?: { message?: string };
};

const parseMcpText = (payload: McpResponse) => {
  if (payload.error) throw new Error(payload.error.message || "Axi Docs MCP error");
  const text = payload.result?.content?.find((entry) => entry.type === "text")?.text;
  if (!text) throw new Error("Axi Docs MCP returned no text result");
  return JSON.parse(text) as unknown;
};

const arrayFromPayload = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["results", "items", "documents", "projects"]) {
      if (Array.isArray(record[key])) return arrayFromPayload(record[key]);
    }
  }
  return [];
};

export class AxiDocsAdapter implements ResourceAdapter {
  descriptor = {
    id: "axi-docs",
    label: "Axi Docs / Skills",
    resourceKinds: ["skill", "document"],
    capabilities: ["search", "preview"] as Array<"search" | "preview">,
  };

  constructor(
    private readonly options: {
      baseUrl?: string;
      token?: string;
      transport?: ResourceTransport;
    } = {},
  ) {}

  private async call(toolName: string, args: Record<string, unknown>, signal?: AbortSignal) {
    const baseUrl = browserBase(this.options.baseUrl || "/provider/axi-docs");
    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.options.transport));
    const response = await fetchWithTimeout(`${baseUrl}/mcp`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(this.options.token ? { authorization: `Bearer ${this.options.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } }),
    });
    return parseMcpText(await safeJson(response) as McpResponse);
  }

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const kind = intent.resourceKinds.includes("skill") ? "skill" : "document";
    const providerQuery = providerQueryFor(query, kind);
    const payload = await this.call(kind === "skill" ? "axi_docs_skill_search" : "axi_docs_search", { query: providerQuery }, signal);
    const items = arrayFromPayload(payload).flatMap((item) => {
      const title = String(item.title || item.name || item.path || "未命名文档");
      const path = String(item.path || item.relativePath || title);
      const sourceId = String(item.sourceId || item.source || "axi-docs");
      const description = String(item.description || item.snippet || "");
      return [{
        id: `${kind}:${hash(`${sourceId}:${path}`)}`,
        kind,
        title,
        facts: {
          sourceId,
          path,
          description,
          requestedQuery: query,
          providerQuery,
          score: item.score,
          matchedBy: item.matchedBy,
          tags: item.tags,
        },
        provenance: {
          provider: "axi-docs",
          ref: `${sourceId}:${path}`,
          version: String(item.generatedAt || "axi-docs-index"),
        },
        safety: "safe" as const,
      } satisfies ResourceCandidate];
    });
    return {
      items,
      sourceVersion: "axi-docs-index",
      confidence: confidenceFor(query, items.length),
      clarification: [{ id: "source", label: "限定技能库或文档库", value: "请限定 source 或项目范围" }],
      mode: "live",
    };
  }
}

export class WorkspaceStatusAdapter implements ResourceAdapter {
  descriptor = {
    id: "axi-workspace-status",
    label: "Axi Workspace Status",
    resourceKinds: ["workspace"],
    capabilities: ["search"] as Array<"search">,
  };

  constructor(private readonly options: { baseUrl?: string; token?: string; transport?: ResourceTransport } = {}) {}

  async search(_intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const baseUrl = browserBase(this.options.baseUrl || "/provider/axi-docs");
    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.options.transport));
    const response = await fetchWithTimeout(`${baseUrl}/mcp`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(this.options.token ? { authorization: `Bearer ${this.options.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "axi_docs_workspace_status", arguments: {} } }),
    });
    const payload = parseMcpText(await safeJson(response) as McpResponse);
    const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    return {
      items: [{
        id: "workspace:status",
        kind: "workspace",
        title: "当前 Axi 工作区状态",
        facts: record,
        provenance: { provider: "axi-docs", ref: "workspace-status", version: String(record.generatedAt || "live") },
        safety: "safe",
      }],
      sourceVersion: String(record.generatedAt || "axi-docs-workspace-status"),
      confidence: "high",
      mode: "live",
    };
  }
}

type LibraryProviderResponse = {
  results?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
  icons?: Array<Record<string, unknown>>;
  totalItems?: number;
  generatedAt?: string;
};

const parseLibraryPayload = (payload: unknown): LibraryProviderResponse => {
  if (!payload || typeof payload !== "object") {
    throw new Error("library provider returned non-object payload");
  }
  const record = payload as Record<string, unknown>;
  return {
    results: Array.isArray(record.results) ? record.results as Array<Record<string, unknown>> : undefined,
    items: Array.isArray(record.items) ? record.items as Array<Record<string, unknown>> : undefined,
    projects: Array.isArray(record.projects) ? record.projects as Array<Record<string, unknown>> : undefined,
    components: Array.isArray(record.components) ? record.components as Array<Record<string, unknown>> : undefined,
    icons: Array.isArray(record.icons) ? record.icons as Array<Record<string, unknown>> : undefined,
    totalItems: typeof record.totalItems === "number" ? record.totalItems : undefined,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : undefined,
  };
};

const libraryArray = (parsed: LibraryProviderResponse): Array<Record<string, unknown>> =>
  parsed.results || parsed.items || parsed.projects || parsed.components || parsed.icons || [];

/**
 * ProjectInfoAdapter — controlled gateway route for `resource.search.project`.
 *
 * Returns workspace-registered project facts (id, title, description,
 * owner, stack, lastVerifiedAt, etc.) from an allowlisted project
 * provider. The provider MUST respond with JSON of shape:
 *   { results?: Project[] } | { projects?: Project[] } | Project[]
 *
 * Adapters must NEVER shell out or walk the workspace — every fact
 * here originates from the configured transport.
 */
export class ProjectInfoAdapter implements ResourceAdapter {
  descriptor = {
    id: "axi-project-info",
    label: "Axi Project Info",
    resourceKinds: ["project"],
    capabilities: ["search"] as Array<"search">,
    toolId: "resource.search.project",
  };

  constructor(
    private readonly options: {
      baseUrl: string;
      transport?: ResourceTransport;
      timeoutMs?: number;
    },
  ) {
    if (!options.baseUrl || typeof options.baseUrl !== "string") {
      throw new Error("ProjectInfoAdapter requires a non-empty baseUrl");
    }
  }

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const url = new URL(`${browserBase(this.options.baseUrl)}/projects`);
    if (query) url.searchParams.set("q", query);
    url.searchParams.set("limit", String(resultLimitFor(intent)));

    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.options.transport), this.options.timeoutMs);
    const payload = await safeJson(await fetchWithTimeout(url, { signal })) as unknown;
    const parsed = parseLibraryPayload(payload);
    const projects = libraryArray(parsed);
    const items: ResourceCandidate[] = projects.flatMap((project, index) => {
      const projectId = String(project.id || project.slug || project.projectId || `project-${index}`);
      const title = String(project.title || project.name || projectId);
      const description = typeof project.description === "string" ? project.description : "";
      const owner = typeof project.owner === "string" ? project.owner : undefined;
      const stack = Array.isArray(project.stack) ? project.stack.filter((entry): entry is string => typeof entry === "string") : undefined;
      const lastVerifiedAt = typeof project.lastVerifiedAt === "string" ? project.lastVerifiedAt : undefined;
      const docsRef = typeof project.docsRef === "string" ? project.docsRef : projectId;
      return [{
        id: `project:${hash(`${this.options.baseUrl}:${projectId}`)}`,
        kind: "project",
        title,
        preview: typeof project.preview === "string" ? project.preview : undefined,
        facts: {
          projectId,
          description,
          owner,
          stack,
          lastVerifiedAt,
          tags: Array.isArray(project.tags) ? project.tags.filter((entry): entry is string => typeof entry === "string") : undefined,
          requestedQuery: query,
          providerQuery: query || "*",
        },
        provenance: {
          provider: "axi-project-info",
          ref: docsRef,
          version: lastVerifiedAt || parsed.generatedAt || "live",
        },
        safety: "safe",
      } satisfies ResourceCandidate];
    });

    return {
      items,
      sourceVersion: `axi-project-info:${parsed.generatedAt || parsed.totalItems || items.length}`,
      confidence: confidenceFor(query, items.length),
      mode: "live",
    };
  }
}

/**
 * UiLibraryAdapter — controlled gateway route for `resource.search.ui`.
 *
 * Returns UI component catalog facts from an allowlisted UI library
 * provider. The provider MUST respond with JSON of shape:
 *   { components?: Component[] } | { results?: Component[] } | Component[]
 *
 * The adapter is a pure JSON normalizer; it never inspects files or
 * directories.
 */
export class UiLibraryAdapter implements ResourceAdapter {
  descriptor = {
    id: "axi-ui-library",
    label: "Axi UI Library",
    resourceKinds: ["ui"],
    capabilities: ["search", "preview"] as Array<"search" | "preview">,
    toolId: "resource.search.ui",
  };

  constructor(
    private readonly options: {
      baseUrl: string;
      transport?: ResourceTransport;
      timeoutMs?: number;
      libraryName?: string;
    },
  ) {
    if (!options.baseUrl || typeof options.baseUrl !== "string") {
      throw new Error("UiLibraryAdapter requires a non-empty baseUrl");
    }
  }

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const url = new URL(`${browserBase(this.options.baseUrl)}/components`);
    if (query) url.searchParams.set("q", query);
    url.searchParams.set("limit", String(resultLimitFor(intent)));

    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.options.transport), this.options.timeoutMs);
    const payload = await safeJson(await fetchWithTimeout(url, { signal })) as unknown;
    const parsed = parseLibraryPayload(payload);
    const components = libraryArray(parsed);
    const libraryName = this.options.libraryName || "ui-library";
    const items: ResourceCandidate[] = components.flatMap((component, index) => {
      const componentId = String(component.id || component.slug || component.name || `component-${index}`);
      const title = String(component.title || component.name || componentId);
      const componentKind = typeof component.kind === "string" ? component.kind : "component";
      const description = typeof component.description === "string" ? component.description : "";
      const previewUrl = typeof component.previewUrl === "string" ? component.previewUrl : undefined;
      const version = typeof component.version === "string" ? component.version : undefined;
      return [{
        id: `ui:${hash(`${libraryName}:${componentId}`)}`,
        kind: "ui",
        title,
        preview: previewUrl,
        facts: {
          componentId,
          componentKind,
          description,
          library: libraryName,
          tags: Array.isArray(component.tags) ? component.tags.filter((entry): entry is string => typeof entry === "string") : undefined,
          props: component.props,
          requestedQuery: query,
          providerQuery: query || "*",
        },
        provenance: {
          provider: `axi-ui-library:${libraryName}`,
          ref: componentId,
          version: version || parsed.generatedAt || "live",
        },
        safety: "safe",
      } satisfies ResourceCandidate];
    });

    return {
      items,
      sourceVersion: `axi-ui-library:${libraryName}:${parsed.generatedAt || parsed.totalItems || items.length}`,
      confidence: confidenceFor(query, items.length),
      mode: "live",
    };
  }
}

/**
 * IconLibraryAdapter — controlled gateway route for `resource.search.icon`.
 *
 * Returns icon catalog facts from an allowlisted icon library provider.
 * The provider MUST respond with JSON of shape:
 *   { icons?: Icon[] } | { results?: Icon[] } | Icon[]
 *
 * Adapters must NOT generate or transcode icons — every fact here is
 * provider-returned JSON.
 */
export class IconLibraryAdapter implements ResourceAdapter {
  descriptor = {
    id: "axi-icon-library",
    label: "Axi Icon Library",
    resourceKinds: ["icon"],
    capabilities: ["search", "preview"] as Array<"search" | "preview">,
    toolId: "resource.search.icon",
  };

  constructor(
    private readonly options: {
      baseUrl: string;
      transport?: ResourceTransport;
      timeoutMs?: number;
      libraryName?: string;
    },
  ) {
    if (!options.baseUrl || typeof options.baseUrl !== "string") {
      throw new Error("IconLibraryAdapter requires a non-empty baseUrl");
    }
  }

  async search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult> {
    const query = queryFrom(intent);
    const url = new URL(`${browserBase(this.options.baseUrl)}/icons`);
    if (query) url.searchParams.set("q", query);
    url.searchParams.set("limit", String(resultLimitFor(intent)));

    const fetchWithTimeout = createFetchWithTimeout(asTransport(this.options.transport), this.options.timeoutMs);
    const payload = await safeJson(await fetchWithTimeout(url, { signal })) as unknown;
    const parsed = parseLibraryPayload(payload);
    const icons = libraryArray(parsed);
    const libraryName = this.options.libraryName || "icon-library";
    const items: ResourceCandidate[] = icons.flatMap((icon, index) => {
      const iconId = String(icon.id || icon.slug || icon.name || `icon-${index}`);
      const title = String(icon.title || icon.name || iconId);
      const style = typeof icon.style === "string" ? icon.style : "outline";
      const previewUrl = typeof icon.previewUrl === "string" ? icon.previewUrl : undefined;
      const svg = typeof icon.svg === "string" ? icon.svg : undefined;
      const version = typeof icon.version === "string" ? icon.version : undefined;
      return [{
        id: `icon:${hash(`${libraryName}:${iconId}`)}`,
        kind: "icon",
        title,
        preview: previewUrl || svg,
        facts: {
          iconId,
          style,
          library: libraryName,
          tags: Array.isArray(icon.tags) ? icon.tags.filter((entry): entry is string => typeof entry === "string") : undefined,
          requestedQuery: query,
          providerQuery: query || "*",
        },
        provenance: {
          provider: `axi-icon-library:${libraryName}`,
          ref: iconId,
          version: version || parsed.generatedAt || "live",
        },
        safety: "safe",
      } satisfies ResourceCandidate];
    });

    return {
      items,
      sourceVersion: `axi-icon-library:${libraryName}:${parsed.generatedAt || parsed.totalItems || items.length}`,
      confidence: confidenceFor(query, items.length),
      mode: "live",
    };
  }
}

class FixtureAdapter implements ResourceAdapter {
  constructor(
    public readonly descriptor: ResourceAdapter["descriptor"],
    private readonly items: ResourceCandidate[],
  ) {}

  async search(intent: Intent): Promise<AdapterSearchResult> {
    const query = queryFrom(intent).toLocaleLowerCase();
    const tokenRegex = new RegExp("[\\s\\u3000,，。！？!？;；]+", "u");
    const tokens = query.split(tokenRegex).filter(Boolean);
    const kindFiltered = this.items.filter((item) => intent.resourceKinds.includes(item.kind));
    const pool = kindFiltered.length ? kindFiltered : this.items;
    const haystack = (item: ResourceCandidate) => `${item.title} ${JSON.stringify(item.facts)}`.toLocaleLowerCase();
    const directMatches = tokens.length
      ? pool.filter((item) => tokens.some((token) => haystack(item).includes(token)))
      : pool;
    // Images keep the historical catalog fallback used by the local preview
    // fixture. Text resources must never invent a match by returning an
    // unrelated skill/document/project/etc. when the query misses.
    const filtered = directMatches.length
      ? directMatches
      : intent.resourceKinds.includes("image")
        ? pool
        : [];
    const limited = filtered.slice(0, resultLimitFor(intent));
    const hasResults = limited.length > 0;
    return {
      items: limited,
      sourceVersion: "fixture-v1",
      confidence: hasResults ? "high" : "low",
      clarification: [{ id: "fixture-query", label: "补充更具体的关键词", value: "请补充用途或主题" }],
      warnings: hasResults ? [] : ["当前 provider 不可用，展示的是本地 fixture；它不能作为真实工作区事实。"],
      mode: "fixture",
    };
  }
}

export const createFixtureAdapters = (): ResourceAdapter[] => [
  new FixtureAdapter(
    { id: "fixture-image-preview", label: "Fixture Image Preview", resourceKinds: ["image"], capabilities: ["search", "preview"] },
    [
      {
        id: "fixture-image-sunlit", kind: "image", title: "暖光头像构图示例", facts: { tags: ["头像", "暖光", "人像"] },
        provenance: { provider: "fixture:image-preview", ref: "fixture://image/sunlit", version: "fixture-v1" }, safety: "safe",
      },
      {
        id: "fixture-image-fashion", kind: "image", title: "时尚人像构图示例", facts: { tags: ["时尚", "人像"] },
        provenance: { provider: "fixture:image-preview", ref: "fixture://image/fashion", version: "fixture-v1" }, safety: "safe",
      },
    ],
  ),
  new FixtureAdapter(
    { id: "fixture-axi-docs", label: "Fixture Axi Docs", resourceKinds: ["skill", "document"], capabilities: ["search", "preview"] },
    [
      {
        id: "fixture-skill-ppt", kind: "skill", title: "Presentation workflow", facts: { description: "PPT 结构、视觉迭代和导出验证", path: "skills/presentations/SKILL.md" },
        provenance: { provider: "fixture:axi-docs", ref: "fixture://skill/presentation", version: "fixture-v1" }, safety: "safe",
      },
      {
        id: "fixture-document-contract", kind: "document", title: "资源工具契约", facts: { description: "工具调用和确定性验证边界", path: "docs/resource-contract.md" },
        provenance: { provider: "fixture:axi-docs", ref: "fixture://document/contract", version: "fixture-v1" }, safety: "safe",
      },
    ],
  ),
  new FixtureAdapter(
    { id: "fixture-workspace", label: "Fixture Workspace", resourceKinds: ["workspace"], capabilities: ["search"] },
    [{
      id: "fixture-workspace-status", kind: "workspace", title: "工作区资源 provider 已注册", facts: { providers: ["image-preview", "axi-docs", "axi-skills"] },
      provenance: { provider: "fixture:workspace", ref: "fixture://workspace/status", version: "fixture-v1" }, safety: "safe",
    }],
  ),
  new FixtureAdapter(
    { id: "fixture-project-info", label: "Fixture Project Info", resourceKinds: ["project"], capabilities: ["search"], toolId: "resource.search.project" },
    [
      {
        id: "fixture-project-orchestration", kind: "project", title: "ai-resource-orchestration",
        facts: { projectId: "ai-resource-orchestration", description: "本地资源调度工作台", owner: "libu", stack: ["typescript", "vite"], tags: ["orchestration"] },
        provenance: { provider: "fixture:project-info", ref: "ai-resource-orchestration", version: "fixture-v1" }, safety: "safe",
      },
      {
        id: "fixture-project-image-preview", kind: "project", title: "axi-image-preview",
        facts: { projectId: "axi-image-preview", description: "本地图库 provider", owner: "libu", stack: ["node"], tags: ["provider"] },
        provenance: { provider: "fixture:project-info", ref: "axi-image-preview", version: "fixture-v1" }, safety: "safe",
      },
    ],
  ),
  new FixtureAdapter(
    { id: "fixture-ui-library", label: "Fixture UI Library", resourceKinds: ["ui"], capabilities: ["search", "preview"], toolId: "resource.search.ui" },
    [
      {
        id: "fixture-ui-button", kind: "ui", title: "Button",
        facts: { componentId: "button", componentKind: "atom", library: "axi-ui", tags: ["form"] },
        provenance: { provider: "fixture:ui-library:axi-ui", ref: "button", version: "fixture-v1" }, safety: "safe",
      },
      {
        id: "fixture-ui-card", kind: "ui", title: "Card",
        facts: { componentId: "card", componentKind: "molecule", library: "axi-ui", tags: ["layout"] },
        provenance: { provider: "fixture:ui-library:axi-ui", ref: "card", version: "fixture-v1" }, safety: "safe",
      },
    ],
  ),
  new FixtureAdapter(
    { id: "fixture-icon-library", label: "Fixture Icon Library", resourceKinds: ["icon"], capabilities: ["search", "preview"], toolId: "resource.search.icon" },
    [
      {
        id: "fixture-icon-search", kind: "icon", title: "Search",
        facts: { iconId: "search", style: "outline", library: "axi-icons", tags: ["nav"] },
        provenance: { provider: "fixture:icon-library:axi-icons", ref: "search", version: "fixture-v1" }, safety: "safe",
      },
      {
        id: "fixture-icon-home", kind: "icon", title: "Home",
        facts: { iconId: "home", style: "outline", library: "axi-icons", tags: ["nav"] },
        provenance: { provider: "fixture:icon-library:axi-icons", ref: "home", version: "fixture-v1" }, safety: "safe",
      },
    ],
  ),
];

export const withFallback = (primary: ResourceAdapter, fallback: ResourceAdapter): ResourceAdapter => ({
  descriptor: primary.descriptor,
  async search(intent, signal) {
    try {
      return await primary.search(intent, signal);
    } catch (error) {
      const result = await fallback.search(intent, signal);
      return {
        ...result,
        warnings: [
          `实时 ${primary.descriptor.label} provider 不可用：${error instanceof Error ? error.message : "未知错误"}`,
          ...(result.warnings || []),
        ],
      };
    }
  },
});

export const withFallbackOnEmpty = (primary: ResourceAdapter, fallback: ResourceAdapter): ResourceAdapter => ({
  descriptor: primary.descriptor,
  async search(intent, signal) {
    try {
      const result = await primary.search(intent, signal);
      if (result.items.length > 0) return result;
      return fallback.search(intent, signal);
    } catch (error) {
      const result = await fallback.search(intent, signal);
      return {
        ...result,
        warnings: [
          `实时 ${primary.descriptor.label} provider 不可用：${error instanceof Error ? error.message : "未知错误"}`,
          ...(result.warnings || []),
        ],
      };
    }
  },
});

export const adapterStatusLabel = (candidate: ResourceCandidate) => candidate.provenance.provider.startsWith("fixture:") ? "FIXTURE" : "LIVE PROVIDER";

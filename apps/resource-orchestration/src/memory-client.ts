import type {
  MemoryContributionRequest,
  MemoryEntry,
  MemoryExportResponse,
  MemorySettings,
  PlannerMemoryContext,
} from "@axi/gateway-contracts";
import {
  memoryAckResponseSchema,
  memoryEntryResponseSchema,
  memoryExportResponseSchema,
  memoryListResponseSchema,
  memorySearchResponseSchema,
  memorySettingsResponseSchema,
} from "@axi/gateway-contracts";

/**
 * MEM-MVP-014 / MEM-MVP-015 — Browser-side memory client.
 *
 * Workbench is the only client of the gateway's `/memory/*` HTTP
 * surface. Every method:
 *
 *   - resolves the same gateway base URL as `gateway-client.ts`,
 *   - emits `x-request-id`,
 *   - returns either the parsed typed payload or `null` when the
 *     gateway is unreachable / returned a non-2xx envelope. The
 *     workbench must keep running when memory is unavailable; we
 *     never throw across the run-time boundary.
 *   - never echoes the storage path, raw memory entries, or provider
 *     payloads into browser logs.
 *
 * The browser never sees the store path or the on-disk file. It only
 * sees the public redacted projection.
 */

export interface MemoryClientOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  fetcher?: typeof fetch;
  requestId?: string;
  projectId?: string;
}

const RESOLVE_BASE_URL = (override?: string): string => {
  if (typeof override === "string" && override.length > 0) return override.replace(/\/$/u, "");
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GATEWAY_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv.replace(/\/$/u, "");
  return import.meta.env.DEV ? "" : "http://127.0.0.1:8787";
};

const newRequestId = (): string => `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const safeFetch = async (
  fetcher: typeof fetch | undefined,
  url: string,
  init: RequestInit,
): Promise<Response | null> => {
  const fn = fetcher ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fn) return null;
  try {
    return await fn(url, init);
  } catch {
    return null;
  }
};

const okOrNull = async (response: Response | null): Promise<unknown | null> => {
  if (!response || !response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

const CONTRIBUTION_SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:bearer|basic)\s+[^\s]+/iu,
  /(?:token|secret|password|passwd|api[_-]?key|authorization|cookie|private[_-]?key)\s*[:=]\s*[^\s]+/iu,
  /(?:^|[\s(])\/(?:Users|Volumes|home|root|etc|var|tmp|opt|usr)\/[^\s)]+/iu,
  /file:\/\/[^\s)]+/iu,
  /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/iu,
];

/** Keep the browser contribution body safe even when the gateway is down. */
const safeContributionText = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || CONTRIBUTION_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed))) return null;
  return trimmed.slice(0, 800);
};

const conciseContributionText = (value: string): string | null => {
  const safe = safeContributionText(value);
  if (!safe) return null;
  const instruction = safe.match(/(?:记住|以后|之后|默认|本项目|这个项目)[^\n。！？!?]{0,240}/u)?.[0];
  return (instruction ?? safe.slice(0, 240)).trim();
};

export const fetchMemorySettings = async (options: MemoryClientOptions = {}): Promise<MemorySettings | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/settings`, {
    method: "GET",
    signal: options.signal,
    headers: { accept: "application/json", "x-request-id": requestId },
  });
  const parsed = memorySettingsResponseSchema.safeParse(await okOrNull(response));
  return parsed.success ? parsed.data.settings : null;
};

export const patchMemorySettings = async (
  patch: Partial<MemorySettings>,
  options: MemoryClientOptions = {},
): Promise<MemorySettings | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/settings`, {
    method: "PATCH",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify(patch),
  });
  const parsed = memorySettingsResponseSchema.safeParse(await okOrNull(response));
  return parsed.success ? parsed.data.settings : null;
};

export const searchMemory = async (
  query: string,
  options: MemoryClientOptions & { scope?: "global" | "project"; projectId?: string } = {},
): Promise<PlannerMemoryContext | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/search`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({
      query,
      ...(options.scope ? { scope: options.scope } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
    }),
  });
  const parsed = memorySearchResponseSchema.safeParse(await okOrNull(response));
  return parsed.success ? { memories: parsed.data.memories } : null;
};

export const listMemoryEntries = async (
  options: MemoryClientOptions = {},
): Promise<ReadonlyArray<MemoryEntry>> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/entries`, {
    method: "GET",
    signal: options.signal,
    headers: { accept: "application/json", "x-request-id": requestId },
  });
  const parsed = memoryListResponseSchema.safeParse(await okOrNull(response));
  return parsed.success ? parsed.data.entries : [];
};

export const approveMemoryEntry = async (id: string, options: MemoryClientOptions = {}): Promise<boolean> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/entries/${id}/approve`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: "{}",
  });
  return memoryEntryResponseSchema.safeParse(await okOrNull(response)).success;
};

export const rejectMemoryEntry = async (id: string, options: MemoryClientOptions = {}): Promise<boolean> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/entries/${id}/reject`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: "{}",
  });
  return memoryAckResponseSchema.safeParse(await okOrNull(response)).success;
};

export const deleteMemoryEntry = async (id: string, options: MemoryClientOptions = {}): Promise<boolean> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/entries/${id}`, {
    method: "DELETE",
    signal: options.signal,
    headers: { "x-request-id": requestId },
  });
  return memoryAckResponseSchema.safeParse(await okOrNull(response)).success;
};

export const clearMemory = async (
  scope: "global" | "project",
  options: MemoryClientOptions & { projectId?: string } = {},
): Promise<boolean> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/clear`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({
      scope,
      ...(options.projectId ? { projectId: options.projectId } : {}),
      confirm: true,
    }),
  });
  return memoryAckResponseSchema.safeParse(await okOrNull(response)).success;
};

export const exportMemory = async (options: MemoryClientOptions = {}): Promise<MemoryExportResponse | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/export`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: "{}",
  });
  const parsed = memoryExportResponseSchema.safeParse(await okOrNull(response));
  return parsed.success ? parsed.data : null;
};

/**
 * Post-run contribution. The browser submits a redacted session
 * summary; the gateway runs policy + redactor + extractor on its
 * own server side. The browser applies a second fail-closed filter so
 * raw provider payloads, query text containing credentials, and secret-
 * shaped values never cross this boundary.
 */
export const contributeMemory = async (
  contribution: MemoryContributionRequest,
  options: MemoryClientOptions = {},
): Promise<{ processed: boolean; accepted: number; rejected: number }> => {
  const userInput = conciseContributionText(contribution.userInput);
  const summary = contribution.summary === undefined ? userInput : conciseContributionText(contribution.summary);
  if (!userInput || !summary) return { processed: false, accepted: 0, rejected: 1 };
  const safeContribution: MemoryContributionRequest = {
    ...contribution,
    userInput,
    summary,
  };
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/memory/contribute`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify(safeContribution),
  });
  if (!response || !response.ok || !memoryAckResponseSchema.safeParse(await okOrNull(response)).success) {
    return { processed: false, accepted: 0, rejected: 0 };
  }
  const accepted = Number(response.headers.get("x-memory-contribution-accepted") ?? 0);
  const rejected = Number(response.headers.get("x-memory-contribution-rejected") ?? 0);
  return { processed: asString(response.headers.get("x-memory-contribution")) === "processed", accepted, rejected };
};

export const memoryBaseUrl = (override?: string): string => RESOLVE_BASE_URL(override);

import type {
  SessionAppendRequest,
  SessionCreateRequest,
  SessionDeleteRequest,
  SessionDetailResponse,
  SessionEntry,
  SessionListResponse,
  SessionPatch,
  SessionRecord,
  SessionSummary,
} from "@axi/gateway-contracts";
import {
  sessionAppendResponseSchema,
  sessionCreateResponseSchema,
  sessionDeleteResponseSchema,
  sessionDetailResponseSchema,
  sessionListResponseSchema,
  sessionPatchResponseSchema,
} from "@axi/gateway-contracts";

/**
 * SES-MVP-013 — Browser session client.
 *
 * Workbench talks to `/sessions` only. Failures return null so the
 * workbench can keep a temporary conversation when the gateway is down.
 */

export interface SessionClientOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  fetcher?: typeof fetch;
  requestId?: string;
  /** Used on pagehide so the append can outlive the document. */
  keepalive?: boolean;
}

const RESOLVE_BASE_URL = (override?: string): string => {
  if (typeof override === "string" && override.length > 0) return override.replace(/\/$/u, "");
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GATEWAY_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv.replace(/\/$/u, "");
  return import.meta.env.DEV ? "" : "http://127.0.0.1:8787";
};

const newRequestId = (): string => `ses-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

const jsonOrNull = async (response: Response | null): Promise<unknown | null> => {
  if (!response) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const headers = (requestId: string): HeadersInit => ({
  "content-type": "application/json",
  "x-request-id": requestId,
});

export const listSessions = async (
  dateKey?: string,
  options: SessionClientOptions = {},
): Promise<SessionSummary[] | null> => {
  const requestId = options.requestId ?? newRequestId();
  const query = dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : "";
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/sessions${query}`, {
    method: "GET",
    headers: headers(requestId),
    signal: options.signal,
  });
  if (!response?.ok) return null;
  const parsed = sessionListResponseSchema.safeParse(await jsonOrNull(response));
  return parsed.success ? parsed.data.summaries : null;
};

export const getSession = async (
  sessionId: string,
  options: SessionClientOptions = {},
): Promise<SessionRecord | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: headers(requestId),
    signal: options.signal,
  });
  if (!response?.ok) return null;
  const parsed = sessionDetailResponseSchema.safeParse(await jsonOrNull(response));
  return parsed.success ? parsed.data.session : null;
};

export const createSession = async (
  body: SessionCreateRequest,
  options: SessionClientOptions = {},
): Promise<{ session: SessionSummary; created: boolean } | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/sessions`, {
    method: "POST",
    headers: headers(requestId),
    signal: options.signal,
    body: JSON.stringify(body),
  });
  if (!response?.ok) return null;
  const parsed = sessionCreateResponseSchema.safeParse(await jsonOrNull(response));
  return parsed.success ? { session: parsed.data.session, created: parsed.data.created } : null;
};

export const appendSessionEntry = async (
  sessionId: string,
  body: SessionAppendRequest,
  options: SessionClientOptions = {},
): Promise<{ summary: SessionSummary; entry: SessionEntry } | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/sessions/${encodeURIComponent(sessionId)}/entries`, {
    method: "POST",
    headers: headers(requestId),
    ...(options.keepalive ? { keepalive: true } : { signal: options.signal }),
    body: JSON.stringify(body),
  });
  if (!response) return null;
  if (response.status === 409) {
    const error = new Error("session_conflict");
    error.name = "SessionConflictError";
    throw error;
  }
  if (!response.ok) return null;
  const parsed = sessionAppendResponseSchema.safeParse(await jsonOrNull(response));
  return parsed.success ? { summary: parsed.data.summary, entry: parsed.data.entry } : null;
};

export const patchSession = async (
  sessionId: string,
  body: SessionPatch,
  options: SessionClientOptions = {},
): Promise<SessionSummary | null> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: headers(requestId),
    signal: options.signal,
    body: JSON.stringify(body),
  });
  if (!response?.ok) return null;
  const parsed = sessionPatchResponseSchema.safeParse(await jsonOrNull(response));
  return parsed.success ? parsed.data.summary : null;
};

export const deleteSession = async (
  sessionId: string,
  body: SessionDeleteRequest = { confirm: true },
  options: SessionClientOptions = {},
): Promise<boolean> => {
  const requestId = options.requestId ?? newRequestId();
  const response = await safeFetch(options.fetcher, `${RESOLVE_BASE_URL(options.baseUrl)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: headers(requestId),
    signal: options.signal,
    body: JSON.stringify(body),
  });
  if (!response?.ok) return false;
  const parsed = sessionDeleteResponseSchema.safeParse(await jsonOrNull(response));
  return parsed.success ? parsed.data.deleted : false;
};

export type { SessionDetailResponse, SessionListResponse };

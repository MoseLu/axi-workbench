/**
 * SES-MVP-009 / SES-MVP-010 / SES-MVP-011 — Session HTTP handlers.
 *
 *   GET    /sessions?dateKey=YYYY-MM-DD
 *   POST   /sessions
 *   GET    /sessions/:id
 *   PATCH  /sessions/:id
 *   DELETE /sessions/:id
 *   POST   /sessions/:id/entries
 *   POST   /sessions/export
 *
 * Auth, CORS, request-id and body-limit are enforced by the gateway
 * server before this module runs. Handlers never echo the store path,
 * stack traces, or raw provider payloads.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import {
  errorEnvelopeSchema,
  gatewayContractVersion,
  httpStatusForErrorCode,
  sessionApiContractVersion,
  sessionAppendRequestSchema,
  sessionAppendResponseSchema,
  sessionCreateRequestSchema,
  sessionCreateResponseSchema,
  sessionDeleteRequestSchema,
  sessionDeleteResponseSchema,
  sessionDetailResponseSchema,
  sessionExportRequestSchema,
  sessionExportResponseSchema,
  sessionIdSchema,
  sessionListQuerySchema,
  sessionListResponseSchema,
  sessionPatchResponseSchema,
  sessionPatchSchema,
  type ErrorEnvelope,
  type GatewayErrorCode,
} from "@axi/gateway-contracts";
import {
  JsonSessionStore,
  SessionConflictError,
  SessionLimitExceededError,
  SessionNotFoundError,
  SessionStoreUnavailableError,
  toSummary,
  type SessionStore,
} from "@axi/resource-session";
import { redactSessionText } from "@axi/resource-session/redactor";

export const PATH_SESSIONS = "/sessions" as const;
export const PATH_SESSIONS_EXPORT = "/sessions/export" as const;

export interface SessionHandlerContext {
  readonly store: SessionStore;
  readonly maxBodyBytes: number;
  readonly knownProjectIds: () => ReadonlyArray<string>;
}

const buildError = (requestId: string, code: GatewayErrorCode, message: string, details?: ErrorEnvelope["details"]): {
  envelope: ErrorEnvelope;
  status: number;
} => {
  const envelope = errorEnvelopeSchema.parse({
    contractVersion: gatewayContractVersion,
    requestId,
    code,
    message,
    details,
  });
  return { envelope, status: httpStatusForErrorCode(code) };
};

const sendJson = (response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(JSON.stringify(payload));
};

const sendError = (
  response: ServerResponse,
  requestId: string,
  code: GatewayErrorCode,
  message: string,
  details?: ErrorEnvelope["details"],
): void => {
  const { envelope, status } = buildError(requestId, code, message, details);
  sendJson(response, status, envelope, { "x-request-id": requestId });
};

const readBody = (request: IncomingMessage, maxBytes: number): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  request.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > maxBytes) {
      truncated = true;
      request.resume();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    if (truncated) {
      reject(new Error("request_body_too_large"));
      return;
    }
    resolve(Buffer.concat(chunks).toString("utf8"));
  });
  request.on("error", reject);
});

const parseBody = async (
  request: IncomingMessage,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; code: GatewayErrorCode; message: string; details?: ErrorEnvelope["details"] }> => {
  try {
    const raw = await readBody(request, maxBytes);
    if (!raw.length) return { ok: true, value: {} };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, code: "invalid_request", message: "request body is not valid JSON" };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "request_body_too_large") {
      return { ok: false, code: "invalid_request", message: "request body exceeds max body size", details: { maxBodyBytes: maxBytes } };
    }
    throw error;
  }
};

const parseQuery = (url: string): Record<string, string> => {
  const query = url.split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
};

export const matchSessionPath = (method: string, path: string): { matched: boolean; suffix: string; sessionId?: string } => {
  const upper = method.toUpperCase();
  if (path === PATH_SESSIONS && upper === "GET") return { matched: true, suffix: "list" };
  if (path === PATH_SESSIONS && upper === "POST") return { matched: true, suffix: "create" };
  if (path === PATH_SESSIONS_EXPORT && upper === "POST") return { matched: true, suffix: "export" };
  if (!path.startsWith(`${PATH_SESSIONS}/`)) return { matched: false, suffix: "" };
  const rest = path.slice(PATH_SESSIONS.length + 1);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 1) {
    const parsed = sessionIdSchema.safeParse(parts[0]);
    if (!parsed.success) return { matched: false, suffix: "" };
    if (upper === "GET") return { matched: true, suffix: "get", sessionId: parsed.data };
    if (upper === "PATCH") return { matched: true, suffix: "patch", sessionId: parsed.data };
    if (upper === "DELETE") return { matched: true, suffix: "delete", sessionId: parsed.data };
    return { matched: false, suffix: "" };
  }
  if (parts.length === 2 && parts[1] === "entries") {
    const parsed = sessionIdSchema.safeParse(parts[0]);
    if (!parsed.success) return { matched: false, suffix: "" };
    if (upper === "POST") return { matched: true, suffix: "append", sessionId: parsed.data };
  }
  return { matched: false, suffix: "" };
};

const mapStoreError = (error: unknown): { code: GatewayErrorCode; message: string; details?: ErrorEnvelope["details"] } => {
  if (error instanceof SessionConflictError) {
    return {
      code: "session_conflict",
      message: "session revision conflict",
      details: { expected: error.expected, actual: error.actual },
    };
  }
  if (error instanceof SessionLimitExceededError) {
    return { code: "session_limit", message: "session capacity exceeded", details: { limit: error.limit, actual: error.actual } };
  }
  if (error instanceof SessionNotFoundError) {
    return { code: "session_not_found", message: "session not found" };
  }
  if (error instanceof SessionStoreUnavailableError) {
    return { code: "session_store_unavailable", message: "session store unavailable" };
  }
  return { code: "internal", message: "session request failed" };
};

const assertKnownProject = (context: SessionHandlerContext, projectId: string): string | null => {
  if (!context.knownProjectIds().includes(projectId)) return "projectId is not registered";
  return null;
};

export const handleSessionRequest = async (
  context: SessionHandlerContext,
  method: string,
  path: string,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<boolean> => {
  const matched = matchSessionPath(method, path);
  if (!matched.matched) return false;

  const replyError = (error: unknown): void => {
    const mapped = mapStoreError(error);
    sendError(response, requestId, mapped.code, mapped.message, mapped.details);
  };

  try {
    if (matched.suffix === "list") {
      const rawQuery = parseQuery(request.url || "");
      if (rawQuery.dateKey) {
        const parsed = sessionListQuerySchema.safeParse({
          dateKey: rawQuery.dateKey,
          ...(rawQuery.timezoneOffsetMinutes !== undefined && rawQuery.timezoneOffsetMinutes !== ""
            ? { timezoneOffsetMinutes: Number(rawQuery.timezoneOffsetMinutes) }
            : {}),
        });
        if (!parsed.success) {
          sendError(response, requestId, "invalid_request", "session list query is invalid");
          return true;
        }
        const summaries = await context.store.list({ dateKey: parsed.data.dateKey });
        sendJson(response, 200, sessionListResponseSchema.parse({
          summaries,
          contractVersion: sessionApiContractVersion,
        }), { "x-request-id": requestId });
        return true;
      }
      const summaries = await context.store.list();
      sendJson(response, 200, sessionListResponseSchema.parse({
        summaries,
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }

    if (matched.suffix === "create") {
      const body = await parseBody(request, context.maxBodyBytes);
      if (!body.ok) {
        sendError(response, requestId, body.code, body.message, body.details);
        return true;
      }
      const parsed = sessionCreateRequestSchema.safeParse(body.value);
      if (!parsed.success) {
        sendError(response, requestId, "invalid_request", "session create request is invalid");
        return true;
      }
      const projectError = assertKnownProject(context, parsed.data.projectId);
      if (projectError) {
        sendError(response, requestId, "invalid_request", projectError);
        return true;
      }
      if (parsed.data.kind === "daily") {
        const result = await context.store.createDaily({
          projectId: parsed.data.projectId,
          dateKey: parsed.data.dateKey,
        });
        sendJson(response, result.created ? 201 : 200, sessionCreateResponseSchema.parse({
          session: toSummary(result.session),
          created: result.created,
          contractVersion: sessionApiContractVersion,
        }), { "x-request-id": requestId });
        return true;
      }
      const session = await context.store.createManual({
        projectId: parsed.data.projectId,
        dateKey: parsed.data.dateKey,
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
      });
      sendJson(response, 201, sessionCreateResponseSchema.parse({
        session: toSummary(session),
        created: true,
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }

    if (matched.suffix === "get" && matched.sessionId) {
      const session = await context.store.get(matched.sessionId);
      if (!session) {
        sendError(response, requestId, "session_not_found", "session not found");
        return true;
      }
      sendJson(response, 200, sessionDetailResponseSchema.parse({
        session,
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }

    if (matched.suffix === "append" && matched.sessionId) {
      const body = await parseBody(request, context.maxBodyBytes);
      if (!body.ok) {
        sendError(response, requestId, body.code, body.message, body.details);
        return true;
      }
      const parsed = sessionAppendRequestSchema.safeParse(body.value);
      if (!parsed.success) {
        sendError(response, requestId, "invalid_request", "session append request is invalid");
        return true;
      }
      const entry = {
        ...parsed.data.entry,
        text: redactSessionText(parsed.data.entry.text).value,
      };
      const result = await context.store.append(
        matched.sessionId,
        entry,
        parsed.data.expectedRevision ?? parsed.data.entry.expectedRevision,
      );
      sendJson(response, 200, sessionAppendResponseSchema.parse({
        summary: toSummary(result.record),
        entry: result.entry,
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }

    if (matched.suffix === "patch" && matched.sessionId) {
      const body = await parseBody(request, context.maxBodyBytes);
      if (!body.ok) {
        sendError(response, requestId, body.code, body.message, body.details);
        return true;
      }
      const parsed = sessionPatchSchema.safeParse(body.value);
      if (!parsed.success) {
        sendError(response, requestId, "invalid_request", "session patch is invalid");
        return true;
      }
      let record;
      if (parsed.data.title !== undefined) {
        record = await context.store.rename(matched.sessionId, parsed.data.title, parsed.data.expectedRevision);
      } else {
        record = await context.store.get(matched.sessionId);
        if (!record) throw new SessionNotFoundError(matched.sessionId);
      }
      if (parsed.data.status === "archived") {
        record = await context.store.archive(matched.sessionId, parsed.data.title !== undefined ? record.revision : parsed.data.expectedRevision);
      }
      sendJson(response, 200, sessionPatchResponseSchema.parse({
        summary: toSummary(record),
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }

    if (matched.suffix === "delete" && matched.sessionId) {
      const body = await parseBody(request, context.maxBodyBytes);
      if (!body.ok) {
        sendError(response, requestId, body.code, body.message, body.details);
        return true;
      }
      const parsed = sessionDeleteRequestSchema.safeParse(body.value);
      if (!parsed.success) {
        sendError(response, requestId, "invalid_request", "session delete requires confirm=true");
        return true;
      }
      const deleted = await context.store.delete(matched.sessionId, parsed.data.expectedRevision);
      if (!deleted) {
        sendError(response, requestId, "session_not_found", "session not found");
        return true;
      }
      sendJson(response, 200, sessionDeleteResponseSchema.parse({
        deleted: true,
        id: matched.sessionId,
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }

    if (matched.suffix === "export") {
      const body = await parseBody(request, context.maxBodyBytes);
      if (!body.ok) {
        sendError(response, requestId, body.code, body.message, body.details);
        return true;
      }
      const parsed = sessionExportRequestSchema.safeParse(body.value);
      if (!parsed.success) {
        sendError(response, requestId, "invalid_request", "session export request is invalid");
        return true;
      }
      const session = await context.store.export(parsed.data.sessionId);
      sendJson(response, 200, sessionExportResponseSchema.parse({
        session,
        exportedAt: new Date().toISOString(),
        contractVersion: sessionApiContractVersion,
      }), { "x-request-id": requestId });
      return true;
    }
  } catch (error) {
    replyError(error);
    return true;
  }

  return false;
};

export { JsonSessionStore };

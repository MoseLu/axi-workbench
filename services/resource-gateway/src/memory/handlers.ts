/**
 * MEM-MVP-012 / MEM-MVP-013 — Memory HTTP handlers.
 *
 * 10 method/path variants that match the contract declared in
 * `packages/contracts/src/memory.ts`:
 *
 *   GET    /memory/settings
 *   PATCH  /memory/settings
 *   POST   /memory/search
 *   GET    /memory/entries
 *   POST   /memory/entries/:id/approve
 *   POST   /memory/entries/:id/reject
 *   DELETE /memory/entries/:id
 *   POST   /memory/export
 *   POST   /memory/clear
 *
 * All handlers:
 *
 *   - run inside the existing gateway server context (auth, CORS,
 *     request-id, body-limit, error envelope already wired),
 *   - reject opaque projectIds that don't match the locally
 *     registered project list (MEM-MVP-011 / MEM-MVP-008),
 *   - return redacted bodies (never expose raw provider payloads,
 *     paths, secrets, or the on-disk path),
 *   - emit a stable audit envelope `{ contractVersion, requestId,
 *     ok: true }` for mutations.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  errorEnvelopeSchema,
  gatewayContractVersion,
  httpStatusForErrorCode,
  memoryAckResponseSchema,
  memoryApiContractVersion,
  memoryApproveRequestSchema,
  memoryClearRequestSchema,
  memoryContributionRequestSchema,
  memoryEntryResponseSchema,
  memoryExportResponseSchema,
  memoryFileSchema,
  memoryListResponseSchema,
  memorySchemaVersion,
  memorySearchRequestSchema,
  memorySearchResponseSchema,
  memorySettingsPatchSchema,
  memorySettingsSchema,
  type ErrorEnvelope,
  type GatewayErrorCode,
  type MemoryEntry,
  type MemoryFile,
  type MemorySettings,
} from "@axi/gateway-contracts";
import {
  JsonMemoryStore,
  canGenerate,
  type MemoryStore,
  rankMemories,
  redactEntry,
  redactString,
  type RedactionOutcome,
} from "@axi/resource-memory";

export const PATH_MEMORY_SETTINGS = "/memory/settings" as const;
export const PATH_MEMORY_SEARCH = "/memory/search" as const;
export const PATH_MEMORY_ENTRIES = "/memory/entries" as const;
export const PATH_MEMORY_EXPORT = "/memory/export" as const;
export const PATH_MEMORY_CLEAR = "/memory/clear" as const;
export const PATH_MEMORY_CONTRIBUTION = "/memory/contribute" as const;

/** Build a stable error envelope using the gateway's contract version. */
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

const sendError = (response: ServerResponse, requestId: string, code: GatewayErrorCode, message: string, details?: ErrorEnvelope["details"]): void => {
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

const matchPath = (path: string, prefix: string): { matched: boolean; tail: string } => {
  if (path === prefix) return { matched: true, tail: "" };
  if (path.startsWith(`${prefix}/`)) return { matched: true, tail: path.slice(prefix.length + 1) };
  return { matched: false, tail: "" };
};

const projectIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/u;
const assertSafeProjectId = (projectId: unknown, source: string): string => {
  if (typeof projectId !== "string" || !projectId) {
    throw new Error(`${source} requires a non-empty projectId`);
  }
  if (!projectIdPattern.test(projectId)) {
    throw new Error(`${source} projectId must match ${projectIdPattern.source}`);
  }
  return projectId;
};

export interface MemoryHandlerContext {
  readonly store: MemoryStore;
  readonly maxBodyBytes: number;
  readonly loadSettings: () => Promise<MemorySettings>;
  readonly saveSettings: (patch: Partial<MemorySettings>) => Promise<MemorySettings>;
  readonly registerProjectId: (projectId: string) => void;
  readonly knownProjectIds: () => ReadonlyArray<string>;
  /** Runtime hook used by the real gateway to defer extraction until idle. */
  readonly scheduleContribution?: (sessionId: string, task: () => Promise<void>) => void;
  /** Test seam: replace extractor / redactor pipeline. */
  readonly processContribution?: (input: z.infer<typeof memoryContributionRequestSchema>, settings: MemorySettings) => Promise<{ candidates: ReadonlyArray<MemoryEntry>; rejected: ReadonlyArray<{ reason: string }> }>;
}

const defaultContributionProcessor = async (
  input: z.infer<typeof memoryContributionRequestSchema>,
  settings: MemorySettings,
): Promise<{ candidates: ReadonlyArray<MemoryEntry>; rejected: ReadonlyArray<{ reason: string }> }> => {
  // Lazy import: the extractor lives in packages/memory but is loaded
  // here to keep handlers.ts from pulling every dependency eagerly.
  const { extractMemoryCandidates } = await import("@axi/resource-memory/extractor");
  const sourceText = input.summary ?? input.userInput;
  const redactedText = redactString(sourceText);
  if (redactedText.redacted) {
    return { candidates: [], rejected: [{ reason: "contribution summary contains blocked data" }] };
  }
  const projectId = settings.defaultScope === "project"
    ? input.projectId ?? settings.defaultProjectId
    : undefined;
  if (settings.defaultScope === "project" && !projectId) {
    return { candidates: [], rejected: [{ reason: "project memory requires a registered projectId" }] };
  }
  const { candidates } = extractMemoryCandidates(redactedText.value, {
    defaultScope: settings.defaultScope,
    ...(projectId ? { defaultProjectId: projectId } : {}),
  });
  const accepted: MemoryEntry[] = [];
  const rejected: Array<{ reason: string }> = [];
  for (const candidate of candidates) {
    const redaction: RedactionOutcome<{ summary: string; facts: Record<string, string | number | boolean>; tags: ReadonlyArray<string> }> = redactEntry({
      summary: candidate.summary,
      facts: candidate.facts,
      tags: [...candidate.tags],
      sensitivity: "normal",
    });
    if (!redaction.ok) {
      rejected.push({ reason: redaction.reason });
      continue;
    }
    const entry: MemoryEntry = {
      id: candidate.id,
      schemaVersion: memorySchemaVersion,
      scope: candidate.scope,
      ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      kind: candidate.kind,
      status: candidate.status,
      summary: redaction.value.summary,
      facts: redaction.value.facts,
      tags: [...redaction.value.tags],
      source: candidate.source,
      sensitivity: "normal",
      confidence: candidate.confidence,
      evidenceHash: candidate.evidenceHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    accepted.push(entry);
  }
  return { candidates: accepted, rejected };
};

const persistContribution = async (
  context: MemoryHandlerContext,
  input: z.infer<typeof memoryContributionRequestSchema>,
  settings: MemorySettings,
): Promise<{ accepted: number; rejected: number }> => {
  const processor = context.processContribution ?? defaultContributionProcessor;
  const { candidates, rejected } = await processor(input, settings);
  const persisted: MemoryEntry[] = [];
  const writeRejections: Array<{ reason: string }> = [...rejected];
  for (const candidate of candidates) {
    try {
      await context.store.upsert(candidate);
      persisted.push(candidate);
    } catch (error) {
      writeRejections.push({ reason: error instanceof Error ? error.message : "memory write failed" });
    }
  }
  return { accepted: persisted.length, rejected: writeRejections.length };
};

const redactedMemoryEntry = (entry: MemoryEntry): MemoryEntry | null => {
  const redaction = redactEntry({
    summary: entry.summary,
    facts: entry.facts,
    tags: entry.tags,
    sensitivity: entry.sensitivity,
  });
  if (!redaction.ok) return null;
  return {
    ...entry,
    summary: redaction.value.summary,
    facts: redaction.value.facts,
    tags: [...redaction.value.tags],
  };
};

const redactedMemoryEntries = (entries: ReadonlyArray<MemoryEntry>): MemoryEntry[] => entries
  .map(redactedMemoryEntry)
  .filter((entry): entry is MemoryEntry => entry !== null);

/** Decide whether a single HTTP call routes through the memory surface. */
export const matchMemoryPath = (method: string, path: string): { matched: boolean; suffix: string } => {
  const upper = method.toUpperCase();
  if (upper === "GET" && path === PATH_MEMORY_SETTINGS) return { matched: true, suffix: "settings:get" };
  if (upper === "PATCH" && path === PATH_MEMORY_SETTINGS) return { matched: true, suffix: "settings:patch" };
  if (upper === "POST" && path === PATH_MEMORY_SEARCH) return { matched: true, suffix: "search" };
  if (upper === "GET" && path === PATH_MEMORY_ENTRIES) return { matched: true, suffix: "entries:list" };
  if (upper === "POST" && path === PATH_MEMORY_EXPORT) return { matched: true, suffix: "export" };
  if (upper === "POST" && path === PATH_MEMORY_CLEAR) return { matched: true, suffix: "clear" };
  if (upper === "POST" && path === PATH_MEMORY_CONTRIBUTION) return { matched: true, suffix: "contribute" };

  const entryMatch = matchPath(path, PATH_MEMORY_ENTRIES);
  if (entryMatch.matched) {
    const parts = entryMatch.tail.split("/");
    if (parts.length === 2 && upper === "POST" && parts[1] === "approve") return { matched: true, suffix: "entry:approve" };
    if (parts.length === 2 && upper === "POST" && parts[1] === "reject") return { matched: true, suffix: "entry:reject" };
    if (parts.length === 1 && upper === "DELETE") return { matched: true, suffix: "entry:delete" };
  }
  return { matched: false, suffix: "" };
};

const parseBody = async (request: IncomingMessage, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; code: GatewayErrorCode; message: string; details?: ErrorEnvelope["details"] }> => {
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

export const handleMemoryRequest = async (
  context: MemoryHandlerContext,
  method: string,
  path: string,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<boolean> => {
  const matched = matchMemoryPath(method, path);
  if (!matched.matched) return false;

  const writeSettings = async (next: MemorySettings): Promise<void> => {
    await context.saveSettings(next);
  };

  if (matched.suffix === "settings:get") {
    const settings = await context.loadSettings();
    sendJson(response, 200, {
      contractVersion: memoryApiContractVersion,
      requestId,
      settings: memorySettingsSchema.parse(settings),
    }, { "x-request-id": requestId });
    return true;
  }

  if (matched.suffix === "settings:patch") {
    const body = await parseBody(request, context.maxBodyBytes);
    if (!body.ok) {
      sendError(response, requestId, body.code, body.message, body.details);
      return true;
    }
    const patch = memorySettingsPatchSchema.safeParse(body.value);
    if (!patch.success) {
      sendError(response, requestId, "invalid_request", "memory settings patch is invalid");
      return true;
    }
    const current = await context.loadSettings();
    const next: MemorySettings = memorySettingsSchema.parse({ ...current, ...patch.data });
    await writeSettings(next);
    sendJson(response, 200, {
      contractVersion: memoryApiContractVersion,
      requestId,
      settings: next,
    }, { "x-request-id": requestId });
    return true;
  }

  if (matched.suffix === "search") {
    const body = await parseBody(request, context.maxBodyBytes);
    if (!body.ok) {
      sendError(response, requestId, body.code, body.message, body.details);
      return true;
    }
    const parsed = memorySearchRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      sendError(response, requestId, "invalid_request", "memory search request is invalid");
      return true;
    }
    const settings = await context.loadSettings();
    if (!settings.useMemory) {
      // MEM-MVP-007 — use=false is a no-op; we still echo an empty
      // payload so the browser doesn't see a 4xx for a deliberate
      // user choice.
      sendJson(response, 200, memorySearchResponseSchema.parse({
        contractVersion: memoryApiContractVersion,
        requestId,
        memories: [],
      }), { "x-request-id": requestId });
      return true;
    }
    if (parsed.data.projectId) {
      try {
        assertSafeProjectId(parsed.data.projectId, "memory search");
      } catch (error) {
        sendError(response, requestId, "invalid_request", (error as Error).message);
        return true;
      }
      if (!context.knownProjectIds().includes(parsed.data.projectId)) {
        sendError(response, requestId, "invalid_request", "memory search projectId is not registered");
        return true;
      }
    }
    let entries = redactedMemoryEntries(await context.store.readAll());
    if (parsed.data.scope === "project" && parsed.data.projectId) {
      entries = entries.filter((entry) => entry.scope === "project" && entry.projectId === parsed.data.projectId);
    }
    if (parsed.data.scope === "global") {
      entries = entries.filter((entry) => entry.scope === "global");
    }
    if (parsed.data.kinds?.length) {
      const allowed = new Set(parsed.data.kinds);
      entries = entries.filter((entry) => allowed.has(entry.kind));
    }
    const context2 = rankMemories({
      entries,
      query: parsed.data.query,
      ...(parsed.data.scope ? { scope: parsed.data.scope } : {}),
      ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
    });
    sendJson(response, 200, memorySearchResponseSchema.parse({
      contractVersion: memoryApiContractVersion,
      requestId,
      memories: context2.memories,
    }), { "x-request-id": requestId });
    return true;
  }

  if (matched.suffix === "entries:list") {
    const entries = redactedMemoryEntries(await context.store.readAll());
    sendJson(response, 200, memoryListResponseSchema.parse({
      contractVersion: memoryApiContractVersion,
      requestId,
      entries,
    }), { "x-request-id": requestId });
    return true;
  }

  if (matched.suffix === "entry:approve" || matched.suffix === "entry:reject" || matched.suffix === "entry:delete") {
    const tail = matchPath(path, PATH_MEMORY_ENTRIES).tail;
    const [id] = tail.split("/");
    if (!id) {
      sendError(response, requestId, "invalid_request", "memory entry id missing");
      return true;
    }
    if (matched.suffix === "entry:delete") {
      const removed = await context.store.delete(id);
      sendJson(response, 200, memoryAckResponseSchema.parse({
        contractVersion: memoryApiContractVersion,
        requestId,
        ok: true,
      }), { "x-request-id": requestId });
      if (!removed) {
        response.statusCode = 200; // idempotent: 200 with ok:true even when the id was absent
      }
      return true;
    }
    const existing = await context.store.get(id);
    if (!existing) {
      sendError(response, requestId, "invalid_request", "memory entry not found");
      return true;
    }
    const safeExisting = redactedMemoryEntry(existing);
    if (!safeExisting) {
      sendError(response, requestId, "invalid_request", "memory entry failed safety validation");
      return true;
    }
    if (matched.suffix === "entry:reject") {
      await context.store.delete(id);
      sendJson(response, 200, memoryAckResponseSchema.parse({
        contractVersion: memoryApiContractVersion,
        requestId,
        ok: true,
      }), { "x-request-id": requestId });
      return true;
    }
    // approve
    const body = await parseBody(request, context.maxBodyBytes);
    if (!body.ok) {
      sendError(response, requestId, body.code, body.message, body.details);
      return true;
    }
    const parsed = memoryApproveRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      sendError(response, requestId, "invalid_request", "memory approve payload is invalid");
      return true;
    }
    const next: MemoryEntry = {
      ...safeExisting,
      status: "active",
      confidence: parsed.data.confidence ?? existing.confidence,
      updatedAt: new Date().toISOString(),
    };
    await context.store.upsert(next);
    sendJson(response, 200, memoryEntryResponseSchema.parse({
      contractVersion: memoryApiContractVersion,
      requestId,
      entry: next,
    }), { "x-request-id": requestId });
    return true;
  }

  if (matched.suffix === "export") {
    const file = await context.store.export();
    sendJson(response, 200, memoryExportResponseSchema.parse({
      contractVersion: memoryApiContractVersion,
      requestId,
      exportedAt: new Date().toISOString(),
      file: memoryFileSchema.parse({ ...file, entries: redactedMemoryEntries(file.entries) }),
    }), { "x-request-id": requestId });
    return true;
  }

  if (matched.suffix === "clear") {
    const body = await parseBody(request, context.maxBodyBytes);
    if (!body.ok) {
      sendError(response, requestId, body.code, body.message, body.details);
      return true;
    }
    const parsed = memoryClearRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      sendError(response, requestId, "invalid_request", "memory clear payload is invalid");
      return true;
    }
    if (parsed.data.scope === "project") {
      try {
        assertSafeProjectId(parsed.data.projectId, "memory clear");
      } catch (error) {
        sendError(response, requestId, "invalid_request", (error as Error).message);
        return true;
      }
      if (!parsed.data.projectId || !context.knownProjectIds().includes(parsed.data.projectId)) {
        sendError(response, requestId, "invalid_request", "memory clear projectId is not registered");
        return true;
      }
    }
    const removed = await context.store.clear((entry) => {
      if (parsed.data.scope === "global") return entry.scope === "global";
      return entry.scope === "project" && entry.projectId === parsed.data.projectId;
    });
    sendJson(response, 200, memoryAckResponseSchema.parse({
      contractVersion: memoryApiContractVersion,
      requestId,
      ok: true,
    }), { "x-request-id": requestId, "x-memory-removed-count": String(removed) });
    return true;
  }

  if (matched.suffix === "contribute") {
    const body = await parseBody(request, context.maxBodyBytes);
    if (!body.ok) {
      sendError(response, requestId, body.code, body.message, body.details);
      return true;
    }
    const parsed = memoryContributionRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      sendError(response, requestId, "invalid_request", "memory contribution payload is invalid");
      return true;
    }
    if (parsed.data.projectId) {
      try {
        assertSafeProjectId(parsed.data.projectId, "memory contribution");
      } catch (error) {
        sendError(response, requestId, "invalid_request", (error as Error).message);
        return true;
      }
      if (!context.knownProjectIds().includes(parsed.data.projectId)) {
        sendError(response, requestId, "invalid_request", "memory contribution projectId is not registered");
        return true;
      }
    }
    const settings = await context.loadSettings();
    if (!canGenerate(settings, {
      outcome: parsed.data.outcome,
      usedExternalContext: parsed.data.usedExternalContext,
      toolIds: parsed.data.toolIds,
    })) {
      // generateMemory off → silent ack so the workbench can call this
      // unconditionally without conditional logic. The same path also
      // rejects failed, cancelled, and external-context runs.
      sendJson(response, 200, memoryAckResponseSchema.parse({
        contractVersion: memoryApiContractVersion,
        requestId,
        ok: true,
      }), { "x-request-id": requestId, "x-memory-contribution": "skipped", "x-memory-contribution-reason": "policy_denied" });
      return true;
    }
    const process = async (): Promise<void> => {
      try {
        const latestSettings = await context.loadSettings();
        if (!canGenerate(latestSettings, {
          outcome: parsed.data.outcome,
          usedExternalContext: parsed.data.usedExternalContext,
          toolIds: parsed.data.toolIds,
        })) return;
        await persistContribution(context, parsed.data, latestSettings);
      } catch {
        // A background memory failure must never affect resource queries
        // or crash the gateway process.
      }
    };
    if (context.scheduleContribution) {
      context.scheduleContribution(parsed.data.sessionId, process);
      sendJson(response, 200, memoryAckResponseSchema.parse({
        contractVersion: memoryApiContractVersion,
        requestId,
        ok: true,
      }), {
        "x-request-id": requestId,
        "x-memory-contribution": "scheduled",
      });
      return true;
    }
    const result = await persistContribution(context, parsed.data, settings);
    sendJson(response, 200, memoryAckResponseSchema.parse({
      contractVersion: memoryApiContractVersion,
      requestId,
      ok: true,
    }), {
      "x-request-id": requestId,
      "x-memory-contribution": "processed",
      "x-memory-contribution-accepted": String(result.accepted),
      "x-memory-contribution-rejected": String(result.rejected),
    });
    return true;
  }

  return false;
};

/** Helper for composition: build an in-memory `JsonMemoryStore`
 *  pointed at the resolved file path. Test code can pass a stub
 *  store instead. */
export const buildMemoryStore = (filePath: string): MemoryStore => new JsonMemoryStore({ filePath });

export const projectIdAllowed = (projectId: string): boolean => projectIdPattern.test(projectId);

export type { MemoryStore, MemoryFile };

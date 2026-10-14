/**
 * `POST /resource-search` — the narrow cross-project resource-search/v1
 * contract (GHA-NEXT-046 pagination included).
 *
 * Extracted verbatim from the original monolithic `server.ts`; the
 * inline dispatch body was lifted into a function with an identical
 * body. No behaviour changed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  resourceSearchContractVersion,
  resourceSearchItemSchema,
  resourceSearchRequestSchema,
  resourceSearchResponseSchema,
  type ResourceSearchRequest,
  type ResourceSearchResponse,
} from "@axi/gateway-contracts";

import { decideAuthFromRequest, errorCodeForAuth } from "../auth.js";
import { errorCodeFor } from "../router.js";
import {
  mapToNarrowErrorCode,
  readBody,
  READY_DRAINING,
  READY_NOT_READY,
  sendJson,
  sendResourceSearchError,
  type ServerState,
} from "./context.js";

export const handleResourceSearch = async (
  state: ServerState,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<void> => {
  const authDecision = decideAuthFromRequest({
    keys: state.config.apiKeys,
    request,
  });
  const authCode = errorCodeForAuth(authDecision);
  if (authCode) {
    const message = authDecision.kind === "missing"
      ? "Authorization bearer token required"
      : authDecision.kind === "expired"
        ? "bearer token has expired"
        : "invalid bearer token";
    sendResourceSearchError(response, requestId, mapToNarrowErrorCode(authCode), message);
    return;
  }
  if (state.lifecycle.isDraining()) {
    sendResourceSearchError(response, requestId, "not_configured", READY_DRAINING, undefined, { "retry-after": "0" });
    return;
  }
  if (!state.ready || !state.router) {
    sendResourceSearchError(response, requestId, "not_configured", READY_NOT_READY);
    return;
  }

  let raw: string;
  try {
    raw = await readBody(request, state.config.maxBodyBytes);
  } catch (error) {
    if (error instanceof Error && error.message === "request_body_too_large") {
      sendResourceSearchError(response, requestId, "invalid_request", "request body exceeds max body size", { maxBodyBytes: state.config.maxBodyBytes });
      return;
    }
    throw error;
  }
  let parsedJson: unknown;
  try {
    parsedJson = raw.length ? JSON.parse(raw) : {};
  } catch {
    sendResourceSearchError(response, requestId, "invalid_request", "request body is not valid JSON");
    return;
  }
  let narrowRequest: ResourceSearchRequest;
  try {
    narrowRequest = resourceSearchRequestSchema.parse(parsedJson);
  } catch {
    sendResourceSearchError(response, requestId, "invalid_request", "request payload does not match resource-search/v1 schema");
    return;
  }

  // GHA-NEXT-046 — opaque pagination cursor. The client supplied
  // `narrowRequest.cursor` (when present) is a server-issued
  // token. We look it up, swap in the upstream `requestId` plus
  // the next page number, and propagate the pageSize it was
  // minted with so subsequent pages stay stable even when the
  // client would have asked for a different size in a fresh
  // request. Malformed / expired / unknown cursors map to
  // `invalid_request`; we never leak the registry's internal
  // layout through the error path.
  let paginationRequestId = requestId;
  let paginationPage = 1;
  let paginationPageSize: number = narrowRequest.pageSize;
  if (narrowRequest.cursor !== undefined && narrowRequest.cursor !== "") {
    const lookup = state.cursors.decode(narrowRequest.cursor);
    if (!lookup.ok) {
      sendResourceSearchError(
        response,
        requestId,
        "invalid_request",
        `pagination cursor is ${lookup.reason}`,
        { cursor: lookup.reason },
      );
      return;
    }
    paginationRequestId = lookup.state.requestId;
    paginationPage = lookup.state.page;
    paginationPageSize = lookup.state.pageSize;
  }

  const kinds = narrowRequest.resourceKinds && narrowRequest.resourceKinds.length > 0
    ? narrowRequest.resourceKinds
    : ["image"] as const;
  const primaryKind = kinds[0];
  const toolId = `resource.search.${primaryKind}`;
  // Route-tool allowlist: when the gateway's registry exposes the
  // requested toolId we forward the dispatch; when it does not
  // (e.g. test stubs / pre-composition bootstrap), the orchestrator
  // is responsible for surfacing an `unknown_tool` outcome via the
  // typed failure path. We never block on a missing route here —
  // that path goes through the same ProviderFailure → ErrorEnvelope
  // mapping as the internal /gateway/run dispatch.
  const routeTools = state.router
    ? new Set(state.router.routeRegistry().map((route) => route.toolId))
    : new Set<string>();
  if (routeTools.size > 0 && !routeTools.has(toolId)) {
    sendResourceSearchError(response, requestId, "unknown_tool", `tool not registered: ${toolId}`, { toolId });
    return;
  }

  const abort = new AbortController();
  const endRequest = state.lifecycle.beginRequest(requestId, abort);
  request.once("close", () => { if (!response.writableEnded) abort.abort(); });
  try {
    const outcome = await state.router.dispatch({
      intent: {
        operation: "search",
        resourceKinds: [...kinds],
        constraints: {
          query: narrowRequest.query,
          pageSize: paginationPageSize,
          page: paginationPage,
          ...(narrowRequest.cursor ? { cursor: narrowRequest.cursor } : {}),
        },
        needsClarification: false,
      },
      toolId,
      signal: abort.signal,
      // requestKey seeds cache + coalescing. Binding it to the
      // upstream requestId lets a paginated session reuse
      // results when the client re-issues the same page after
      // a retry; binding to the wire requestId would coalesce
      // unrelated paginated sessions sharing one client id.
      requestKey: paginationRequestId,
    });

    if (outcome.kind === "failure") {
      const failure = outcome.failure;
      const extra: Record<string, string> = failure.retryAfterMs
        ? { "retry-after": String(Math.ceil(failure.retryAfterMs / 1000)) }
        : {};
      const mapped = mapToNarrowErrorCode(errorCodeFor(failure));
      sendResourceSearchError(
        response,
        requestId,
        mapped,
        failure.message.slice(0, 400),
        { kind: failure.kind, routeId: failure.routeId },
        extra,
      );
      return;
    }

    const projection = (Array.isArray(outcome.result.items) ? outcome.result.items : [])
      .map((item) => {
        const parsed = resourceSearchItemSchema.safeParse({
          id: item.id,
          kind: item.kind,
          title: item.title,
          preview: typeof item.preview === "string" ? item.preview : null,
          safety: item.safety,
          provenance: {
            provider: item.provenance?.provider ?? "unknown",
            ref: item.provenance?.ref ?? "",
            ...(item.provenance?.version ? { version: item.provenance.version } : {}),
          },
          ...(item.facts && typeof item.facts === "object" ? { facts: item.facts as Record<string, string> } : {}),
        });
        if (!parsed.success) return null;
        return parsed.data;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, paginationPageSize);

    // GHA-NEXT-046 / H-2 fix — opaque pagination cursor. The
    // projection only earns a nextCursor when the page is full;
    // partial pages have no continuation. The token is minted
    // by `state.cursors.encode(...)` so the response never
    // leaks the upstream requestId or the projection length.
    const nextPage = paginationPage + 1;
    const nextCursor =
      projection.length === paginationPageSize
        ? state.cursors.encode({
            requestId: paginationRequestId,
            page: nextPage,
            pageSize: paginationPageSize,
          })
        : null;

    const responseBody: ResourceSearchResponse = resourceSearchResponseSchema.parse({
      contractVersion: resourceSearchContractVersion,
      requestId,
      mode: outcome.result.mode,
      state: projection.length > 0 ? "presenting" : "clarifying",
      items: projection,
      warnings: (outcome.result.warnings ?? []).slice(0, 32),
      nextCursor,
    });
    sendJson(response, 200, responseBody, { "x-request-id": requestId });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/aborted/iu.test(message)) {
      sendResourceSearchError(response, requestId, "cancelled", "request aborted by client");
      return;
    }
    sendResourceSearchError(response, requestId, "provider_error", message.slice(0, 400));
    return;
  } finally {
    endRequest();
  }
};

/**
 * `POST /gateway/run` — the wide gateway contract: validates the planner
 * output, runs the image-search cascade when the registry supports it,
 * and projects the dispatch outcome into `GatewayResponse`.
 *
 * Extracted verbatim from the original monolithic `server.ts`; the
 * inline dispatch body (and its planner schemas) was lifted into this
 * module with an identical body. No behaviour changed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  gatewayContractVersion,
  gatewayRequestSchema,
  type GatewayErrorCode,
  type GatewayRequest,
  type GatewayResponse,
} from "@axi/gateway-contracts";
import { z } from "zod";

import { decideAuthFromRequest, errorCodeForAuth } from "../auth.js";
import { runImageSearchCascade } from "../image-search-cascade.js";
import { errorCodeFor } from "../router.js";
import { readBody, READY_DRAINING, READY_NOT_READY, sendError, sendJson, type ServerState } from "./context.js";

/** Minimal planner output validator (GHA-003 boundary). */
const plannerOutputSchema = z.object({
  intent: z.object({
    operation: z.enum(["search", "inspect", "preview"]),
    resourceKinds: z.array(z.string().min(1).max(80)).max(8).default([]),
    constraints: z.record(z.unknown()),
    needsClarification: z.boolean(),
    clarificationReason: z.string().max(400).optional(),
  }),
  calls: z.array(z.object({ toolId: z.string().min(1).max(120), input: z.record(z.unknown()) })).max(3),
  pipeline: z.array(z.object({ toolId: z.string().min(1).max(120), input: z.record(z.unknown()) })).max(6).optional(),
  explanation: z.string().max(800).optional(),
  clarification: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.string().min(1),
  })).max(6).optional(),
});

/** The shape we accept for a single step inside `calls`/`pipeline`. */
const stepToolIdSchema = z.string().min(1).max(120);
const stepInputSchema = z.record(z.unknown());

export const handleGatewayRun = async (
  state: ServerState,
  request: IncomingMessage,
  response: ServerResponse,
  requestId: string,
): Promise<void> => {
  // GHA-NEXT-029 — Bearer API Key gate. Empty key set is a
  // no-op (default, backwards-compatible). Mismatch / missing
  // header → 401 + code=unauthorized. The gate runs BEFORE
  // the ready-check so callers always get a stable auth
  // signal even while the gateway is still composing.
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
    sendError(response, requestId, authCode, message);
    return;
  }

  if (state.lifecycle.isDraining()) {
    sendError(response, requestId, "not_configured", READY_DRAINING, undefined, { "retry-after": "0" });
    return;
  }
  if (!state.ready || !state.router) {
    sendError(response, requestId, "not_configured", READY_NOT_READY);
    return;
  }

  let raw: string;
  try {
    raw = await readBody(request, state.config.maxBodyBytes);
  } catch (error) {
    if (error instanceof Error && error.message === "request_body_too_large") {
      sendError(response, requestId, "invalid_request", "request body exceeds max body size", { maxBodyBytes: state.config.maxBodyBytes });
      return;
    }
    throw error;
  }

  let parsedJson: unknown;
  try {
    parsedJson = raw.length ? JSON.parse(raw) : {};
  } catch {
    sendError(response, requestId, "invalid_request", "request body is not valid JSON");
    return;
  }

  let gatewayRequest: GatewayRequest;
  try {
    gatewayRequest = gatewayRequestSchema.parse(parsedJson);
  } catch {
    sendError(response, requestId, "invalid_request", "request payload does not match gateway schema");
    return;
  }

  const planner = plannerOutputSchema.safeParse(gatewayRequest.planner);
  if (!planner.success) {
    sendError(response, requestId, "invalid_request", "planner output failed validation");
    return;
  }

  const firstCall = planner.data.calls[0] ?? planner.data.pipeline?.[0];
  if (!firstCall) {
    sendError(response, requestId, "invalid_request", "planner produced no tool calls");
    return;
  }
  const toolIdCheck = stepToolIdSchema.safeParse(firstCall.toolId);
  const inputCheck = stepInputSchema.safeParse(firstCall.input);
  if (!toolIdCheck.success || !inputCheck.success) {
    sendError(response, requestId, "invalid_request", "tool call shape is invalid");
    return;
  }

  const intent = planner.data.intent;
  const abort = new AbortController();
  const endRequest = state.lifecycle.beginRequest(requestId, abort);
  request.once("close", () => { if (!response.writableEnded) abort.abort(); });

  try {
    const isImageSearch = firstCall.toolId === "resource.search.image" && intent.resourceKinds.includes("image");
    const routeTools = new Set(state.router.routeRegistry().map((route) => route.toolId));
    const canCascadeImageSearch = isImageSearch
      && routeTools.has("resource.search.web")
      && routeTools.has("resource.generate.image");
    const imageIntent = canCascadeImageSearch
      ? {
        ...intent,
        constraints: {
          ...intent.constraints,
          ...(typeof intent.constraints.query === "string"
            ? {}
            : typeof firstCall.input.query === "string" ? { query: firstCall.input.query } : {}),
        },
      }
      : intent;
    const outcome = canCascadeImageSearch
      ? await runImageSearchCascade({
        intent: imageIntent,
        requestKey: requestId,
        signal: abort.signal,
        dispatch: (input) => state.router!.dispatch(input),
      })
      : await state.router.dispatch({
        intent,
        toolId: firstCall.toolId,
        signal: abort.signal,
        requestKey: requestId,
      });
    if (outcome.kind === "success") {
      const items = Array.isArray(outcome.result.items) ? outcome.result.items.slice(0, state.config.maxResultItems) : [];
      const gatewayTrace = "trace" in outcome && Array.isArray(outcome.trace)
        ? outcome.trace as ReadonlyArray<{ state: string; label: string; detail?: string }>
        : [];
      const responseBody: GatewayResponse = {
        contractVersion: gatewayContractVersion,
        requestId,
        fromCache: outcome.fromCache,
        trace: gatewayTrace.map((event) => [event.state, event.label, event.detail].filter(Boolean).join("|").slice(0, 400)),
        planner: planner.data,
        result: { ...outcome.result, items },
        warnings: (outcome.result.warnings || []).slice(0, 32),
      };
      sendJson(response, 200, responseBody, { "x-request-id": requestId });
      return;
    }
    const failure = outcome.failure;
    const retryAfterMs = failure.retryAfterMs;
    const extra: Record<string, string> = retryAfterMs ? { "retry-after": String(Math.ceil(retryAfterMs / 1000)) } : {};
    sendError(response, requestId, errorCodeFor(failure) as GatewayErrorCode, failure.message, { kind: failure.kind, routeId: failure.routeId }, extra);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/aborted/iu.test(message)) {
      sendError(response, requestId, "cancelled", "request aborted by client");
      return;
    }
    sendError(response, requestId, "provider_error", message.slice(0, 400));
    return;
  } finally {
    endRequest();
  }
};

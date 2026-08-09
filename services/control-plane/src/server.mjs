import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createControlPlane } from "./control-plane.mjs";

const port = Number.parseInt(process.env.CONTROL_PLANE_PORT || "8092", 10);

function secureTokenEqual(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createControlPlaneHttpServer({
  controlPlane = createControlPlane(),
  mobileOwnerToken = process.env.AXI_MOBILE_OWNER_TOKEN || "",
  pairingRequired = controlPlane.pairingEnabled || Boolean(controlPlane.pairing),
  gatewayInternalToken = process.env.AXI_GATEWAY_CONTROL_PLANE_TOKEN || "axi-development-internal-token",
  coreApiToken = process.env.AXI_OWNER_API_TOKEN || "",
  ownerApprovalSecret = process.env.AXI_OWNER_PAIR_APPROVAL_SECRET || "",
  allowedOrigins = (process.env.AXI_CONTROL_PLANE_ALLOWED_ORIGINS || "http://127.0.0.1:3000,http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
} = {}) {
  return createServer(async (req, res) => {
    let url;
    // Helpers bound to this server instance (closure over coreApiToken, ownerApprovalSecret, allowedOrigins).
    function sendRaw(res, statusCode, body, url) {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Axi-Internal-Token, X-Axi-Subject, X-Axi-Owner-Token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Vary": "Origin",
      };
      const origin = res.req && res.req.headers && typeof res.req.headers.origin === "string" ? res.req.headers.origin : "";
      if (origin && originMatchesAllowlist(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
      }
      res.writeHead(statusCode, headers);
      res.end(body);
    }

    function sendJson(res, statusCode, payload, url) {
      sendRaw(res, statusCode, JSON.stringify(payload), url);
    }

    function originMatchesAllowlist(origin) {
      if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) return false;
      // A reflected wildcard would turn the control plane into a browser
      // reachable ambient-authority endpoint.  Keep the allowlist explicit;
      // callers that need more origins must enumerate them in configuration.
      if (allowedOrigins.includes("*")) return false;
      return allowedOrigins.includes(origin);
    }

    function writeReplayResponse(res, response, url) {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Idempotency-Replay": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Axi-Internal-Token, X-Axi-Subject, X-Axi-Owner-Token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Vary": "Origin",
      };
      const origin = res.req && res.req.headers && typeof res.req.headers.origin === "string" ? res.req.headers.origin : "";
      if (origin && originMatchesAllowlist(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
      }
      res.writeHead(response.status, headers);
      res.end(JSON.stringify(response.body));
    }

    function authenticateCoreRequest(req, coreApiToken) {
      if (!coreApiToken) return { ok: false, error: "core API token not configured" };
      const authorization = req.headers.authorization || "";
      const expected = `Bearer ${coreApiToken}`;
      if (typeof authorization !== "string" || !authorization) {
        return { ok: false, error: "core API bearer required" };
      }
      if (!secureTokenEqual(authorization, expected)) {
        return { ok: false, error: "core API bearer invalid" };
      }
      return { ok: true, source: "core_api_token" };
    }

    try {
    url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "OPTIONS") {
      // Reflect the request's Origin only when it matches the allowlist,
      // otherwise browsers will reject the preflight and we never expose
      // a wildcard Access-Control-Allow-Origin.
      return sendRaw(res, 204, "", url);
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "healthy", service: "control-plane" }, url);
    }
    if (req.method === "GET" && url.pathname === "/snapshot") {
      const coreAuth = authenticateCoreRequest(req, coreApiToken);
      if (!coreAuth.ok) return sendJson(res, 401, { error: coreAuth.error }, url);
      return sendJson(res, 200, controlPlane.snapshot(), url);
    }
    if (url.pathname.startsWith("/internal/web/v1/handoffs/")) {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" });
      }
      const subject = String(req.headers["x-axi-subject"] || "").trim();
      if (!subject) return sendJson(res, 401, { error: "verified web identity required" });
      const handoffMatch = url.pathname.match(/^\/internal\/web\/v1\/handoffs\/([^/]+)$/);
      if (!handoffMatch) return sendJson(res, 404, { error: "handoff endpoint not found" });
      const handoffID = decodeURIComponent(handoffMatch[1]);
      if (req.method === "GET") {
        const handoff = controlPlane.openHandoff(handoffID, subject);
        return sendJson(res, handoff ? 200 : 404, handoff || { error: "handoff not found" });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (!body || typeof body.outcome !== "string" || !body.outcome.trim() || Object.keys(body).some((key) => key !== "outcome")) {
          return sendJson(res, 400, { error: "handoff completion accepts only a non-empty outcome" });
        }
        const handoff = controlPlane.completeHandoff(handoffID, subject, body.outcome.trim());
        return sendJson(res, handoff ? 200 : 404, handoff || { error: "handoff not found" });
      }
      return sendJson(res, 405, { error: "method not allowed" });
    }
    let gatewayWebAuth = false;
    if (url.pathname.startsWith("/internal/web/v1/")) {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      if (!String(req.headers["x-axi-subject"] || "").trim()) {
        return sendJson(res, 401, { error: "verified web identity required" }, url);
      }
      url.pathname = url.pathname.replace(/^\/internal\/web\/v1/u, "");
      gatewayWebAuth = true;
    }
    // Mobile public traffic reaches this process only through API Gateway.
    // Gateway changes /api/v1/mobile/* to /internal/mobile/v1/* and injects
    // its internal credential.  The historical /mobile/v1/* route remains
    // usable only by an internal caller during migration/tests; browser code
    // must never target the Control Plane port directly.
    const isGatewayMobileRoute = url.pathname.startsWith("/internal/mobile/v1/");
    if (isGatewayMobileRoute) {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      url.pathname = url.pathname.replace(/^\/internal\/mobile\/v1/u, "/mobile/v1");
    }
    if (url.pathname.startsWith("/mobile/v1/")) {
      // Pairing endpoints are unauthenticated by design — the caller is
      // trying to establish an identity. Token/nonce calls remain
      // unauthenticated at HTTP level but require proof of device-key
      // possession before a bearer token is minted.
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/start") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.startPair(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/confirm") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.confirmPair(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/auth/token") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.exchangeNonceForAccessToken(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      // A nonce is safe to issue without a bearer token: only a device that
      // still owns the registered secret can sign it and obtain a token.
      if (req.method === "POST" && url.pathname === "/mobile/v1/auth/nonce") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.requestAuthNonce({ deviceId: body?.deviceId });
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/revoke") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const auth = authenticate(req, controlPlane, { pairingRequired, mobileOwnerToken });
        if (!auth.ok) return sendJson(res, 401, { error: auth.error }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.revokeDevice({ deviceId: body?.deviceId || auth.deviceId, reason: body?.reason || "owner_revoked" });
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }

      // /mobile/v1/auth/owner-token — out-of-band upgrade of a paired device
      // to the `owner` scope.  Requires the caller to prove possession of
      // ownerApprovalSecret via the `X-Axi-Owner-Token` header, plus a
      // freshly signed nonce from the device private key.  This is the
      // only legal way a mobile bearer can carry the `owner` scope.
        if (req.method === "POST" && url.pathname === "/mobile/v1/auth/owner-token") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const presented = req.headers["x-axi-owner-token"] || "";
        if (!ownerApprovalSecret) return sendJson(res, 503, { error: "owner approval secret not configured" }, url);
        if (!secureTokenEqual(presented, ownerApprovalSecret)) {
          return sendJson(res, 401, { error: "owner approval token missing or invalid" }, url);
        }
        const body = await readJsonBody(req);
        if (!body || typeof body.deviceId !== "string" || typeof body.nonceId !== "string" || typeof body.nonce !== "string" || typeof body.signatureHex !== "string") {
          return sendJson(res, 400, { error: "owner-token request requires deviceId, nonceId, nonce, signatureHex" }, url);
        }
        const r = controlPlane.pairing.issueOwnerAccessToken({
          deviceId: body.deviceId,
          nonceId: body.nonceId,
          nonce: body.nonce,
          signatureHex: body.signatureHex,
          ownerProof: body.ownerProof,
        });
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }

      // Authenticated routes below this point.
      const auth = authenticate(req, controlPlane, { pairingRequired, mobileOwnerToken });
      if (!auth.ok) return sendJson(res, 401, { error: auth.error }, url);

      /* Owner scope gate for dangerous writes.  A paired device by
       * default only carries `mobile` scope; jobs/cancel, approvals,
       * approval-scan decisions, and commands must additionally
       * carry `owner` (or come from the static owner token fallback).
       * The static-owner-token path is granted the `owner-static`
       * scope and counts as owner. */
      function hasOwnerScope(scopes) {
        if (!Array.isArray(scopes)) return false;
        return scopes.includes("owner") || scopes.includes("owner-static");
      }


      if (req.method === "GET" && url.pathname === "/mobile/v1/workspace") return sendJson(res, 200, controlPlane.mobileSnapshot(), url);
      if (req.method === "POST" && url.pathname === "/mobile/v1/approval-scans/resolve") {
        const body = await readJsonBody(req);
        if (!body || typeof body.scanToken !== "string" || Object.keys(body).some((key) => key !== "scanToken")) {
          return sendJson(res, 400, { error: "approval scan resolve accepts only scanToken" }, url);
        }
        const preview = controlPlane.resolveApprovalScan(body.scanToken);
        if (!preview.ok) return sendJson(res, preview.httpStatus || 422, { error: preview.error }, url);
        controlPlane.recordMobileAudit({ auditKind: "approval_scan_previewed", deviceId: auth.deviceId, approvalRef: preview.approvalId, handoffCorrelationId: preview.handoffCorrelationId, status: "previewed" });
        return sendJson(res, 200, preview, url);
      }
      const mobileApprovalScanDecisionMatch = url.pathname.match(/^\/mobile\/v1\/approval-scans\/([^/]+)\/decision$/);
      if (req.method === "POST" && mobileApprovalScanDecisionMatch) {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required for approval scan decisions" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileApprovalScanDecision(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        const scanId = decodeURIComponent(mobileApprovalScanDecisionMatch[1]);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ auditKind: "approval_scan_replayed", deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, handoffCorrelationId: body.handoffCorrelationId, status: "replayed" });
          return;
        }
        const result = controlPlane.decideApprovalScan({ scanId, decision: body.decision, idempotencyKey: body.idempotencyKey, handoffCorrelationId: body.handoffCorrelationId, deviceId: auth.deviceId });
        const status = result.ok ? (result.status === "handed_off" ? 202 : 200) : (result.httpStatus || 422);
        const responseBody = result.ok ? result : { error: result.error };
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        return sendJson(res, status, responseBody, url);
      }
      const mobileProjectMatch = url.pathname.match(/^\/mobile\/v1\/projects\/([^/]+)$/);
      if (req.method === "GET" && mobileProjectMatch) {
        const project = controlPlane.mobileProject(decodeURIComponent(mobileProjectMatch[1]));
        return sendJson(res, project ? 200 : 404, project || { error: "project not found" }, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/jobs") {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required to create mobile jobs" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileProjectAction(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: null, status: "replayed" });
          return;
        }
        const result = controlPlane.createMobileProjectAction({ ...body, deviceId: auth.deviceId, auditDeviceId: auth.deviceId });
        if (result?.ok === false) {
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: null, status: "rejected" });
          return sendJson(res, result.httpStatus || 422, { error: result.error }, url);
        }
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status: 202, body: result } });
        const approvalRef = result?.approvalId || null;
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef, status: approvalRef ? "pending_approval" : "executed" });
        return sendJson(res, 202, result, url);
      }
      const mobileCancelMatch = url.pathname.match(/^\/mobile\/v1\/jobs\/([^/]+)\/cancel$/);
      if (req.method === "POST" && mobileCancelMatch) {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required to cancel mobile jobs" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileAction(body, ["idempotencyKey", "projectId", "actionType"]);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, status: "replayed" });
          return;
        }
        const job = controlPlane.cancelJob(decodeURIComponent(mobileCancelMatch[1]));
        const responseBody = job || { error: "job not found" };
        const status = job ? 200 : 404;
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, status: job ? "executed" : "not_found" });
        return sendJson(res, status, responseBody, url);
      }
      const mobileApprovalMatch = url.pathname.match(/^\/mobile\/v1\/approvals\/([^/]+)\/decision$/);
      if (req.method === "POST" && mobileApprovalMatch) {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required to decide mobile approvals" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileApprovalDecision(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        if (body.approvalRef !== decodeURIComponent(mobileApprovalMatch[1])) return sendJson(res, 422, { error: "approvalRef must match the approval path" }, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: body.approvalRef, status: "replayed" });
          return;
        }
        const decision = controlPlane.decideApproval({ id: decodeURIComponent(mobileApprovalMatch[1]), ...body, deviceId: auth.deviceId });
        const responseBody = decision || { error: "approval not found" };
        const status = decision ? 200 : 404;
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: body.approvalRef, status: decision ? "executed" : "not_found" });
        return sendJson(res, status, responseBody, url);
      }
      return sendJson(res, 404, { error: "mobile endpoint not found" }, url);
    }
    /* Core control-plane endpoints require an owner-grade bearer
     * (`Authorization: Bearer <AXI_OWNER_API_TOKEN>`) unless the
     * caller is the gateway, in which case the gateway internal
     * token already proved authority above.  These endpoints expose
     * snapshot, run, command, and approval surface that previously
     * had no authentication at all. */
    const coreAuth = gatewayWebAuth ? { ok: true, source: "gateway_web" } : authenticateCoreRequest(req, coreApiToken);
    if (!coreAuth.ok) return sendJson(res, 401, { error: coreAuth.error }, url);
    if (req.method === "POST" && url.pathname === "/query") {
      return sendJson(res, 200, await controlPlane.query(await readJsonBody(req)), url);
    }
    if (req.method === "POST" && url.pathname === "/communication/messages") {
      return sendJson(res, 200, await controlPlane.handleCommunicationMessage(await readJsonBody(req), {
        intelligenceOnly: url.searchParams.get("mode") === "intelligence",
      }), url);
    }
    if (req.method === "POST" && url.pathname === "/jobs") {
      return sendJson(res, 202, controlPlane.createJob(await readJsonBody(req)), url);
    }
    const jobEventsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/events$/);
    if (req.method === "GET" && jobEventsMatch) {
      return sendJson(res, 200, controlPlane.getJobEvents(decodeURIComponent(jobEventsMatch[1]), {
        afterEventId: url.searchParams.get("afterEventId") || "",
      }), url);
    }
    const jobArtifactsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/artifacts$/);
    if (req.method === "GET" && jobArtifactsMatch) {
      return sendJson(res, 200, controlPlane.getJobArtifacts(decodeURIComponent(jobArtifactsMatch[1])), url);
    }
    const cancelJobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelJobMatch) {
      const job = controlPlane.cancelJob(decodeURIComponent(cancelJobMatch[1]));
      return sendJson(res, job ? 200 : 404, job || { error: "job not found" }, url);
    }
    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = controlPlane.getJob(decodeURIComponent(jobMatch[1]));
      return sendJson(res, job ? 200 : 404, job || { error: "job not found" }, url);
    }
    const agentTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)$/);
    if (req.method === "GET" && agentTaskMatch) {
      const task = controlPlane.getAgentTask(decodeURIComponent(agentTaskMatch[1]));
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" }, url);
    }
    const cancelTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelTaskMatch) {
      const task = controlPlane.cancelAgentTask(decodeURIComponent(cancelTaskMatch[1]));
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" }, url);
    }
    const approvalMatch = url.pathname.match(/^\/approvals\/([^/]+)\/decision$/);
    if (req.method === "POST" && approvalMatch) {
      const decision = controlPlane.decideApproval({
        id: decodeURIComponent(approvalMatch[1]),
        ...await readJsonBody(req),
      });
      return sendJson(res, decision ? 200 : 404, decision || { error: "approval not found" }, url);
    }
    const commandMatch = url.pathname.match(/^\/commands\/([^/]+)\/run$/);
    if (req.method === "POST" && commandMatch) {
      const run = controlPlane.runCommand(decodeURIComponent(commandMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "command not found" }, url);
    }
    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) {
      const run = controlPlane.getRun(decodeURIComponent(runMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "run not found" }, url);
    }
    return sendJson(res, 404, { error: "not found" }, url);
  } catch (error) {
    return sendJson(res, 500, { error: "control-plane error", message: error?.message || String(error) }, url);
  }
  });
}

const controlPlane = createControlPlane();
const mobileOwnerToken = process.env.AXI_MOBILE_OWNER_TOKEN || "";
const pairingRequired = controlPlane.pairingEnabled || Boolean(controlPlane.pairing);
const server = createControlPlaneHttpServer({ controlPlane, mobileOwnerToken, pairingRequired });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`control-plane listening on http://127.0.0.1:${port}`);
  });
}

function isPairedOwner(req, { pairingRequired, mobileOwnerToken }) {
  // Bootstrap fallback: when pairing is not enabled AND a static
  // owner token is configured, treat its bearer as the only valid
  // credential. When pairing is enabled (AXI_MOBILE_PAIRING_ENABLED=true
  // or AXI_MOBILE_TOKEN_SECRET set), the device-token path takes over.
  if (pairingRequired) return false;
  if (!mobileOwnerToken) return false;
  const authorization = req.headers.authorization || "";
  return secureTokenEqual(authorization, `Bearer ${mobileOwnerToken}`);
}

function authenticate(req, controlPlane, authOptions) {
  // Order: device-token (preferred) → static owner token (bootstrap only).
  if (controlPlane.pairing) {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const verified = controlPlane.pairing.verifyAccessToken(token);
    if (verified.ok) return { ok: true, deviceId: verified.deviceId, scopes: verified.scopes };
    if (controlPlane.pairingEnabled) return { ok: false, error: verified.error };
    // fall through to static owner token when pairing is configured but not strictly required
  }
  if (isPairedOwner(req, authOptions)) return { ok: true, deviceId: "static-owner-token", scopes: ["owner-static"] };
  return { ok: false, error: "owner device pairing required" };
}

/**
 * Shared fail-fast presence check for authenticated mobile writes.
 * A project action is later restricted to a registered projectId + actionId
 * + actionType; the device identity always comes from the bearer token.
 */
function validateMobileAction(body, required) {
  if (!body || typeof body !== "object") return { ok: false, error: "request body must be a JSON object" };
  const missing = required.filter((key) => {
    const value = body[key];
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    return false;
  });
  if (missing.length) return { ok: false, error: `missing required field(s): ${missing.join(", ")}` };
  return { ok: true };
}

function validateMobileProjectAction(body) {
  const fields = validateMobileAction(body, ["idempotencyKey", "projectId", "actionId", "actionType"]);
  if (!fields.ok) return fields;
  const forbidden = ["text", "command", "cwd", "workdir", "workingDirectory", "envelope"]
    .filter((key) => Object.hasOwn(body, key));
  if (forbidden.length) return { ok: false, error: `mobile project actions do not accept raw execution fields: ${forbidden.join(", ")}` };
  const allowed = new Set(["idempotencyKey", "projectId", "actionId", "actionType"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `unsupported mobile project action field(s): ${unknown.join(", ")}` };
  return { ok: true };
}

function validateMobileApprovalDecision(body) {
  const fields = validateMobileAction(body, ["idempotencyKey", "projectId", "actionId", "actionType", "approvalRef", "decision"]);
  if (!fields.ok) return fields;
  if (!["approved", "rejected"].includes(body.decision)) return { ok: false, error: "decision must be approved or rejected" };
  const allowed = new Set(["idempotencyKey", "projectId", "actionId", "actionType", "approvalRef", "decision", "decisionText"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `unsupported mobile approval field(s): ${unknown.join(", ")}` };
  return { ok: true };
}

function validateMobileApprovalScanDecision(body) {
  const fields = validateMobileAction(body, ["idempotencyKey", "decision", "handoffCorrelationId"]);
  if (!fields.ok) return fields;
  if (!["approved", "rejected", "handoff"].includes(body.decision)) return { ok: false, error: "decision must be approved, rejected, or handoff" };
  const allowed = new Set(["idempotencyKey", "decision", "handoffCorrelationId"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `approval scan decision accepts only decision, idempotencyKey, handoffCorrelationId; unsupported: ${unknown.join(", ")}` };
  return { ok: true };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

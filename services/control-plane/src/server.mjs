import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createControlPlane } from "./control-plane.mjs";

const port = Number.parseInt(process.env.CONTROL_PLANE_PORT || "8092", 10);
export function createControlPlaneHttpServer({
  controlPlane = createControlPlane(),
  mobileOwnerToken = process.env.AXI_MOBILE_OWNER_TOKEN || "",
  pairingRequired = controlPlane.pairingEnabled || Boolean(controlPlane.pairing),
} = {}) {
  return createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { status: "healthy", service: "control-plane" });
    }
    if (req.method === "GET" && url.pathname === "/snapshot") {
      return sendJson(res, 200, controlPlane.snapshot());
    }
    if (url.pathname.startsWith("/mobile/v1/")) {
      // Pairing endpoints are unauthenticated by design — the caller is
      // trying to establish an identity. Token/nonce calls remain
      // unauthenticated at HTTP level but require proof of device-key
      // possession before a bearer token is minted.
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/start") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" });
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.startPair(body || {});
        return sendJson(res, r.ok ? 200 : 400, r);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/confirm") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" });
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.confirmPair(body || {});
        return sendJson(res, r.ok ? 200 : 400, r);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/auth/token") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" });
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.exchangeNonceForAccessToken(body || {});
        return sendJson(res, r.ok ? 200 : 400, r);
      }
      // A nonce is safe to issue without a bearer token: only a device that
      // still owns the registered secret can sign it and obtain a token.
      if (req.method === "POST" && url.pathname === "/mobile/v1/auth/nonce") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" });
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.requestAuthNonce({ deviceId: body?.deviceId });
        return sendJson(res, r.ok ? 200 : 400, r);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/revoke") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" });
        const auth = authenticate(req, controlPlane, { pairingRequired, mobileOwnerToken });
        if (!auth.ok) return sendJson(res, 401, { error: auth.error });
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.revokeDevice({ deviceId: body?.deviceId || auth.deviceId, reason: body?.reason || "owner_revoked" });
        return sendJson(res, r.ok ? 200 : 400, r);
      }

      // Authenticated routes below this point.
      const auth = authenticate(req, controlPlane, { pairingRequired, mobileOwnerToken });
      if (!auth.ok) return sendJson(res, 401, { error: auth.error });

      if (req.method === "GET" && url.pathname === "/mobile/v1/workspace") return sendJson(res, 200, controlPlane.mobileSnapshot());
      const mobileProjectMatch = url.pathname.match(/^\/mobile\/v1\/projects\/([^/]+)$/);
      if (req.method === "GET" && mobileProjectMatch) {
        const project = controlPlane.mobileProject(decodeURIComponent(mobileProjectMatch[1]));
        return sendJson(res, project ? 200 : 404, project || { error: "project not found" });
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/jobs") {
        const body = await readJsonBody(req);
        const fields = validateMobileProjectAction(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error });
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          res.writeHead(cached.response.status, {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "X-Idempotency-Replay": "true",
          });
          res.end(JSON.stringify(cached.response.body));
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: null, status: "replayed" });
          return;
        }
        const result = controlPlane.createMobileProjectAction({ ...body, deviceId: auth.deviceId, auditDeviceId: auth.deviceId });
        if (result?.ok === false) {
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: null, status: "rejected" });
          return sendJson(res, result.httpStatus || 422, { error: result.error });
        }
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status: 202, body: result } });
        const approvalRef = result?.approvalId || null;
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef, status: approvalRef ? "pending_approval" : "executed" });
        return sendJson(res, 202, result);
      }
      const mobileCancelMatch = url.pathname.match(/^\/mobile\/v1\/jobs\/([^/]+)\/cancel$/);
      if (req.method === "POST" && mobileCancelMatch) {
        const body = await readJsonBody(req);
        const fields = validateMobileAction(body, ["idempotencyKey", "projectId", "actionType"]);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error });
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          res.writeHead(cached.response.status, {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "X-Idempotency-Replay": "true",
          });
          res.end(JSON.stringify(cached.response.body));
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, status: "replayed" });
          return;
        }
        const job = controlPlane.cancelJob(decodeURIComponent(mobileCancelMatch[1]));
        const responseBody = job || { error: "job not found" };
        const status = job ? 200 : 404;
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, status: job ? "executed" : "not_found" });
        return sendJson(res, status, responseBody);
      }
      const mobileApprovalMatch = url.pathname.match(/^\/mobile\/v1\/approvals\/([^/]+)\/decision$/);
      if (req.method === "POST" && mobileApprovalMatch) {
        const body = await readJsonBody(req);
        const fields = validateMobileApprovalDecision(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error });
        if (body.approvalRef !== decodeURIComponent(mobileApprovalMatch[1])) return sendJson(res, 422, { error: "approvalRef must match the approval path" });
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          res.writeHead(cached.response.status, {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "X-Idempotency-Replay": "true",
          });
          res.end(JSON.stringify(cached.response.body));
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: body.approvalRef, status: "replayed" });
          return;
        }
        const decision = controlPlane.decideApproval({ id: decodeURIComponent(mobileApprovalMatch[1]), ...body, deviceId: auth.deviceId });
        const responseBody = decision || { error: "approval not found" };
        const status = decision ? 200 : 404;
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: body.approvalRef, status: decision ? "executed" : "not_found" });
        return sendJson(res, status, responseBody);
      }
      return sendJson(res, 404, { error: "mobile endpoint not found" });
    }
    if (req.method === "POST" && url.pathname === "/query") {
      return sendJson(res, 200, await controlPlane.query(await readJsonBody(req)));
    }
    if (req.method === "POST" && url.pathname === "/communication/messages") {
      return sendJson(res, 200, await controlPlane.handleCommunicationMessage(await readJsonBody(req), {
        intelligenceOnly: url.searchParams.get("mode") === "intelligence",
      }));
    }
    if (req.method === "POST" && url.pathname === "/jobs") {
      return sendJson(res, 202, controlPlane.createJob(await readJsonBody(req)));
    }
    const jobEventsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/events$/);
    if (req.method === "GET" && jobEventsMatch) {
      return sendJson(res, 200, controlPlane.getJobEvents(decodeURIComponent(jobEventsMatch[1]), {
        afterEventId: url.searchParams.get("afterEventId") || "",
      }));
    }
    const jobArtifactsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/artifacts$/);
    if (req.method === "GET" && jobArtifactsMatch) {
      return sendJson(res, 200, controlPlane.getJobArtifacts(decodeURIComponent(jobArtifactsMatch[1])));
    }
    const cancelJobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelJobMatch) {
      const job = controlPlane.cancelJob(decodeURIComponent(cancelJobMatch[1]));
      return sendJson(res, job ? 200 : 404, job || { error: "job not found" });
    }
    const jobMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = controlPlane.getJob(decodeURIComponent(jobMatch[1]));
      return sendJson(res, job ? 200 : 404, job || { error: "job not found" });
    }
    const agentTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)$/);
    if (req.method === "GET" && agentTaskMatch) {
      const task = controlPlane.getAgentTask(decodeURIComponent(agentTaskMatch[1]));
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" });
    }
    const cancelTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelTaskMatch) {
      const task = controlPlane.cancelAgentTask(decodeURIComponent(cancelTaskMatch[1]));
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" });
    }
    const approvalMatch = url.pathname.match(/^\/approvals\/([^/]+)\/decision$/);
    if (req.method === "POST" && approvalMatch) {
      const decision = controlPlane.decideApproval({
        id: decodeURIComponent(approvalMatch[1]),
        ...await readJsonBody(req),
      });
      return sendJson(res, decision ? 200 : 404, decision || { error: "approval not found" });
    }
    const commandMatch = url.pathname.match(/^\/commands\/([^/]+)\/run$/);
    if (req.method === "POST" && commandMatch) {
      const run = controlPlane.runCommand(decodeURIComponent(commandMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "command not found" });
    }
    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) {
      const run = controlPlane.getRun(decodeURIComponent(runMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "run not found" });
    }
    return sendJson(res, 404, { error: "not found" });
  } catch (error) {
    return sendJson(res, 500, { error: "control-plane error", message: error?.message || String(error) });
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

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

function isPairedOwner(req, { pairingRequired, mobileOwnerToken }) {
  // Bootstrap fallback: when pairing is not enabled AND a static
  // owner token is configured, treat its bearer as the only valid
  // credential. When pairing is enabled (AXI_MOBILE_PAIRING_ENABLED=true
  // or AXI_MOBILE_TOKEN_SECRET set), the device-token path takes over.
  if (pairingRequired) return false;
  if (!mobileOwnerToken) return false;
  const authorization = req.headers.authorization || "";
  return authorization === `Bearer ${mobileOwnerToken}`;
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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

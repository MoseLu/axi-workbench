import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { createControlPlane } from "./control-plane.mjs";

const port = Number.parseInt(process.env.CONTROL_PLANE_PORT || "8092", 10);
const DEVELOPMENT_GATEWAY_INTERNAL_TOKEN = "axi-development-internal-token";

export function resolveGatewayInternalToken({ configuredToken = "", nodeEnv = process.env.NODE_ENV || "development" } = {}) {
  const token = String(configuredToken || "").trim();
  const environment = String(nodeEnv || "development").trim().toLowerCase();
  if (environment === "production" && (!token || token === DEVELOPMENT_GATEWAY_INTERNAL_TOKEN)) return "";
  return token || DEVELOPMENT_GATEWAY_INTERNAL_TOKEN;
}

function secureTokenEqual(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isPrivateIpv4(address) {
  const octets = String(address).split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/**
 * The desktop QR must carry a transport origin the phone can reach. In local
 * development the Control Plane and API Gateway share the host, so prefer an
 * explicit advertised URL and otherwise select a private IPv4 interface.
 * Production deployments must provide the public HTTPS origin explicitly.
 */
export function resolveMobileGatewayUrl({
  explicit = process.env.AXI_MOBILE_GATEWAY_BASE_URL || process.env.GATEWAY_PUBLIC_URL || "",
  environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "development",
  gatewayPort = process.env.GATEWAY_PORT || "8088",
  interfaces = networkInterfaces(),
} = {}) {
  explicit = String(explicit || "").trim();
  if (explicit) return explicit.endsWith("/") ? explicit : `${explicit}/`;
  if (String(environment || "development").trim() === "production") return "";
  const port = Number.parseInt(gatewayPort, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return "";
  for (const entries of Object.values(interfaces || {})) {
    for (const entry of entries || []) {
      const family = typeof entry.family === "string" ? entry.family : entry.family === 4 ? "IPv4" : "";
      if (family === "IPv4" && !entry.internal && isPrivateIpv4(entry.address)) {
        return `http://${entry.address}:${port}/api/v1/`;
      }
    }
  }
  return "";
}

export function createControlPlaneHttpServer({
  controlPlane = createControlPlane({ enforceExecutionPolicy: true }),
  mobileOwnerToken = process.env.AXI_MOBILE_OWNER_TOKEN || "",
  pairingRequired = controlPlane.pairingEnabled || Boolean(controlPlane.pairing),
  gatewayInternalToken = process.env.AXI_GATEWAY_CONTROL_PLANE_TOKEN || DEVELOPMENT_GATEWAY_INTERNAL_TOKEN,
  nodeEnv = process.env.NODE_ENV || "development",
  coreApiToken = process.env.AXI_OWNER_API_TOKEN || "",
  ownerApprovalSecret = process.env.AXI_OWNER_PAIR_APPROVAL_SECRET || "",
  allowedOrigins = (process.env.AXI_CONTROL_PLANE_ALLOWED_ORIGINS || "http://127.0.0.1:3000,http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean),
  mobileGatewayUrlResolver = resolveMobileGatewayUrl,
} = {}) {
  gatewayInternalToken = resolveGatewayInternalToken({ configuredToken: gatewayInternalToken, nodeEnv });
  return createServer(async (req, res) => {
    let url;
    controlPlane.expireHandoffs?.();
    // Helpers bound to this server instance (closure over coreApiToken, ownerApprovalSecret, allowedOrigins).
    function sendRaw(res, statusCode, body, url) {
      const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Axi-Internal-Token, X-Axi-Subject, X-Axi-Owner-Token, X-Axi-QR-Poll-Token",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
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
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Axi-Internal-Token, X-Axi-Subject, X-Axi-Owner-Token, X-Axi-QR-Poll-Token",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
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
    if (url.pathname === "/internal/web/v1/handoffs") {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      const subject = String(req.headers["x-axi-subject"] || "").trim();
      if (!subject) return sendJson(res, 401, { error: "verified web identity required" }, url);
      // GET: list handoffs
      if (req.method === "GET") {
        const result = controlPlane.listHandoffs({ status: url.searchParams.get("status") || "", actor: url.searchParams.get("actor") || "", owner: subject });
        return sendJson(res, result.ok ? 200 : result.httpStatus || 400, result.ok ? result : { error: result.error }, url);
      }
      // POST: create new web-to-mobile handoff
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object") return sendJson(res, 400, { error: "request body required" }, url);
        const input = {
          sourceActorRef: subject,
          sourceOwnerRef: subject,
          targetOwnerRef: body.targetOwnerRef || null,
          projectId: body.projectId || null,
          actionId: body.actionId || null,
          actionType: body.actionType || null,
          impact: body.impact || null,
          riskLevel: body.riskLevel || "medium",
        };
        const result = controlPlane.createWebToMobileHandoff(input);
        return sendJson(res, result.ok ? 201 : 400, result, url);
      }
      return sendJson(res, 405, { error: "method not allowed" }, url);
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
        if (handoff?.ok === false) return sendJson(res, handoff.httpStatus || 403, { error: handoff.error }, url);
        return sendJson(res, handoff ? 200 : 404, handoff || { error: "handoff not found" });
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        if (body && body.action === "reject") {
          if (typeof body.reason !== "string" || !body.reason.trim() || Object.keys(body).some((key) => !["action", "reason"].includes(key))) {
            return sendJson(res, 400, { error: "handoff rejection requires a non-empty reason" }, url);
          }
          const handoff = controlPlane.rejectHandoff(handoffID, subject, body.reason.trim());
          if (handoff?.ok === false) return sendJson(res, handoff.httpStatus || 403, { error: handoff.error }, url);
          return sendJson(res, handoff ? 200 : 404, handoff || { error: "handoff not found" }, url);
        }
        if (!body || typeof body.outcome !== "string" || !body.outcome.trim() || Object.keys(body).some((key) => key !== "outcome")) {
          return sendJson(res, 400, { error: "handoff completion accepts only a non-empty outcome" });
        }
        const handoff = controlPlane.completeHandoff(handoffID, subject, body.outcome.trim());
        if (handoff?.ok === false) return sendJson(res, handoff.httpStatus || 403, { error: handoff.error }, url);
        return sendJson(res, handoff ? 200 : 404, handoff || { error: "handoff not found" });
      }
      return sendJson(res, 405, { error: "method not allowed" });
    }
    if (req.method === "POST" && url.pathname === "/internal/web/v1/mobile/pair-approval") {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      const subject = String(req.headers["x-axi-subject"] || "").trim();
      if (!subject) return sendJson(res, 401, { error: "verified web identity required" }, url);
      if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
      const body = await readJsonBody(req);
      if (!body || typeof body.pairingId !== "string" || typeof body.code !== "string" || Object.keys(body).some((key) => !["pairingId", "code"].includes(key))) {
        return sendJson(res, 400, { error: "pairingId and code are required" }, url);
      }
      const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(body.pairingId.trim(), body.code.trim());
      if (!ownerApprovalToken) return sendJson(res, 503, { error: "owner approval secret not configured" }, url);
      return sendJson(res, 200, { ownerApprovalToken }, url);
    }
    if (req.method === "POST" && url.pathname === "/internal/web/v1/mobile/pair/approve") {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      const subject = String(req.headers["x-axi-subject"] || "").trim();
      if (!subject) return sendJson(res, 401, { error: "verified web identity required" }, url);
      if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
      const body = await readJsonBody(req);
      if (!body || typeof body.code !== "string" || !/^\d{6}$/.test(body.code.trim()) || Object.keys(body).some((key) => key !== "code")) {
        return sendJson(res, 400, { error: "a 6-digit pairing code is required" }, url);
      }
      const approved = controlPlane.pairing.approvePairByCode(body.code.trim());
      if (!approved.ok) return sendJson(res, 400, approved, url);
      controlPlane.pairing.audit({ event: "web_pairing_approved", subject, pairingId: approved.pairingId });
      return sendJson(res, 200, { ok: true, status: approved.status, deviceName: approved.deviceName }, url);
    }
    const webLoginStatusMatch = url.pathname.match(/^\/internal\/gateway\/v1\/web-login\/qr\/(weblogin_[A-Za-z0-9_-]+)$/);
    const webLoginConsumeMatch = url.pathname.match(/^\/internal\/gateway\/v1\/web-login\/qr\/(weblogin_[A-Za-z0-9_-]+)\/consume$/);
    if (
      (req.method === "POST" && url.pathname === "/internal/gateway/v1/web-login/qr") ||
      (req.method === "GET" && webLoginStatusMatch) ||
      (req.method === "POST" && webLoginConsumeMatch)
    ) {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
      if (req.method === "POST" && url.pathname === "/internal/gateway/v1/web-login/qr") {
        const body = await readJsonBody(req);
        if (!body || Object.keys(body).length !== 0) return sendJson(res, 400, { error: "Web login QR creation accepts no fields" }, url);
        const created = controlPlane.pairing.startWebLogin();
        return sendJson(res, created.ok ? 200 : 400, created, url);
      }
      const pollToken = String(req.headers["x-axi-qr-poll-token"] || "");
      if (req.method === "GET" && webLoginStatusMatch) {
        const status = controlPlane.pairing.webLoginStatus({ webLoginId: webLoginStatusMatch[1], pollToken });
        return sendJson(res, status.ok ? 200 : 404, status, url);
      }
      const body = await readJsonBody(req);
      if (!body || Object.keys(body).length !== 0) return sendJson(res, 400, { error: "Web login QR consume accepts no fields" }, url);
      const consumed = controlPlane.pairing.consumeWebLogin({ webLoginId: webLoginConsumeMatch[1], pollToken });
      if (!consumed.ok) return sendJson(res, 400, consumed, url);
      controlPlane.pairing.audit({ event: "web_login_qr_consumed", webLoginId: webLoginConsumeMatch[1], ownerSubject: consumed.ownerSubject });
      return sendJson(res, 200, consumed, url);
    }
    const webPairingStatusMatch = url.pathname.match(/^\/internal\/web\/v1\/mobile\/pair\/qr\/(webpair_[A-Za-z0-9_-]+)$/);
    const webPairingApproveMatch = url.pathname.match(/^\/internal\/web\/v1\/mobile\/pair\/qr\/(webpair_[A-Za-z0-9_-]+)\/approve$/);
    if (
      (req.method === "POST" && url.pathname === "/internal/web/v1/mobile/pair/qr") ||
      (req.method === "GET" && webPairingStatusMatch) ||
      (req.method === "POST" && webPairingApproveMatch)
    ) {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
      }
      const subject = String(req.headers["x-axi-subject"] || "").trim();
      if (!subject) return sendJson(res, 401, { error: "verified web identity required" }, url);
      if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
      if (req.method === "POST" && url.pathname === "/internal/web/v1/mobile/pair/qr") {
        const body = await readJsonBody(req);
        if (!body || Object.keys(body).length !== 0) return sendJson(res, 400, { error: "QR pairing creation accepts no fields" }, url);
        const created = controlPlane.pairing.startWebPairing({
          ownerSubject: subject,
          ownerEmail: String(req.headers["x-axi-email"] || "").trim(),
        });
        const gatewayUrl = created.ok ? mobileGatewayUrlResolver() : "";
        return sendJson(res, created.ok ? 200 : 400, created.ok
          ? { ...created, ...(gatewayUrl ? { gatewayUrl } : {}) }
          : created, url);
      }
      if (req.method === "GET" && webPairingStatusMatch) {
        const status = controlPlane.pairing.webPairingStatus({ webPairingId: webPairingStatusMatch[1], ownerSubject: subject });
        return sendJson(res, status.ok ? 200 : 404, status, url);
      }
      const body = await readJsonBody(req);
      if (!body || Object.keys(body).length !== 0) return sendJson(res, 400, { error: "QR pairing approval accepts no fields" }, url);
      const approved = controlPlane.pairing.approveWebPairing({ webPairingId: webPairingApproveMatch[1], ownerSubject: subject });
      if (!approved.ok) return sendJson(res, 400, approved, url);
      controlPlane.pairing.audit({ event: "web_qr_pairing_approved", subject, webPairingId: webPairingApproveMatch[1] });
      return sendJson(res, 200, approved, url);
    }
    let gatewayWebAuth = false;
    let gatewayCommunicationAuth = false;
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
    if (url.pathname.startsWith("/internal/communication/v1/")) {
      if (!gatewayInternalToken || !secureTokenEqual(req.headers["x-axi-internal-token"], gatewayInternalToken)) {
        return sendJson(res, 401, { error: "communication gateway authorization required" }, url);
      }
      if (!String(req.headers["x-axi-subject"] || "").trim()) {
        return sendJson(res, 401, { error: "verified communication subject required" }, url);
      }
      url.pathname = url.pathname.replace(/^\/internal\/communication\/v1/u, "");
      gatewayCommunicationAuth = true;
    }
    // The gateway exposes the control-plane snapshot at
    // `/api/v1/control-plane/snapshot` and rewrites it to the internal web
    // prefix above.  Handle the rewritten path before the mobile/core
    // dispatchers; otherwise it falls through to the core 404 despite having
    // already passed the gateway identity and internal-token checks.
    if (gatewayWebAuth && req.method === "GET" && url.pathname === "/snapshot") {
      return sendJson(res, 200, controlPlane.snapshot(), url);
    }
    const personalOsPath = url.pathname === "/personal-os" || url.pathname.startsWith("/personal-os/");
    if (personalOsPath) {
      if (!controlPlane.personalOs) return sendJson(res, 503, { error: "personal OS is not configured" }, url);
      const personalOsAuth = gatewayWebAuth ? { ok: true, source: "gateway_web" } : authenticateCoreRequest(req, coreApiToken);
      if (!personalOsAuth.ok) return sendJson(res, 401, { error: personalOsAuth.error }, url);

      if (req.method === "GET" && url.pathname === "/personal-os/queue") {
        try {
          return sendJson(res, 200, await controlPlane.personalOs.getQueue({
            view: url.searchParams.get("view") || "all",
            query: url.searchParams.get("query") || url.searchParams.get("q") || "",
            partition: url.searchParams.get("partition") || "",
          }), url);
        } catch (error) {
          return sendPersonalOsError(sendJson, res, error, url);
        }
      }

      const personalOsProjectMatch = url.pathname.match(/^\/personal-os\/projects\/([^/]+)$/);
      if (personalOsProjectMatch && req.method === "GET") {
        try {
          return sendJson(res, 200, await controlPlane.personalOs.getProject(decodeURIComponent(personalOsProjectMatch[1])), url);
        } catch (error) {
          return sendPersonalOsError(sendJson, res, error, url);
        }
      }
      if (personalOsProjectMatch && req.method === "PATCH") {
        const body = await readJsonBody(req);
        const validation = validatePersonalOsPatch(body);
        if (!validation.ok) return sendJson(res, 400, { error: validation.error }, url);
        try {
          return sendJson(res, 200, await controlPlane.personalOs.updateProject(decodeURIComponent(personalOsProjectMatch[1]), body), url);
        } catch (error) {
          return sendPersonalOsError(sendJson, res, error, url);
        }
      }

      if (req.method === "GET" && url.pathname === "/personal-os/focus") {
        return sendJson(res, 200, await controlPlane.personalOs.getFocus(), url);
      }
      if (req.method === "PUT" && url.pathname === "/personal-os/focus") {
        const body = await readJsonBody(req);
        const validation = validatePersonalOsFocus(body);
        if (!validation.ok) return sendJson(res, 400, { error: validation.error }, url);
        try {
          return sendJson(res, 200, await controlPlane.personalOs.updateFocus(body), url);
        } catch (error) {
          return sendPersonalOsError(sendJson, res, error, url);
        }
      }
      return sendJson(res, 404, { error: "personal OS endpoint not found" }, url);
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
        const allowedStartFields = ["publicKeyHex", "publicKeyAlgorithm", "deviceName", "clientInfo"];
        if (!body || Object.keys(body).some((key) => !allowedStartFields.includes(key))) {
          return sendJson(res, 400, { error: "pairing start accepts only a device key, declared algorithm, device name, and optional client info" }, url);
        }
        const r = controlPlane.pairing.startPair({
          publicKeyHex: body.publicKeyHex,
          publicKeyAlgorithm: body.publicKeyAlgorithm,
          deviceName: body.deviceName,
          clientInfo: body.clientInfo,
        });
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/qr/scan") {
        if (!isGatewayMobileRoute) return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const allowedScanFields = ["webPairingId", "scanToken", "publicKeyHex", "publicKeyAlgorithm", "deviceName"];
        if (
          !body ||
          Object.keys(body).some((key) => !allowedScanFields.includes(key)) ||
          typeof body.webPairingId !== "string" ||
          typeof body.scanToken !== "string" ||
          typeof body.publicKeyHex !== "string" ||
          !["Ed25519", "ES256"].includes(body.publicKeyAlgorithm) ||
          typeof body.deviceName !== "string"
        ) {
          return sendJson(res, 400, { error: "QR pairing scan requires only transaction, scan token, device key, algorithm, and device name" }, url);
        }
        const r = controlPlane.pairing.scanWebPairing(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/web-login/qr/scan") {
        if (!isGatewayMobileRoute) return sendJson(res, 401, { error: "gateway internal authorization required" }, url);
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const auth = authenticate(req, controlPlane, { pairingRequired, mobileOwnerToken });
        if (!auth.ok) return sendJson(res, 401, { error: auth.error }, url);
        const body = await readJsonBody(req);
        if (
          !body ||
          Object.keys(body).some((key) => !["webLoginId", "scanToken"].includes(key)) ||
          typeof body.webLoginId !== "string" ||
          typeof body.scanToken !== "string"
        ) {
          return sendJson(res, 400, { error: "Web login QR scan requires only transaction and scan token" }, url);
        }
        const r = controlPlane.pairing.scanWebLogin({
          webLoginId: body.webLoginId,
          scanToken: body.scanToken,
          deviceId: auth.deviceId,
        });
        if (r.ok) controlPlane.pairing.audit({ event: "mobile_web_login_qr_approved", webLoginId: body.webLoginId, deviceId: auth.deviceId });
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && (url.pathname === "/mobile/v1/pair/confirm" || url.pathname === "/mobile/v1/pair/confirmations")) {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.confirmPair(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/status") {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.pairingStatus(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && (url.pathname === "/mobile/v1/auth/token" || url.pathname === "/mobile/v1/auth/tokens")) {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.exchangeNonceForAccessToken(body || {});
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      // A nonce is safe to issue without a bearer token: only a device that
      // still owns the registered secret can sign it and obtain a token.
      if (req.method === "POST" && (url.pathname === "/mobile/v1/auth/nonce" || url.pathname === "/mobile/v1/auth/nonces")) {
        if (!controlPlane.pairing) return sendJson(res, 503, { error: "pairing not configured" }, url);
        const body = await readJsonBody(req);
        const r = controlPlane.pairing.requestAuthNonce({ deviceId: body?.deviceId });
        return sendJson(res, r.ok ? 200 : 400, r, url);
      }
      if (req.method === "POST" && (url.pathname === "/mobile/v1/pair/revoke" || url.pathname === "/mobile/v1/pair/revocations")) {
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
        if (req.method === "POST" && (url.pathname === "/mobile/v1/auth/owner-token" || url.pathname === "/mobile/v1/auth/owner-tokens")) {
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
      const mobileSubjectRef = `user:${String(auth.deviceId || "unknown").trim()}`;

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

      function evaluateMobilePolicy({ resourceRef, action, scopeRef = "workspace", correlationId = "" }) {
        const actorRef = mobileSubjectRef;
        const response = controlPlane.evaluateConfiguredGovernancePolicy({
          subjectRef: actorRef,
          scopeRef,
          resourceRef,
          action,
        });
        controlPlane.recordWorkspaceEvent({
          eventType: "policy_decision.evaluated",
          actorRef,
          scopeRef,
          objectRef: resourceRef,
          action,
          correlationId: correlationId || response.decision.id,
          policyDecisionRef: response.decision.id,
          evidenceRefs: response.decision.evidenceRefs,
          result: response.decision.decision,
          status: response.decision.decision,
        });
        return response;
      }

      function requireMobilePolicy(policyInput, { allowApproval = false } = {}) {
        const response = evaluateMobilePolicy(policyInput);
        const decision = response.decision.decision;
        if (decision === "allow" || (allowApproval && decision === "require_approval")) {
          return { ok: true, response };
        }
        return {
          ok: false,
          status: decision === "require_approval" ? 409 : 403,
          body: {
            error: "workspace policy does not allow this mobile action",
            policy: response,
          },
        };
      }


      if (req.method === "GET" && url.pathname === "/mobile/v1/workspace") return sendJson(res, 200, controlPlane.mobileSnapshot(), url);
      if (req.method === "GET" && url.pathname === "/mobile/v1/handoffs") {
        const result = controlPlane.listHandoffs({
          status: url.searchParams.get("status") || "",
          actor: mobileSubjectRef,
        });
        return sendJson(res, result.ok ? 200 : result.httpStatus || 400, result.ok ? result : { error: result.error }, url);
      }
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
      const mobileApprovalScanDecisionMatch = url.pathname.match(/^\/mobile\/v1\/approval-scans\/([^/]+)\/(?:decision|decisions)$/);
      if (req.method === "POST" && mobileApprovalScanDecisionMatch) {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required for approval scan decisions" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileApprovalScanDecision(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        const scanId = decodeURIComponent(mobileApprovalScanDecisionMatch[1]);
        const policy = requireMobilePolicy({
          resourceRef: `approval-scan:${scanId}`,
          action: "approve",
          correlationId: body.handoffCorrelationId,
        });
        if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ auditKind: "approval_scan_replayed", deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, handoffCorrelationId: body.handoffCorrelationId, policyDecisionRef: policy.response.decision.id, status: "replayed" });
          return;
        }
        const result = controlPlane.decideApprovalScan({ scanId, decision: body.decision, idempotencyKey: body.idempotencyKey, handoffCorrelationId: body.handoffCorrelationId, deviceId: auth.deviceId, subjectRef: mobileSubjectRef, sourceOwnerRef: auth.device?.owner?.subject || null, policyDecisionRef: policy.response.decision.id });
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
        const policy = requireMobilePolicy({ resourceRef: body.projectId, action: "execute", correlationId: body.idempotencyKey }, { allowApproval: true });
        if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: null, policyDecisionRef: policy.response.decision.id, status: "replayed" });
          return;
        }
        const result = controlPlane.createMobileProjectAction({ ...body, deviceId: auth.deviceId, auditDeviceId: auth.deviceId }, {
          policyDecisionRef: policy.response.decision.id,
          subjectRef: mobileSubjectRef,
          forceApproval: policy.response.decision.decision === "require_approval",
        });
        if (result?.ok === false) {
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: null, policyDecisionRef: policy.response.decision.id, status: "rejected" });
          return sendJson(res, result.httpStatus || 422, { error: result.error }, url);
        }
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status: 202, body: result } });
        const approvalRef = result?.approvalId || null;
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef, policyDecisionRef: policy.response.decision.id, status: approvalRef ? "pending_approval" : "executed" });
        return sendJson(res, 202, result, url);
      }
      const mobileCancelMatch = url.pathname.match(/^\/mobile\/v1\/jobs\/([^/]+)\/(?:cancel|cancellations)$/);
      if (req.method === "POST" && mobileCancelMatch) {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required to cancel mobile jobs" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileAction(body, ["idempotencyKey", "projectId", "actionType"]);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        const jobId = decodeURIComponent(mobileCancelMatch[1]);
        const policy = requireMobilePolicy({ resourceRef: `job:${jobId}`, action: "write", correlationId: body.idempotencyKey });
        if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, policyDecisionRef: policy.response.decision.id, status: "replayed" });
          return;
        }
        const job = controlPlane.cancelJob(jobId, { policyDecisionRef: policy.response.decision.id, subjectRef: mobileSubjectRef });
        const responseBody = job || { error: "job not found" };
        const status = job ? 200 : 404;
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionType: "cancel_job", approvalRef: null, policyDecisionRef: policy.response.decision.id, status: job ? "executed" : "not_found" });
        return sendJson(res, status, responseBody, url);
      }
      const mobileApprovalMatch = url.pathname.match(/^\/mobile\/v1\/approvals\/([^/]+)\/(?:decision|decisions)$/);
      if (req.method === "POST" && mobileApprovalMatch) {
        if (!hasOwnerScope(auth.scopes)) return sendJson(res, 403, { error: "owner scope required to decide mobile approvals" }, url);
        const body = await readJsonBody(req);
        const fields = validateMobileApprovalDecision(body);
        if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
        if (body.approvalRef !== decodeURIComponent(mobileApprovalMatch[1])) return sendJson(res, 422, { error: "approvalRef must match the approval path" }, url);
        const approvalId = decodeURIComponent(mobileApprovalMatch[1]);
        const policy = requireMobilePolicy({ resourceRef: `approval:${approvalId}`, action: "approve", correlationId: body.idempotencyKey });
        if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
        const idempotency = controlPlane.idempotency;
        const cached = idempotency.check({ deviceId: auth.deviceId, key: body.idempotencyKey });
        if (cached.cached) {
          writeReplayResponse(res, cached.response, url);
          controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: body.approvalRef, policyDecisionRef: policy.response.decision.id, status: "replayed" });
          return;
        }
        const decision = controlPlane.decideApproval({ id: approvalId, ...body, deviceId: auth.deviceId, actorRef: auth.deviceId, subjectRef: mobileSubjectRef, policyDecisionRef: policy.response.decision.id });
        const responseBody = decision || { error: "approval not found" };
        const status = decision ? 200 : 404;
        idempotency.record({ deviceId: auth.deviceId, key: body.idempotencyKey, response: { status, body: responseBody } });
        controlPlane.recordMobileAudit({ deviceId: auth.deviceId, idempotencyKey: body.idempotencyKey, projectId: body.projectId, actionId: body.actionId, actionType: body.actionType, approvalRef: body.approvalRef, policyDecisionRef: policy.response.decision.id, status: decision ? "executed" : "not_found" });
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
    const coreAuth = gatewayWebAuth
      ? { ok: true, source: "gateway_web" }
      : gatewayCommunicationAuth
        ? { ok: true, source: "gateway_communication" }
        : authenticateCoreRequest(req, coreApiToken);
    if (!coreAuth.ok) return sendJson(res, 401, { error: coreAuth.error }, url);
    const coreSubjectRef = String(req.headers["x-axi-subject"] || coreAuth.source || "unknown").trim();
    function evaluateCorePolicy({ resourceRef, action, scopeRef = "workspace", correlationId = "" }) {
      const actorRef = coreSubjectRef;
      const response = controlPlane.evaluateConfiguredGovernancePolicy({
        subjectRef: actorRef,
        scopeRef,
        resourceRef,
        action,
        ...(correlationId ? { correlationId } : {}),
      });
      controlPlane.recordWorkspaceEvent({
        eventType: "policy_decision.evaluated",
        actorRef,
        scopeRef,
        objectRef: resourceRef,
        action,
        correlationId: correlationId || response.decision.id,
        policyDecisionRef: response.decision.id,
        evidenceRefs: response.decision.evidenceRefs,
        result: response.decision.decision,
        status: response.decision.decision,
      });
      return response;
    }
    function requireCorePolicy(policyInput, { allowApproval = false } = {}) {
      const response = evaluateCorePolicy(policyInput);
      if (response.decision.decision === "allow") return { ok: true, response };
      if (allowApproval && response.decision.decision === "require_approval") return { ok: true, response, requiresApproval: true };
      return {
        ok: false,
        status: response.decision.decision === "require_approval" ? 409 : 403,
        body: {
          error: "workspace policy does not allow this action",
          policy: response,
        },
      };
    }
    if (req.method === "GET" && url.pathname === "/risks") {
      const governance = controlPlane.snapshot().governance;
      return sendJson(res, 200, { risks: governance?.risks || [], incidents: governance?.incidents || [] }, url);
    }
    const riskTransitionMatch = url.pathname.match(/^\/risks\/([^/]+)\/transition$/);
    if (req.method === "POST" && riskTransitionMatch) {
      const body = await readJsonBody(req);
      const fields = validateRiskTransition(body);
      if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
      const riskId = decodeURIComponent(riskTransitionMatch[1]);
      const policy = requireCorePolicy({ resourceRef: `risk:${riskId}`, action: "manage", correlationId: firstPolicyCorrelation(body) });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      const result = controlPlane.transitionGovernanceRisk({
        ...body,
        id: riskId,
        actorRef: String(req.headers["x-axi-subject"] || coreAuth.source || "unknown").trim(),
        policyDecisionRef: policy.response.decision.id,
        subjectRef: coreSubjectRef,
      });
      if (!result.ok) return sendJson(res, result.httpStatus || 422, { error: result.error }, url);
      return sendJson(res, 200, result, url);
    }
    if (req.method === "POST" && url.pathname === "/query") {
      const body = await readJsonBody(req);
      const run = await controlPlane.query(body, {
        policyEvaluator: (policyInput) => evaluateCorePolicy(policyInput),
      });
      return sendJson(res, 200, run, url);
    }
    const workspaceEventMatch = url.pathname.match(/^\/events\/([^/]+)$/);
    if (req.method === "GET" && workspaceEventMatch) {
      const event = controlPlane.getWorkspaceEvent(decodeURIComponent(workspaceEventMatch[1]));
      return sendJson(res, event ? 200 : 404, event || { error: "workspace event not found" }, url);
    }
    if (req.method === "GET" && url.pathname === "/events") {
      const rawLimit = Number.parseInt(url.searchParams.get("limit") || "100", 10);
      return sendJson(res, 200, controlPlane.getWorkspaceEvents({
        afterEventId: url.searchParams.get("afterEventId") || "",
        eventType: url.searchParams.get("eventType") || "",
        actorRef: url.searchParams.get("actorRef") || "",
        objectRef: url.searchParams.get("objectRef") || "",
        surfaceRef: url.searchParams.get("surfaceRef") || "",
        projectRef: url.searchParams.get("projectRef") || "",
        serviceRef: url.searchParams.get("serviceRef") || "",
        runRef: url.searchParams.get("runRef") || "",
        since: url.searchParams.get("since") || "",
        limit: Number.isFinite(rawLimit) ? rawLimit : 100,
      }), url);
    }
    const policyDecisionMatch = url.pathname.match(/^\/authorization\/decision\/([^/]+)$/);
    if (req.method === "GET" && policyDecisionMatch) {
      const decision = controlPlane.getGovernancePolicyDecision(decodeURIComponent(policyDecisionMatch[1]));
      return sendJson(res, decision ? 200 : 404, decision || { error: "policy decision not found" }, url);
    }
    if (req.method === "POST" && url.pathname === "/authorization/decision") {
      const body = await readJsonBody(req);
      const fields = validateGovernancePolicyQuery(body);
      if (!fields.ok) return sendJson(res, 400, { error: fields.error }, url);
      const response = evaluateCorePolicy(body);
      return sendJson(res, 200, response, url);
    }
    if (req.method === "POST" && url.pathname === "/communication/messages") {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await controlPlane.handleCommunicationMessage(body, {
        intelligenceOnly: url.searchParams.get("mode") === "intelligence",
        policyEvaluator: (policyInput) => evaluateCorePolicy(policyInput),
      }), url);
    }
    if (req.method === "POST" && url.pathname === "/jobs") {
      const body = await readJsonBody(req);
      const policy = requireCorePolicy({
        resourceRef: firstPolicyResource(body, "workspace"),
        action: "execute",
        correlationId: firstPolicyCorrelation(body),
      }, { allowApproval: true });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      return sendJson(res, 202, controlPlane.createJob(body, { policyDecisionRef: policy.response.decision.id, forceApproval: policy.requiresApproval === true, subjectRef: coreSubjectRef }), url);
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
    const cancelJobMatch = url.pathname.match(/^\/jobs\/([^/]+)\/(?:cancel|cancellations)$/);
    if (req.method === "POST" && cancelJobMatch) {
      const jobId = decodeURIComponent(cancelJobMatch[1]);
      const body = await readJsonBody(req);
      const policy = requireCorePolicy({ resourceRef: `job:${jobId}`, action: "write", correlationId: firstPolicyCorrelation(body) });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      const job = controlPlane.cancelJob(jobId, { policyDecisionRef: policy.response.decision.id, subjectRef: coreSubjectRef });
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
    const cancelTaskMatch = url.pathname.match(/^\/agent-tasks\/([^/]+)\/(?:cancel|cancellations)$/);
    if (req.method === "POST" && cancelTaskMatch) {
      const taskId = decodeURIComponent(cancelTaskMatch[1]);
      const body = await readJsonBody(req);
      const policy = requireCorePolicy({ resourceRef: `agent-task:${taskId}`, action: "write", correlationId: firstPolicyCorrelation(body) });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      const task = controlPlane.cancelAgentTask(taskId, { policyDecisionRef: policy.response.decision.id, subjectRef: coreSubjectRef });
      return sendJson(res, task ? 200 : 404, task || { error: "agent task not found" }, url);
    }
    const approvalMatch = url.pathname.match(/^\/approvals\/([^/]+)\/(?:decision|decisions)$/);
    if (req.method === "POST" && approvalMatch) {
      const body = await readJsonBody(req);
      const approvalId = decodeURIComponent(approvalMatch[1]);
      const policy = requireCorePolicy({ resourceRef: `approval:${approvalId}`, action: "approve", correlationId: firstPolicyCorrelation(body) });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      const decision = controlPlane.decideApproval({
        id: approvalId,
        ...body,
        actorRef: String(req.headers["x-axi-subject"] || coreAuth.source || "unknown").trim(),
        policyDecisionRef: policy.response.decision.id,
        subjectRef: coreSubjectRef,
      });
      return sendJson(res, decision ? 200 : 404, decision || { error: "approval not found" }, url);
    }
    const automationMatch = url.pathname.match(/^\/automations\/([^/]+)\/(?:run|runs)$/);
    if (req.method === "POST" && automationMatch) {
      const automationId = decodeURIComponent(automationMatch[1]);
      const body = await readJsonBody(req);
      const policy = requireCorePolicy({ resourceRef: `automation:${automationId}`, action: "execute", correlationId: firstPolicyCorrelation(body) });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      const run = controlPlane.runAutomation(automationId, { policyDecisionRef: policy.response.decision.id, subjectRef: coreSubjectRef });
      return sendJson(res, run ? 200 : 404, run || { error: "automation not found" }, url);
    }
    const commandMatch = url.pathname.match(/^\/commands\/([^/]+)\/(?:run|runs)$/);
    if (req.method === "POST" && commandMatch) {
      const commandId = decodeURIComponent(commandMatch[1]);
      const body = await readJsonBody(req);
      const policy = requireCorePolicy({ resourceRef: commandId, action: "execute", correlationId: firstPolicyCorrelation(body) });
      if (!policy.ok) return sendJson(res, policy.status, policy.body, url);
      const run = controlPlane.runCommand(commandId, { policyDecisionRef: policy.response.decision.id, subjectRef: coreSubjectRef });
      return sendJson(res, run ? 200 : 404, run || { error: "command not found" }, url);
    }
    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (req.method === "GET" && runMatch) {
      const run = controlPlane.getRun(decodeURIComponent(runMatch[1]));
      return sendJson(res, run ? 200 : 404, run || { error: "run not found" }, url);
    }
    return sendJson(res, 404, { error: "not found" }, url);
  } catch (error) {
    if (url?.pathname?.startsWith("/personal-os")) {
      return sendPersonalOsError(sendJson, res, error, url);
    }
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
    if (verified.ok) return { ok: true, deviceId: verified.deviceId, scopes: verified.scopes, device: verified.device };
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

function validateGovernancePolicyQuery(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "authorization decision requires a JSON object" };
  const allowed = new Set(["subjectRef", "scopeRef", "resourceRef", "action", "correlationId"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `unsupported authorization decision field(s): ${unknown.join(", ")}` };
  const required = ["subjectRef", "resourceRef", "action"];
  const missing = required.filter((key) => typeof body[key] !== "string" || !body[key].trim());
  if (missing.length) return { ok: false, error: `missing authorization decision field(s): ${missing.join(", ")}` };
  const actions = new Set(["read", "write", "execute", "deploy", "manage", "approve", "admin"]);
  if (!actions.has(body.action)) return { ok: false, error: "action is not a supported Workspace RBAC action" };
  return { ok: true };
}

function validateRiskTransition(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "risk transition requires a JSON object" };
  const allowed = new Set(["status", "reason", "correlationId"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `unsupported risk transition field(s): ${unknown.join(", ")}` };
  if (!["open", "acknowledged", "resolved", "waived"].includes(body.status)) return { ok: false, error: "risk status must be open, acknowledged, resolved, or waived" };
  for (const key of ["reason", "correlationId"]) {
    if (body[key] !== undefined && (typeof body[key] !== "string" || !body[key].trim())) return { ok: false, error: `${key} must be a non-empty string when provided` };
  }
  return { ok: true };
}

function firstPolicyResource(body, fallback) {
  for (const key of ["resourceRef", "projectId", "targetId", "actionId"]) {
    if (typeof body?.[key] === "string" && body[key].trim()) return body[key].trim();
  }
  return fallback;
}

function firstPolicyCorrelation(body) {
  return typeof body?.correlationId === "string" && body.correlationId.trim()
    ? body.correlationId.trim()
    : "";
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

function validatePersonalOsPatch(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "request body must be a JSON object" };
  const allowed = new Set(["lifecycleOverride", "finishLine", "usesAxiUi", "revision"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `unsupported personal OS field(s): ${unknown.join(", ")}` };
  if (!Object.hasOwn(body, "revision")) return { ok: false, error: "revision is required" };
  return { ok: true };
}

function validatePersonalOsFocus(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "request body must be a JSON object" };
  const allowed = new Set(["projectId", "revision"]);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return { ok: false, error: `unsupported personal OS focus field(s): ${unknown.join(", ")}` };
  if (!Object.hasOwn(body, "revision")) return { ok: false, error: "revision is required" };
  if (body.projectId !== null && typeof body.projectId !== "string") return { ok: false, error: "projectId must be a string or null" };
  return { ok: true };
}

function sendPersonalOsError(sendJson, res, error, url) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const body = {
    error: error?.code || "personal_os_error",
    message: statusCode >= 500 ? "personal OS request failed" : error?.message || "personal OS request rejected",
  };
  if (statusCode === 409 && error?.current) body.current = error.current;
  return sendJson(res, statusCode, body, url);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

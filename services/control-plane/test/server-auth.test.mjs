import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { createServer } from "node:http";
import { createControlPlane } from "../src/control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

const TEST_TOKEN_SECRET = "test-core-token-secret";
const OWNER_APPROVAL_SECRET = "test-core-owner-approval-secret";

function fixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-core-auth-"));
  const projectPath = join(workspaceRoot, "projects", "sample-app");
  mkdirSync(join(workspaceRoot, ".workspace"), { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {
    "sample-app": {
      name: "示例应用",
      kind: "android-app",
      path: projectPath,
      health: ["node -e \"process.stdout.write('ok')\""],
    },
  } }));
  writeFileSync(join(workspaceRoot, ".workspace", "project-completion.json"), JSON.stringify({ projects: [{
    id: "sample-app",
    stage: "building",
    confidence: "low",
    updatedAt: new Date().toISOString(),
    handoff: { status: "ready" },
  }] }));
  const controlPlane = createControlPlane({
    workspaceRoot,
    graphPath,
    cacheDir: join(workspaceRoot, ".cache"),
    pairingTokenSecret: TEST_TOKEN_SECRET,
    ownerApprovalSecret: OWNER_APPROVAL_SECRET,
  });
  return {
    controlPlane,
    server: createControlPlaneHttpServer({
      controlPlane,
      coreApiToken: "core-token-test-value",
      ownerApprovalSecret: OWNER_APPROVAL_SECRET,
      // Restrict CORS to a single known origin.
      allowedOrigins: ["http://allowed-origin.test"],
    }),
  };
}

function freshKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  return { publicKeyHex, privateKey: createPrivateKey(privateKeyPem) };
}

function signNonce(privateKey, nonce) {
  return cryptoSign(null, Buffer.from(nonce, "utf8"), privateKey).toString("hex");
}

/* In-process invocation of the HTTP server.  Avoids TCP listen() so
 * the test works in sandboxed environments that block network sockets.
 * Mirrors server.mjs routing closely enough to exercise the auth gate,
 * CORS allowlist, and scope checks. */
function invokeServer(server, { method, url, headers = {}, body }) {
  // The createServer handler reads `req.headers.host` for URL parsing and
  // streams the body via async iteration.
  const fullHeaders = { host: "127.0.0.1", ...headers };
  let payload = body;
  if (payload !== undefined && typeof payload !== "string") {
    payload = JSON.stringify(payload);
    fullHeaders["content-type"] = "application/json";
  }
  return new Promise((resolve) => {
    const chunks = payload ? [Buffer.from(payload)] : [];
    const req = {
      method,
      url,
      headers: fullHeaders,
      [Symbol.asyncIterator]() { return this; },
      async next() {
        if (chunks.length === 0) return { value: undefined, done: true };
        return { value: chunks.shift(), done: false };
      },
    };
    const resHeaders = {};
    const res = {
      req,
      statusCode: 200,
      writeHead(code, hdrs) { this.statusCode = code; Object.assign(resHeaders, hdrs); return this; },
      end(buf) { resolve({ status: this.statusCode, headers: resHeaders, body: buf ? buf.toString("utf8") : "" }); },
    };
    // Invoke the listener directly.  Node’s http server normally wires res.req itself.
    server.emit("request", req, res);
  });
}

test("core HTTP rejects /snapshot, /jobs, /approvals, /commands, /runs without Authorization", async () => {
  const { server } = fixture();
  const endpoints = [
    ["GET", "/snapshot"],
    ["POST", "/query"],
    ["POST", "/communication/messages"],
    ["POST", "/jobs"],
    ["GET", "/jobs/x"],
    ["GET", "/jobs/x/events"],
    ["GET", "/jobs/x/artifacts"],
    ["POST", "/jobs/x/cancel"],
    ["GET", "/agent-tasks/x"],
    ["POST", "/agent-tasks/x/cancel"],
    ["POST", "/approvals/x/decision"],
    ["POST", "/commands/x/run"],
    ["GET", "/runs/x"],
  ];
  for (const [method, url] of endpoints) {
    const r = await invokeServer(server, { method, url, headers: {} });
    assert.equal(r.status, 401, `${method} ${url} must 401 unauthenticated, got ${r.status}`);
    const body = JSON.parse(r.body);
    assert.match(body.error, /core API|owner|bearer/i, `${method} ${url} error message`);
  }
});

test("core HTTP rejects /snapshot with a wrong Authorization bearer", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, { method: "GET", url: "/snapshot", headers: { authorization: "Bearer wrong-token" } });
  assert.equal(r.status, 401);
});

test("core HTTP accepts /snapshot with the configured coreApiToken bearer", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, { method: "GET", url: "/snapshot", headers: { authorization: "Bearer core-token-test-value" } });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.ok(body.axiResources || body.resources, "snapshot shape");
});

test("core HTTP does not emit Access-Control-Allow-Origin: * for arbitrary origin", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, {
    method: "GET",
    url: "/snapshot",
    headers: { origin: "http://attacker.test", authorization: "Bearer core-token-test-value" },
  });
  assert.equal(r.status, 200);
  assert.notEqual(r.headers["Access-Control-Allow-Origin"], "*", "wildcard forbidden");
  assert.equal(r.headers["Access-Control-Allow-Origin"], undefined, "unknown origin should not be echoed");
});

test("core HTTP echoes the configured allowed origin and sets Vary: Origin", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, {
    method: "GET",
    url: "/snapshot",
    headers: { origin: "http://allowed-origin.test", authorization: "Bearer core-token-test-value" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers["Access-Control-Allow-Origin"], "http://allowed-origin.test");
  assert.match(r.headers["Vary"], /Origin/);
});

test("OPTIONS preflight from an unknown origin has no Allow-Origin (browsers block)", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, { method: "OPTIONS", url: "/snapshot", headers: { origin: "http://attacker.test" } });
  assert.equal(r.status, 204);
  assert.notEqual(r.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(r.headers["Access-Control-Allow-Origin"], undefined);
});

test("core HTTP returns 401 when coreApiToken is not configured (fail closed)", async () => {
  // Build a fixture that does NOT set coreApiToken.
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-core-auth-failclosed-"));
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const controlPlane = createControlPlane({
    workspaceRoot,
    graphPath,
    cacheDir: join(workspaceRoot, ".cache"),
  });
  const server = createControlPlaneHttpServer({ controlPlane });
  const r = await invokeServer(server, { method: "GET", url: "/snapshot", headers: { authorization: "Bearer anything" } });
  assert.equal(r.status, 401);
  const body = JSON.parse(r.body);
  assert.match(body.error, /not configured/i);
});

test("dangerous mobile writes reject a non-owner mobile bearer with 403", async () => {
  const { server, controlPlane } = fixture();
  const { publicKeyHex, privateKey } = freshKey();
  // Pair + issue a baseline mobile-scoped bearer.
  const start = controlPlane.pairing.startPair({ publicKeyHex, deviceName: "scope-test" });
  const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.pairingId, start.code);
  const confirm = controlPlane.pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
  const token = controlPlane.pairing.exchangeNonceForAccessToken({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  const bearer = { authorization: `Bearer ${token.accessToken}` };

  const paths = [
    { method: "POST", url: "/mobile/v1/jobs", body: { idempotencyKey: "scope_no_owner_job01", projectId: "sample-app", actionId: "verify", actionType: "project_verification" } },
    { method: "POST", url: "/mobile/v1/approvals/apx/decision", body: { idempotencyKey: "scope_no_owner_app01", projectId: "sample-app", actionId: "verify", actionType: "project_verification", approvalRef: "apx", decision: "approved" } },
  ];
  for (const req of paths) {
    const r = await invokeServer(server, { ...req, headers: bearer });
    assert.equal(r.status, 403, `${req.method} ${req.url} must 403 for mobile-only bearer, got ${r.status}`);
    const body = JSON.parse(r.body);
    assert.match(body.error, /owner scope/i);
  }
});

test("mobile /workspace accepts a mobile-scoped bearer (read-only path)", async () => {
  const { server, controlPlane } = fixture();
  const { publicKeyHex, privateKey } = freshKey();
  const start = controlPlane.pairing.startPair({ publicKeyHex, deviceName: "scope-workspace" });
  const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.pairingId, start.code);
  const confirm = controlPlane.pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
  const token = controlPlane.pairing.exchangeNonceForAccessToken({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  const r = await invokeServer(server, { method: "GET", url: "/mobile/v1/workspace", headers: { authorization: `Bearer ${token.accessToken}` } });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.ok(Array.isArray(body.projects));
});

test("mobile /workspace rejects anonymous caller with 401", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, { method: "GET", url: "/mobile/v1/workspace", headers: {} });
  assert.equal(r.status, 401);
});

test("/mobile/v1/auth/owner-token requires X-Axi-Owner-Token header that equals ownerApprovalSecret", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, { method: "POST", url: "/mobile/v1/auth/owner-token", headers: {}, body: {} });
  assert.equal(r.status, 401);
  const body = JSON.parse(r.body);
  assert.match(body.error, /owner approval/i);
});

test("/mobile/v1/auth/owner-token rejects a wrong X-Axi-Owner-Token with constant-time compare", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/auth/owner-token",
    headers: { "x-axi-owner-token": "wrong-value" },
    body: { deviceId: "dev_x", nonceId: "nonce_x", nonce: "n", signatureHex: "0".repeat(128) },
  });
  assert.equal(r.status, 401);
});

test("/mobile/v1/auth/owner-token returns 503 when neither pairing nor ownerApprovalSecret is configured", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "axi-owner-token-failclosed-"));
  const graphPath = join(workspaceRoot, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const controlPlane = createControlPlane({
    workspaceRoot,
    graphPath,
    cacheDir: join(workspaceRoot, ".cache"),
  });
  const server = createControlPlaneHttpServer({ controlPlane });
  const r = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/auth/owner-token",
    headers: { "x-axi-owner-token": "anything" },
    body: {},
  });
  assert.equal(r.status, 503);
  const body = JSON.parse(r.body);
  // When pairing is also unconfigured, the route bails out at the
  // earlier "pairing not configured" check.  That is also fail-closed
  // and is the correct observable behaviour.
  assert.match(body.error, /not configured/i);
});

test("internal gateway handoff route still requires the gateway internal token", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/handoffs/handoff_x",
    headers: { "x-axi-subject": "owner@example.test" },
  });
  assert.equal(r.status, 401);
  const body = JSON.parse(r.body);
  assert.match(body.error, /gateway internal/i);
});

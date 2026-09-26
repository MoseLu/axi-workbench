import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { createServer } from "node:http";
import { createControlPlane } from "./test-control-plane.mjs";
import { createControlPlaneHttpServer, resolveGatewayInternalToken, resolveMobileGatewayUrl } from "../src/server.mjs";

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
    registryPath: join(workspaceRoot, "workspace.json"),
    cacheDir: join(workspaceRoot, ".cache"),
    pairingTokenSecret: TEST_TOKEN_SECRET,
    ownerApprovalSecret: OWNER_APPROVAL_SECRET,
  });
  return {
    workspaceRoot,
    cacheDir: join(workspaceRoot, ".cache"),
    controlPlane,
    server: createControlPlaneHttpServer({
      controlPlane,
      coreApiToken: "core-token-test-value",
      ownerApprovalSecret: OWNER_APPROVAL_SECRET,
      mobileGatewayUrlResolver: () => "http://192.168.1.42:8088/api/v1/",
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
    ["GET", "/events"],
    ["POST", "/authorization/decision"],
    ["POST", "/query"],
    ["POST", "/communication/messages"],
    ["POST", "/jobs"],
    ["GET", "/jobs/x"],
    ["GET", "/jobs/x/events"],
    ["GET", "/jobs/x/artifacts"],
    ["POST", "/jobs/x/cancel"],
    ["POST", "/jobs/x/cancellations"],
    ["GET", "/agent-tasks/x"],
    ["POST", "/agent-tasks/x/cancel"],
    ["POST", "/agent-tasks/x/cancellations"],
    ["POST", "/approvals/x/decision"],
    ["POST", "/approvals/x/decisions"],
    ["POST", "/commands/x/run"],
    ["POST", "/commands/x/runs"],
    ["POST", "/automations/x/run"],
    ["POST", "/automations/x/runs"],
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

test("core HTTP exposes normalized workspace events with object filters", async () => {
  const { server, controlPlane } = fixture();
  controlPlane.recordMobileAudit({
    auditKind: "mobile_action",
    projectId: "sample-app",
    serviceId: "mobile-client",
    runId: "run-sample-app",
    deviceId: "device-1",
    handoffCorrelationId: "handoff:sample-app",
    status: "executed",
  });
  const r = await invokeServer(server, {
    method: "GET",
    url: "/events?objectRef=sample-app&surfaceRef=mobile&projectRef=sample-app&serviceRef=mobile-client&runRef=run-sample-app&limit=10",
    headers: { authorization: "Bearer core-token-test-value" },
  });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].objectRef, "sample-app");
  assert.equal(body.events[0].actorRef, "device-1");
  assert.equal(body.events[0].correlationId, "handoff:sample-app");
  assert.equal(body.events[0].immutable, true);
  assert.equal(body.events[0].raw, undefined);
  const detail = await invokeServer(server, {
    method: "GET",
    url: `/events/${encodeURIComponent(body.events[0].eventId)}`,
    headers: { authorization: "Bearer core-token-test-value" },
  });
  assert.equal(detail.status, 200);
  assert.deepEqual(JSON.parse(detail.body), body.events[0]);
  const missing = await invokeServer(server, {
    method: "GET",
    url: "/events/event-does-not-exist",
    headers: { authorization: "Bearer core-token-test-value" },
  });
  assert.equal(missing.status, 404);
});

test("core HTTP returns a secure default-deny Workspace policy decision", async () => {
  const { server, controlPlane } = fixture();
  const r = await invokeServer(server, {
    method: "POST",
    url: "/authorization/decision",
    headers: { authorization: "Bearer core-token-test-value" },
    body: { subjectRef: "user:alice", resourceRef: "sample-app", action: "execute" },
  });
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.decision.decision, "deny");
  assert.equal(body.decision.reason, "no_matching_grant");
  assert.ok(body.warnings.includes("workspace_rbac_grants_unconfigured"));
  assert.equal(body.decision.evidenceRefs.length, 1);
  assert.ok(controlPlane.snapshot().governance.evidence.some((item) => item.id === body.decision.evidenceRefs[0] && item.source === "control-plane.policy" && item.status === "deny"));
  const decisionEvents = controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events;
  assert.equal(decisionEvents.length, 1);
  assert.equal(decisionEvents[0].eventType, "policy_decision.evaluated");
  assert.equal(decisionEvents[0].actorRef, "core_api_token");
  assert.equal(decisionEvents[0].objectRef, "sample-app");
  assert.equal(decisionEvents[0].policyDecisionRef, body.decision.id);
  assert.ok(decisionEvents[0].evidenceRefs.includes(body.decision.evidenceRefs[0]));
  const persisted = await invokeServer(server, {
    method: "GET",
    url: `/authorization/decision/${encodeURIComponent(body.decision.id)}`,
    headers: { authorization: "Bearer core-token-test-value" },
  });
  assert.equal(persisted.status, 200);
  assert.deepEqual(JSON.parse(persisted.body), body.decision);
  const invalid = await invokeServer(server, {
    method: "POST",
    url: "/authorization/decision",
    headers: { authorization: "Bearer core-token-test-value" },
    body: { subjectRef: "user:alice", resourceRef: "sample-app", action: "execute", grants: [] },
  });
  assert.equal(invalid.status, 400);
});

test("core controlled writes fail closed before execution and emit policy decisions", async () => {
  const { server, controlPlane } = fixture();
  const headers = {
    authorization: "Bearer core-token-test-value",
    "x-axi-subject": "user:alice",
  };
  const requests = [
    { method: "POST", url: "/jobs", body: { projectId: "sample-app" }, action: "execute", objectRef: "sample-app" },
    { method: "POST", url: "/jobs/job-1/cancel", body: {}, action: "write", objectRef: "job:job-1" },
    { method: "POST", url: "/agent-tasks/task-1/cancel", body: {}, action: "write", objectRef: "agent-task:task-1" },
    { method: "POST", url: "/approvals/approval-1/decision", body: { decision: "approved" }, action: "approve", objectRef: "approval:approval-1" },
    { method: "POST", url: "/commands/command-1/run", body: {}, action: "execute", objectRef: "command-1" },
    { method: "POST", url: "/automations/automation-1/run", body: {}, action: "execute", objectRef: "automation:automation-1" },
  ];
  for (const request of requests) {
    const response = await invokeServer(server, { ...request, headers });
    assert.equal(response.status, 403, `${request.url} must default deny, got ${response.status}: ${response.body}`);
    const body = JSON.parse(response.body);
    assert.equal(body.policy.decision.decision, "deny");
  }
  const events = controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events;
  assert.equal(events.length, requests.length);
  const actualDecisions = events.map((event) => [event.actorRef, event.action, event.objectRef, event.result]).sort((left, right) => left.join("\u0000").localeCompare(right.join("\u0000")));
  const expectedDecisions = requests.map((request) => ["user:alice", request.action, request.objectRef, "deny"]).sort((left, right) => left.join("\u0000").localeCompare(right.join("\u0000")));
  assert.deepEqual(actualDecisions, expectedDecisions);
  assert.equal(controlPlane.getJob("job-1"), null);
});

test("core controlled writes proceed only with a registry-declared allow grant", async () => {
  const { workspaceRoot, server, controlPlane } = fixture();
  mkdirSync(join(workspaceRoot, "rbac"), { recursive: true });
  writeFileSync(join(workspaceRoot, "workspace.json"), JSON.stringify({
    settings: { rbac: { version: "test-rbac-v1", grants: "rbac/grants.json" } },
  }));
  writeFileSync(join(workspaceRoot, "rbac", "grants.json"), JSON.stringify({ grants: [{
    id: "grant:core-execute",
    subjectRef: "user:alice",
    roleRef: "role:operator",
    scopeType: "workspace",
    scopeRef: "workspace",
    resourceRef: "*",
    action: "execute",
    effect: "allow",
    inheritance: "default",
  }] }));
  let received;
  let receivedAuthorization;
  controlPlane.createJob = (body, internal) => {
    received = body;
    receivedAuthorization = internal;
    return { accepted: true, job: { id: "job:allowed" } };
  };
  const response = await invokeServer(server, {
    method: "POST",
    url: "/jobs",
    headers: { authorization: "Bearer core-token-test-value", "x-axi-subject": "user:alice" },
    body: { projectId: "sample-app", correlationId: "corr:allowed" },
  });
  assert.equal(response.status, 202);
  assert.deepEqual(received, { projectId: "sample-app", correlationId: "corr:allowed" });
  assert.match(receivedAuthorization.policyDecisionRef, /^policy-decision:/);
  const event = controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events[0];
  assert.equal(event.result, "allow");
  assert.equal(event.policyDecisionRef.startsWith("policy-decision:"), true);
  assert.equal(event.correlationId, "corr:allowed");
});

test("core Risk lifecycle is policy-gated and returns durable Risk plus Incident state", async () => {
  const { workspaceRoot, cacheDir, server, controlPlane } = fixture();
  mkdirSync(join(cacheDir, "risks"), { recursive: true });
  mkdirSync(join(cacheDir, "incidents"), { recursive: true });
  writeFileSync(join(cacheDir, "risks", "risk_test.json"), JSON.stringify({
    id: "risk:test",
    targetRef: "sample-app",
    riskType: "execution_failure",
    severity: "critical",
    likelihood: "likely",
    status: "open",
    ownerRef: "unknown",
    reason: "runtime unavailable",
    sourceAssessmentRef: "job:test",
    evidenceRefs: [],
    correlationId: "corr-risk-test",
    detectedAt: new Date().toISOString(),
    dueAt: null,
    resolvedAt: null,
    source: "control-plane.execution",
    incidentRef: "incident:test",
  }));
  writeFileSync(join(cacheDir, "incidents", "incident_test.json"), JSON.stringify({
    id: "incident:test",
    riskRef: "risk:test",
    targetRef: "sample-app",
    severity: "critical",
    status: "open",
    ownerRef: "unknown",
    summary: "runtime unavailable",
    correlationId: "corr-risk-test",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    source: "control-plane.execution",
  }));
  const headers = { authorization: "Bearer core-token-test-value", "x-axi-subject": "user:alice" };
  const listed = await invokeServer(server, { method: "GET", url: "/risks", headers });
  assert.equal(listed.status, 200);
  assert.equal(JSON.parse(listed.body).risks[0].id, "risk:test");

  const denied = await invokeServer(server, { method: "POST", url: "/risks/risk%3Atest/transition", headers, body: { status: "acknowledged" } });
  assert.equal(denied.status, 403);

  writeFileSync(join(workspaceRoot, "workspace.json"), JSON.stringify({ settings: { rbac: { grants: "rbac/grants.json" } } }));
  mkdirSync(join(workspaceRoot, "rbac"), { recursive: true });
  writeFileSync(join(workspaceRoot, "rbac", "grants.json"), JSON.stringify({ grants: [{
    id: "grant:risk-manage",
    subjectRef: "user:alice",
    roleRef: "role:operator",
    scopeType: "workspace",
    scopeRef: "workspace",
    resourceRef: "risk:risk:test",
    action: "manage",
    effect: "allow",
    inheritance: "default",
  }] }));
  const acknowledged = await invokeServer(server, {
    method: "POST",
    url: "/risks/risk%3Atest/transition",
    headers,
    body: { status: "acknowledged", correlationId: "corr-risk-ack-http" },
  });
  assert.equal(acknowledged.status, 200, acknowledged.body);
  assert.equal(JSON.parse(acknowledged.body).risk.status, "acknowledged");
  const resolved = await invokeServer(server, {
    method: "POST",
    url: "/risks/risk%3Atest/transition",
    headers,
    body: { status: "resolved", reason: "runtime restored", correlationId: "corr-risk-resolve-http" },
  });
  assert.equal(resolved.status, 200, resolved.body);
  assert.equal(JSON.parse(resolved.body).incident.status, "resolved");
  const transitionEvents = controlPlane.getWorkspaceEvents({ eventType: "risk.transitioned" }).events;
  assert.equal(transitionEvents.at(-1).policyDecisionRef.startsWith("policy-decision:"), true);
});

test("natural-language execution over core query is policy-gated before command execution", async () => {
  const { server, controlPlane } = fixture();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/query",
    headers: { authorization: "Bearer core-token-test-value", "x-axi-subject": "user:alice" },
    body: { text: "跑一下 sample-app 健康检查" },
  });
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.accepted, false);
  assert.equal(body.actions[0].status, "blocked");
  assert.match(body.blockedReason, /no_matching_grant/);
  const event = controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events[0];
  assert.deepEqual([event.actorRef, event.action, event.objectRef, event.result], ["user:alice", "execute", "sample-app", "deny"]);
});

test("REST noun aliases match legacy RPC control-plane action paths", async () => {
  const { server } = fixture();
  const headers = { authorization: "Bearer core-token-test-value" };
  const pairs = [
    ["/jobs/missing/cancel", "/jobs/missing/cancellations"],
    ["/agent-tasks/missing/cancel", "/agent-tasks/missing/cancellations"],
    ["/approvals/missing/decision", "/approvals/missing/decisions"],
    ["/commands/missing/run", "/commands/missing/runs"],
  ];
  for (const [rpcPath, restPath] of pairs) {
    const rpc = await invokeServer(server, { method: "POST", url: rpcPath, headers, body: {} });
    const rest = await invokeServer(server, { method: "POST", url: restPath, headers, body: {} });
    assert.equal(rest.status, rpc.status, `${restPath} status ${rest.status} != ${rpcPath} ${rpc.status}`);
    const semantic = (response) => {
      const body = JSON.parse(response.body);
      return {
        status: response.status,
        error: body.error,
        decision: body.policy?.decision?.decision,
        reason: body.policy?.decision?.reason,
        action: body.policy?.decision?.action,
        resourceRef: body.policy?.decision?.resourceRef,
      };
    };
    assert.deepEqual(semantic(rest), semantic(rpc), `${restPath} semantics drifted from ${rpcPath}`);
  }
});

test("internal gateway web route accepts /snapshot with its service identity", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/snapshot",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
  });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.ok(body.axiResources || body.resources, "snapshot shape");
});

test("internal gateway web snapshot still rejects missing service identity", async () => {
  const { server } = fixture();
  const r = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/snapshot",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
  });
  assert.equal(r.status, 401);
});

test("production Control Plane rejects the development gateway token but accepts an injected token", async () => {
  assert.equal(resolveGatewayInternalToken({ nodeEnv: "production" }), "");
  assert.equal(resolveGatewayInternalToken({ configuredToken: "axi-development-internal-token", nodeEnv: "production" }), "");
  assert.equal(resolveGatewayInternalToken({ configuredToken: "production-gateway-token", nodeEnv: "production" }), "production-gateway-token");

  const { controlPlane } = fixture();
  const productionServer = createControlPlaneHttpServer({
    controlPlane,
    nodeEnv: "production",
    gatewayInternalToken: "axi-development-internal-token",
    coreApiToken: "core-token-test-value",
    allowedOrigins: ["http://allowed-origin.test"],
  });
  const rejected = await invokeServer(productionServer, {
    method: "GET",
    url: "/internal/web/v1/snapshot",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
  });
  assert.equal(rejected.status, 401);

  const configuredServer = createControlPlaneHttpServer({
    controlPlane,
    nodeEnv: "production",
    gatewayInternalToken: "production-gateway-token",
    coreApiToken: "core-token-test-value",
    allowedOrigins: ["http://allowed-origin.test"],
  });
  const accepted = await invokeServer(configuredServer, {
    method: "GET",
    url: "/internal/web/v1/snapshot",
    headers: {
      "x-axi-internal-token": "production-gateway-token",
      "x-axi-subject": "owner-subject",
    },
  });
  assert.equal(accepted.status, 200);
});

test("communication gateway internal route carries a verified subject into the policy gate", async () => {
  const { server, controlPlane } = fixture();
  const r = await invokeServer(server, {
    method: "POST",
    url: "/internal/communication/v1/jobs",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "user:alice",
    },
    body: { projectId: "sample-app" },
  });
  assert.equal(r.status, 403);
  const body = JSON.parse(r.body);
  assert.equal(body.policy.decision.decision, "deny");
  const event = controlPlane.getWorkspaceEvents({ eventType: "policy_decision.evaluated" }).events[0];
  assert.deepEqual([event.actorRef, event.action, event.objectRef, event.result], ["user:alice", "execute", "sample-app", "deny"]);
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

test("authenticated web owner can mint a pairing approval token through the internal gateway route", async () => {
  const { server, controlPlane } = fixture();
  const { publicKeyHex } = freshKey();
  const start = controlPlane.pairing.startPair({ publicKeyHex, deviceName: "web-approval-test" });
  const r = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair-approval",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: { pairingId: start.pairingId, code: start.code },
  });
  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.equal(body.ownerApprovalToken, controlPlane.pairing.getOwnerApprovalToken(start.pairingId, start.code));
});

test("authenticated web owner can approve an Android pairing without receiving the owner approval secret", async () => {
  const { server, controlPlane } = fixture();
  const { publicKeyHex } = freshKey();
  const start = controlPlane.pairing.startPair({ publicKeyHex, deviceName: "android-lan" });
  const r = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair/approve",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: { code: start.code },
  });

  assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.body}`);
  const body = JSON.parse(r.body);
  assert.equal(body.ok, true);
  assert.equal(body.status, "approved");
  assert.equal("ownerApprovalToken" in body, false);
  assert.equal(
    controlPlane.pairing.pairingStatus({ pairingId: start.pairingId, code: start.code }).status,
    "approved",
  );
});

test("Web owner can create, observe, and confirm a QR pairing without exposing its scan bearer", async () => {
  const { server } = fixture();
  const authHeaders = {
    "x-axi-internal-token": "axi-development-internal-token",
    "x-axi-subject": "owner-subject",
  };
  const created = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair/qr",
    headers: authHeaders,
    body: {},
  });
  assert.equal(created.status, 200, created.body);
  const createdBody = JSON.parse(created.body);
  assert.match(createdBody.webPairingId, /^webpair_/);
  assert.match(createdBody.scanToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.equal(createdBody.gatewayUrl, "http://192.168.1.42:8088/api/v1/");

  const beforeScan = await invokeServer(server, {
    method: "GET",
    url: `/internal/web/v1/mobile/pair/qr/${createdBody.webPairingId}`,
    headers: authHeaders,
  });
  assert.equal(beforeScan.status, 200, beforeScan.body);
  const beforeScanBody = JSON.parse(beforeScan.body);
  assert.equal(beforeScanBody.status, "waiting_scan");
  assert.equal("scanToken" in beforeScanBody, false);
  assert.equal("gatewayUrl" in beforeScanBody, false);

  const foreignOwner = await invokeServer(server, {
    method: "GET",
    url: `/internal/web/v1/mobile/pair/qr/${createdBody.webPairingId}`,
    headers: { ...authHeaders, "x-axi-subject": "other-owner" },
  });
  assert.equal(foreignOwner.status, 404);
});

test("mobile QR Gateway hint prefers explicit advertisement and never advertises production discovery", () => {
  assert.equal(
    resolveMobileGatewayUrl({ explicit: "https://workbench.axiomaticworld.com/api/v1", environment: "production" }),
    "https://workbench.axiomaticworld.com/api/v1/",
  );
  assert.equal(resolveMobileGatewayUrl({ environment: "production", interfaces: {} }), "");
  assert.equal(
    resolveMobileGatewayUrl({
      environment: "development",
      gatewayPort: "8088",
      interfaces: {
        en0: [
          { address: "127.0.0.1", family: "IPv4", internal: true },
          { address: "192.168.1.42", family: "IPv4", internal: false },
        ],
      },
    }),
    "http://192.168.1.42:8088/api/v1/",
  );
  assert.equal(
    resolveMobileGatewayUrl({
      environment: "development",
      interfaces: { en0: [{ address: "8.8.8.8", family: "IPv4", internal: false }] },
    }),
    "",
  );
});

test("phone QR scan is gateway-only and requires the one-time scan bearer", async () => {
  const { server } = fixture();
  const created = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair/qr",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: {},
  });
  const createdBody = JSON.parse(created.body);
  const { publicKeyHex } = freshKey();

  const extraField = await invokeServer(server, {
    method: "POST",
    url: "/internal/mobile/v1/pair/qr/scan",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: {
      webPairingId: createdBody.webPairingId,
      scanToken: createdBody.scanToken,
      publicKeyHex,
      publicKeyAlgorithm: "Ed25519",
      deviceName: "phone",
      ownerSubject: "forged-owner",
    },
  });
  assert.equal(extraField.status, 400, "the phone scan request must not accept owner or browser fields");

  const missingGatewayIdentity = await invokeServer(server, {
    method: "POST",
    url: "/internal/mobile/v1/pair/qr/scan",
    body: {
      webPairingId: createdBody.webPairingId,
      scanToken: createdBody.scanToken,
      publicKeyHex,
      publicKeyAlgorithm: "Ed25519",
      deviceName: "phone",
    },
  });
  assert.equal(missingGatewayIdentity.status, 401);

  const scan = await invokeServer(server, {
    method: "POST",
    url: "/internal/mobile/v1/pair/qr/scan",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: {
      webPairingId: createdBody.webPairingId,
      scanToken: createdBody.scanToken,
      publicKeyHex,
      publicKeyAlgorithm: "Ed25519",
      deviceName: "phone",
    },
  });
  assert.equal(scan.status, 200, scan.body);
  const scanBody = JSON.parse(scan.body);
  assert.match(scanBody.pairingId, /^pair_/);
  assert.match(scanBody.code, /^\d{6}$/);

  const approved = await invokeServer(server, {
    method: "POST",
    url: `/internal/web/v1/mobile/pair/qr/${createdBody.webPairingId}/approve`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: {},
  });
  assert.equal(approved.status, 200, approved.body);
  assert.equal(JSON.parse(approved.body).status, "approved");
});

test("public pairing start cannot forge a Web owner binding", async () => {
  const { server } = fixture();
  const { publicKeyHex } = freshKey();
  const response = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/pair/start",
    body: {
      publicKeyHex,
      deviceName: "attacker-device",
      ownerSubject: "forged-owner",
    },
  });
  assert.equal(response.status, 400);
  assert.match(JSON.parse(response.body).error, /accepts only/i);
});

test("a previously owner-bound mobile bearer can approve one browser QR without exposing its identity to polling", async () => {
  const { server, controlPlane } = fixture();
  const { publicKeyHex, privateKey } = freshKey();
  const enrollment = controlPlane.pairing.startWebPairing({ ownerSubject: "owner-subject", ownerEmail: "owner@example.test" });
  const enrollmentScan = controlPlane.pairing.scanWebPairing({
    webPairingId: enrollment.webPairingId,
    scanToken: enrollment.scanToken,
    publicKeyHex,
    deviceName: "physical-android",
  });
  assert.equal(controlPlane.pairing.approveWebPairing({ webPairingId: enrollment.webPairingId, ownerSubject: "owner-subject" }).ok, true);
  const paired = controlPlane.pairing.pairingStatus({ pairingId: enrollmentScan.pairingId, code: enrollmentScan.code });
  const nonce = controlPlane.pairing.requestAuthNonce({ deviceId: paired.deviceId });
  const bearer = controlPlane.pairing.exchangeNonceForAccessToken({
    deviceId: paired.deviceId,
    nonceId: nonce.nonceId,
    nonce: nonce.nonce,
    signatureHex: signNonce(privateKey, nonce.nonce),
  });
  assert.equal(bearer.ok, true);

  const created = await invokeServer(server, {
    method: "POST",
    url: "/internal/gateway/v1/web-login/qr",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: {},
  });
  assert.equal(created.status, 200, created.body);
  const login = JSON.parse(created.body);
  assert.match(login.webLoginId, /^weblogin_/);
  assert.match(login.scanToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.match(login.pollToken, /^[A-Za-z0-9_-]{32,}$/);

  const before = await invokeServer(server, {
    method: "GET",
    url: `/internal/gateway/v1/web-login/qr/${login.webLoginId}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-qr-poll-token": login.pollToken,
    },
  });
  assert.equal(before.status, 200, before.body);
  const beforeBody = JSON.parse(before.body);
  assert.equal(beforeBody.status, "waiting_scan");
  assert.equal("ownerSubject" in beforeBody, false);

  const directMobile = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/web-login/qr/scan",
    headers: { authorization: `Bearer ${bearer.accessToken}` },
    body: { webLoginId: login.webLoginId, scanToken: login.scanToken },
  });
  assert.equal(directMobile.status, 401, "the device bearer must still traverse API Gateway");

  const approved = await invokeServer(server, {
    method: "POST",
    url: "/internal/mobile/v1/web-login/qr/scan",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      authorization: `Bearer ${bearer.accessToken}`,
    },
    body: { webLoginId: login.webLoginId, scanToken: login.scanToken },
  });
  assert.equal(approved.status, 200, approved.body);
  assert.equal(JSON.parse(approved.body).status, "approved");

  const after = await invokeServer(server, {
    method: "GET",
    url: `/internal/gateway/v1/web-login/qr/${login.webLoginId}`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-qr-poll-token": login.pollToken,
    },
  });
  assert.deepEqual(JSON.parse(after.body), { ok: true, status: "approved", expiresAt: login.expiresAt });

  const consumed = await invokeServer(server, {
    method: "POST",
    url: `/internal/gateway/v1/web-login/qr/${login.webLoginId}/consume`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-qr-poll-token": login.pollToken,
    },
    body: {},
  });
  assert.equal(consumed.status, 200, consumed.body);
  assert.deepEqual(JSON.parse(consumed.body), {
    ok: true,
    status: "approved",
    ownerSubject: "owner-subject",
    ownerEmail: "owner@example.test",
    deviceName: "physical-android",
  });
  const replay = await invokeServer(server, {
    method: "POST",
    url: `/internal/gateway/v1/web-login/qr/${login.webLoginId}/consume`,
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-qr-poll-token": login.pollToken,
    },
    body: {},
  });
  assert.equal(replay.status, 400);
});

test("phone can poll only its own pairing transaction until Web approval exposes a device id", async () => {
  const { server, controlPlane } = fixture();
  const { publicKeyHex } = freshKey();
  const start = controlPlane.pairing.startPair({ publicKeyHex, deviceName: "lan-polling-phone" });

  const pending = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/pair/status",
    body: { pairingId: start.pairingId, code: start.code },
  });
  assert.equal(pending.status, 200, `expected pending 200, got ${pending.status}: ${pending.body}`);
  assert.deepEqual(JSON.parse(pending.body).status, "pending");
  assert.equal("deviceId" in JSON.parse(pending.body), false, "pending response must not disclose a device id");

  const approve = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair/approve",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: { code: start.code },
  });
  assert.equal(approve.status, 200, `expected approval 200, got ${approve.status}: ${approve.body}`);

  const approved = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/pair/status",
    body: { pairingId: start.pairingId, code: start.code },
  });
  assert.equal(approved.status, 200, `expected approved 200, got ${approved.status}: ${approved.body}`);
  const approvedBody = JSON.parse(approved.body);
  assert.equal(approvedBody.status, "approved");
  assert.match(approvedBody.deviceId, /^dev_/);

  const wrongCode = await invokeServer(server, {
    method: "POST",
    url: "/mobile/v1/pair/status",
    body: { pairingId: start.pairingId, code: "000000" },
  });
  assert.equal(wrongCode.status, 400, `wrong code must fail closed, got ${wrongCode.status}: ${wrongCode.body}`);
});

test("native pairing approval route rejects spoofed or malformed owner requests", async () => {
  const { server } = fixture();
  const missingSubject = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair/approve",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: { code: "123456" },
  });
  assert.equal(missingSubject.status, 401);

  const malformed = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair/approve",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: { code: "not-a-code" },
  });
  assert.equal(malformed.status, 400);
});

test("pairing approval route rejects spoofed or incomplete internal requests", async () => {
  const { server } = fixture();
  const missingSubject = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair-approval",
    headers: { "x-axi-internal-token": "axi-development-internal-token" },
    body: { pairingId: "pair_x", code: "123456" },
  });
  assert.equal(missingSubject.status, 401);
  const incomplete = await invokeServer(server, {
    method: "POST",
    url: "/internal/web/v1/mobile/pair-approval",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
    body: { pairingId: "pair_x" },
  });
  assert.equal(incomplete.status, 400);
});

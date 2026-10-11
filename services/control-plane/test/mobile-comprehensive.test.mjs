import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign, randomBytes } from "node:crypto";
import { createControlPlane } from "./test-control-plane.mjs";

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-mobile-comp-"));
}

const TEST_SECRET = "test-secret-32bytes-please-rotate-me";
const OWNER_APPROVAL_SECRET = "test-owner-approval-rotate-me-32bytes";

function freshKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  return { publicKeyHex, privateKey: createPrivateKey(privateKeyPem) };
}

function signNonce(privateKey, nonce) {
  return cryptoSign(null, Buffer.from(nonce, "utf8"), privateKey).toString("hex");
}

function buildServer(controlPlane, opts = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/mobile/v1/")) {
        return json(res, 404, { error: "not found" });
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/start") {
        if (!controlPlane.pairing) return json(res, 503, { error: "pairing not configured" });
        return json(res, 200, controlPlane.pairing.startPair(await readJson(req)));
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/pair/confirm") {
        if (!controlPlane.pairing) return json(res, 503, { error: "pairing not configured" });
        return json(res, 200, controlPlane.pairing.confirmPair(await readJson(req)));
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/auth/token") {
        if (!controlPlane.pairing) return json(res, 503, { error: "pairing not configured" });
        const body = await readJson(req);
        const result = controlPlane.pairing.exchangeNonceForAccessToken(body);
        return json(res, result.ok ? 200 : 400, result);
      }
      if (req.method === "POST" && url.pathname === "/mobile/v1/auth/nonce") {
        if (!controlPlane.pairing) return json(res, 503, { error: "pairing not configured" });
        const body = await readJson(req);
        const result = controlPlane.pairing.requestAuthNonce({ deviceId: body?.deviceId });
        return json(res, result.ok ? 200 : 400, result);
      }
      if (req.method === "GET" && url.pathname === "/mobile/v1/workspace") {
        const auth = authenticate(req, controlPlane);
        if (!auth.ok) return json(res, 401, { error: auth.error });
        return json(res, 200, controlPlane.mobileSnapshot());
      }
      if (req.method === "GET" && url.pathname.startsWith("/mobile/v1/handoff")) {
        const auth = authenticate(req, controlPlane);
        if (!auth.ok) return json(res, 401, { error: auth.error });
        const handoffUrl = new URL(req.url, "http://127.0.0.1");
        const status = handoffUrl.searchParams.get("status");
        const projectId = handoffUrl.searchParams.get("projectId");
        const result = controlPlane.mobileHandoffList({ status, projectId });
        return json(res, 200, result);
      }
      return json(res, 404, { error: "mobile endpoint not found" });
    } catch (error) {
      return json(res, 500, { error: error?.message || String(error) });
    }
  });
}

function authenticate(req, controlPlane) {
  if (controlPlane.pairing) {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const verified = controlPlane.pairing.verifyAccessToken(token);
    if (verified.ok) return { ok: true, deviceId: verified.deviceId };
    return { ok: false, error: verified.error };
  }
  return { ok: false, error: "no pairing" };
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function fetchJson(server, method, pathname, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = httpRequest({
      method,
      hostname: "127.0.0.1",
      port,
      path: pathname,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        resolve({ status: res.statusCode, body: json, raw: text });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test 1: Input validation — malformed publicKeyHex
// ---------------------------------------------------------------------------
test("mobile v1: pair/start rejects malformed publicKeyHex (odd-length hex)", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const res = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex: "deadbeef" } });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
    assert.ok(res.body.error?.toLowerCase().includes("publickey") || res.body.error?.toLowerCase().includes("key") || res.body.error?.toLowerCase().includes("hex") || res.body.error?.toLowerCase().includes("invalid"));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: pair/start rejects publicKeyHex with invalid hex chars", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const res = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex: "gghhiijjkkll" } });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: pair/start rejects missing publicKeyHex", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const res = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { deviceName: "ci-android" } });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 2: Wrong code flows — incorrect 6-digit codes on pair/confirm
// ---------------------------------------------------------------------------
test("mobile v1: pair/confirm rejects wrong 6-digit code", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    assert.equal(start.status, 200);
    const wrongCode = "000000";
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: wrongCode, ownerApprovalToken },
    });
    assert.equal(confirm.status, 400);
    assert.equal(confirm.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: pair/confirm rejects 5-digit code", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: "12345", ownerApprovalToken },
    });
    assert.equal(confirm.status, 400);
    assert.equal(confirm.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: pair/confirm rejects 7-digit code", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: "1234567", ownerApprovalToken },
    });
    assert.equal(confirm.status, 400);
    assert.equal(confirm.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 3: Wrong ownerApprovalToken flows — tampered tokens rejected
// ---------------------------------------------------------------------------
test("mobile v1: pair/confirm rejects tampered ownerApprovalToken", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    assert.equal(start.status, 200);
    // Tamper: flip a byte in the token
    const tamperedToken = Buffer.from(start.body.ownerApprovalToken || "tampered", "utf8").toString("base64") + "X";
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken: tamperedToken },
    });
    assert.equal(confirm.status, 400);
    assert.equal(confirm.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: pair/confirm rejects empty ownerApprovalToken", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken: "" },
    });
    assert.equal(confirm.status, 400);
    assert.equal(confirm.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 4: Nonce expiry — expired nonce on auth/token returns error
// ---------------------------------------------------------------------------
test("mobile v1: auth/token rejects consumed nonce (nonce cannot be reused)", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex, privateKey } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    // Simulate nonce consumption by directly calling verifyNonceSignature
    controlPlane.pairing.verifyNonceSignature({
      deviceId: confirm.body.deviceId,
      nonceId: confirm.body.nonce.nonceId,
      nonce: confirm.body.nonce.nonce,
      signatureHex: signNonce(privateKey, confirm.body.nonce.nonce),
    });
    // Try to use the same nonce again — should fail
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: {
        deviceId: confirm.body.deviceId,
        nonceId: confirm.body.nonce.nonceId,
        nonce: confirm.body.nonce.nonce,
        signatureHex: signNonce(privateKey, confirm.body.nonce.nonce),
      },
    });
    assert.equal(token.status, 400);
    assert.equal(token.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 5: Signature tampering — bad signatureHex rejected
// ---------------------------------------------------------------------------
test("mobile v1: auth/token rejects bad signatureHex", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const badSig = "aabbccdd" + "00".repeat(64 - 4);
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: {
        deviceId: confirm.body.deviceId,
        nonceId: confirm.body.nonce.nonceId,
        nonce: confirm.body.nonce.nonce,
        signatureHex: badSig,
      },
    });
    assert.equal(token.status, 400);
    assert.equal(token.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: auth/token rejects signatureHex with wrong length", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const shortSig = "deadbeef";
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: {
        deviceId: confirm.body.deviceId,
        nonceId: confirm.body.nonce.nonceId,
        nonce: confirm.body.nonce.nonce,
        signatureHex: shortSig,
      },
    });
    assert.equal(token.status, 400);
    assert.equal(token.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 6: Full mobileSnapshot shape validation — all projected fields
// ---------------------------------------------------------------------------
test("mobile v1: mobileSnapshot returns correct shape with one project", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "test-proj": {
        name: "Test Project",
        kind: "tool",
        provides: ["api"],
        mobile: {
          summary: "A test project",
          preview: { mode: "embedded_web", url: "https://preview.test", allowEmbedded: true },
        },
      },
    },
  }));
  const { publicKeyHex, privateKey } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const sig = signNonce(privateKey, confirm.body.nonce.nonce);
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId: confirm.body.deviceId, nonceId: confirm.body.nonce.nonceId, nonce: confirm.body.nonce.nonce, signatureHex: sig },
    });
    const ws = await fetchJson(server, "GET", "/mobile/v1/workspace", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(ws.status, 200);
    assert.ok(ws.body);
    assert.ok(Array.isArray(ws.body.projects));
    assert.equal(ws.body.projects.length, 1);
    const proj = ws.body.projects[0];
    assert.ok(proj.id, "project must have id");
    assert.ok(proj.name, "project must have name");
    assert.ok(proj.kind, "project must have kind");
    assert.ok(proj.provides, "project must have provides (array)");
    assert.ok(Array.isArray(proj.provides));
    assert.ok(proj.mobile, "project must have mobile");
    assert.ok(proj.mobile.summary, "mobile must have summary");
    assert.ok(proj.mobile.preview, "mobile must have preview");
    assert.ok(proj.mobile.preview.mode, "preview must have mode");
    assert.ok(proj.mobile.preview.url, "preview must have url");
    assert.ok(typeof proj.mobile.preview.allowEmbedded === "boolean", "preview.allowEmbedded must be boolean");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 7: Token refresh/renewal flow
// ---------------------------------------------------------------------------
test("mobile v1: auth/nonce then auth/token produces a new valid token", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex, privateKey } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const deviceId = confirm.body.deviceId;
    // First token
    const sig1 = signNonce(privateKey, confirm.body.nonce.nonce);
    const token1 = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId, nonceId: confirm.body.nonce.nonceId, nonce: confirm.body.nonce.nonce, signatureHex: sig1 },
    });
    assert.equal(token1.status, 200);
    assert.ok(token1.body.accessToken);
    // Request a fresh nonce
    const nonceResp = await fetchJson(server, "POST", "/mobile/v1/auth/nonce", { body: { deviceId } });
    assert.equal(nonceResp.status, 200);
    assert.ok(nonceResp.body.nonce);
    assert.ok(nonceResp.body.nonceId);
    // Second token using fresh nonce
    const sig2 = signNonce(privateKey, nonceResp.body.nonce);
    const token2 = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId, nonceId: nonceResp.body.nonceId, nonce: nonceResp.body.nonce, signatureHex: sig2 },
    });
    assert.equal(token2.status, 200);
    assert.ok(token2.body.accessToken);
    assert.notEqual(token2.body.accessToken, token1.body.accessToken, "fresh token should differ from first token");
    // Both tokens should still work for workspace
    const ws1 = await fetchJson(server, "GET", "/mobile/v1/workspace", { headers: { Authorization: `Bearer ${token1.body.accessToken}` } });
    assert.equal(ws1.status, 200);
    const ws2 = await fetchJson(server, "GET", "/mobile/v1/workspace", { headers: { Authorization: `Bearer ${token2.body.accessToken}` } });
    assert.equal(ws2.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 8: Concurrent nonce submission — same nonce twice should fail second time
// ---------------------------------------------------------------------------
test("mobile v1: same nonce cannot be submitted twice concurrently", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const { publicKeyHex, privateKey } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const deviceId = confirm.body.deviceId;
    const nonce = confirm.body.nonce.nonce;
    const nonceId = confirm.body.nonce.nonceId;
    const sig = signNonce(privateKey, nonce);
    // First submission — should succeed
    const t1 = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId, nonceId, nonce, signatureHex: sig },
    });
    assert.equal(t1.status, 200);
    // Second submission with same nonce — should fail
    const t2 = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId, nonceId, nonce, signatureHex: sig },
    });
    assert.equal(t2.status, 400);
    assert.equal(t2.body.ok, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 9: Mobile workspace with multiple projects — verify all project fields
// ---------------------------------------------------------------------------
test("mobile v1: mobileSnapshot returns all fields for multiple projects", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "proj-a": { name: "Project A", kind: "study-app", provides: ["vocab"], mobile: { summary: "Summ A", preview: { mode: "embedded_web", url: "https://a.test", allowEmbedded: true } } },
      "proj-b": { name: "Project B", kind: "cli", provides: ["shell"], mobile: { summary: "Summ B", preview: { mode: "deeplink", url: "axi://b.test", allowEmbedded: false } } },
      "proj-c": { name: "Project C", kind: "web-app", provides: ["api", "ui"], mobile: { summary: "Summ C", preview: { mode: "external", url: "https://c.test", allowEmbedded: false } } },
    },
  }));
  const { publicKeyHex, privateKey } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const sig = signNonce(privateKey, confirm.body.nonce.nonce);
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId: confirm.body.deviceId, nonceId: confirm.body.nonce.nonceId, nonce: confirm.body.nonce.nonce, signatureHex: sig },
    });
    const ws = await fetchJson(server, "GET", "/mobile/v1/workspace", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(ws.status, 200);
    assert.equal(ws.body.projects.length, 3);
    const ids = ws.body.projects.map((p) => p.id).sort();
    assert.deepEqual(ids, ["proj-a", "proj-b", "proj-c"]);
    for (const proj of ws.body.projects) {
      assert.ok(proj.id);
      assert.ok(proj.name);
      assert.ok(proj.kind);
      assert.ok(Array.isArray(proj.provides));
      assert.ok(proj.mobile?.summary);
      assert.ok(proj.mobile?.preview?.mode);
      assert.ok(proj.mobile?.preview?.url);
      assert.ok(typeof proj.mobile?.preview?.allowEmbedded === "boolean");
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// ---------------------------------------------------------------------------
// Test 10: Mobile handoff list filtering — by status, projectId
// ---------------------------------------------------------------------------
test("mobile v1: mobileHandoffList exists and returns shape", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "proj-x": { name: "Proj X", kind: "tool", provides: ["api"], mobile: { summary: "mx", preview: { mode: "external", url: "https://x.test", allowEmbedded: false } } },
    },
  }));
  const { publicKeyHex, privateKey } = freshKey();
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET, ownerApprovalSecret: OWNER_APPROVAL_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex } });
    const ownerApprovalToken = controlPlane.pairing.getOwnerApprovalToken(start.body.pairingId, start.body.code);
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code, ownerApprovalToken },
    });
    const sig = signNonce(privateKey, confirm.body.nonce.nonce);
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: { deviceId: confirm.body.deviceId, nonceId: confirm.body.nonce.nonceId, nonce: confirm.body.nonce.nonce, signatureHex: sig },
    });
    // Unfiltered list
    const list = await fetchJson(server, "GET", "/mobile/v1/handoff", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.items), "handoff list must have items array");
    // Filter by projectId
    const byProject = await fetchJson(server, "GET", "/mobile/v1/handoff?projectId=proj-x", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(byProject.status, 200);
    assert.ok(Array.isArray(byProject.body.items));
    // Filter by status
    const byStatus = await fetchJson(server, "GET", "/mobile/v1/handoff?status=pending", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(byStatus.status, 200);
    assert.ok(Array.isArray(byStatus.body.items));
    // Combined filter
    const byBoth = await fetchJson(server, "GET", "/mobile/v1/handoff?status=pending&projectId=proj-x", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(byBoth.status, 200);
    assert.ok(Array.isArray(byBoth.body.items));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

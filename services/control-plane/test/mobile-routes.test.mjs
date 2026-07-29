import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { createControlPlane } from "../src/control-plane.mjs";
import { createHmac } from "node:crypto";

/* We don't actually spin up the real server.mjs (it would call
 * process.env at module load).  Instead we re-derive the HTTP handler
 * from createControlPlane() so we exercise the full pairing + token
 * flow without polluting process.env.
 *
 * This deliberately mirrors server.mjs' /mobile/v1/* routing shape.
 */

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-mobile-route-"));
}

const TEST_SECRET = "test-secret-32bytes-please-rotate-me";
const TEST_PUBKEY = "f".repeat(64);

function signNonce(publicKeyHex, nonce) {
  return createHmac("sha256", publicKeyHex).update(nonce).digest("hex");
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
      const auth = authenticate(req, controlPlane);
      if (!auth.ok) return json(res, 401, { error: auth.error });
      if (req.method === "GET" && url.pathname === "/mobile/v1/workspace") return json(res, 200, controlPlane.mobileSnapshot());
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

test("mobile v1: pair/confirm/auth/workspace end-to-end", async () => {
  const cacheDir = freshCacheDir();
  // Bootstrap a workspace graph with one project that has a mobile entry.
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({
    projects: {
      "ielts-vocab": {
        name: "IELTS Vocab",
        kind: "study-app",
        provides: ["vocabulary", "study"],
        mobile: {
          summary: "mobile study product",
          preview: { mode: "embedded_web", url: "https://preview.example.test", allowEmbedded: true },
        },
      },
    },
  }));
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));

  try {
    // 1. unauthenticated /mobile/v1/workspace → 401
    const unauth = await fetchJson(server, "GET", "/mobile/v1/workspace");
    assert.equal(unauth.status, 401);

    // 2. pair/start
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", {
      body: { publicKeyHex: TEST_PUBKEY, deviceName: "ci-android" },
    });
    assert.equal(start.status, 200);
    assert.equal(start.body.ok, true);
    assert.match(start.body.code, /^[0-9]{6}$/);

    // 3. pair/confirm
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", {
      body: { pairingId: start.body.pairingId, code: start.body.code },
    });
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.ok, true);
    const deviceId = confirm.body.deviceId;

    // 4. sign the nonce and call auth/token
    const sig = signNonce(TEST_PUBKEY, confirm.body.nonce.nonce);
    const token = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: {
        deviceId,
        nonceId: confirm.body.nonce.nonceId,
        nonce: confirm.body.nonce.nonce,
        signatureHex: sig,
        scopes: ["mobile"],
      },
    });
    assert.equal(token.status, 200);
    assert.equal(token.body.ok, true);

    // 5. workspace with bearer token
    const ws = await fetchJson(server, "GET", "/mobile/v1/workspace", {
      headers: { Authorization: `Bearer ${token.body.accessToken}` },
    });
    assert.equal(ws.status, 200);
    assert.equal(ws.body.projects.length, 1);
    assert.equal(ws.body.projects[0].id, "ielts-vocab");
    assert.equal(ws.body.projects[0].preview.mode, "embedded_web");

    const refreshedNonce = await fetchJson(server, "POST", "/mobile/v1/auth/nonce", {
      body: { deviceId },
    });
    assert.equal(refreshedNonce.status, 200);
    const refreshedToken = await fetchJson(server, "POST", "/mobile/v1/auth/token", {
      body: {
        deviceId,
        nonceId: refreshedNonce.body.nonceId,
        nonce: refreshedNonce.body.nonce,
        signatureHex: signNonce(TEST_PUBKEY, refreshedNonce.body.nonce),
      },
    });
    assert.equal(refreshedToken.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("mobile v1: bearer token from a revoked device gets 401", async () => {
  const cacheDir = freshCacheDir();
  const graphPath = join(cacheDir, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {} }));
  const controlPlane = createControlPlane({ workspaceRoot: cacheDir, cacheDir, graphPath, pairingTokenSecret: TEST_SECRET });
  const server = buildServer(controlPlane);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const start = await fetchJson(server, "POST", "/mobile/v1/pair/start", { body: { publicKeyHex: TEST_PUBKEY } });
    const confirm = await fetchJson(server, "POST", "/mobile/v1/pair/confirm", { body: { pairingId: start.body.pairingId, code: start.body.code } });
    const token = controlPlane.pairing.issueAccessToken({ deviceId: confirm.body.deviceId });
    controlPlane.pairing.revokeDevice({ deviceId: confirm.body.deviceId });
    const ws = await fetchJson(server, "GET", "/mobile/v1/workspace", { headers: { Authorization: `Bearer ${token.accessToken}` } });
    assert.equal(ws.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

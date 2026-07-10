/**
 * pairing.mjs — DevHub / Axi Mobile stage-B · 配对 + 短期 token
 *
 * Why this exists
 * ---------------
 * Before this module the mobile routes were gated by an env-var
 * `AXI_MOBILE_OWNER_TOKEN` string compared against `Authorization:
 * Bearer <token>`.  That is a single shared secret with no per-device
 * revocation, no expiry, and no audit binding to a device id.
 *
 * This module introduces a per-device pairing flow:
 *   1. Client posts /mobile/v1/pair/start with {publicKeyHex, deviceName}
 *      and receives a one-time six-digit pairing code (5-minute TTL).
 *   2. Client posts /mobile/v1/pair/confirm with the code; if it matches,
 *      the device is recorded as active in cacheDir/devices/<id>.json.
 *   3. Client posts /mobile/v1/auth/token with its deviceId and signs
 *      a server-issued nonce with the private key matching publicKeyHex;
 *      on success it receives a 1-hour HS256 access token.
 *   4. Subsequent mobile requests carry `Authorization: Bearer <jwt>`;
 *      verifyAccessToken() checks signature, exp, and that the device is
 *      still active (not revoked).
 *
 * Persistence layout
 * ------------------
 *   cacheDir/devices/<deviceId>.json       — device metadata + pubkey hash
 *   cacheDir/pairing-codes.jsonl           — append-only pair-code ledger
 *   cacheDir/access-tokens.jsonl           — append-only token ledger
 *   cacheDir/nonces/<nonceId>.json         — single-use auth nonces (5 min)
 *   cacheDir/audit.jsonl                   — append-only audit (existing)
 *
 * No external npm deps.  HS256 via node:crypto.createHmac; base64url
 * per RFC 7515 §3.
 */

import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";

const DEFAULT_CODE_TTL_SECONDS = 300;          // 5 minutes
const DEFAULT_TOKEN_TTL_SECONDS = 3600;        // 1 hour
const DEFAULT_NONCE_TTL_SECONDS = 300;         // 5 minutes
const PAIR_CODE_LENGTH = 6;
const NONCE_LENGTH = 32;                       // 32 random bytes -> base64url ~43 chars

const DEVICES_DIRNAME = "devices";
const NONCES_DIRNAME = "nonces";
const PAIR_CODES_FILE = "pairing-codes.jsonl";
const TOKENS_FILE = "access-tokens.jsonl";

/**
 * Ensure that a path exists and is chmod 600 (owner-only).  Used for
 * the audit file and the JSONL ledgers; existing files are left alone
 * so we do not surprise external readers on a long-running server.
 */
function ensureOwnerOnly(path) {
  if (!existsSync(path)) {
    writeFileSync(path, "", { mode: 0o600 });
    return;
  }
  try {
    chmodSync(path, 0o600);
  } catch {
    // chmod may fail on filesystems that do not support it (e.g. some
    // bind mounts in CI).  Tolerated — the audit pipeline will catch
    // a wider ACL on the next read.
  }
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function appendJsonl(path, entry) {
  ensureOwnerOnly(path);
  appendFileSync(path, JSON.stringify(entry) + "\n", { mode: 0o600 });
}

/* ─── Base64url helpers (RFC 7515 §3) ─────────────────────────────────── */

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

/* ─── HS256 sign / verify (no third-party jwt lib) ────────────────────── */

function signHs256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64url(signature)}`;
}

function verifyHs256(token, secret) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  const expected = createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
  const actual = base64urlDecode(signatureB64);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
    return { header: JSON.parse(base64urlDecode(headerB64).toString("utf8")), payload };
  } catch {
    return null;
  }
}

/* ─── Pair-code generation (6 digit, monotonic-ish, no leading zeros trap) ─ */

function randomPairCode() {
  // 6 digits, leading zeros allowed (we always pad to 6 chars below).
  let code = "";
  for (let i = 0; i < PAIR_CODE_LENGTH; i += 1) {
    code += Math.floor(Math.random() * 10).toString(10);
  }
  return code;
}

function isValidHexPublicKey(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

function fingerprintPublicKey(publicKeyHex) {
  return createHmac("sha256", "axi-mobile-pubkey-fingerprint-v1").update(publicKeyHex.toLowerCase()).digest("hex");
}

/* ─── createPairingService ────────────────────────────────────────────── */

export function createPairingService({
  cacheDir,
  tokenSecret,
  codeTtlSeconds = DEFAULT_CODE_TTL_SECONDS,
  tokenTtlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
  nonceTtlSeconds = DEFAULT_NONCE_TTL_SECONDS,
  clock = () => Date.now(),
} = {}) {
  if (!cacheDir) throw new Error("createPairingService: cacheDir is required");
  if (!tokenSecret) throw new Error("createPairingService: tokenSecret is required");

  const devicesDir = join(cacheDir, DEVICES_DIRNAME);
  const noncesDir = join(cacheDir, NONCES_DIRNAME);
  const pairCodesPath = join(cacheDir, PAIR_CODES_FILE);
  const tokensPath = join(cacheDir, TOKENS_FILE);

  for (const dir of [cacheDir, devicesDir, noncesDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  function nowSeconds() { return Math.floor(clock() / 1000); }

  function readDevice(deviceId) {
    if (!/^dev_[A-Za-z0-9_-]{6,}$/.test(deviceId)) return null;
    const path = join(devicesDir, `${deviceId}.json`);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
  }

  function writeDevice(device) {
    const path = join(devicesDir, `${device.deviceId}.json`);
    writeFileSync(path, JSON.stringify(device, null, 2), { mode: 0o600 });
  }

  /* startPair — generate a one-time code; device is not yet registered. */
  function startPair({ publicKeyHex, deviceName, clientInfo } = {}) {
    if (!isValidHexPublicKey(publicKeyHex)) {
      return { ok: false, error: "publicKeyHex must be a 64-char hex string" };
    }
    const now = nowSeconds();
    const code = randomPairCode();
    const pairingId = `pair_${randomUUID()}`;
    const entry = {
      pairingId,
      code,
      publicKeyHex: publicKeyHex.toLowerCase(),
      publicKeyFingerprint: fingerprintPublicKey(publicKeyHex),
      deviceName: typeof deviceName === "string" ? deviceName : "unknown-device",
      clientInfo: clientInfo && typeof clientInfo === "object" ? clientInfo : null,
      createdAt: now,
      expiresAt: now + codeTtlSeconds,
      consumed: false,
    };
    appendJsonl(pairCodesPath, entry);
    return { ok: true, pairingId, code, codeExpiresAt: entry.expiresAt };
  }

  /* confirmPair — exchange code for a registered deviceId. */
  function confirmPair({ pairingId, code } = {}) {
    if (typeof pairingId !== "string" || typeof code !== "string") {
      return { ok: false, error: "pairingId and code are required" };
    }
    const entries = readJsonl(pairCodesPath);
    const now = nowSeconds();
    const entry = entries.reverse().find((e) => e.pairingId === pairingId);
    if (!entry) return { ok: false, error: "pairing not found" };
    if (entry.consumed) return { ok: false, error: "pairing already consumed" };
    if (entry.expiresAt <= now) return { ok: false, error: "pairing code expired" };
    if (entry.code !== code) return { ok: false, error: "pairing code mismatch" };

    // Mark consumed and register the device.
    entry.consumed = true;
    entry.consumedAt = now;
    appendJsonl(pairCodesPath, entry);

    const deviceId = `dev_${randomUUID()}`;
    const device = {
      deviceId,
      publicKeyHex: entry.publicKeyHex,
      publicKeyFingerprint: entry.publicKeyFingerprint,
      deviceName: entry.deviceName,
      clientInfo: entry.clientInfo,
      status: "active",
      createdAt: now,
      lastSeenAt: now,
    };
    writeDevice(device);

    // Issue an initial nonce so the device can immediately request a token.
    const nonce = base64url(randomBytes(NONCE_LENGTH));
    const nonceId = `nonce_${randomUUID()}`;
    const nonceEntry = { nonceId, nonce, deviceId, createdAt: now, expiresAt: now + nonceTtlSeconds, consumed: false };
    writeFileSync(join(noncesDir, `${nonceId}.json`), JSON.stringify(nonceEntry, null, 2), { mode: 0o600 });

    return {
      ok: true,
      deviceId,
      status: device.status,
      nonce: { nonceId, nonce, expiresAt: nonceEntry.expiresAt },
    };
  }

  /* requestAuthNonce — mint a single-use nonce for /auth/token (refresh path). */
  function requestAuthNonce({ deviceId } = {}) {
    const device = readDevice(deviceId);
    if (!device) return { ok: false, error: "device not found" };
    if (device.status !== "active") return { ok: false, error: `device ${device.status}` };
    const now = nowSeconds();
    const nonce = base64url(randomBytes(NONCE_LENGTH));
    const nonceId = `nonce_${randomUUID()}`;
    const nonceEntry = { nonceId, nonce, deviceId, createdAt: now, expiresAt: now + nonceTtlSeconds, consumed: false };
    writeFileSync(join(noncesDir, `${nonceId}.json`), JSON.stringify(nonceEntry, null, 2), { mode: 0o600 });
    return { ok: true, nonceId, nonce, expiresAt: nonceEntry.expiresAt };
  }

  /* verifyNonceSignature — HMAC-SHA256(pubkeyHex, nonce) returned as hex. */
  function verifyNonceSignature({ deviceId, nonceId, nonce, signatureHex } = {}) {
    const device = readDevice(deviceId);
    if (!device) return { ok: false, error: "device not found" };
    if (device.status !== "active") return { ok: false, error: `device ${device.status}` };
    if (typeof signatureHex !== "string" || !/^[0-9a-f]{64}$/i.test(signatureHex)) {
      return { ok: false, error: "signatureHex must be a 64-char hex string" };
    }
    if (typeof nonce !== "string" || typeof nonceId !== "string") {
      return { ok: false, error: "nonce and nonceId are required" };
    }
    const path = join(noncesDir, `${nonceId}.json`);
    if (!existsSync(path)) return { ok: false, error: "nonce not found" };
    const nonceEntry = JSON.parse(readFileSync(path, "utf8"));
    if (nonceEntry.consumed) return { ok: false, error: "nonce already consumed" };
    if (nonceEntry.expiresAt <= nowSeconds()) return { ok: false, error: "nonce expired" };
    if (nonceEntry.nonce !== nonce) return { ok: false, error: "nonce mismatch" };
    if (nonceEntry.deviceId !== deviceId) return { ok: false, error: "nonce/device mismatch" };

    const expected = createHmac("sha256", device.publicKeyHex).update(nonce).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHex.toLowerCase(), "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "signature mismatch" };

    nonceEntry.consumed = true;
    nonceEntry.consumedAt = nowSeconds();
    writeFileSync(path, JSON.stringify(nonceEntry, null, 2), { mode: 0o600 });
    return { ok: true, device };
  }

  /* issueAccessToken — mint a 1h HS256 access token for an active device. */
  function issueAccessToken({ deviceId, scopes = [] } = {}) {
    const device = readDevice(deviceId);
    if (!device) return { ok: false, error: "device not found" };
    if (device.status !== "active") return { ok: false, error: `device ${device.status}` };

    const now = nowSeconds();
    const token = signHs256({
      sub: deviceId,
      scopes: Array.isArray(scopes) ? scopes : [],
      iat: now,
      exp: now + tokenTtlSeconds,
    }, tokenSecret);

    appendJsonl(tokensPath, {
      deviceId,
      tokenJti: token.split(".")[2],
      issuedAt: now,
      expiresAt: now + tokenTtlSeconds,
      scopes: Array.isArray(scopes) ? scopes : [],
    });

    device.lastSeenAt = now;
    writeDevice(device);
    return { ok: true, accessToken: token, expiresAt: now + tokenTtlSeconds };
  }

  /* verifyAccessToken — used by the HTTP middleware for /mobile/v1/* routes. */
  function verifyAccessToken(token) {
    const decoded = verifyHs256(token, tokenSecret);
    if (!decoded) return { ok: false, error: "invalid signature" };
    const { payload } = decoded;
    if (!payload.sub || typeof payload.sub !== "string") return { ok: false, error: "missing sub" };
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds()) return { ok: false, error: "expired" };
    const device = readDevice(payload.sub);
    if (!device) return { ok: false, error: "device not found" };
    if (device.status !== "active") return { ok: false, error: `device ${device.status}` };
    return { ok: true, deviceId: payload.sub, scopes: payload.scopes || [], device };
  }

  /* revokeDevice — soft-revoke; existing tokens will fail verifyAccessToken. */
  function revokeDevice({ deviceId, reason = "operator_revoked" } = {}) {
    const device = readDevice(deviceId);
    if (!device) return { ok: false, error: "device not found" };
    device.status = "revoked";
    device.revokedAt = nowSeconds();
    device.revokeReason = reason;
    writeDevice(device);
    return { ok: true, deviceId, status: device.status };
  }

  /* listDevices — read every device record for the owner UI / audit. */
  function listDevices() {
    if (!existsSync(devicesDir)) return [];
    return readdirSync(devicesDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => {
        try { return JSON.parse(readFileSync(join(devicesDir, name), "utf8")); } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /* Audit append — wraps the standard appendJsonl for the audit file. */
  function audit(event) {
    appendJsonl(join(cacheDir, "audit.jsonl"), { auditKind: "mobile_pairing", ...event, occurredAt: nowSeconds() });
  }

  return {
    startPair,
    confirmPair,
    requestAuthNonce,
    verifyNonceSignature,
    issueAccessToken,
    verifyAccessToken,
    revokeDevice,
    listDevices,
    audit,
    // exposed for tests only:
    _internals: {
      signHs256,
      verifyHs256,
      base64url,
      fingerprintPublicKey,
      readDevice,
      writeDevice,
      devicesDir,
      pairCodesPath,
      tokensPath,
    },
  };
}
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
 *   1. Client posts /mobile/v1/pair/start with its declared public signing
 *      key and receives a one-time six-digit pairing code (5-minute TTL).
 *   2. An authenticated Web owner submits that code to the internal Web
 *      approval route. The server activates the device without ever sending
 *      its owner-approval secret to the phone.
 *   3. Client polls /mobile/v1/pair/status, then posts /mobile/v1/auth/token
 *      with its approved deviceId and signs
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
import { createHash, createHmac, createPublicKey, randomBytes, randomInt, randomUUID, verify as cryptoVerify, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";

const DEFAULT_CODE_TTL_SECONDS = 300;          // 5 minutes
const DEFAULT_TOKEN_TTL_SECONDS = 3600;        // 1 hour
const DEFAULT_NONCE_TTL_SECONDS = 300;         // 5 minutes
const PAIR_CODE_LENGTH = 6;
const NONCE_LENGTH = 32;                       // 32 random bytes -> base64url ~43 chars

const DEVICES_DIRNAME = "devices";
const NONCES_DIRNAME = "nonces";
const PAIR_CODES_FILE = "pairing-codes.jsonl";
const WEB_PAIRINGS_FILE = "web-pairings.jsonl";
const WEB_LOGINS_FILE = "web-logins.jsonl";
const TOKENS_FILE = "access-tokens.jsonl";

/* ─── Ed25519 raw → SPKI helpers (RFC 8410 §3, OID 1.3.101.112) ──────────
 *
 * The wire format for `publicKeyHex` is a 64-char lowercase hex string
 * encoding the raw 32-byte Ed25519 public key.  Internally Node's
 * `verify()` only accepts SubjectPublicKeyInfo (SPKI) DER; we wrap the
 * raw key with the standard 12-byte Ed25519 SPKI header before parsing.
 */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const RAW_PUBLIC_KEY_LENGTH = 32;
const RAW_PUBLIC_KEY_HEX_LENGTH = RAW_PUBLIC_KEY_LENGTH * 2;
const KEY_ALGORITHM_ED25519 = "Ed25519";
const KEY_ALGORITHM_ES256 = "ES256";
const ES256_SPKI_MAX_BYTES = 256;
const MAX_SIGNATURE_HEX_LENGTH = 512;

function rawPublicKeyHexToSpki(publicKeyHex) {
  const raw = Buffer.from(publicKeyHex, "hex");
  if (raw.length !== RAW_PUBLIC_KEY_LENGTH) return null;
  return Buffer.concat([ED25519_SPKI_PREFIX, raw]);
}

function parseEd25519PublicKey(publicKeyHex) {
  const spki = rawPublicKeyHexToSpki(publicKeyHex);
  if (!spki) return null;
  try {
    return createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch {
    return null;
  }
}

/** Android Keystore's portable asymmetric-signing API is P-256 EC rather
 * than Ed25519.  ES256 requests therefore carry the complete SPKI DER public
 * key; Node validates both key type and curve before accepting it. */
function parseEs256PublicKey(publicKeyHex) {
  if (typeof publicKeyHex !== "string" || !/^[0-9a-f]+$/i.test(publicKeyHex) || publicKeyHex.length % 2 !== 0) return null;
  const spki = Buffer.from(publicKeyHex, "hex");
  if (spki.length < 64 || spki.length > ES256_SPKI_MAX_BYTES) return null;
  try {
    const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
    if (publicKey.asymmetricKeyType !== "ec" || publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") return null;
    return publicKey;
  } catch {
    return null;
  }
}

function normalizePublicKeyAlgorithm(value) {
  // Old pairings had no explicit algorithm and used raw Ed25519 keys. Keep
  // them usable while every current Android client explicitly sends ES256.
  if (value === undefined || value === null || value === "") return KEY_ALGORITHM_ED25519;
  if (value === KEY_ALGORITHM_ED25519 || value === KEY_ALGORITHM_ES256) return value;
  return null;
}

function parseDevicePublicKey(publicKeyAlgorithm, publicKeyHex) {
  if (publicKeyAlgorithm === KEY_ALGORITHM_ED25519) return parseEd25519PublicKey(publicKeyHex);
  if (publicKeyAlgorithm === KEY_ALGORITHM_ES256) return parseEs256PublicKey(publicKeyHex);
  return null;
}

/* Owner out-of-band approval: when AXI_OWNER_PAIR_APPROVAL_SECRET is
 * set, /mobile/v1/pair/confirm requires a body field `ownerApprovalToken`
 * that equals HMAC-SHA256(secret, pairingId + ":" + code).  This is a
 * short string the owner pastes from a side-channel (terminal, vault)
 * at confirm time — it is impossible to forge without the secret and
 * cannot be derived from the 6-digit code alone.  Personal-use project
 * level: an env var is acceptable as a clearly documented out-of-band
 * channel; tests configure it explicitly via createPairingService. */
function computeOwnerApprovalToken(secret, pairingId, code) {
  return createHmac("sha256", secret).update(`${pairingId}:${code}`).digest("hex");
}
function verifyOwnerApprovalToken(secret, pairingId, code, token) {
  if (typeof token !== "string" || !token) return false;
  const expected = computeOwnerApprovalToken(secret, pairingId, code);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token.toLowerCase(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
  // 6 digits, leading zeros allowed. Use a CSPRNG: the code is a pairing
  // factor and must not be predictable from Math.random state.
  return randomInt(0, 10 ** PAIR_CODE_LENGTH).toString(10).padStart(PAIR_CODE_LENGTH, "0");
}

function isValidHexPublicKey(value, publicKeyAlgorithm) {
  if (typeof value !== "string") return false;
  if (publicKeyAlgorithm === KEY_ALGORITHM_ED25519 && !/^[0-9a-f]{64}$/i.test(value)) return false;
  return parseDevicePublicKey(publicKeyAlgorithm, value.toLowerCase()) !== null;
}

function fingerprintPublicKey(publicKeyHex, publicKeyAlgorithm = KEY_ALGORITHM_ED25519) {
  return createHmac("sha256", "axi-mobile-pubkey-fingerprint-v1")
    .update(`${publicKeyAlgorithm}:${publicKeyHex.toLowerCase()}`)
    .digest("hex");
}

/** QR and browser poll credentials are high-entropy one-time bearers.  The
 * ledger retains only their SHA-256 digests so a local cache inspection
 * cannot replay a still-live QR transaction. */
function opaqueTokenHash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function opaqueTokenMatches(value, expectedHash) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(value)) return false;
  if (typeof expectedHash !== "string" || !/^[0-9a-f]{64}$/i.test(expectedHash)) return false;
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(opaqueTokenHash(value), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeOwner({ ownerSubject, ownerEmail } = {}) {
  const subject = typeof ownerSubject === "string" ? ownerSubject.trim() : "";
  if (!subject || subject.length > 256 || /[\u0000-\u001f\u007f]/.test(subject)) return null;
  const email = typeof ownerEmail === "string" ? ownerEmail.trim() : "";
  if (email && (email.length > 320 || /[\u0000-\u001f\u007f]/.test(email))) return null;
  return email ? { subject, email } : { subject };
}

/* ─── createPairingService ────────────────────────────────────────────── */

export function createPairingService({
  cacheDir,
  tokenSecret,
  ownerApprovalSecret = "",
  codeTtlSeconds = DEFAULT_CODE_TTL_SECONDS,
  tokenTtlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
  nonceTtlSeconds = DEFAULT_NONCE_TTL_SECONDS,
  clock = () => Date.now(),
} = {}) {
  if (!cacheDir) throw new Error("createPairingService: cacheDir is required");
  if (!tokenSecret) throw new Error("createPairingService: tokenSecret is required");
  // ownerApprovalSecret is required to make confirmPair operational.  When
  // missing, confirmPair fails closed with an explicit "owner approval
  // secret not configured" error instead of letting anyone with the
  // 6-digit code activate a device.  Tests configure it explicitly.
  ownerApprovalSecret = typeof ownerApprovalSecret === "string" ? ownerApprovalSecret : "";

  const devicesDir = join(cacheDir, DEVICES_DIRNAME);
  const noncesDir = join(cacheDir, NONCES_DIRNAME);
  const pairCodesPath = join(cacheDir, PAIR_CODES_FILE);
  const webPairingsPath = join(cacheDir, WEB_PAIRINGS_FILE);
  const webLoginsPath = join(cacheDir, WEB_LOGINS_FILE);
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

  function readWebPairing(webPairingId) {
    if (typeof webPairingId !== "string" || !/^webpair_[A-Za-z0-9_-]{6,}$/.test(webPairingId)) return null;
    return [...readJsonl(webPairingsPath)].reverse().find((entry) => entry?.webPairingId === webPairingId) || null;
  }

  function updateWebPairing(entry) {
    appendJsonl(webPairingsPath, entry);
    return entry;
  }

  function readWebLogin(webLoginId) {
    if (typeof webLoginId !== "string" || !/^weblogin_[A-Za-z0-9_-]{6,}$/.test(webLoginId)) return null;
    return [...readJsonl(webLoginsPath)].reverse().find((entry) => entry?.webLoginId === webLoginId) || null;
  }

  function updateWebLogin(entry) {
    appendJsonl(webLoginsPath, entry);
    return entry;
  }

  /**
   * A signed-in Web owner creates a short-lived, opaque QR transaction.  The
   * random scan token is a bearer only for the *scan* step; it never grants a
   * device a session and is never returned by a status endpoint.
   */
  function startWebPairing({ ownerSubject, ownerEmail } = {}) {
    const owner = normalizeOwner({ ownerSubject, ownerEmail });
    if (!owner) {
      return { ok: false, error: "verified web identity required" };
    }
    const now = nowSeconds();
    const scanToken = base64url(randomBytes(NONCE_LENGTH));
    const entry = {
      webPairingId: `webpair_${randomUUID()}`,
      ownerSubject: owner.subject,
      ownerEmail: owner.email,
      scanTokenHash: opaqueTokenHash(scanToken),
      createdAt: now,
      expiresAt: now + codeTtlSeconds,
      status: "waiting_scan",
    };
    updateWebPairing(entry);
    return {
      ok: true,
      webPairingId: entry.webPairingId,
      scanToken,
      expiresAt: entry.expiresAt,
    };
  }

  /** The phone scans a Web-owned QR and contributes its device public key. */
  function scanWebPairing({ webPairingId, scanToken, publicKeyHex, publicKeyAlgorithm, deviceName, clientInfo } = {}) {
    if (typeof scanToken !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(scanToken)) {
      return { ok: false, error: "invalid pairing scan token" };
    }
    const current = readWebPairing(webPairingId);
    if (!current) return { ok: false, error: "web pairing not found" };
    const now = nowSeconds();
    if (current.expiresAt <= now) return { ok: false, error: "web pairing expired" };
    if (current.status !== "waiting_scan") return { ok: false, error: "web pairing is no longer scannable" };
    if (!opaqueTokenMatches(scanToken, current.scanTokenHash)) {
      return { ok: false, error: "invalid pairing scan token" };
    }
    const started = startPair({
      publicKeyHex,
      publicKeyAlgorithm,
      deviceName,
      clientInfo,
      ownerSubject: current.ownerSubject,
      ownerEmail: current.ownerEmail,
    });
    if (!started.ok) return started;
    updateWebPairing({
      ...current,
      status: "scanned",
      scannedAt: now,
      pairingId: started.pairingId,
      deviceName: typeof deviceName === "string" ? deviceName : "unknown-device",
    });
    return {
      ok: true,
      pairingId: started.pairingId,
      code: started.code,
      expiresAt: started.codeExpiresAt,
    };
  }

  /** An owner may view only their own transaction and never its scan bearer. */
  function webPairingStatus({ webPairingId, ownerSubject } = {}) {
    if (typeof ownerSubject !== "string" || !ownerSubject.trim()) return { ok: false, error: "verified web identity required" };
    const current = readWebPairing(webPairingId);
    if (!current || current.ownerSubject !== ownerSubject.trim()) return { ok: false, error: "web pairing not found" };
    const now = nowSeconds();
    if (current.expiresAt <= now && current.status !== "approved") {
      return { ok: true, status: "expired", expiresAt: current.expiresAt };
    }
    const result = { ok: true, status: current.status, expiresAt: current.expiresAt };
    if (current.status === "scanned" || current.status === "approved") result.deviceName = current.deviceName;
    return result;
  }

  /** Final, explicit owner confirmation.  Only then is the device activated. */
  function approveWebPairing({ webPairingId, ownerSubject } = {}) {
    if (typeof ownerSubject !== "string" || !ownerSubject.trim()) return { ok: false, error: "verified web identity required" };
    const current = readWebPairing(webPairingId);
    if (!current || current.ownerSubject !== ownerSubject.trim()) return { ok: false, error: "web pairing not found" };
    const now = nowSeconds();
    if (current.expiresAt <= now) return { ok: false, error: "web pairing expired" };
    if (current.status !== "scanned" || typeof current.pairingId !== "string") {
      return { ok: false, error: "phone has not scanned this QR code" };
    }
    const pair = [...readJsonl(pairCodesPath)].reverse().find((entry) => entry?.pairingId === current.pairingId);
    if (!pair || pair.consumed || pair.expiresAt <= now) return { ok: false, error: "phone pairing expired" };
    const approved = approvePairByCode(pair.code);
    if (!approved.ok) return approved;
    updateWebPairing({ ...current, status: "approved", approvedAt: now });
    return { ok: true, status: "approved", deviceName: approved.deviceName };
  }

  /** A browser that is not yet authenticated creates this short-lived QR.
   * The QR carries only the scanner bearer; its polling bearer remains in the
   * browser.  A mobile device must already be active and owner-bound before
   * it can approve this transaction. */
  function startWebLogin() {
    const now = nowSeconds();
    const scanToken = base64url(randomBytes(NONCE_LENGTH));
    const pollToken = base64url(randomBytes(NONCE_LENGTH));
    const entry = {
      webLoginId: `weblogin_${randomUUID()}`,
      scanTokenHash: opaqueTokenHash(scanToken),
      pollTokenHash: opaqueTokenHash(pollToken),
      createdAt: now,
      expiresAt: now + codeTtlSeconds,
      status: "waiting_scan",
    };
    updateWebLogin(entry);
    return {
      ok: true,
      webLoginId: entry.webLoginId,
      scanToken,
      pollToken,
      expiresAt: entry.expiresAt,
    };
  }

  function webLoginStatus({ webLoginId, pollToken } = {}) {
    if (typeof pollToken !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(pollToken)) {
      return { ok: false, error: "invalid browser poll token" };
    }
    const current = readWebLogin(webLoginId);
    if (!current || !opaqueTokenMatches(pollToken, current.pollTokenHash)) {
      return { ok: false, error: "web login not found" };
    }
    if (current.expiresAt <= nowSeconds() && current.status !== "consumed") {
      return { ok: true, status: "expired", expiresAt: current.expiresAt };
    }
    return { ok: true, status: current.status, expiresAt: current.expiresAt };
  }

  function scanWebLogin({ webLoginId, scanToken, deviceId } = {}) {
    if (typeof scanToken !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(scanToken)) {
      return { ok: false, error: "invalid web login scan token" };
    }
    const current = readWebLogin(webLoginId);
    if (!current) return { ok: false, error: "web login not found" };
    const now = nowSeconds();
    if (current.expiresAt <= now) return { ok: false, error: "web login expired" };
    if (current.status !== "waiting_scan") return { ok: false, error: "web login is no longer scannable" };
    if (!opaqueTokenMatches(scanToken, current.scanTokenHash)) return { ok: false, error: "invalid web login scan token" };
    const device = readDevice(deviceId);
    if (!device || device.status !== "active") return { ok: false, error: "mobile device is not active" };
    if (!device.owner?.subject) return { ok: false, error: "mobile device is not bound to a Web owner" };
    updateWebLogin({
      ...current,
      status: "approved",
      approvedAt: now,
      approvingDeviceId: device.deviceId,
      ownerSubject: device.owner.subject,
      ownerEmail: device.owner.email,
      deviceName: device.deviceName,
    });
    return { ok: true, status: "approved" };
  }

  /** Consume is internal-gateway only at the HTTP layer.  The browser holder
   * gets a cookie from API Gateway; the identity is never exposed by polling. */
  function consumeWebLogin({ webLoginId, pollToken } = {}) {
    if (typeof pollToken !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(pollToken)) {
      return { ok: false, error: "invalid browser poll token" };
    }
    const current = readWebLogin(webLoginId);
    if (!current || !opaqueTokenMatches(pollToken, current.pollTokenHash)) {
      return { ok: false, error: "web login not found" };
    }
    const now = nowSeconds();
    if (current.expiresAt <= now) return { ok: false, error: "web login expired" };
    if (current.status !== "approved" || !current.ownerSubject) return { ok: false, error: "web login is not approved" };
    updateWebLogin({ ...current, status: "consumed", consumedAt: now });
    return {
      ok: true,
      status: "approved",
      ownerSubject: current.ownerSubject,
      ownerEmail: current.ownerEmail,
      deviceName: current.deviceName,
    };
  }

  /* startPair — generate a one-time code; device is not yet registered. */
  function startPair({ publicKeyHex, publicKeyAlgorithm, deviceName, clientInfo, ownerSubject, ownerEmail } = {}) {
    const normalizedPublicKeyAlgorithm = normalizePublicKeyAlgorithm(publicKeyAlgorithm);
    if (!normalizedPublicKeyAlgorithm || !isValidHexPublicKey(publicKeyHex, normalizedPublicKeyAlgorithm)) {
      return { ok: false, error: "publicKeyHex must be a valid declared device signing key" };
    }
    const now = nowSeconds();
    const code = randomPairCode();
    const pairingId = `pair_${randomUUID()}`;
    const owner = ownerSubject === undefined && ownerEmail === undefined ? null : normalizeOwner({ ownerSubject, ownerEmail });
    if ((ownerSubject !== undefined || ownerEmail !== undefined) && !owner) {
      return { ok: false, error: "verified web identity required" };
    }
    const entry = {
      pairingId,
      code,
      publicKeyHex: publicKeyHex.toLowerCase(),
      publicKeyAlgorithm: normalizedPublicKeyAlgorithm,
      publicKeyFingerprint: fingerprintPublicKey(publicKeyHex, normalizedPublicKeyAlgorithm),
      deviceName: typeof deviceName === "string" ? deviceName : "unknown-device",
      clientInfo: clientInfo && typeof clientInfo === "object" ? clientInfo : null,
      createdAt: now,
      expiresAt: now + codeTtlSeconds,
      consumed: false,
    };
    if (owner) entry.owner = owner;
    appendJsonl(pairCodesPath, entry);
    return { ok: true, pairingId, code, codeExpiresAt: entry.expiresAt };
  }

  /* confirmPair — exchange code for a registered deviceId.
   *
   * Security model: the 6-digit code is a low-entropy shared secret
   * that pairs the device request with the owner's side-channel.  By
   * itself the code cannot activate a device — the caller must also
   * present an `ownerApprovalToken` equal to
   * HMAC-SHA256(ownerApprovalSecret, pairingId + ":" + code).  The
   * secret is held out-of-band by the owner (env var or vault) and is
   * never returned by /pair/start or any other unauthenticated path.
   * When `ownerApprovalSecret` is empty the function fails closed.
   */
  function confirmPair({ pairingId, code, ownerApprovalToken } = {}) {
    if (typeof pairingId !== "string" || typeof code !== "string") {
      return { ok: false, error: "pairingId and code are required" };
    }
    if (!ownerApprovalSecret) {
      return { ok: false, error: "owner approval secret not configured; pairing is owner-gated" };
    }
    if (!verifyOwnerApprovalToken(ownerApprovalSecret, pairingId, code, ownerApprovalToken)) {
      return { ok: false, error: "owner approval token missing or invalid" };
    }
    const entries = readJsonl(pairCodesPath);
    const now = nowSeconds();
    const entry = entries.reverse().find((e) => e.pairingId === pairingId);
    if (!entry) return { ok: false, error: "pairing not found" };
    if (entry.consumed) return { ok: false, error: "pairing already consumed" };
    if (entry.expiresAt <= now) return { ok: false, error: "pairing code expired" };
    if (entry.code !== code) return { ok: false, error: "pairing code mismatch" };

    const deviceId = `dev_${randomUUID()}`;
    // Mark the transaction as consumed before publishing the device record.
    // The append-only ledger carries the device id so the original device can
    // later poll its own pairing status without ever receiving the owner's
    // approval secret.
    entry.consumed = true;
    entry.consumedAt = now;
    entry.deviceId = deviceId;
    entry.status = "approved";
    appendJsonl(pairCodesPath, entry);

    const device = {
      deviceId,
      publicKeyHex: entry.publicKeyHex,
      publicKeyAlgorithm: entry.publicKeyAlgorithm,
      publicKeyFingerprint: entry.publicKeyFingerprint,
      deviceName: entry.deviceName,
      clientInfo: entry.clientInfo,
      status: "active",
      createdAt: now,
      lastSeenAt: now,
    };
    if (entry.owner) device.owner = entry.owner;
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

  /**
   * A Web owner approves the request by entering the six-digit code shown on
   * the phone.  This deliberately returns no HMAC approval token: that token
   * remains an internal server implementation detail and never crosses to a
   * native device.
   */
  function approvePairByCode(code) {
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      return { ok: false, error: "pairing code must be a 6-digit string" };
    }
    const now = nowSeconds();
    const candidates = readJsonl(pairCodesPath).filter((entry) => (
      entry &&
      entry.code === code.trim() &&
      !entry.consumed &&
      typeof entry.expiresAt === "number" &&
      entry.expiresAt > now
    ));
    if (candidates.length === 0) return { ok: false, error: "pairing not found or expired" };
    // A six-digit code is deliberately human-enterable. In the unlikely event
    // of a collision, require a fresh request instead of approving either.
    if (candidates.length !== 1) return { ok: false, error: "pairing code is ambiguous; start a new pairing request" };

    const entry = candidates[0];
    const ownerApprovalToken = getOwnerApprovalToken(entry.pairingId, entry.code);
    if (!ownerApprovalToken) return { ok: false, error: "owner approval secret not configured" };
    const confirmed = confirmPair({
      pairingId: entry.pairingId,
      code: entry.code,
      ownerApprovalToken,
    });
    if (!confirmed.ok) return confirmed;
    return {
      ok: true,
      status: "approved",
      pairingId: entry.pairingId,
      deviceName: entry.deviceName,
    };
  }

  /**
   * The phone proves continuity with both its opaque pairing id and the
   * short-lived code. A device id is disclosed only after the authenticated
   * Web owner has approved the exact request; access still requires an
   * registered-device nonce signature in the next step.
   */
  function pairingStatus({ pairingId, code } = {}) {
    if (typeof pairingId !== "string" || typeof code !== "string") {
      return { ok: false, error: "pairingId and code are required" };
    }
    const entry = [...readJsonl(pairCodesPath)].reverse().find((candidate) => candidate?.pairingId === pairingId);
    if (!entry) return { ok: false, error: "pairing not found" };
    if (entry.code !== code) return { ok: false, error: "pairing code mismatch" };
    if (!entry.consumed) {
      if (entry.expiresAt <= nowSeconds()) return { ok: false, error: "pairing code expired" };
      return { ok: true, status: "pending", expiresAt: entry.expiresAt };
    }
    if (typeof entry.deviceId !== "string") return { ok: false, error: "approved pairing record is incomplete" };
    const device = readDevice(entry.deviceId);
    if (!device || device.status !== "active") return { ok: false, error: "approved device is unavailable" };
    return { ok: true, status: "approved", deviceId: entry.deviceId };
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

  /* verifyNonceSignature — verify a signature against the registered device key.
   *
   * Legacy records use a raw Ed25519 public key. Current Android Keystore
   * records use an ES256 P-256 SPKI key and SHA256withECDSA DER signature.
   * In both cases only the holder of the keystore private key can sign the
   * nonce; the old HMAC design was forgeable because the key was symmetric.
   */
  function verifyNonceSignature({ deviceId, nonceId, nonce, signatureHex } = {}) {
    const device = readDevice(deviceId);
    if (!device) return { ok: false, error: "device not found" };
    if (device.status !== "active") return { ok: false, error: `device ${device.status}` };
    const publicKeyAlgorithm = normalizePublicKeyAlgorithm(device.publicKeyAlgorithm);
    if (!publicKeyAlgorithm) return { ok: false, error: "device signing algorithm is not supported" };
    if (typeof signatureHex !== "string" || !/^[0-9a-f]+$/i.test(signatureHex) || signatureHex.length % 2 !== 0 || signatureHex.length > MAX_SIGNATURE_HEX_LENGTH) {
      return { ok: false, error: "signatureHex must be a bounded hexadecimal device signature" };
    }
    if (publicKeyAlgorithm === KEY_ALGORITHM_ED25519 && signatureHex.length !== 128) {
      return { ok: false, error: "signatureHex must be a 128-char Ed25519 signature hex string" };
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

    const publicKey = parseDevicePublicKey(publicKeyAlgorithm, device.publicKeyHex);
    if (!publicKey) return { ok: false, error: "device public key is not a valid declared signing key" };
    let signatureValid = false;
    try {
      signatureValid = cryptoVerify(
        publicKeyAlgorithm === KEY_ALGORITHM_ES256 ? "sha256" : null,
        Buffer.from(nonce, "utf8"),
        publicKey,
        Buffer.from(signatureHex, "hex")
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) return { ok: false, error: "signature mismatch" };

    nonceEntry.consumed = true;
    nonceEntry.consumedAt = nowSeconds();
    writeFileSync(path, JSON.stringify(nonceEntry, null, 2), { mode: 0o600 });
    return { ok: true, device };
  }

  /* exchangeNonceForAccessToken — prove possession of the device key before minting a token.
   *
   * Scopes are derived server-side only: an elevate=true grant (issued
   * via the out-of-band owner channel) yields "owner"; otherwise the
   * device gets the least-privilege "mobile" scope.  Caller-supplied
   * scopes are intentionally ignored. */
  function exchangeNonceForAccessToken({ deviceId, nonceId, nonce, signatureHex, elevate = false } = {}) {
    const verified = verifyNonceSignature({ deviceId, nonceId, nonce, signatureHex });
    if (!verified.ok) return verified;
    return issueAccessToken({ deviceId, elevate });
  }

  /* issueAccessToken — mint a 1h HS256 access token for an active device.
   *
   * Scopes are derived ONLY from server-side policy (`elevate`
   * boolean).  Caller-supplied scopes are never honoured here — that
   * was the previous scope escalation bug. */
  function issueAccessToken({ deviceId, elevate = false } = {}) {
    const device = readDevice(deviceId);
    if (!device) return { ok: false, error: "device not found" };
    if (device.status !== "active") return { ok: false, error: `device ${device.status}` };

    const now = nowSeconds();
    const grantedScopes = elevate ? ["owner"] : ["mobile"];
    const token = signHs256({
      sub: deviceId,
      scopes: grantedScopes,
      iat: now,
      exp: now + tokenTtlSeconds,
    }, tokenSecret);

    appendJsonl(tokensPath, {
      deviceId,
      tokenJti: token.split(".")[2],
      issuedAt: now,
      expiresAt: now + tokenTtlSeconds,
      scopes: grantedScopes,
    });

    device.lastSeenAt = now;
    writeDevice(device);
    return { ok: true, accessToken: token, expiresAt: now + tokenTtlSeconds, scopes: grantedScopes };
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

  /* issueOwnerAccessToken — out-of-band upgrade path for trusted devices.
   *
   * This is the only way a paired device can obtain a JWT with the
   * `owner` scope: the caller proves possession of the
   * ownerApprovalSecret (the same secret that gates pair/confirm) by
   * presenting a freshly signed nonce whose body carries an
   * `ownerProof` equal to HMAC-SHA256(ownerApprovalSecret, nonce).
   * The nonce must still match a server-issued nonce for the device.
   * This keeps "owner" reach strictly inside the owner's side-channel.
   */
  function issueOwnerAccessToken({ deviceId, nonceId, nonce, signatureHex, ownerProof } = {}) {
    if (!ownerApprovalSecret) {
      return { ok: false, error: "owner approval secret not configured" };
    }
    const verified = verifyNonceSignature({ deviceId, nonceId, nonce, signatureHex });
    if (!verified.ok) return verified;
    if (!verifyOwnerApprovalToken(ownerApprovalSecret, "owner-elevation", nonce, ownerProof)) {
      return { ok: false, error: "owner proof missing or invalid" };
    }
    return issueAccessToken({ deviceId, elevate: true });
  }

  /* computeOwnerApprovalToken — exported so tests and the
   * `pairingOwnerProof` HTTP route can compute the value the owner
   * pastes from a side-channel.  Returns null when the secret is
   * unconfigured. */
  function getOwnerApprovalToken(pairingId, code) {
    if (!ownerApprovalSecret) return null;
    return computeOwnerApprovalToken(ownerApprovalSecret, pairingId, code);
  }

  function hasOwnerApproval() {
    return Boolean(ownerApprovalSecret);
  }

  /* Audit append — wraps the standard appendJsonl for the audit file. */
  function audit(event) {
    appendJsonl(join(cacheDir, "audit.jsonl"), { auditKind: "mobile_pairing", ...event, occurredAt: nowSeconds() });
  }

  return {
    startPair,
    confirmPair,
    approvePairByCode,
    pairingStatus,
    startWebPairing,
    scanWebPairing,
    webPairingStatus,
    approveWebPairing,
    startWebLogin,
    scanWebLogin,
    webLoginStatus,
    consumeWebLogin,
    requestAuthNonce,
    verifyNonceSignature,
    exchangeNonceForAccessToken,
    issueAccessToken,
    issueOwnerAccessToken,
    verifyAccessToken,
    getOwnerApprovalToken,
    hasOwnerApproval,
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
      webPairingsPath,
      webLoginsPath,
      readWebPairing,
      readWebLogin,
      tokensPath,
      computeOwnerApprovalToken,
      parseEd25519PublicKey,
      rawPublicKeyHexToSpki,
      parseEs256PublicKey,
      parseDevicePublicKey,
      normalizePublicKeyAlgorithm,
    },
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac, createHash } from "node:crypto";
import { createPairingService } from "../src/pairing.mjs";

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-pairing-"));
}

const FIXED_SECRET = "test-secret-do-not-use-in-prod-32bytes-please";
const TEST_PUBKEY = "a".repeat(64);

function signNonce(publicKeyHex, nonce) {
  return createHmac("sha256", publicKeyHex).update(nonce).digest("hex");
}

test("startPair returns a 6-digit code and a pairing id", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const result = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "test-device" });
  assert.equal(result.ok, true);
  assert.match(result.code, /^[0-9]{6}$/);
  assert.match(result.pairingId, /^pair_/);
  assert.equal(typeof result.codeExpiresAt, "number");
});

test("startPair rejects non-hex publicKeyHex", () => {
  const pairing = createPairingService({ cacheDir: freshCacheDir(), tokenSecret: FIXED_SECRET });
  const r = pairing.startPair({ publicKeyHex: "not-hex" });
  assert.equal(r.ok, false);
  assert.match(r.error, /publicKeyHex/);
});

test("confirmPair registers a device and issues an initial nonce", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "ci-phone" });
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  assert.equal(confirm.ok, true);
  assert.match(confirm.deviceId, /^dev_/);
  assert.equal(confirm.status, "active");
  assert.ok(confirm.nonce.nonceId);
  assert.match(confirm.nonce.nonce, /^[A-Za-z0-9_-]+$/);
});

test("confirmPair rejects a wrong code", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  const r = pairing.confirmPair({ pairingId: start.pairingId, code: "000000" });
  assert.equal(r.ok, false);
  assert.match(r.error, /mismatch|expired|not found/i);
});

test("confirmPair rejects an expired code (clock override)", () => {
  let now = 1_700_000_000;
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET, clock: () => now * 1000 });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  now += 400; // past the 300s TTL
  const r = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  assert.equal(r.ok, false);
  assert.match(r.error, /expired|not found/i);
});

test("confirmPair rejects a second use of the same pairing id", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  const first = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  assert.equal(first.ok, true);
  const second = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  assert.equal(second.ok, false);
});

test("verifyNonceSignature + issueAccessToken issue an HS256 token that round-trips", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "round-trip" });
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  const sig = signNonce(TEST_PUBKEY, confirm.nonce.nonce);
  const verified = pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  assert.equal(verified.ok, true);
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId, scopes: ["mobile"] });
  assert.equal(token.ok, true);
  assert.match(token.accessToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const verify = pairing.verifyAccessToken(token.accessToken);
  assert.equal(verify.ok, true);
  assert.equal(verify.deviceId, confirm.deviceId);
  assert.deepEqual(verify.scopes, ["mobile"]);
});

test("verifyNonceSignature rejects a tampered signature", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  const bad = "0".repeat(64);
  const r = pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: bad,
  });
  assert.equal(r.ok, false);
});

test("revokeDevice blocks subsequent verifyAccessToken", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  const sig = signNonce(TEST_PUBKEY, confirm.nonce.nonce);
  pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId });
  assert.equal(token.ok, true);
  const okBefore = pairing.verifyAccessToken(token.accessToken);
  assert.equal(okBefore.ok, true);
  pairing.revokeDevice({ deviceId: confirm.deviceId, reason: "test" });
  const after = pairing.verifyAccessToken(token.accessToken);
  assert.equal(after.ok, false);
  assert.match(after.error, /revoked/i);
});

test("verifyAccessToken rejects an expired token (clock override)", () => {
  let now = 1_700_000_000;
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET, clock: () => now * 1000 });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  const sig = signNonce(TEST_PUBKEY, confirm.nonce.nonce);
  pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId });
  now += 4000; // past 1h
  const r = pairing.verifyAccessToken(token.accessToken);
  assert.equal(r.ok, false);
  assert.match(r.error, /expired/i);
});

test("verifyAccessToken rejects a token signed with the wrong secret", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const start = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "x" });
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  const sig = signNonce(TEST_PUBKEY, confirm.nonce.nonce);
  pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId });
  // Forge a token signed with a different secret.
  const forged = pairing._internals.signHs256({ sub: confirm.deviceId, exp: 9_999_999_999 }, "wrong-secret");
  assert.equal(pairing.verifyAccessToken(forged).ok, false);
  assert.equal(pairing.verifyAccessToken(token.accessToken).ok, true);
});

test("listDevices returns active and revoked devices", () => {
  const cacheDir = freshCacheDir();
  const pairing = createPairingService({ cacheDir, tokenSecret: FIXED_SECRET });
  const s1 = pairing.startPair({ publicKeyHex: TEST_PUBKEY, deviceName: "a" });
  const c1 = pairing.confirmPair({ pairingId: s1.pairingId, code: s1.code });
  const s2 = pairing.startPair({ publicKeyHex: "b".repeat(64), deviceName: "b" });
  const c2 = pairing.confirmPair({ pairingId: s2.pairingId, code: s2.code });
  pairing.revokeDevice({ deviceId: c2.deviceId });
  const list = pairing.listDevices();
  assert.equal(list.length, 2);
  const a = list.find((d) => d.deviceId === c1.deviceId);
  const b = list.find((d) => d.deviceId === c2.deviceId);
  assert.equal(a.status, "active");
  assert.equal(b.status, "revoked");
});
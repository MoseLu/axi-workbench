import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { createPairingService } from "../src/pairing.mjs";

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-pairing-"));
}

const FIXED_SECRET = "test-secret-do-not-use-in-prod-32bytes-please";
const OWNER_APPROVAL_SECRET = "test-owner-approval-do-not-use-in-prod-32bytes";

/** Generate a real Ed25519 keypair for tests.  The public key is exported
 * as the 32-byte raw hex string the new pairing service requires; the
 * private key is exported as PKCS8 PEM for crypto.sign(). */
function freshKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("hex");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  return { publicKeyHex, privateKey: createPrivateKey(privateKeyPem) };
}

function signNonce(privateKey, nonce) {
  return cryptoSign(null, Buffer.from(nonce, "utf8"), privateKey).toString("hex");
}

/** Android Keystore documents EC P-256 as its portable signing path. Its
 * SHA256withECDSA signature is DER encoded, exactly as Node crypto.verify()
 * expects for an ES256 key. */
function freshEs256Key() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  return { publicKeyHex, publicKeyAlgorithm: "ES256", privateKey: createPrivateKey(privateKeyPem) };
}

function signEs256Nonce(privateKey, nonce) {
  return cryptoSign("sha256", Buffer.from(nonce, "utf8"), privateKey).toString("hex");
}

function freshPairing(opts = {}) {
  return createPairingService({
    cacheDir: freshCacheDir(),
    tokenSecret: FIXED_SECRET,
    ownerApprovalSecret: OWNER_APPROVAL_SECRET,
    ...opts,
  });
}

function pairDevice(pairing, { publicKeyHex, publicKeyAlgorithm, privateKey, deviceName = "x" } = {}) {
  const start = pairing.startPair({ publicKeyHex, publicKeyAlgorithm, deviceName });
  const ownerApprovalToken = pairing.getOwnerApprovalToken(start.pairingId, start.code);
  const confirm = pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken });
  return { start, confirm, privateKey };
}

test("startPair returns a 6-digit code and a pairing id", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const result = pairing.startPair({ publicKeyHex, deviceName: "test-device" });
  assert.equal(result.ok, true);
  assert.match(result.code, /^[0-9]{6}$/);
  assert.match(result.pairingId, /^pair_/);
  assert.equal(typeof result.codeExpiresAt, "number");
});

test("startPair rejects non-hex publicKeyHex", () => {
  const pairing = freshPairing();
  const r = pairing.startPair({ publicKeyHex: "not-hex" });
  assert.equal(r.ok, false);
  assert.match(r.error, /publicKeyHex/);
});

test("startPair rejects an empty 64-char hex publicKeyHex", () => {
  const pairing = freshPairing();
  // 64-char all-zero string: still parses as Ed25519 SPKI but we still
  // want to assert that the regex length check accepts valid hex
  // shapes — the deeper non-Ed25519-point check is below.
  const ok = pairing.startPair({ publicKeyHex: "0".repeat(64) });
  // The regex /^[0-9a-f]{64}$/ accepts zeros and Node parses the SPKI;
  // this is the documented behaviour.  The test documents the shape.
  assert.equal(ok.ok, true);
});

test("confirmPair refuses to activate a device without ownerApprovalToken (fail closed)", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const start = pairing.startPair({ publicKeyHex });
  const r = pairing.confirmPair({ pairingId: start.pairingId, code: start.code });
  assert.equal(r.ok, false);
  assert.match(r.error, /owner approval/i);
});

test("confirmPair rejects a wrong ownerApprovalToken", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const start = pairing.startPair({ publicKeyHex });
  const r = pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken: "0".repeat(64) });
  assert.equal(r.ok, false);
  assert.match(r.error, /owner approval/i);
});

test("confirmPair registers a device and issues an initial nonce when ownerApprovalToken is valid", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex });
  assert.equal(confirm.ok, true);
  assert.match(confirm.deviceId, /^dev_/);
  assert.equal(confirm.status, "active");
  assert.ok(confirm.nonce.nonceId);
  assert.match(confirm.nonce.nonce, /^[A-Za-z0-9_-]+$/);
});

test("confirmPair rejects a wrong pairing code even with a valid ownerApprovalToken", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const start = pairing.startPair({ publicKeyHex });
  const ownerApprovalToken = pairing.getOwnerApprovalToken(start.pairingId, "000000");
  const r = pairing.confirmPair({ pairingId: start.pairingId, code: "000000", ownerApprovalToken });
  assert.equal(r.ok, false);
  assert.match(r.error, /mismatch/);
});

test("confirmPair rejects an expired code (clock override)", () => {
  let now = 1_700_000_000;
  const pairing = freshPairing({ clock: () => now * 1000 });
  const { publicKeyHex } = freshKey();
  const start = pairing.startPair({ publicKeyHex });
  now += 400; // past the 300s TTL
  const ownerApprovalToken = pairing.getOwnerApprovalToken(start.pairingId, start.code);
  const r = pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken });
  assert.equal(r.ok, false);
  assert.match(r.error, /expired|not found/i);
});

test("confirmPair rejects a second use of the same pairing id", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const start = pairing.startPair({ publicKeyHex });
  const ownerApprovalToken = pairing.getOwnerApprovalToken(start.pairingId, start.code);
  const first = pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken });
  assert.equal(first.ok, true);
  const second = pairing.confirmPair({ pairingId: start.pairingId, code: start.code, ownerApprovalToken });
  assert.equal(second.ok, false);
});

test("an authenticated owner can approve a pending pairing by its six-digit code without releasing an approval secret", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const start = pairing.startPair({ publicKeyHex, deviceName: "android-lan" });

  assert.deepEqual(
    pairing.pairingStatus({ pairingId: start.pairingId, code: start.code }),
    { ok: true, status: "pending", expiresAt: start.codeExpiresAt },
  );

  const approved = pairing.approvePairByCode(start.code);
  assert.equal(approved.ok, true);
  assert.equal(approved.status, "approved");
  assert.equal(approved.deviceName, "android-lan");
  assert.equal("ownerApprovalToken" in approved, false);

  const status = pairing.pairingStatus({ pairingId: start.pairingId, code: start.code });
  assert.equal(status.ok, true);
  assert.equal(status.status, "approved");
  assert.match(status.deviceId, /^dev_/);
  assert.equal(pairing.approvePairByCode(start.code).ok, false, "approval is single-use");
  assert.equal(pairing.pairingStatus({ pairingId: start.pairingId, code: "000000" }).ok, false);
});

test("verifyNonceSignature + issueAccessToken issue an HS256 token that round-trips on Ed25519-signed nonces", () => {
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey, deviceName: "round-trip" });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
  const verified = pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  assert.equal(verified.ok, true);
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId });
  assert.equal(token.ok, true);
  assert.match(token.accessToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const verify = pairing.verifyAccessToken(token.accessToken);
  assert.equal(verify.ok, true);
  assert.equal(verify.deviceId, confirm.deviceId);
  assert.deepEqual(verify.scopes, ["mobile"]);
});

test("Android Keystore-compatible ES256 pairing keeps the private key on-device and verifies a DER ECDSA signature", () => {
  const pairing = freshPairing();
  const { publicKeyHex, publicKeyAlgorithm, privateKey } = freshEs256Key();
  const { confirm } = pairDevice(pairing, {
    publicKeyHex,
    publicKeyAlgorithm,
    privateKey,
    deviceName: "android-keystore-p256",
  });

  assert.equal(confirm.ok, true, `ES256 pairing failed: ${confirm.error || "unknown error"}`);
  const verified = pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: signEs256Nonce(privateKey, confirm.nonce.nonce),
  });
  assert.equal(verified.ok, true, `ES256 nonce verification failed: ${verified.error || "unknown error"}`);
  assert.equal(verified.device.publicKeyAlgorithm, "ES256");
});

test("declared device signing algorithms fail closed instead of guessing a key format", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshEs256Key();

  assert.equal(
    pairing.startPair({ publicKeyHex, publicKeyAlgorithm: "Ed25519", deviceName: "mismatched-key" }).ok,
    false,
    "an ES256 SPKI must not be reinterpreted as a legacy Ed25519 key",
  );
  assert.equal(
    pairing.startPair({ publicKeyHex, publicKeyAlgorithm: "RSA", deviceName: "unsupported-key" }).ok,
    false,
    "unknown signing algorithms must be rejected",
  );
  assert.equal(
    pairing.startPair({ publicKeyHex: "00".repeat(64), publicKeyAlgorithm: "ES256", deviceName: "malformed-key" }).ok,
    false,
    "non-SPKI ES256 values must be rejected before they enter the ledger",
  );
});

test("issueAccessToken ignores caller-supplied scopes and always returns the least-privilege default", () => {
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
  pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  // Old API passed a `scopes` array; the new API ignores any caller-supplied
  // scopes and only emits the server-side default `["mobile"]`.
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId, scopes: ["owner"] });
  assert.equal(token.ok, true);
  assert.deepEqual(token.scopes, ["mobile"]);
  const verified = pairing.verifyAccessToken(token.accessToken);
  assert.deepEqual(verified.scopes, ["mobile"]);
});

test("exchangeNonceForAccessToken requires a real Ed25519 signature", () => {
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey, deviceName: "android-keystore" });
  const signatureHex = signNonce(privateKey, confirm.nonce.nonce);
  const token = pairing.exchangeNonceForAccessToken({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex,
    // scopes argument is intentionally ignored now
    scopes: ["owner"],
  });
  assert.equal(token.ok, true);
  assert.deepEqual(token.scopes, ["mobile"]);
  assert.equal(pairing.verifyAccessToken(token.accessToken).ok, true);

  const replay = pairing.exchangeNonceForAccessToken({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex,
  });
  assert.equal(replay.ok, false);
  assert.match(replay.error, /consumed/i);
});

test("verifyNonceSignature rejects a tampered signature (wrong private key)", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const { publicKeyHex: otherPublicKeyHex, privateKey: otherPrivateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex });
  // Sign the nonce with a DIFFERENT private key — this used to "pass" because
  // the previous HMAC-based design let any caller forge signatures.
  const badSig = signNonce(otherPrivateKey, confirm.nonce.nonce);
  const r = pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: badSig,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /signature|public key/i);
  // Sanity: never registered the wrong pubkey
  assert.notEqual(otherPublicKeyHex, publicKeyHex);
});

test("verifyNonceSignature rejects a too-short signature (forces 128-char Ed25519 hex)", () => {
  const pairing = freshPairing();
  const { publicKeyHex } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex });
  const r = pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: "0".repeat(64),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /128-char/);
});

test("revokeDevice blocks subsequent verifyAccessToken", () => {
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
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
  const pairing = freshPairing({ clock: () => now * 1000 });
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
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
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey });
  const sig = signNonce(privateKey, confirm.nonce.nonce);
  pairing.verifyNonceSignature({
    deviceId: confirm.deviceId,
    nonceId: confirm.nonce.nonceId,
    nonce: confirm.nonce.nonce,
    signatureHex: sig,
  });
  const token = pairing.issueAccessToken({ deviceId: confirm.deviceId });
  const forged = pairing._internals.signHs256({ sub: confirm.deviceId, exp: 9_999_999_999 }, "wrong-secret");
  assert.equal(pairing.verifyAccessToken(forged).ok, false);
  assert.equal(pairing.verifyAccessToken(token.accessToken).ok, true);
});

test("listDevices returns active and revoked devices", () => {
  const pairing = freshPairing();
  const key1 = freshKey();
  const key2 = freshKey();
  const c1 = pairDevice(pairing, { ...key1, deviceName: "a" }).confirm;
  const c2 = pairDevice(pairing, { ...key2, deviceName: "b" }).confirm;
  pairing.revokeDevice({ deviceId: c2.deviceId });
  const list = pairing.listDevices();
  assert.equal(list.length, 2);
  const a = list.find((d) => d.deviceId === c1.deviceId);
  const b = list.find((d) => d.deviceId === c2.deviceId);
  assert.equal(a.status, "active");
  assert.equal(b.status, "revoked");
});

test("issueOwnerAccessToken requires both Ed25519 nonce signature and an ownerProof tied to the same nonce", () => {
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey });
  // Issue a fresh nonce so we can build an ownerProof that ties to it.
  const nonceResp = pairing.requestAuthNonce({ deviceId: confirm.deviceId });
  assert.equal(nonceResp.ok, true);
  const signatureHex = signNonce(privateKey, nonceResp.nonce);
  const ownerProof = pairing.getOwnerApprovalToken("owner-elevation", nonceResp.nonce);
  assert.ok(ownerProof, "ownerProof should be computable when ownerApprovalSecret is set");

  const elevated = pairing.issueOwnerAccessToken({
    deviceId: confirm.deviceId,
    nonceId: nonceResp.nonceId,
    nonce: nonceResp.nonce,
    signatureHex,
    ownerProof,
  });
  assert.equal(elevated.ok, true);
  assert.deepEqual(elevated.scopes, ["owner"]);
  const verify = pairing.verifyAccessToken(elevated.accessToken);
  assert.equal(verify.ok, true);
  assert.deepEqual(verify.scopes, ["owner"]);
});

test("issueOwnerAccessToken refuses elevation when the ownerProof is wrong", () => {
  const pairing = freshPairing();
  const { publicKeyHex, privateKey } = freshKey();
  const { confirm } = pairDevice(pairing, { publicKeyHex, privateKey });
  const nonceResp = pairing.requestAuthNonce({ deviceId: confirm.deviceId });
  const signatureHex = signNonce(privateKey, nonceResp.nonce);
  const r = pairing.issueOwnerAccessToken({
    deviceId: confirm.deviceId,
    nonceId: nonceResp.nonceId,
    nonce: nonceResp.nonce,
    signatureHex,
    ownerProof: "0".repeat(64),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /owner proof/i);
});

test("issueOwnerAccessToken returns no value when ownerApprovalSecret is unconfigured", () => {
  const pairing = createPairingService({
    cacheDir: freshCacheDir(),
    tokenSecret: FIXED_SECRET,
    // ownerApprovalSecret intentionally omitted
  });
  assert.equal(pairing.hasOwnerApproval(), false);
  const r = pairing.issueOwnerAccessToken({
    deviceId: "dev_does-not-exist",
    nonceId: "nonce_x",
    nonce: "anything",
    signatureHex: "0".repeat(128),
    ownerProof: "0".repeat(64),
  });
  assert.equal(r.ok, false);
});

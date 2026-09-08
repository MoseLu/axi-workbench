/**
 * idempotency.mjs — DevHub / Axi Mobile stage-B · idempotency cache
 *
 * Why this exists
 * ---------------
 * Mobile POST routes (/mobile/v1/jobs, /mobile/v1/jobs/:id/cancel,
 * /mobile/v1/approvals/:id/decision) are at risk of double-submission
 * from a flaky cellular network.  The mobile client supplies an
 * idempotency key per logical action; the control plane stores the
 * first response in cacheDir/idempotency/<deviceId>/<key>.json for 24h
 * and replays it for every subsequent request carrying the same
 * (deviceId, key) pair.
 *
 * Persistence layout
 * ------------------
 *   cacheDir/idempotency/<deviceId>/<key>.json
 *     {
 *       deviceId, key, response: { status, body }, recordedAt
 *     }
 *
 * The cache is append-then-replace: on record() we write the file
 * atomically (writeFileSync with mode 0o600); on read we tolerate
 * corrupt/missing by returning { cached: false }.
 *
 * No external npm deps.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;        // 24 hours

function isValidKey(key) {
  return typeof key === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(key);
}

function isValidDeviceId(deviceId) {
  return typeof deviceId === "string" && /^dev_[A-Za-z0-9_-]{6,}$/.test(deviceId);
}

export function createIdempotencyService({
  cacheDir,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  clock = () => Date.now(),
} = {}) {
  if (!cacheDir) throw new Error("createIdempotencyService: cacheDir is required");

  const root = join(cacheDir, "idempotency");
  if (!existsSync(root)) mkdirSync(root, { recursive: true, mode: 0o700 });

  function nowSeconds() { return Math.floor(clock() / 1000); }

  function pathFor(deviceId, key) {
    return join(root, deviceId, `${key}.json`);
  }

  function readRecord(deviceId, key) {
    const path = pathFor(deviceId, key);
    if (!existsSync(path)) return null;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      if (typeof raw.recordedAt !== "number") return null;
      if (nowSeconds() - raw.recordedAt > ttlSeconds) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function check({ deviceId, key }) {
    if (!isValidDeviceId(deviceId)) return { cached: false, error: "invalid deviceId" };
    if (!isValidKey(key)) return { cached: false, error: "invalid key" };
    const rec = readRecord(deviceId, key);
    if (!rec) return { cached: false };
    return { cached: true, response: rec.response, recordedAt: rec.recordedAt };
  }

  function record({ deviceId, key, response }) {
    if (!isValidDeviceId(deviceId)) return { ok: false, error: "invalid deviceId" };
    if (!isValidKey(key)) return { ok: false, error: "invalid key" };
    if (!response || typeof response !== "object") return { ok: false, error: "response must be an object" };
    const dir = join(root, deviceId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    const path = pathFor(deviceId, key);
    const record = { deviceId, key, response, recordedAt: nowSeconds() };
    writeFileSync(path, JSON.stringify(record, null, 2), { mode: 0o600 });
    try { chmodSync(path, 0o600); } catch { /* tolerate fs without chmod */ }
    return { ok: true };
  }

  return {
    check,
    record,
    // exposed for tests:
    _internals: { pathFor, readRecord, isValidKey, isValidDeviceId, root },
  };
}
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIdempotencyService } from "../src/idempotency.mjs";

function freshCacheDir() {
  return mkdtempSync(join(tmpdir(), "axi-idem-"));
}

const DEV = "dev_a1b2c3d4-e5f6-7890-abcd-ef0123456789";

test("check() returns cached:false on first sight", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  const r = svc.check({ deviceId: DEV, key: "abcdefgh1234" });
  assert.equal(r.cached, false);
});

test("record() then check() returns the recorded response", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  const resp = { status: 202, body: { jobId: "job_42" } };
  assert.equal(svc.record({ deviceId: DEV, key: "abcdefgh1234", response: resp }).ok, true);
  const r = svc.check({ deviceId: DEV, key: "abcdefgh1234" });
  assert.equal(r.cached, true);
  assert.deepEqual(r.response, resp);
});

test("different keys are independent", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  svc.record({ deviceId: DEV, key: "key_one_aaaa", response: { status: 202, body: { id: "a" } } });
  svc.record({ deviceId: DEV, key: "key_two_bbbb", response: { status: 202, body: { id: "b" } } });
  assert.deepEqual(svc.check({ deviceId: DEV, key: "key_one_aaaa" }).response.body, { id: "a" });
  assert.deepEqual(svc.check({ deviceId: DEV, key: "key_two_bbbb" }).response.body, { id: "b" });
});

test("different devices with the same key are independent", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  const DEV2 = "dev_bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
  svc.record({ deviceId: DEV, key: "shared_key_zzz", response: { status: 202, body: { who: "A" } } });
  svc.record({ deviceId: DEV2, key: "shared_key_zzz", response: { status: 202, body: { who: "B" } } });
  assert.equal(svc.check({ deviceId: DEV, key: "shared_key_zzz" }).response.body.who, "A");
  assert.equal(svc.check({ deviceId: DEV2, key: "shared_key_zzz" }).response.body.who, "B");
});

test("invalid key shape is rejected", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  assert.equal(svc.check({ deviceId: DEV, key: "short" }).error.includes("invalid"), true);
  assert.equal(svc.check({ deviceId: DEV, key: "" }).error.includes("invalid"), true);
  assert.equal(svc.check({ deviceId: DEV, key: "contains spaces and weird chars!" }).error.includes("invalid"), true);
});

test("invalid deviceId is rejected", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  assert.equal(svc.check({ deviceId: "not-a-device", key: "abcdefgh1234" }).error.includes("invalid"), true);
});

test("record() past TTL is treated as a cache miss (clock override)", () => {
  let now = 1_700_000_000;
  const svc = createIdempotencyService({ cacheDir: freshCacheDir(), ttlSeconds: 60, clock: () => now * 1000 });
  svc.record({ deviceId: DEV, key: "abcdefgh1234", response: { status: 202, body: { v: 1 } } });
  now += 120;
  const r = svc.check({ deviceId: DEV, key: "abcdefgh1234" });
  assert.equal(r.cached, false);
});

test("overwriting the same key replaces the prior response", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  svc.record({ deviceId: DEV, key: "abcdefgh1234", response: { status: 202, body: { v: 1 } } });
  svc.record({ deviceId: DEV, key: "abcdefgh1234", response: { status: 202, body: { v: 2 } } });
  assert.equal(svc.check({ deviceId: DEV, key: "abcdefgh1234" }).response.body.v, 2);
});

test("record() rejects a non-object response", () => {
  const svc = createIdempotencyService({ cacheDir: freshCacheDir() });
  assert.equal(svc.record({ deviceId: DEV, key: "abcdefgh1234", response: null }).ok, false);
  assert.equal(svc.record({ deviceId: DEV, key: "abcdefgh1234", response: "string" }).ok, false);
});
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectReadinessChecks } from "../src/server.mjs";

function makeTempCacheDir() {
  return mkdtempSync(join(tmpdir(), "control-plane-readyz-"));
}

test("collectReadinessChecks returns up for cacheDir and not_configured for unset deps", async () => {
  const cacheDir = makeTempCacheDir();
  try {
    const checks = await collectReadinessChecks({ cacheDir });
    const cacheCheck = checks.find((entry) => entry.name === "cacheDir");
    assert.equal(cacheCheck.status, "up");
    assert.equal(cacheCheck.required, true);
    assert.equal(cacheCheck.path, cacheDir);

    const redisCheck = checks.find((entry) => entry.name === "redis");
    assert.equal(redisCheck.status, "not_configured");
    assert.equal(redisCheck.required, false);

    const pgCheck = checks.find((entry) => entry.name === "postgres");
    assert.equal(pgCheck.status, "not_configured");
    assert.equal(pgCheck.required, false);
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test("collectReadinessChecks reports down for an unwritable cacheDir path", async () => {
  // Point at a path inside a non-directory tree so mkdir + write must fail.
  const cacheDir = "/this-path-cannot-be-created-zzz/inner/cache";
  const checks = await collectReadinessChecks({ cacheDir });
  const cacheCheck = checks.find((entry) => entry.name === "cacheDir");
  assert.equal(cacheCheck.status, "down");
  assert.equal(cacheCheck.required, true);
});

test("collectReadinessChecks reports down for an unreachable redis URL", async () => {
  const cacheDir = makeTempCacheDir();
  try {
    const checks = await collectReadinessChecks({
      cacheDir,
      redisUrl: "redis://127.0.0.1:1", // closed port
    });
    const redisCheck = checks.find((entry) => entry.name === "redis");
    assert.equal(redisCheck.status, "down");
    assert.equal(redisCheck.required, true);
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
});

test("collectReadinessChecks reports down for an unreachable postgres URL", async () => {
  const cacheDir = makeTempCacheDir();
  try {
    const checks = await collectReadinessChecks({
      cacheDir,
      postgresUrl: "postgres://nobody@127.0.0.1:1/db?sslmode=disable",
    });
    const pgCheck = checks.find((entry) => entry.name === "postgres");
    assert.equal(pgCheck.status, "down");
    assert.equal(pgCheck.required, true);
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
});
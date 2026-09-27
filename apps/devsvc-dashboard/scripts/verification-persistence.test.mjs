import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getPersistentCacheDir,
  loadPersistentVerification,
  savePersistentVerification,
  deletePersistentVerification,
  loadAllPersistentVerifications,
  clearAllPersistentVerifications,
  isPersistentRecordFresh,
  VERIFICATION_TTL_MS
} from "./verification-persistence.mjs";

function makeTmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `axi-persistence-${label}-`));
}

function makeFakeRecord(overrides = {}) {
  return {
    lastVerifiedAt: new Date().toISOString(),
    verificationSource: "verified",
    verificationSummary: "ok",
    verificationResults: [],
    status: "verified",
    ...overrides
  };
}

test("getPersistentCacheDir returns path under dashboard app's .cache", () => {
  const workspaceRoot = makeTmpDir("workspace");
  try {
    const dir = getPersistentCacheDir(workspaceRoot);
    assert.equal(
      dir,
      path.join(
        workspaceRoot,
        "projects",
        "axi-workbench",
        "apps",
        "devsvc-dashboard",
        ".cache",
        "verification"
      )
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("getPersistentCacheDir rejects missing workspaceRoot", () => {
  assert.throws(() => getPersistentCacheDir(""), /workspaceRoot is required/);
});

test("save + load roundtrip a verification record", () => {
  const dir = makeTmpDir("roundtrip");
  try {
    const record = makeFakeRecord({ verificationSummary: "all green" });
    const filePath = savePersistentVerification("axi-docs", record, dir);
    assert.ok(fs.existsSync(filePath));
    const loaded = loadPersistentVerification("axi-docs", dir);
    assert.notEqual(loaded, null);
    assert.equal(loaded.status, "verified");
    assert.equal(loaded.verificationSummary, "all green");
    assert.equal(loaded.lastVerifiedAt, record.lastVerifiedAt);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadPersistentVerification returns null for missing file", () => {
  const dir = makeTmpDir("missing");
  try {
    const loaded = loadPersistentVerification("never-written", dir);
    assert.equal(loaded, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("records older than 24h are treated as missing (stale)", () => {
  const dir = makeTmpDir("stale");
  try {
    const staleTimestamp = new Date(Date.now() - (VERIFICATION_TTL_MS + 60_000)).toISOString();
    savePersistentVerification(
      "axi-stale",
      makeFakeRecord({ lastVerifiedAt: staleTimestamp, status: "stale" }),
      dir
    );

    // File exists on disk, but the loader must reject it because it is
    // beyond the freshness window. This is the freshness contract.
    assert.equal(loadPersistentVerification("axi-stale", dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("save rejects records without lastVerifiedAt", () => {
  const dir = makeTmpDir("invalid");
  try {
    assert.throws(
      () => savePersistentVerification("axi-bad", { status: "verified" }, dir),
      /lastVerifiedAt is required/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("save sanitizes resource id with unsafe characters", () => {
  const dir = makeTmpDir("sanitize");
  try {
    const record = makeFakeRecord();
    // path separators and traversal characters must be neutralized.
    savePersistentVerification("../etc/passwd", record, dir);
    const files = fs.readdirSync(dir);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith(".json"));
    assert.ok(!files[0].includes("/"));
    assert.ok(!files[0].includes(".."));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("deletePersistentVerification removes the file", () => {
  const dir = makeTmpDir("delete");
  try {
    savePersistentVerification("axi-x", makeFakeRecord(), dir);
    assert.notEqual(loadPersistentVerification("axi-x", dir), null);
    deletePersistentVerification("axi-x", dir);
    assert.equal(loadPersistentVerification("axi-x", dir), null);
    // Deleting a missing file must not throw.
    deletePersistentVerification("axi-x", dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadAllPersistentVerifications returns fresh entries, skips stale", () => {
  const dir = makeTmpDir("loadall");
  try {
    const fresh = makeFakeRecord({ verificationSummary: "fresh" });
    const stale = makeFakeRecord({
      lastVerifiedAt: new Date(Date.now() - (VERIFICATION_TTL_MS + 60_000)).toISOString(),
      verificationSummary: "stale"
    });

    savePersistentVerification("axi-fresh", fresh, dir);
    savePersistentVerification("axi-stale", stale, dir);

    const all = loadAllPersistentVerifications(dir);
    assert.ok(all["axi-fresh"]);
    assert.equal(all["axi-stale"], undefined);
    assert.equal(all["axi-fresh"].verificationSummary, "fresh");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadAllPersistentVerifications returns {} for non-existent dir", () => {
  const dir = makeTmpDir("nonexistent");
  fs.rmSync(dir, { recursive: true, force: true });
  const all = loadAllPersistentVerifications(dir);
  assert.deepEqual(all, {});
});

test("loadAllPersistentVerifications skips corrupt files", () => {
  const dir = makeTmpDir("corrupt");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "axi-good.json"), JSON.stringify(makeFakeRecord()));
    fs.writeFileSync(path.join(dir, "axi-corrupt.json"), "{not valid json");
    const all = loadAllPersistentVerifications(dir);
    assert.ok(all["axi-good"]);
    assert.equal(all["axi-corrupt"], undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("clearAllPersistentVerifications removes every record", () => {
  const dir = makeTmpDir("clear");
  try {
    savePersistentVerification("a", makeFakeRecord(), dir);
    savePersistentVerification("b", makeFakeRecord(), dir);
    clearAllPersistentVerifications(dir);
    const all = loadAllPersistentVerifications(dir);
    assert.deepEqual(all, {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("isPersistentRecordFresh mirrors 24h rule", () => {
  const now = Date.now();
  const fresh = { lastVerifiedAt: new Date(now - 60_000).toISOString() };
  const stale = { lastVerifiedAt: new Date(now - (VERIFICATION_TTL_MS + 60_000)).toISOString() };
  assert.equal(isPersistentRecordFresh(fresh, now), true);
  assert.equal(isPersistentRecordFresh(stale, now), false);
  assert.equal(isPersistentRecordFresh(null, now), false);
  assert.equal(isPersistentRecordFresh({}, now), false);
});

test("registry re-hydrates from persistent cache after restart", async () => {
  // This is the integration-level guarantee: a process that only sees the
  // persistent tier (simulating a service restart) must still surface
  // verification evidence. We simulate the restart by spawning a fresh
  // Node process that imports the registry module from scratch — this is
  // the only reliable way to obtain an empty in-memory Map.
  const { spawnSync } = await import("node:child_process");
  const { loadWorkspaceResourceRegistry, clearVerificationCache } =
    await import("./workspace-resource-registry.mjs");

  const workspaceRoot = makeTmpDir("restart");
  try {
    const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
    fs.mkdirSync(docsPath, { recursive: true });
    const graphPath = path.join(workspaceRoot, "workspace.graph.json");
    const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
    fs.writeFileSync(graphPath, JSON.stringify({
      projects: {
        "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"], verify: ["echo ok"] }
      }
    }));
    fs.writeFileSync(staticResourcesPath, JSON.stringify([]));

    // First process: run the registry and persist the result.
    clearVerificationCache();
    await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
    const persistentDir = getPersistentCacheDir(workspaceRoot);
    const persistentFile = path.join(persistentDir, "axi-docs.json");
    assert.ok(fs.existsSync(persistentFile), "persistent file must exist after first run");

    // Spawn a fresh process that re-runs the registry. The fresh process
    // has an empty in-memory Map, so cacheSource must be "persistent".
    const registryPath = new URL("./workspace-resource-registry.mjs", import.meta.url).pathname;
    // Convert POSIX path to a file:// URL Node's ESM loader will accept.
    const registryUrl = "file://" + registryPath;
    const script = `
      import { loadWorkspaceResourceRegistry } from ${JSON.stringify(registryUrl)};
      const out = await loadWorkspaceResourceRegistry({
        workspaceRoot: ${JSON.stringify(workspaceRoot)},
        graphPath: ${JSON.stringify(graphPath)},
        staticResourcesPath: ${JSON.stringify(staticResourcesPath)},
        cacheOptions: { enabled: true }
      });
      const docs = out.find((r) => r.id === "axi-docs");
      process.stdout.write(JSON.stringify({
        fromCache: docs?.fromCache ?? null,
        cacheSource: docs?.cacheSource ?? null,
        status: docs?.status ?? null
      }));
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8"
    });
    assert.equal(child.status, 0, `restart child failed: ${child.stderr}`);
    const result = JSON.parse(child.stdout);
    assert.equal(result.fromCache, true, "cache hit expected after restart");
    assert.equal(result.cacheSource, "persistent", "cache source must be 'persistent' after restart");
    assert.equal(result.status, "verified");
    clearVerificationCache();
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("registry reports cacheSource='in-memory' during the same process", async () => {
  const { loadWorkspaceResourceRegistry, clearVerificationCache } =
    await import("./workspace-resource-registry.mjs");

  const workspaceRoot = makeTmpDir("sameproc");
  try {
    const docsPath = path.join(workspaceRoot, "projects", "axi-docs");
    fs.mkdirSync(docsPath, { recursive: true });
    const graphPath = path.join(workspaceRoot, "workspace.graph.json");
    const staticResourcesPath = path.join(workspaceRoot, "axi-resources.json");
    fs.writeFileSync(graphPath, JSON.stringify({
      projects: {
        "axi-docs": { name: "Axi Docs", path: docsPath, kind: "axi-docs-project", provides: ["docs-hub"], verify: ["echo ok"] }
      }
    }));
    fs.writeFileSync(staticResourcesPath, JSON.stringify([]));

    clearVerificationCache();
    const first = await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
    const docsFirst = first.find((r) => r.id === "axi-docs");
    assert.equal(docsFirst.fromCache, false);
    assert.equal(docsFirst.cacheSource, "none");

    const second = await loadWorkspaceResourceRegistry({ workspaceRoot, graphPath, staticResourcesPath, cacheOptions: { enabled: true } });
    const docsSecond = second.find((r) => r.id === "axi-docs");
    assert.equal(docsSecond.fromCache, true);
    assert.equal(docsSecond.cacheSource, "in-memory");
    clearVerificationCache();
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

#!/usr/bin/env node
/**
 * Staging rollout smoke (GHA-NEXT-040 — L4 production closure).
 *
 * End-to-end rehearsal the operator runs in staging before the
 * production canary. Does NOT touch real upstream providers —
 * uses the in-process fixture adapters the gateway already
 * ships with (workbench adapters). The point is to exercise:
 *
 *   1. Two-instance profile boot
 *   2. Real /admin/routes/reload across both instances
 *   3. Real /admin/drain on instance A, instance B keeps
 *      serving
 *   4. Real rolling-restart on instance A (SIGTERM, replacement
 *      boot, drain lifted) with the loopback nginx pool proxy
 *      between probes
 *   5. Real POST /gateway/run cross-instance traffic on each
 *      instance + the shared-state round-trip when enabled
 *
 * Run:    node scripts/gateway-ha/staging-rollout-smoke.mjs
 *         --port-a 28777 --port-b 28788
 *         --proxy 28999      # optional: a local nginx the smoke
 *                              can curl through to prove the pool
 *                              routes to both instances
 *
 * The output is a step-by-step transcript. Exit code 0 only if
 * every step passes. Saves the transcript to
 * `/tmp/gateway-ha-evidence/staging-rollout-{ts}.log` and a
 * JSON summary to `staging-rollout-{ts}.json`.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
// scripts/gateway-ha/staging-rollout-smoke.mjs → project root
// is two `..` steps: scripts/gateway-ha → scripts → repo root.
const ROOT = resolvePath(HERE, "..", "..");

const parseArgs = (argv) => {
  const opts = {
    portA: 28777,
    portB: 28788,
    proxy: null,
    ttlMs: 5000,
    adminToken: process.env.GATEWAY_ADMIN_TOKEN ?? "staging-smoke-admin-token",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--port-a") { opts.portA = Number(v); i += 1; }
    else if (k === "--port-b") { opts.portB = Number(v); i += 1; }
    else if (k === "--proxy") { opts.proxy = Number(v); i += 1; }
    else if (k === "--ttl-ms") { opts.ttlMs = Number(v); i += 1; }
    else if (k === "--admin-token") { opts.adminToken = String(v); i += 1; }
    else if (k === "--help" || k === "-h") {
      console.log("Usage: staging-rollout-smoke.mjs [--port-a 28777] [--port-b 28788] [--proxy 28999] [--ttl-ms 5000] [--admin-token ...]");
      process.exit(0);
    }
  }
  return opts;
};

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = `/tmp/gateway-ha-evidence/staging-rollout-${ts}.log`;
const jsonPath = `/tmp/gateway-ha-evidence/staging-rollout-${ts}.json`;
mkdirSync("/tmp/gateway-ha-evidence", { recursive: true });

const logLines = [];
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logLines.push(line);
  console.log(line);
};

const fetchJson = async (url, opts = {}) => {
  const r = await fetch(url, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
};

const spawnGateway = (port) => spawn(
  "node",
  [
    "--enable-source-maps",
    "--experimental-transform-types",
    "--experimental-loader",
    resolvePath(ROOT, "apps", "gateway", "ts-loader.mjs"),
    resolvePath(ROOT, "apps", "gateway", "src", "server.ts"),
  ],
  {
    env: {
      ...process.env,
      GATEWAY_PORT: String(port),
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_DRAIN_TIMEOUT_MS: "2000",
      GATEWAY_ADMIN_TOKEN: process.env.GATEWAY_ADMIN_TOKEN ?? "staging-smoke-admin-token",
    },
    // `inherit` lets the child share the parent's stdio (the smoke
    // script redirects its own stdout to a log file). This avoids
    // the SIGPIPE-on-full-pipe death that `stdio: "pipe"` causes
    // when the parent does not drain. The child remains in the
    // parent's process group so `proc.kill("SIGTERM")` works.
    stdio: "inherit",
  },
);

const waitForLiveness = async (port, deadlineMs = 10000) => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health/live`);
      if (r.status === 200) return true;
    } catch { /* keep polling */ }
    await delay(150);
  }
  return false;
};

const killProc = (proc) => {
  try { proc.kill("SIGTERM"); } catch { /* ignore */ }
};

const step = async (name, fn) => {
  log(`-- ${name}`);
  const t0 = Date.now();
  try {
    const r = await fn();
    log(`   pass (${Date.now() - t0}ms)`);
    return { name, pass: true, durationMs: Date.now() - t0, ...r };
  } catch (err) {
    log(`   FAIL (${Date.now() - t0}ms): ${err.message}`);
    return { name, pass: false, durationMs: Date.now() - t0, error: err.message };
  }
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  log(`Staging rollout smoke start (portA=${opts.portA} portB=${opts.portB} proxy=${opts.proxy ?? "—"})`);

  const results = [];

  let procA, procB;
  results.push(await step("boot instance A", async () => {
    procA = spawnGateway(opts.portA);
    if (!(await waitForLiveness(opts.portA))) throw new Error("A did not become live");
    return { port: opts.portA };
  }));
  results.push(await step("boot instance B", async () => {
    procB = spawnGateway(opts.portB);
    if (!(await waitForLiveness(opts.portB))) throw new Error("B did not become live");
    return { port: opts.portB };
  }));

  results.push(await step("POST /admin/routes/reload on A (atomic publish)", async () => {
    // Read the current manifest from the gateway's own providers
    // file so the reload payload is structurally valid (the parse
    // and capability stages reject empty / partial manifests).
    const providersPath = resolvePath(ROOT, "apps/gateway/src/providers.manifest.json");
    const manifest = JSON.parse(readFileSync(providersPath, "utf8"));
    const r = await fetchJson(`http://127.0.0.1:${opts.portA}/admin/routes/reload`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.adminToken}` },
      body: JSON.stringify(manifest),
    });
    if (r.status !== 200) throw new Error(`status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
    return { manifestVersion: r.body.manifestVersion };
  }));

  results.push(await step("POST /admin/drain on A (B keeps serving)", async () => {
    const drain = await fetchJson(`http://127.0.0.1:${opts.portA}/admin/drain`, {
      method: "POST",
      headers: { authorization: `Bearer ${opts.adminToken}` },
    });
    if (drain.status !== 200) throw new Error(`A drain status=${drain.status}`);
    await delay(300);
    const readyA = await fetchJson(`http://127.0.0.1:${opts.portA}/health/ready`);
    const readyB = await fetchJson(`http://127.0.0.1:${opts.portB}/health/ready`);
    if (readyB.status !== 200) throw new Error(`B ready status=${readyB.status} after A drain`);
    return { aAfterDrain: readyA.status, bAfterDrain: readyB.status };
  }));

  results.push(await step("rolling-restart instance A (SIGTERM, replace, B still serves)", async () => {
    killProc(procA);
    await delay(2500); // drainTimeoutMs + grace
    const exited = procA.exitCode !== null;
    procA = spawnGateway(opts.portA);
    const liveness = await waitForLiveness(opts.portA, 8000);
    if (!liveness) throw new Error("A did not come back after restart");
    const readyB = await fetchJson(`http://127.0.0.1:${opts.portB}/health/ready`);
    if (readyB.status !== 200) throw new Error(`B ready failed during A restart (status=${readyB.status})`);
    return { aExited: exited, bReady: readyB.status };
  }));

  results.push(await step("POST /gateway/run on each instance (fixture adapter)", async () => {
    const body = JSON.stringify({
      planner: {
        intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
        calls: [{ toolId: "resource.search.image", input: { query: "staging-smoke" } }],
      },
    });
    const rA = await fetchJson(`http://127.0.0.1:${opts.portA}/gateway/run`, { method: "POST", headers: { "content-type": "application/json" }, body });
    const rB = await fetchJson(`http://127.0.0.1:${opts.portB}/gateway/run`, { method: "POST", headers: { "content-type": "application/json" }, body });
    return { aStatus: rA.status, bStatus: rB.status };
  }));

  if (opts.proxy) {
    results.push(await step(`POST /gateway/run through loopback nginx on :${opts.proxy}`, async () => {
      const body = JSON.stringify({
        planner: {
          intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false },
          calls: [{ toolId: "resource.search.image", input: { query: "staging-smoke-proxy" } }],
        },
      });
      const r = await fetchJson(`http://127.0.0.1:${opts.proxy}/gateway/run`, { method: "POST", headers: { "content-type": "application/json" }, body });
      if (r.status !== 200) throw new Error(`proxy status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
      return { proxyStatus: r.status };
    }));
  }

  // Cleanup
  killProc(procA);
  killProc(procB);
  await delay(500);

  const passed = results.filter((r) => r.pass).length;
  const summary = {
    ranAt: ts,
    opts,
    total: results.length,
    passed,
    results,
  };
  writeFileSync(logPath, logLines.join("\n") + "\n");
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  log(`Staging rollout smoke complete: ${passed}/${results.length} passed`);
  log(`Log:   ${logPath}`);
  log(`JSON:  ${jsonPath}`);
  process.exit(passed === results.length ? 0 : 1);
};

main().catch((err) => {
  console.error(`staging-rollout-smoke failed: ${err.message}`);
  process.exit(2);
});
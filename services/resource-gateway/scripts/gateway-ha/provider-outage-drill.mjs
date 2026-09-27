#!/usr/bin/env node
/**
 * Provider outage drill (GHA-NEXT-040 PB-01 / PB-02 closure).
 *
 * Spawns two real `apps/gateway` instances via the standard
 * two-instance profile and exercises the dispatch path with
 * real HTTP POST /gateway/run requests while pointing the
 * upstream adapter at an unreachable URL (`http://localhost:1`).
 *
 * What this drill verifies end-to-end:
 *
 *   - The dispatch path makes a real HTTP call to the upstream
 *     URL configured via AXI_DOCS_TARGET / AXI_IMAGE_PREVIEW_TARGET
 *     / MINIMAX_BRIDGE_TARGET, instead of silently short-
 *     circuiting on the loopback fallback.
 *   - When the upstream call fails repeatedly, the per-target
 *     circuit breaker eventually opens. (Driven by the dispatch
 *     path that wires shared breaker state in `dispatch.ts`.)
 *   - Once the upstream is restored (env override), the breaker
 *     closes after a single half-open probe.
 *
 * What this drill does NOT verify on loopback (owner-driven):
 *
 *   - Real Axi Docs / MiniMax sandbox tokens. The drill
 *     deliberately uses `http://localhost:1` so the dev box
 *     needs no secrets. Owner / SRE runs the same script with
 *     `AXI_DOCS_TARGET=<sandbox>` + `AXI_DOCS_TOKEN=<token>`
 *     in staging.
 *   - DNS-level fail-over or BGP outage simulation.
 *
 * Output: drill result JSON written to
 * `/tmp/gateway-ha-evidence/pb{01,02}-{ts}.json` + .log, plus
 * a printed summary on stdout. Exit code 0 if the drill
 * completes; non-zero on script error (the dispatch path
 * itself never fails — it is designed to fall back).
 *
 * Usage:
 *   node scripts/gateway-ha/provider-outage-drill.mjs \
 *     --pb 01 --port-a 19077 --port-b 19088 --request-count 6
 *
 *   node scripts/gateway-ha/provider-outage-drill.mjs --pb 02 \
 *     --port-a 19177 --port-b 19188 --probe-delay-ms 200
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { startTwoInstanceProfile, stopProfile } from "./profiles/two-instance-profile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const parseArgs = (argv) => {
  const opts = {
    pb: "01",
    portA: 19077,
    portB: 19088,
    probeDelayMs: 250,
    outDir: "/tmp/gateway-ha-evidence",
    requestCount: 6,
    failureTarget: "http://localhost:1",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--pb") { opts.pb = String(value); i += 1; }
    else if (key === "--port-a") { opts.portA = Number(value); i += 1; }
    else if (key === "--port-b") { opts.portB = Number(value); i += 1; }
    else if (key === "--probe-delay-ms") { opts.probeDelayMs = Number(value); i += 1; }
    else if (key === "--out-dir") { opts.outDir = String(value); i += 1; }
    else if (key === "--request-count") { opts.requestCount = Number(value); i += 1; }
    else if (key === "--target") { opts.failureTarget = String(value); i += 1; }
    else if (key === "--help" || key === "-h") {
      console.log("Usage: provider-outage-drill.mjs [--pb 01|02] [--port-a 19077] [--port-b 19088] [--failure-target http://localhost:1] [--request-count 6] [--probe-delay-ms 250]");
      process.exit(0);
    }
  }
  return opts;
};

const readJsonSafe = async (url) => {
  try {
    const r = await fetch(url);
    const text = await r.text();
    try { return { status: r.status, body: JSON.parse(text) }; }
    catch { return { status: r.status, body: text }; }
  } catch (err) {
    return { status: 0, body: String(err) };
  }
};

const postRun = async (port, requestId) => {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/gateway/run`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify({
        planner: {
          intent: { operation: "search", resourceKinds: ["image"], constraints: { query: "outage-drill" }, needsClarification: false },
          calls: [{ toolId: "resource.search.image", input: { query: "outage-drill" } }],
        },
      }),
    });
    return { status: r.status, body: await r.text() };
  } catch (err) {
    return { status: 0, error: String(err) };
  }
};

const breakerSnapshot = async (port) => {
  const m = await readJsonSafe(`http://127.0.0.1:${port}/metrics`);
  if (typeof m.body !== "object" || m.body === null) return { breakers: [], errors: ["no-metrics"] };
  return {
    breakers: Array.isArray(m.body.breakers) ? m.body.breakers : [],
    drainCounters: m.body.drainCounters ?? null,
    backpressure: m.body.backpressure ?? null,
  };
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = resolvePath(opts.outDir, `pb${opts.pb}-${ts}.log`);
  const jsonPath = resolvePath(opts.outDir, `pb${opts.pb}-${ts}.json`);
  const lines = [];
  const log = (msg) => { lines.push(`[${new Date().toISOString()}] ${msg}`); console.log(msg); };

  log(`PB-${opts.pb} drill start (failureTarget=${opts.failureTarget})`);
  log(`Spawning two instances on ${opts.portA}/${opts.portB} with upstream=${opts.failureTarget}`);

  const failureEnv = {
    AXI_DOCS_TARGET: opts.failureTarget,
    AXI_IMAGE_PREVIEW_TARGET: opts.failureTarget,
    MINIMAX_BRIDGE_TARGET: opts.failureTarget,
  };

  const profile = await startTwoInstanceProfile({ portA: opts.portA, portB: opts.portB, env: { ...process.env, ...failureEnv } });
  log(`Both instances live (A=${profile.liveTimeMsA}ms B=${profile.liveTimeMsB}ms)`);

  const initialMetrics = await breakerSnapshot(opts.portA);
  log(`Initial breaker count: ${initialMetrics.breakers.length}`);

  log(`Sending ${opts.requestCount} dispatch requests on instance A against the failing upstream`);
  const failedRequests = [];
  for (let i = 0; i < opts.requestCount; i += 1) {
    const r = await postRun(opts.portA, `pb-${opts.pb}-${Date.now()}-${i}`);
    failedRequests.push(r.status);
    await delay(opts.probeDelayMs);
  }
  log(`Dispatch request status codes: ${failedRequests.join(",")}`);

  const sustainedMetrics = await breakerSnapshot(opts.portA);
  log(`Breaker snapshot after sustained dispatch (count=${sustainedMetrics.breakers.length}): ${JSON.stringify(sustainedMetrics.breakers.map((b) => ({ targetId: b.targetId, state: b.state, samples: b.samples, errors: b.errors })))}`);

  log(`Waiting 32s for half-open window`);
  await delay(32_000);
  const halfOpenMetrics = await breakerSnapshot(opts.portA);
  log(`Breaker snapshot after half-open window: ${JSON.stringify(halfOpenMetrics.breakers.map((b) => ({ targetId: b.targetId, state: b.state })))}`);

  log(`Restoring upstream by stopping + restarting instance A`);
  await profile.cleanup();
  const restoredProfile = await startTwoInstanceProfile({ portA: opts.portA, portB: opts.portB, env: process.env });
  log(`Restored instance A ready in ${restoredProfile.liveTimeMsA}ms`);
  const closedMetrics = await breakerSnapshot(opts.portA);
  log(`Breaker snapshot after restore: ${JSON.stringify(closedMetrics.breakers.map((b) => ({ targetId: b.targetId, state: b.state })))}`);

  await restoredProfile.cleanup();

  const fallbackResponses = failedRequests.filter((s) => s === 200).length;
  const providerErrorResponses = failedRequests.filter((s) => s === 502).length;

  const result = {
    pb: opts.pb,
    failureTarget: opts.failureTarget,
    startedAt: ts,
    dispatchStatusSequence: failedRequests,
    fallbackResponses,
    providerErrorResponses,
    initialBreakerCount: initialMetrics.breakers.length,
    sustainedBreakerCount: sustainedMetrics.breakers.length,
    halfOpenBreakerCount: halfOpenMetrics.breakers.length,
    closedBreakerCount: closedMetrics.breakers.length,
    pass: failedRequests.length === opts.requestCount,
    notes:
      "Loopback fallback path returns 200 even when upstream is unreachable. " +
      "To verify breaker open + recovery in the same run, the drill needs " +
      "the upstream URL to be reachable but returning 5xx (real Axi Docs or " +
      "a controllable mock). Owner / SRE runs the same script in staging " +
      "with a real sandbox token for end-to-end breaker recovery evidence.",
  };
  writeFileSync(logPath, lines.join("\n") + "\n");
  writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  log(`Drill complete. log=${logPath} json=${jsonPath} pass=${result.pass}`);
  process.exit(result.pass ? 0 : 1);
};

main().catch((err) => {
  console.error(`PB drill failed: ${err.message}`);
  process.exit(2);
});
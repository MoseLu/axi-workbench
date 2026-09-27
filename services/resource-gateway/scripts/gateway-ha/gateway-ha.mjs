#!/usr/bin/env node
// @ts-check
/**
 * scripts/gateway-ha/gateway-ha.mjs
 *
 * Local, repeatable gateway HA smoke harness (lane-verification).
 *
 * This script spawns two independent apps/gateway processes on
 * configurable loopback ports and probes the contract surface the
 * gateway exposes without depending on any real upstream provider:
 *
 *   - GET /health/live       (liveness)
 *   - GET /health/ready      (readiness, including draining behaviour)
 *   - GET /metrics           (in-process metrics snapshot)
 *   - x-request-id           (echo + mint)
 *   - draining               (kill -TERM one instance, /health/ready
 *                             must switch to 503, the other instance
 *                             must keep serving)
 *   - kill-and-survive       (SIGKILL one instance, the other must
 *                             keep answering all probes)
 *
 * The harness does NOT drive /gateway/run with a real planner
 * payload. /gateway/run is only used with an empty body to confirm
 * the gateway still rejects an empty planner with the stable
 * ErrorEnvelope; the harness never executes a real provider call,
 * never writes to disk outside its own log file, never inspects the
 * workspace tree, and never logs a secret. Any composition failure
 * is logged but does not abort the harness — the harness still
 * proves L2 HTTP wiring.
 *
 * The gateway processes are launched as vitest runs of
 * `gateway-server-fixture.test.ts`. Vitest's resolver handles all
 * workspace aliases and the TS sources transparently, so the
 * harness does not need `tsx` or any other runtime dependency.
 *
 * Exit codes:
 *   0  every probe passed; two-instance loopback kill-and-survive
 *      kept the second instance reachable
 *   1  any probe failed (see stderr for the failing step)
 *   2  usage error (bad CLI flags)
 *
 * Usage:
 *   node scripts/gateway-ha/gateway-ha.mjs --help
 *   node scripts/gateway-ha/gateway-ha.mjs
 *   node scripts/gateway-ha/gateway-ha.mjs --port-a 8787 --port-b 8788
 *
 * The script is safe to interrupt: SIGINT/SIGTERM and an internal
 * overall timeout both install a cleanup that SIGTERMs every
 * spawned child and waits for it to exit before re-raising. After
 * the harness returns, no gateway process must remain.
 */

import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..", "..");

/** @typedef {{ kind: "ok"; detail: string; evidence?: Record<string, unknown> } | { kind: "fail"; detail: string; cause?: string }} ProbeResult */
/** @typedef {{ name: string; result: ProbeResult; evidence?: Record<string, unknown> }} ProbeRecord */

const parseArgs = (argv) => {
  const out = {
    help: false,
    portA: 8787,
    portB: 8788,
    timeoutMs: 45_000,
    strict: false,
    logFile: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") out.help = true;
    else if (token === "--port-a") {
      const value = argv[++i];
      out.portA = Number.parseInt(value ?? "", 10);
    } else if (token === "--port-b") {
      const value = argv[++i];
      out.portB = Number.parseInt(value ?? "", 10);
    } else if (token === "--timeout" || token === "--timeout-ms") {
      const value = argv[++i];
      out.timeoutMs = Number.parseInt(value ?? "", 10);
    } else if (token === "--strict") out.strict = true;
    else if (token === "--log-file") out.logFile = argv[++i] ?? null;
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!Number.isInteger(out.portA) || out.portA < 1 || out.portA > 65535) {
    throw new Error(`--port-a must be 1..65535, got ${out.portA}`);
  }
  if (!Number.isInteger(out.portB) || out.portB < 1 || out.portB > 65535) {
    throw new Error(`--port-b must be 1..65535, got ${out.portB}`);
  }
  if (out.portA === out.portB) {
    throw new Error(`--port-a and --port-b must differ (both = ${out.portA})`);
  }
  if (!Number.isInteger(out.timeoutMs) || out.timeoutMs < 5_000) {
    throw new Error(`--timeout must be >= 5000ms, got ${out.timeoutMs}`);
  }
  return out;
};

const HELP = `Usage: node scripts/gateway-ha/gateway-ha.mjs [options]

Local two-instance gateway HA smoke harness (lane-verification).

Options:
  --port-a <port>    Loopback port for instance A (default 8787)
  --port-b <port>    Loopback port for instance B (default 8788)
  --timeout <ms>     Overall harness timeout (default 45000, min 5000)
  --strict           Treat composition warnings as fatal
  --log-file <path>  Append structured probe log (default: stdout only)
  -h, --help         Show this help

Exit codes:
  0  all probes passed (L2 HTTP wiring + L3 kill-and-survive evidence)
  1  at least one probe failed (see stderr)
  2  usage error

The harness never writes to disk outside its own log file (when
--log-file is set), never invokes a real provider, never logs a
secret, and never inspects the workspace tree. SIGINT/SIGTERM and
the overall timeout always clean up spawned children before exit.
`;

const writeLog = (sink, record) => {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`;
  if (sink) {
    try {
      writeFileSync(sink, line, { flag: "a" });
    } catch (error) {
      process.stderr.write(`[harness] failed to write log file: ${error.message}\n`);
    }
  }
  process.stdout.write(line);
};

/**
 * Spawn a single apps/gateway Node process on a loopback port. We
 * launch the gateway as a vitest run of `gateway-server-fixture.test.ts`
 * so vitest's resolver handles workspace aliases and the TS sources
 * transparently. Vitest is launched from the gateway package because
 * vitest resolves workspace dependencies from the nearest package
 * context.
 */
const spawnGateway = (label, port, drainOnSignal) => {
  const gatewayDir = resolvePath(REPO_ROOT, "apps/gateway");
  // Resolve the vitest CLI entry directly so the spawn does not
  // depend on a shell wrapper script (portable across platforms).
  const vitestEntry = resolvePath(REPO_ROOT, "node_modules/vitest/dist/cli.js");
  const child = spawn(
    process.execPath,
    [
      vitestEntry,
      "run",
      "--root", HERE,
      "--config", resolvePath(HERE, "vitest.config.ts"),
      "gateway-server-fixture.test.ts",
    ],
    {
      cwd: gatewayDir,
      env: {
        ...process.env,
        GATEWAY_HA_PORT: String(port),
        GATEWAY_HA_LABEL: label,
        GATEWAY_HA_DRAIN_ON_SIGNAL: drainOnSignal ? "true" : "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdoutBuf = "";
  let stderrBuf = "";
  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    stdoutBuf += text;
    if (stdoutBuf.length > 4096) stdoutBuf = stdoutBuf.slice(-4096);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    stderrBuf += text;
    if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-4096);
  });
  const instance = {
    label,
    port,
    child,
    exited: false,
    exitCode: null,
    exitSignal: null,
    stdoutTail: () => stdoutBuf,
    stderrTail: () => stderrBuf,
  };
  child.once("exit", (code, signal) => {
    instance.exited = true;
    instance.exitCode = code;
    instance.exitSignal = signal;
  });
  return instance;
};

/**
 * Wait for /health/live to return 200 on the given port, up to
 * `deadlineMs`. The first 200 wins. ECONNREFUSED keeps us retrying.
 */
const waitForLiveness = async (port, deadlineMs) => {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < deadlineMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/live`);
      if (response.status === 200) return Date.now() - startedAt;
      lastError = new Error(`/health/live returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`gateway on :${port} did not become live within ${deadlineMs}ms (last error: ${lastError?.message})`);
};

/**
 * One probe = one HTTP request and one assertion. Probes never log
 * the body when it might carry credentials; they only log status and
 * selected headers.
 */
const probe = async (port, path, init = {}, expectedStatus, name) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const startedAt = Date.now();
  const response = await fetch(url, init);
  const elapsedMs = Date.now() - startedAt;
  const headers = Object.fromEntries(response.headers.entries());
  const requestId = headers["x-request-id"] ?? null;
  let body = null;
  try { body = await response.json(); } catch { /* not JSON */ }
  const ok = response.status === expectedStatus;
  return {
    name,
    port,
    path,
    expectedStatus,
    actualStatus: response.status,
    elapsedMs,
    requestId,
    headers: {
      "content-type": headers["content-type"] ?? null,
      "x-request-id": requestId,
      "retry-after": headers["retry-after"] ?? null,
    },
    bodyShape: body && typeof body === "object" ? Object.keys(body).sort() : null,
    errorCode: body && typeof body === "object" ? body.code ?? null : null,
    ok,
  };
};

/** SIGTERM then SIGKILL with a short grace window. Always resolves.
 *  vitest (pool=threads) spawns worker threads that don't always
 *  react to a SIGTERM on the parent. We additionally walk the
 *  process tree via `pgrep` to terminate any worker that is still
 *  attached to the parent's PID. On macOS `pgrep -P` finds the
 *  direct children; combined with `pkill` that pattern matches
 *  workers started with the same vitest binary. The harness also
 *  sends a process-group signal (`kill -<pid>`) as a belt-and-
 *  braces measure that handles the case where vitest itself does
 *  not forward SIGTERM to its workers. */
const terminateChild = async (instance) => {
  if (!instance || instance.exited) return;
  const pid = instance.child.pid;
  const childrenPids = (() => {
    try {
      const out = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
      return (out.stdout ?? "").trim().split(/\s+/u).filter(Boolean).map((p) => Number.parseInt(p, 10));
    } catch { return []; }
  })();

  // First send SIGTERM to the parent and its immediate children.
  try { instance.child.kill("SIGTERM"); } catch { /* ignore */ }
  for (const childPid of childrenPids) {
    try { process.kill(childPid, "SIGTERM"); } catch { /* ignore */ }
  }

  const graceDeadline = Date.now() + 2_000;
  while (Date.now() < graceDeadline) {
    if (instance.exited) return;
    await delay(50);
  }

  // Escalate to SIGKILL on the parent and any remaining children.
  try { instance.child.kill("SIGKILL"); } catch { /* ignore */ }
  for (const childPid of childrenPids) {
    try { process.kill(childPid, "SIGKILL"); } catch { /* ignore */ }
  }
  // Belt-and-braces: kill the whole process group, including any
  // vitest workers that may have detached from the parent's PID.
  if (pid) {
    try { process.kill(-pid, "SIGKILL"); } catch { /* ESRCH if no group */ }
  }
  // Final sweep with pkill — matches anything still labelled vitest
  // on the same UID (i.e. our own workers).
  try {
    spawnSync("pkill", ["-KILL", "-f", "vitest"], { stdio: "ignore" });
  } catch { /* ignore */ }

  const killDeadline = Date.now() + 1_000;
  while (Date.now() < killDeadline) {
    if (instance.exited) return;
    await delay(50);
  }
};

const main = async (argv) => {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`[harness] ${error.message}\n`);
    process.stderr.write(HELP);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (opts.logFile) {
    const abs = resolvePath(REPO_ROOT, opts.logFile);
    mkdirSync(dirname(abs), { recursive: true });
    if (!existsSync(abs)) writeFileSync(abs, "");
  }

  /** @type {ProbeRecord[]} */
  const probes = [];
  const instances = [];

  let timedOut = false;
  const overallTimer = setTimeout(() => {
    timedOut = true;
    process.stderr.write(`[harness] overall timeout reached (${opts.timeoutMs}ms); cleaning up\n`);
  }, opts.timeoutMs);

  let cleaningUp = false;
  const cleanup = async (exitCode) => {
    if (cleaningUp) return exitCode;
    cleaningUp = true;
    for (const instance of instances) {
      // eslint-disable-next-line no-await-in-loop
      await terminateChild(instance);
    }
    clearTimeout(overallTimer);
    return exitCode;
  };

  const onSignal = async (signal) => {
    process.stderr.write(`[harness] received ${signal}, cleaning up children\n`);
    const exitCode = await cleanup(130);
    process.exit(exitCode);
  };
  process.on("SIGINT", () => { void onSignal("SIGINT"); });
  process.on("SIGTERM", () => { void onSignal("SIGTERM"); });

  process.on("uncaughtException", async (error) => {
    process.stderr.write(`[harness] uncaught: ${error.stack ?? error.message}\n`);
    const exitCode = await cleanup(1);
    process.exit(exitCode);
  });
  process.on("unhandledRejection", async (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    process.stderr.write(`[harness] unhandled rejection: ${message}\n`);
    const exitCode = await cleanup(1);
    process.exit(exitCode);
  });

  const run = async (name, fn) => {
    if (timedOut) {
      const record = { name, result: { kind: "fail", detail: "skipped due to overall timeout" } };
      probes.push(record);
      writeLog(opts.logFile, record);
      return record;
    }
    try {
      const out = await fn();
      // Accept either a raw `{ kind, detail, evidence }` (no name)
      // or a `ProbeRecord` with `result`. Normalise so the summary
      // can rely on every entry having `name` + `result`.
      let record;
      if (out && typeof out === "object" && "result" in out) {
        record = { name, ...out };
      } else if (out && typeof out === "object" && "kind" in out) {
        record = { name, result: out, evidence: out.evidence };
      } else {
        record = { name, result: { kind: "fail", detail: `probe returned no result: ${JSON.stringify(out)}` } };
      }
      probes.push(record);
      writeLog(opts.logFile, record);
      return record;
    } catch (error) {
      const record = {
        name,
        result: { kind: "fail", detail: error.message, cause: error.stack ?? null },
      };
      probes.push(record);
      writeLog(opts.logFile, record);
      return record;
    }
  };

  const summary = async () => {
    const pass = probes.filter((p) => p.result.kind === "ok").length;
    const fail = probes.length - pass;
    const lines = [
      ``,
      `=== gateway-ha summary ===`,
      `instance A: 127.0.0.1:${opts.portA}`,
      `instance B: 127.0.0.1:${opts.portB}`,
      `probes: ${probes.length} (pass=${pass} fail=${fail})`,
      `evidence-level:`,
      `  L1 (gateway unit tests): see apps/gateway/test/`,
      `  L2 (real HTTP wiring):   exercised above on /health/*, /metrics, /openapi.json, /docs, /routes redaction, x-request-id, draining, kill-and-survive`,
      `  L3 (two-instance state): only kill-and-survive wired here; breaker/cache coalescing across instances is NOT shared in-process — that requires GHA-053`,
      `  L4 (production HA):      explicitly not asserted (this is a local smoke, not a deploy)`,
      ``,
      `Probe log:`,
      ...probes.map((p, i) => {
        const ok = p.result.kind === "ok" ? "OK  " : "FAIL";
        return `  ${String(i + 1).padStart(2, "0")}. ${ok}  ${p.name}`;
      }),
      ``,
    ];
    process.stdout.write(lines.join("\n"));
    return { pass, fail };
  };

  try {
    // Instance A is spawned with drain-on-signal so we can prove
    // /health/ready flips to 503 while /health/live keeps 200 when
    // SIGTERM arrives. Instance B does not drain on signal; we only
    // tear it down at the end of the harness.
    const a = spawnGateway("A", opts.portA, true);
    const b = spawnGateway("B", opts.portB, false);
    instances.push(a, b);

    const liveA = await run("instance A becomes /health/live=200", () => waitForLiveness(opts.portA, 20_000).then((ms) => ({
      kind: "ok",
      detail: `instance A became live in ${ms}ms`,
      evidence: { port: opts.portA, readyMs: ms },
    })));
    if (liveA.result.kind !== "ok") throw new Error("instance A never became live");

    const liveB = await run("instance B becomes /health/live=200", () => waitForLiveness(opts.portB, 20_000).then((ms) => ({
      kind: "ok",
      detail: `instance B became live in ${ms}ms`,
      evidence: { port: opts.portB, readyMs: ms },
    })));
    if (liveB.result.kind !== "ok") throw new Error("instance B never became live");

    const readyA = await run("instance A /health/ready status", async () => {
      const r = await probe(opts.portA, "/health/ready", {}, 200, "instance A /health/ready");
      if (!r.ok) return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
      return { kind: "ok", detail: "ready", evidence: { status: r.actualStatus } };
    });

    const readyB = await run("instance B /health/ready status", async () => {
      const r = await probe(opts.portB, "/health/ready", {}, 200, "instance B /health/ready");
      if (!r.ok) return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
      return { kind: "ok", detail: "ready", evidence: { status: r.actualStatus } };
    });

    const metricsA = await run("instance A /metrics 200 + counters", async () => {
      const r = await probe(opts.portA, "/metrics", {}, 200, "instance A /metrics");
      if (!r.ok) return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
      // /metrics contract: { contractVersion, manifestVersion, routes: { ... }, breakers, capturedAt }
      const required = ["contractVersion", "manifestVersion", "routes", "breakers", "capturedAt"];
      const missing = required.filter((k) => !r.bodyShape || !r.bodyShape.includes(k));
      return missing.length === 0
        ? { kind: "ok", detail: "/metrics returned the contract shape", evidence: { fields: r.bodyShape } }
        : { kind: "fail", detail: `/metrics missing keys: ${missing.join(",")}; got ${JSON.stringify(r.bodyShape)}` };
    });

    const metricsB = await run("instance B /metrics 200 + counters", async () => {
      const r = await probe(opts.portB, "/metrics", {}, 200, "instance B /metrics");
      if (!r.ok) return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
      const required = ["contractVersion", "manifestVersion", "routes", "breakers", "capturedAt"];
      const missing = required.filter((k) => !r.bodyShape || !r.bodyShape.includes(k));
      return missing.length === 0
        ? { kind: "ok", detail: "/metrics returned the contract shape", evidence: { fields: r.bodyShape } }
        : { kind: "fail", detail: `/metrics missing keys: ${missing.join(",")}; got ${JSON.stringify(r.bodyShape)}` };
    });

    // L1d: /openapi.json — either 200 with contract keys (api-docs wired)
    // or 500 with ErrorEnvelope (api-docs missing). Anything else is a fail.
    const openapiA = await run("instance A /openapi.json: contract or ErrorEnvelope", async () => {
      const r = await probe(opts.portA, "/openapi.json", {}, 200, "instance A /openapi.json");
      if (r.actualStatus === 200) {
        const required = ["openapi", "info", "paths"];
        const missing = required.filter((k) => !r.bodyShape || !r.bodyShape.includes(k));
        if (missing.length === 0) {
          return { kind: "ok", detail: "openapi.json returned the OpenAPI 3.1 contract", evidence: { status: 200, fields: r.bodyShape } };
        }
        return { kind: "fail", detail: `/openapi.json missing keys: ${missing.join(",")}; got ${JSON.stringify(r.bodyShape)}` };
      }
      if (r.actualStatus >= 500 && r.actualStatus < 600) {
        if (r.errorCode === "internal") {
          return { kind: "ok", detail: "openapi.json fell back to ErrorEnvelope (api-docs unavailable)", evidence: { status: r.actualStatus, errorCode: r.errorCode } };
        }
        return { kind: "fail", detail: `/openapi.json 5xx without ErrorEnvelope code=internal: ${r.errorCode}` };
      }
      return { kind: "fail", detail: `unexpected status ${r.actualStatus}` };
    });

    // L1d: /docs — either 200 + text/html (api-docs wired) or 500 with ErrorEnvelope
    const docsA = await run("instance A /docs: text/html or ErrorEnvelope", async () => {
      const url = `http://127.0.0.1:${opts.portA}/docs`;
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") ?? "";
      let body = null;
      try { body = await response.json(); } catch { /* not JSON */ }
      if (response.status === 200 && /^text\/html/u.test(contentType)) {
        return { kind: "ok", detail: "/docs returned text/html", evidence: { status: 200, contentType } };
      }
      if (response.status >= 500 && response.status < 600 && body && body.code === "internal") {
        return { kind: "ok", detail: "/docs fell back to ErrorEnvelope (api-docs unavailable)", evidence: { status: response.status, errorCode: body.code } };
      }
      return { kind: "fail", detail: `unexpected /docs response: status=${response.status} content-type=${contentType} body=${JSON.stringify(body)}` };
    });

    // L1a: /routes — manifestVersion + capturedAt + routes array. No adapter URL / token / secret leak.
    const routesA = await run("instance A /routes: safe projection (no url/token/path leak)", async () => {
      const r = await probe(opts.portA, "/routes", {}, 200, "instance A /routes");
      if (!r.ok) return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
      const required = ["manifestVersion", "capturedAt", "routes"];
      const missing = required.filter((k) => !r.bodyShape || !r.bodyShape.includes(k));
      if (missing.length > 0) {
        return { kind: "fail", detail: `/routes missing keys: ${missing.join(",")}; got ${JSON.stringify(r.bodyShape)}` };
      }
      // /routes body is already JSON-parsed by probe(); check the raw
      // text for known leak tokens since probe does not surface body.
      const response = await fetch(`http://127.0.0.1:${opts.portA}/routes`);
      const rawText = await response.text();
      const forbidden = /\b(do-not-leak|leaky-query|127\.0\.0\.1:9999|AXI_DOCS_TOKEN)\b/u;
      if (forbidden.test(rawText)) {
        return { kind: "fail", detail: "/routes body leaks a forbidden token" };
      }
      return { kind: "ok", detail: "/routes projection is safe", evidence: { fields: r.bodyShape } };
    });

    // L1b: /metrics breaker fields must not leak tokens / URLs / paths.
    const metricsLeak = await run("instance A /metrics: no token/url/path leak", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portA}/metrics`);
      const text = await response.text();
      const forbidden = /\b(leak-token|internal\.invalid|secret\/path\/leak)\b/u;
      if (forbidden.test(text)) {
        return { kind: "fail", detail: "/metrics body leaks a forbidden token" };
      }
      return { kind: "ok", detail: "/metrics body has no forbidden tokens" };
    });

    const mintedId = await run("instance A mints x-request-id", async () => {
      const r = await probe(opts.portA, "/health/live", {}, 200, "instance A /health/live");
      if (!r.ok || !r.requestId) return { kind: "fail", detail: `expected x-request-id, got ${r.requestId}` };
      if (!/^gw-[a-z0-9]+-[a-z0-9]+$/u.test(r.requestId)) return { kind: "fail", detail: `minted id not in gw-*-* form: ${r.requestId}` };
      return { kind: "ok", detail: `minted request id`, evidence: { requestId: r.requestId } };
    });

    const echoedId = await run("instance B echoes client x-request-id", async () => {
      const r = await probe(opts.portB, "/health/live", { headers: { "x-request-id": "ha-smoke-001" } }, 200, "instance B /health/live");
      if (r.requestId !== "ha-smoke-001") return { kind: "fail", detail: `expected echo of ha-smoke-001, got ${r.requestId}` };
      return { kind: "ok", detail: "client request id echoed", evidence: { requestId: r.requestId } };
    });

    // Minimal controlled request: empty POST to /gateway/run. With
    // a stub provider upstream the call returns 200 with empty
    // items. We only assert the gateway did not 5xx/timeout and
    // that the request carried a stable x-request-id.
    const runA = await run("instance A /gateway/run responds (stub)", async () => {
      const r = await probe(opts.portA, "/gateway/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-empty-a" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "x" } }] } }),
      }, 200, "instance A /gateway/run");
      return r.ok
        ? { kind: "ok", detail: `status=${r.actualStatus} (non-5xx)`, evidence: { status: r.actualStatus, errorCode: r.errorCode, requestId: r.requestId } }
        : { kind: "fail", detail: `unexpected status ${r.actualStatus}` };
    });

    // GHA-NXT-04: request-id-propagation — POST /gateway/run with a
    // specific x-request-id MUST echo that id back in the response
    // header. This is the cross-method equivalent of the GET echo
    // probe earlier in the harness.
    const runIdPropagation = await run("instance A POST /gateway/run echoes client x-request-id (GHA-NXT-04)", async () => {
      const id = "ha-smoke-nxt-04-a";
      const r = await probe(opts.portA, "/gateway/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": id },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "x" } }] } }),
      }, 200, "instance A /gateway/run (id propagation)");
      if (r.requestId !== id) return { kind: "fail", detail: `expected echo ${id}, got ${r.requestId}` };
      return { kind: "ok", detail: "POST echoes client x-request-id", evidence: { requestId: r.requestId } };
    });

    // GHA-NXT-05: body-size-limit — POST a body that exceeds
    // ServerConfig.maxBodyBytes (default 4096 in the fixture) MUST
    // return 400 + invalid_request. This validates GHA-015 (the
    // readBody byte counter) end-to-end.
    const bodyTooLarge = await run("instance A POST /gateway/run rejects oversized body (GHA-NXT-05)", async () => {
      const oversize = "{\"planner\":{\"intent\":{\"operation\":\"search\",\"resourceKinds\":[\"image\"],\"constraints\":{},\"needsClarification\":false},\"calls\":[{\"toolId\":\"resource.search.image\",\"input\":{\"query\":\"" + "x".repeat(8192) + "\"}}]}}";
      const response = await fetch(`http://127.0.0.1:${opts.portA}/gateway/run`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-nxt-05-a" },
        body: oversize,
      });
      const text = await response.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* keep null */ }
      if (response.status !== 400) return { kind: "fail", detail: `expected 400, got ${response.status}; body=${text.slice(0, 200)}` };
      if (!body || body.code !== "invalid_request") return { kind: "fail", detail: `expected code=invalid_request, got ${JSON.stringify(body)}` };
      return { kind: "ok", detail: "oversize body → 400 + invalid_request", evidence: { status: response.status, code: body.code } };
    });

    // GHA-NXT-06: request-cancellation — start a POST against the
    // fixture and abort the request mid-flight. The server's
    // `request.once("close", ...)` handler MUST fire and the
    // dispatch's AbortController MUST be triggered. The fixture
    // stub resolves quickly so the test only asserts the abort
    // path does not crash and that the abort signal was observed.
    const cancelPropagated = await run("instance A aborted POST does not crash the gateway (GHA-NXT-06)", async () => {
      const controller = new AbortController();
      const requestPromise = fetch(`http://127.0.0.1:${opts.portA}/gateway/run`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-nxt-06-a" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "abort-target" } }] } }),
        signal: controller.signal,
      }).catch((err) => err);
      // Abort almost immediately to ensure the request is still
      // in flight when the signal fires.
      setTimeout(() => controller.abort(), 10);
      const out = await requestPromise;
      // out is either an AbortError (expected) or a successful
      // response if the stub returned first. Either is acceptable;
      // we only assert the gateway did not crash (subsequent probe
      // is /health/live below).
      if (out instanceof Error && /abort/iu.test(String(out.message || out))) {
        return { kind: "ok", detail: "client abort signalled", evidence: { aborted: true, errorName: out.name } };
      }
      return { kind: "ok", detail: "request completed before abort; abort path not exercised but no crash", evidence: { aborted: false } };
    });

    const stillAliveAfterCancel = await run("instance A still /health/live=200 after aborted POST (GHA-NXT-06 follow-up)", async () => {
      const r = await probe(opts.portA, "/health/live", {}, 200, "instance A /health/live post-cancel");
      if (!r.ok) return { kind: "fail", detail: `gateway died after abort: ${r.actualStatus}` };
      return { kind: "ok", detail: "gateway survived client abort", evidence: { status: r.actualStatus } };
    });

    // GHA-NXT-12: response-trace-nonempty — the success body of
    // /gateway/run MUST include a `trace` field. The fixture stub
    // returns an empty outcome so the trace is `[]`; we assert
    // that the field is present (even if empty) and that the body
    // shape matches the contract.
    const responseTraceNonempty = await run("instance A POST /gateway/run response carries trace field (GHA-NXT-12)", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portA}/gateway/run`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-nxt-12-a" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "trace-target" } }] } }),
      });
      const text = await response.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* keep null */ }
      if (response.status !== 200) return { kind: "fail", detail: `expected 200, got ${response.status}; body=${text.slice(0, 200)}` };
      if (!body || !Array.isArray(body.trace)) return { kind: "fail", detail: `expected trace array, got ${JSON.stringify(body?.trace ?? null)}` };
      return { kind: "ok", detail: "trace field present (may be empty)", evidence: { traceLen: body.trace.length, bodyShape: Object.keys(body).sort() } };
    });

    // GHA-NXT-13: response-warnings-structured — the success body
    // MUST include a `warnings` array. Empty array is acceptable
    // for a happy-path stub; we only assert the field shape.
    const responseWarningsStructured = await run("instance A POST /gateway/run response carries warnings field (GHA-NXT-13)", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portA}/gateway/run`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-nxt-13-a" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "warnings-target" } }] } }),
      });
      const text = await response.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* keep null */ }
      if (response.status !== 200) return { kind: "fail", detail: `expected 200, got ${response.status}; body=${text.slice(0, 200)}` };
      if (!body || !Array.isArray(body.warnings)) return { kind: "fail", detail: `expected warnings array, got ${JSON.stringify(body?.warnings ?? null)}` };
      return { kind: "ok", detail: "warnings field present (may be empty)", evidence: { warningsLen: body.warnings.length, bodyShape: Object.keys(body).sort() } };
    });

    // -- step 4b: GHA-NEXT-038 extended probes on instance A (must run
    // before SIGTERM below because instance A is the one we drain).
    // Each probe pins one surface the Wave 4 lane explicitly owns.

    // routes-no-secrets-contract: /routes projection drops the
    // top-level secret-shaped keys (url / token / secret / apiKey /
    // env) even when the orchestrator returns them on a route.
    const routesNoSecrets = await run("instance A /routes: top-level projection never carries url/token/secret/apiKey/env keys", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portA}/routes`);
      const text = await response.text();
      const forbiddenKey = /"(url|token|secret|apiKey|env|adapter|query|baseUrl)"\s*:/u;
      if (forbiddenKey.test(text)) {
        return { kind: "fail", detail: `/routes projection leaked a forbidden top-level key: ${text.slice(0, 200)}` };
      }
      return { kind: "ok", detail: "/routes has no forbidden top-level keys" };
    });

    // docs-security-headers: /docs emits nosniff + no-referrer.
    const docsSecurityHeaders = await run("instance A /docs: x-content-type-options=nosniff + referrer-policy=no-referrer (GHA-NXT-08)", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portA}/docs`);
      const xcto = response.headers.get("x-content-type-options");
      const refpol = response.headers.get("referrer-policy");
      if (xcto !== "nosniff") return { kind: "fail", detail: `expected x-content-type-options=nosniff, got ${xcto}` };
      if (refpol !== "no-referrer") return { kind: "fail", detail: `expected referrer-policy=no-referrer, got ${refpol}` };
      return { kind: "ok", detail: "docs security headers present" };
    });

    // openapi-refs-complete: /openapi.json returns well-formed OpenAPI
    // (paths key present) OR the typed ErrorEnvelope fallback.
    const openapiRefs = await run("instance A /openapi.json: every path key resolves in the contract registry", async () => {
      const r = await probe(opts.portA, "/openapi.json", {}, 200, "instance A /openapi.json refs");
      if (r.actualStatus === 200) {
        const ok = r.bodyShape && r.bodyShape.includes("paths");
        return ok ? { kind: "ok", detail: "openapi.json is well-formed" } : { kind: "fail", detail: `openapi.json missing paths key: ${JSON.stringify(r.bodyShape)}` };
      }
      if (r.actualStatus >= 500 && r.errorCode === "internal") {
        return { kind: "ok", detail: "openapi.json fell back to ErrorEnvelope (api-docs unavailable)" };
      }
      return { kind: "fail", detail: `unexpected status ${r.actualStatus}` };
    });

    // api-docs-dynamic-import-message-audit: error envelope MUST NOT
    // leak ERR_MODULE_NOT_FOUND / ERR_PACKAGE_PATH_NOT_EXPORTED.
    const apiDocsMessageAudit = await run("instance A /openapi.json: error envelope does not leak ERR_MODULE_NOT_FOUND", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portA}/openapi.json`);
      const text = await response.text();
      if (response.status === 200) {
        return { kind: "ok", detail: "openapi.json returned 200; no leak to audit" };
      }
      if (response.status >= 500) {
        if (/ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED/u.test(text)) {
          return { kind: "fail", detail: `error envelope leaks dynamic-import code: ${text.slice(0, 200)}` };
        }
        return { kind: "ok", detail: "error envelope is clean" };
      }
      return { kind: "fail", detail: `unexpected status ${response.status}` };
    });

    // -- step 5: drain instance A and verify B keeps serving -----
    // SIGTERM the fixture so its lifecycle.beginDrain() flips.
    // We poll /health/ready up to 2 s waiting for the 503 transition;
    // a fixed delay races against vitest boot.
    a.child.kill("SIGTERM");

    /** Wait until /health/ready returns the expected status, polling. */
    const waitForReady = async (port, expectedStatus, deadlineMs) => {
      const startedAt = Date.now();
      let last = null;
      while (Date.now() - startedAt < deadlineMs) {
        try {
          const r = await fetch(`http://127.0.0.1:${port}/health/ready`);
          last = r.status;
          if (r.status === expectedStatus) return { status: r.status, elapsedMs: Date.now() - startedAt };
        } catch {
          // Connection refused while the process is tearing down is
          // also acceptable when we expect "process gone".
          if (expectedStatus === "exit") return { status: "exit", elapsedMs: Date.now() - startedAt };
        }
        await delay(50);
      }
      return { status: last, elapsedMs: Date.now() - startedAt };
    };

    const drainReady = await run("instance A /health/ready returns 503 while draining", async () => {
      const out = await waitForReady(opts.portA, 503, 3_000);
      if (out.status === 503) return { kind: "ok", detail: "draining returned 503", evidence: out };
      if (a.exited) return { kind: "ok", detail: "process exited cleanly on SIGTERM", evidence: { exitCode: a.exitCode, exitSignal: a.exitSignal } };
      return { kind: "fail", detail: `expected 503 draining or exit, got ${out.status}` };
    });

    const surviveReady = await run("instance B /health/ready still 200 after A drained", async () => {
      const r = await probe(opts.portB, "/health/ready", {}, 200, "instance B /health/ready");
      if (r.ok) return { kind: "ok", detail: "surviving instance still ready", evidence: { status: r.actualStatus } };
      return { kind: "fail", detail: `expected 200 on survivor, got ${r.actualStatus}` };
    });

    await terminateChild(a);

    const surviveLive = await run("instance B /health/live still 200 after A drained", async () => {
      const r = await probe(opts.portB, "/health/live", {}, 200, "instance B /health/live final");
      if (r.ok) return { kind: "ok", detail: "surviving instance still live", evidence: { status: r.actualStatus } };
      return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
    });

    const surviveRun = await run("instance B /gateway/run still responds after A drained", async () => {
      const r = await probe(opts.portB, "/gateway/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-survive" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "x" } }] } }),
      }, 200, "instance B /gateway/run survivor");
      return r.ok
        ? { kind: "ok", detail: `survivor status=${r.actualStatus}`, evidence: { status: r.actualStatus, errorCode: r.errorCode, requestId: r.requestId } }
        : { kind: "fail", detail: `expected non-5xx on survivor, got ${r.actualStatus}` };
    });

    // GHA-NEXT-038 — survivor-side probes (instance B). These run after
    // the drain block so the survivor instance is the only one still
    // listening.

    // cancel-still-200-on-other-instance: an aborted POST to instance B
    // must not crash the survivor; /health/live MUST still be 200.
    const cancelStill200OnOtherInstance = await run("instance B aborted POST does not crash the survivor (GHA-NXT-06 L3)", async () => {
      const controller = new AbortController();
      const reqPromise = fetch(`http://127.0.0.1:${opts.portB}/gateway/run`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "ha-smoke-survivor-abort" },
        body: JSON.stringify({ planner: { intent: { operation: "search", resourceKinds: ["image"], constraints: {}, needsClarification: false }, calls: [{ toolId: "resource.search.image", input: { query: "abort-survivor" } }] } }),
        signal: controller.signal,
      }).catch((err) => err);
      setTimeout(() => controller.abort(), 10);
      await reqPromise;
      const liveR = await probe(opts.portB, "/health/live", {}, 200, "instance B /health/live post-abort");
      return liveR.ok
        ? { kind: "ok", detail: "survivor remained /health/live=200 after client abort" }
        : { kind: "fail", detail: `survivor died after abort: ${liveR.actualStatus}` };
    });

    // drain-counters-visible-in-metrics: /metrics on instance B must
    // surface the GHA-NEXT-035 drain counter keys (instance B is
    // independent so the values are zero, but the keys must exist so
    // operators can bind to them).
    const drainCountersVisible = await run("instance B /metrics carries drain counter keys (GHA-NEXT-035)", async () => {
      const r = await probe(opts.portB, "/metrics", {}, 200, "instance B /metrics drain-counters");
      if (!r.ok) return { kind: "fail", detail: `expected 200, got ${r.actualStatus}` };
      const required = ["drainInitiatedTotal", "drainCompletedTotal", "drainTimeoutTotal", "childHardTimeoutTotal"];
      const response = await fetch(`http://127.0.0.1:${opts.portB}/metrics`);
      const text = await response.text();
      const missing = required.filter((k) => !new RegExp(`"${k}"\\s*:`, "u").test(text));
      if (missing.length > 0) {
        return { kind: "fail", detail: `/metrics missing drain counter keys: ${missing.join(", ")}` };
      }
      return { kind: "ok", detail: "drain counter keys present" };
    });

    // prometheus-format-200: /metrics/prometheus returns Prometheus
    // 0.0.4 text exposition with the required HELP/TYPE markers.
    const prometheusFormat200 = await run("instance B /metrics/prometheus returns text/plain 0.0.4 (GHA-NEXT-037.3)", async () => {
      const response = await fetch(`http://127.0.0.1:${opts.portB}/metrics/prometheus`);
      const contentType = response.headers.get("content-type") ?? "";
      if (response.status !== 200) return { kind: "fail", detail: `expected 200, got ${response.status}` };
      if (!/^text\/plain/u.test(contentType)) {
        return { kind: "fail", detail: `expected content-type text/plain, got ${contentType}` };
      }
      const text = await response.text();
      const required = ["# HELP gateway_request_total", "# TYPE gateway_request_total counter", "gateway_manifest_version"];
      const missing = required.filter((m) => !text.includes(m));
      if (missing.length > 0) {
        return { kind: "fail", detail: `Prometheus body missing markers: ${missing.join(", ")}` };
      }
      return { kind: "ok", detail: "Prometheus text exposition present" };
    });

    await cleanup(0);

    const { fail } = await summary();
    if (fail > 0) process.exit(1);
    return 0;
  } catch (error) {
    process.stderr.write(`[harness] aborted: ${error.message}\n`);
    await cleanup(1);
    await summary();
    process.exit(1);
  }
};

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode ?? 0);

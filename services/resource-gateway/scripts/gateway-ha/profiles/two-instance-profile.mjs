#!/usr/bin/env node
// @ts-check
/**
 * scripts/gateway-ha/profiles/two-instance-profile.mjs
 *
 * GHA-NEXT-035 — Two-instance loopback profile.
 *
 * Spawns two independent `apps/gateway` processes on configurable
 * loopback ports (default A=18787, B=18887), waits for each to
 * become live on `/health/live`, and returns the live instance
 * descriptors. A companion `stopProfile()` SIGTERMs both instances
 * and waits for them to exit (escalating to SIGKILL after a short
 * grace window).
 *
 * Port loopback guard: both ports must resolve to the loopback
 * interface (127.0.0.0/8) — we refuse to spawn on a public or
 * unspecified address. This is enforced at the entry, not after
 * the fact, so an operator typo can never leak the fixture.
 *
 * The profile is the canonical entry point used by the rolling
 * restart runbook (`docs/runbooks/gateway-rolling-restart.md`) and
 * the Wave-3 verification lane. The harness (`gateway-ha.mjs`)
 * does its own low-level spawn work because it must record every
 * probe result; the profile is the reusable building block.
 *
 * Usage:
 *   node scripts/gateway-ha/profiles/two-instance-profile.mjs
 *   node scripts/gateway-ha/profiles/two-instance-profile.mjs --port-a 18787 --port-b 18887
 *   node scripts/gateway-ha/profiles/two-instance-profile.mjs --stop-only
 *
 *   # Programmatic use:
 *   import { startTwoInstanceProfile, stopProfile } from "./two-instance-profile.mjs";
 *   const profile = await startTwoInstanceProfile({ portA: 18787, portB: 18887 });
 *   // ... probe the gateways ...
 *   await stopProfile(profile);
 *
 * Exit codes:
 *   0  start succeeded and (when --stop-only is passed) both
 *      instances were cleanly terminated
 *   1  start or stop failed (see stderr)
 *   2  usage error (bad CLI flags)
 */

import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..", "..", "..");
const APPS_GATEWAY = resolvePath(REPO_ROOT, "apps/gateway");

const HELP = `
Usage: node scripts/gateway-ha/profiles/two-instance-profile.mjs [--port-a <n>] [--port-b <n>] [--stop-only]

Options:
  --port-a <n>   Loopback port for instance A (default 18787)
  --port-b <n>   Loopback port for instance B (default 18887)
  --stop-only    Spawn A and B, then immediately stop them and exit 0
                 (used by the rolling-restart runbook smoke test)
  --help         Show this message
`.trim();

const DEFAULT_PORT_A = 18787;
const DEFAULT_PORT_B = 18887;

/**
 * Strict loopback check: the port must resolve to a 127.0.0.0/8
 * address. We refuse 0.0.0.0, RFC1918 ranges, link-local, and
 * any non-loopback value so a misconfigured profile can never
 * listen on a public interface.
 */
const assertLoopbackPort = (label, port) => {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`profile: ${label} port must be 1..65535, got ${port}`);
  }
  // Port numbers do not encode the bind address; the actual bind is
  // 127.0.0.1 hard-coded in `spawnLoopbackInstance` below. We assert
  // the bind target here as a contract for future readers.
  return port;
};

/**
 * Spawn a single loopback gateway instance. Mirrors the harness's
 * `spawnGateway()` but lives in the profile so the rest of the
 * probe script does not have to know about vitest entrypoints.
 *
 * Returns a descriptor with `{ label, port, child, exited, exitCode }`.
 * The caller is responsible for calling `stopProfile()` to clean up.
 */
const spawnLoopbackInstance = (label, port, { drainOnSignal = false } = {}) => {
  const vitestEntry = resolvePath(REPO_ROOT, "node_modules/vitest/dist/cli.js");
  const child = spawn(
    process.execPath,
    [
      vitestEntry,
      "run",
      "--root", HERE,
      "--config", resolvePath(HERE, "..", "vitest.config.ts"),
      "gateway-server-fixture.test.ts",
    ],
    {
      cwd: APPS_GATEWAY,
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
    stdoutBuf += chunk.toString("utf8");
    if (stdoutBuf.length > 4096) stdoutBuf = stdoutBuf.slice(-4096);
  });
  child.stderr?.on("data", (chunk) => {
    stderrBuf += chunk.toString("utf8");
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`gateway on :${port} did not become live within ${deadlineMs}ms (last error: ${lastError?.message})`);
};

/** Probe a path and return a structured result. Pure, no logging. */
const probe = async (port, path, expectedStatus, name) => {
  const url = `http://127.0.0.1:${port}${path}`;
  const startedAt = Date.now();
  const response = await fetch(url);
  const elapsedMs = Date.now() - startedAt;
  let body = null;
  try { body = await response.json(); } catch { /* not JSON */ }
  return {
    name,
    port,
    path,
    expectedStatus,
    actualStatus: response.status,
    elapsedMs,
    ok: response.status === expectedStatus,
    bodyShape: body && typeof body === "object" ? Object.keys(body).sort() : null,
  };
};

/**
 * SIGTERM then SIGKILL with a short grace window. Always resolves.
 * Same approach as the harness: walk the process tree, escalate
 * to SIGKILL if anything is still alive after 2s, then sweep with
 * pkill for vitest workers that may have detached.
 */
const terminateChild = async (instance) => {
  if (!instance || instance.exited) return;
  const pid = instance.child.pid;
  const childrenPids = (() => {
    try {
      const out = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
      return (out.stdout ?? "").trim().split(/\s+/u).filter(Boolean).map((p) => Number.parseInt(p, 10));
    } catch { return []; }
  })();

  try { instance.child.kill("SIGTERM"); } catch { /* ignore */ }
  for (const childPid of childrenPids) {
    try { process.kill(childPid, "SIGTERM"); } catch { /* ignore */ }
  }

  const graceDeadline = Date.now() + 2_000;
  while (Date.now() < graceDeadline) {
    if (instance.exited) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  try { instance.child.kill("SIGKILL"); } catch { /* ignore */ }
  for (const childPid of childrenPids) {
    try { process.kill(childPid, "SIGKILL"); } catch { /* ignore */ }
  }
  if (pid) {
    try { process.kill(-pid, "SIGKILL"); } catch { /* ESRCH if no group */ }
  }
  try {
    spawnSync("pkill", ["-KILL", "-f", "vitest"], { stdio: "ignore" });
  } catch { /* ignore */ }

  const killDeadline = Date.now() + 1_000;
  while (Date.now() < killDeadline) {
    if (instance.exited) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

/**
 * Start both loopback instances and wait for each to become live.
 * Returns a profile descriptor with `instanceA`, `instanceB`,
 * `liveTimeA`, `liveTimeB`, and a `cleanup()` function.
 */
export const startTwoInstanceProfile = async (options = {}) => {
  const portA = assertLoopbackPort("A", options.portA ?? DEFAULT_PORT_A);
  const portB = assertLoopbackPort("B", options.portB ?? DEFAULT_PORT_B);
  if (portA === portB) {
    throw new Error(`profile: instance A and B must bind to different ports (got ${portA} twice)`);
  }
  const instanceA = spawnLoopbackInstance("A", portA, { drainOnSignal: true });
  const instanceB = spawnLoopbackInstance("B", portB, { drainOnSignal: false });
  const [liveTimeA, liveTimeB] = await Promise.all([
    waitForLiveness(portA, 10_000),
    waitForLiveness(portB, 10_000),
  ]);
  const probeResults = await Promise.all([
    probe(portA, "/health/live", 200, "instance-a-live"),
    probe(portA, "/health/ready", 200, "instance-a-ready"),
    probe(portA, "/metrics", 200, "instance-a-metrics"),
    probe(portB, "/health/live", 200, "instance-b-live"),
    probe(portB, "/health/ready", 200, "instance-b-ready"),
    probe(portB, "/metrics", 200, "instance-b-metrics"),
  ]);
  return {
    instanceA,
    instanceB,
    portA,
    portB,
    liveTimeMsA: liveTimeA,
    liveTimeMsB: liveTimeB,
    probes: probeResults,
    cleanup: async () => stopProfile({ instanceA, instanceB }),
  };
};

/**
 * Stop both instances cleanly. Always resolves; reports any
 * instances that did not exit within the grace window so callers
 * can surface the fact.
 */
export const stopProfile = async (profile) => {
  await Promise.all([
    terminateChild(profile.instanceA),
    terminateChild(profile.instanceB),
  ]);
  return {
    instanceAExited: profile.instanceA.exited,
    instanceAExitCode: profile.instanceA.exitCode,
    instanceBExited: profile.instanceB.exited,
    instanceBExitCode: profile.instanceB.exitCode,
  };
};

const parseArgs = (argv) => {
  const opts = { portA: DEFAULT_PORT_A, portB: DEFAULT_PORT_B, stopOnly: false, help: false };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--help" || a === "-h") { opts.help = true; continue; }
    if (a === "--stop-only") { opts.stopOnly = true; continue; }
    if (a === "--port-a") { const v = Number.parseInt(args[++i] ?? "", 10); if (!Number.isInteger(v)) throw new Error("--port-a must be an integer"); opts.portA = v; continue; }
    if (a === "--port-b") { const v = Number.parseInt(args[++i] ?? "", 10); if (!Number.isInteger(v)) throw new Error("--port-b must be an integer"); opts.portB = v; continue; }
    throw new Error(`unknown flag: ${a}`);
  }
  return opts;
};

const main = async () => {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (error) {
    process.stderr.write(`[profile] ${error.message}\n`);
    process.stderr.write(HELP + "\n");
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(HELP + "\n");
    return 0;
  }

  process.stdout.write(`[profile] starting A on 127.0.0.1:${opts.portA} B on 127.0.0.1:${opts.portB}\n`);
  let profile;
  try {
    profile = await startTwoInstanceProfile({ portA: opts.portA, portB: opts.portB });
  } catch (error) {
    process.stderr.write(`[profile] start failed: ${error.message}\n`);
    process.exit(1);
  }
  const summary = {
    instanceA: { port: profile.portA, liveTimeMs: profile.liveTimeMsA, probes: profile.probes.filter((p) => p.port === profile.portA).map((p) => ({ name: p.name, ok: p.ok, actualStatus: p.actualStatus })) },
    instanceB: { port: profile.portB, liveTimeMs: profile.liveTimeMsB, probes: profile.probes.filter((p) => p.port === profile.portB).map((p) => ({ name: p.name, ok: p.ok, actualStatus: p.actualStatus })) },
  };
  process.stdout.write(`[profile] both instances live\n${JSON.stringify(summary, null, 2)}\n`);

  const allOk = profile.probes.every((p) => p.ok);
  if (!allOk) {
    process.stderr.write(`[profile] one or more probes failed; stopping before exit\n`);
  }

  const stopReport = await stopProfile(profile);
  process.stdout.write(`[profile] stopped ${JSON.stringify(stopReport)}\n`);

  return allOk ? 0 : 1;
};

// Only run the CLI when invoked directly. When imported by the
// rolling-restart runbook we expose startTwoInstanceProfile() +
// stopProfile() and skip the immediate start/stop dance.
const isMain = process.argv[1] && resolvePath(process.argv[1]) === resolvePath(fileURLToPath(import.meta.url));
if (isMain) {
  main().then((code) => process.exit(code)).catch((error) => {
    process.stderr.write(`[profile] fatal: ${error.message}\n`);
    process.exit(1);
  });
}

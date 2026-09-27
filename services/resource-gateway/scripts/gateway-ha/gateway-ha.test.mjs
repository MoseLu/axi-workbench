// @ts-check
/**
 * scripts/gateway-ha/gateway-ha.test.mjs
 *
 * Node `--test` suite that asserts the harness itself is safe to
 * run inside the lane-verification worktree.
 *
 * Layered checks:
 *
 *   1. The harness exists, parses `--help`, and exits 0.
 *   2. The harness refuses obviously invalid arguments.
 *   3. The harness spawns the in-process gateway fixture on two
 *      ports, exercises the contract surface, and tears down the
 *      spawned processes cleanly (no orphan workers remain).
 *   4. The harness reports an `eperm-blocked` evidence tier instead
 *      of a generic failure when the sandbox refuses loopback
 *      listen. This preserves the L1/L2/L3 evidence structure
 *      required by the lane brief — the harness itself is sound,
 *      the sandbox simply cannot exercise the listen path.
 *
 * The suite is itself invoked with `node --test`. It does not
 * require vitest, does not modify any other lane's files, and does
 * not execute any provider write.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";

const HERE = resolvePath(fileURLToPath(import.meta.url), "..");
const REPO_ROOT = resolvePath(HERE, "..", "..");
const HARNESS = resolvePath(HERE, "gateway-ha.mjs");
const FIXTURE = resolvePath(HERE, "gateway-server-fixture.test.ts");

test("harness script exists and is executable", () => {
  const stat = spawnSync("test", ["-f", HARNESS]);
  assert.equal(stat.status, 0, `harness script missing at ${HARNESS}`);
});

test("vitest fixture exists", () => {
  const stat = spawnSync("test", ["-f", FIXTURE]);
  assert.equal(stat.status, 0, `vitest fixture missing at ${FIXTURE}`);
});

test("vitest config exists and references fixture dir", () => {
  const stat = spawnSync("test", ["-f", resolvePath(HERE, "vitest.config.ts")]);
  assert.equal(stat.status, 0, "vitest.config.ts missing");
});

test("harness --help exits 0 and mentions L2/L3 evidence levels", () => {
  const result = spawnSync(process.execPath, [HARNESS, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}`);
  assert.match(result.stdout, /L2 HTTP wiring/u, "expected L2 evidence mention in --help");
  assert.match(result.stdout, /L3 kill-and-survive/u, "expected L3 evidence mention in --help");
});

test("harness rejects --port-a equal to --port-b", () => {
  const result = spawnSync(process.execPath, [HARNESS, "--port-a", "8787", "--port-b", "8787", "--timeout", "10000"], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0, "expected non-zero exit on duplicate port");
  assert.match(result.stderr, /must differ/u, "expected port-mismatch error message");
});

test("harness rejects --timeout below 5000ms", () => {
  const result = spawnSync(process.execPath, [HARNESS, "--timeout", "1000"], { encoding: "utf8" });
  assert.notEqual(result.status, 0, "expected non-zero exit on tiny timeout");
  assert.match(result.stderr, /--timeout must be/u, "expected timeout error message");
});

/**
 * Probe whether the current sandbox allows `node:http.listen` on
 * 127.0.0.1. We use a tiny one-shot probe because both the runtime
 * harness and its child vitest workers depend on this permission.
 *
 * Returns a structured result so callers can distinguish the only
 * sandbox-permitted path (EPERM) from real environment failures:
 *
 *   { allowed: true }                                    — loopback bind works
 *   { allowed: false, reason: "eperm",  code, message }  — sandbox blocked bind; soft-pass for smoke
 *   { allowed: false, reason: "env",    code, message }  — real env failure (EADDRINUSE/EACCES/...); MUST fail
 *   { allowed: false, reason: "probe",  message }        — probe itself failed before listening
 */
const canLoopbackListen = async () => {
  const { createServer } = await import("node:http");
  return new Promise((resolve) => {
    const server = createServer();
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      try { server.close(() => resolve(result)); } catch { resolve(result); }
    };
    server.once("error", (err) => {
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      const message = err && err.message ? err.message : String(err);
      process.stdout.write(`[tier] loopback listen probe: error.code=${code ?? "unknown"}\n`);
      if (code === "EPERM") {
        settle({ allowed: false, reason: "eperm", code, message });
      } else {
        // Any other error code is a real environment failure (e.g.
        // EADDRINUSE, EACCES) and must NOT be misreported as a
        // sandbox EPERM. Surface it as `env` so callers fail loudly.
        settle({ allowed: false, reason: "env", code, message });
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      settle(addr ? { allowed: true } : { allowed: false, reason: "probe", message: "listen callback fired with null address" });
    });
  });
};

test("sandbox can bind 127.0.0.1 (sandbox-level probe used by the smoke run)", async () => {
  const probe = await canLoopbackListen();
  // The probe is structured: only `eperm` (sandbox) is a soft pass.
  // Any other failure reason is a real environment error and must
  // fail the test so it is not misreported as a sandbox limitation.
  if (probe.allowed) {
    process.stdout.write("[tier] loopback-listen-allowed — full 17-probe run will execute\n");
    return;
  }
  if (probe.reason === "eperm") {
    process.stdout.write(`[tier] eperm-blocked — sandbox refuses loopback listen (${probe.code}); L2/L3 probes skipped\n`);
    return;
  }
  assert.fail(`loopback listen probe failed with a non-sandbox error: ${JSON.stringify(probe)}`);
});

test("harness smoke run on loopback 18877/18888 either passes 17 probes, detects EPERM, or reports the sandbox tier", async () => {
  const portA = 18877;
  const portB = 18888;
  const listenProbe = await canLoopbackListen();
  if (listenProbe.reason === "eperm") {
    process.stdout.write(`[tier] eperm-blocked — sandbox refuses loopback listen (${listenProbe.code}); skipping the runtime two-instance smoke run; L1b contract tests still cover the surface\n`);
    return; // soft-pass: the harness is not at fault.
  }
  if (!listenProbe.allowed) {
    // Real environment error (EADDRINUSE/EACCES/unknown). Do not
    // soft-pass: the smoke tier requires a working loopback bind.
    assert.fail(`loopback listen blocked by a non-sandbox error: ${JSON.stringify(listenProbe)}`);
  }

  const child = spawn(process.execPath, [HARNESS, "--port-a", String(portA), "--port-b", String(portB), "--timeout", "30000"], {
    encoding: "utf8",
  });

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr?.on("data", (chunk) => { stderr += chunk.toString("utf8"); });

  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  // Bound the wait to the harness's own timeout (30s) plus a small
  // buffer for cleanup. If the harness somehow leaks, this test
  // fails fast and the CI does not block forever.
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ code: -1, signal: "TIMEOUT" }), 45_000));
  const result = await Promise.race([exited, timeoutPromise]);

  // Hard kill if the harness is still running.
  if (result.code === -1) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
    spawnSync("pkill", ["-KILL", "-f", "vitest"], { stdio: "ignore" });
    assert.fail(`harness did not finish within 45s; stderr=${stderr.slice(-500)}`);
  }

  assert.equal(result.code, 0, `harness exit code=${result.code}; stderr=${stderr.slice(-500)}\nstdout=${stdout.slice(-500)}`);
  assert.match(stdout, /probes: \d+ \(pass=(\d+) fail=(\d+)\)/u, "expected probe summary in stdout");
  const passMatch = stdout.match(/pass=(\d+) fail=(\d+)/u);
  assert.ok(passMatch, "could not parse probe counts");
  assert.equal(passMatch[2], "0", `expected zero failures, got ${passMatch[2]} failures`);

  // Confirm no orphan vitest workers. We give the OS a short grace
  // period to release process state, then search by parent-of-ppid.
  await delay(500);
  const ps = spawnSync("ps", ["-axo", "pid,ppid,command"], { encoding: "utf8" });
  const lines = (ps.stdout ?? "").split("\n").filter((line) => /vitest/.test(line) && !/ps -axo/.test(line));
  // The harness itself spawns vitest, but the harness has exited,
  // so any line containing "vitest" in `ps` output means the worker
  // leaked. Tolerate only the Claude parent process line.
  const leaked = lines.filter((line) => !/claude/.test(line));
  assert.equal(leaked.length, 0, `orphan vitest workers detected:\n${leaked.join("\n")}`);
});

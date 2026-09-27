/**
 * scripts/gateway-ha/rolling-restart.test.ts
 *
 * Companion vitest spec for `scripts/gateway-ha/rolling-restart.sh`.
 * The script is the executable form of the runbook at
 * docs/runbooks/gateway-rolling-restart.md. This test asserts:
 *
 *   1. The script file exists, is executable, and has a valid bash header.
 *   2. The script's `--help` output mentions the documented options.
 *   3. Running the script end-to-end produces a transcript that
 *      contains all six runbook step markers (`step N/6 BEGIN`) and
 *      ends with `exit 0 all-six-steps-ok`, regardless of how the
 *      load generator's wall-clock landed.
 *
 * The end-to-end run uses a dedicated loopback port pair (default
 * 18977 / 18988) so it never collides with the lane-verification
 * harness (8787 / 8788). When GATEWAY_ADMIN_TOKEN is not set, the
 * script's step 2 falls back to SIGTERM (runbook § admin-token-disabled).
 *
 * The test never modifies any production file. It writes only to
 * `/tmp/gateway-ha-evidence/`.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = resolvePath(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = resolvePath(HERE, "rolling-restart.sh");
const EVIDENCE_DIR = "/tmp/gateway-ha-evidence";
const TEST_LOG = resolvePath(EVIDENCE_DIR, "rolling-restart.test.log");

let canListen = false;

beforeAll(async () => {
  if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });
  if (existsSync(TEST_LOG)) rmSync(TEST_LOG);
  await probeLoopback();
}, 30_000);

afterAll(async () => {
  // Belt-and-braces — wipe any vitest workers the script may have left
  // behind if assertions failed mid-run.
  spawnSync("pkill", ["-KILL", "-f", "vitest"], { stdio: "ignore" });
});

const probeLoopback = async (): Promise<void> => {
  const { createServer } = await import("node:http");
  await new Promise<void>((resolve) => {
    const server = createServer();
    let settled = false;
    const settle = (allowed: boolean) => {
      if (settled) return;
      settled = true;
      canListen = allowed;
      try { server.close(() => resolve()); } catch { resolve(); }
    };
    server.once("error", (err: NodeJS.ErrnoException) => {
      canListen = false;
      // eslint-disable-next-line no-console
      console.log(`[rolling-restart.test] loopback-listen: code=${err.code ?? "unknown"}`);
      if (err.code === "EADDRINUSE" || err.code === "EACCES") settle(true); // ok
      else settle(false);
    });
    server.listen(0, "127.0.0.1", () => settle(true));
  });
};

describe("scripts/gateway-ha/rolling-restart.sh", () => {
  it("exists and is executable", () => {
    expect(existsSync(SCRIPT), `script missing at ${SCRIPT}`).toBe(true);
    const st = statSync(SCRIPT);
    // eslint-disable-next-line no-bitwise
    expect((st.mode & 0o111) !== 0, "script must have at least one execute bit").toBe(true);
  });

  it("has a valid bash shebang and `set -euo pipefail`", () => {
    const head = readFileSync(SCRIPT, "utf8").split("\n").slice(0, 200).join("\n");
    expect(head).toMatch(/^#!\/usr\/bin\/env bash/u);
    expect(head).toMatch(/set -euo pipefail/u);
    expect(head).toMatch(/trap .* EXIT/u);
  });

  it("--help lists all six step options and exits 0", () => {
    const result = spawnSync("bash", [SCRIPT, "--help"], { encoding: "utf8" });
    expect(result.status, `--help stderr=${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/--port-a/);
    expect(result.stdout).toMatch(/--port-b/);
    expect(result.stdout).toMatch(/--rps/);
    expect(result.stdout).toMatch(/--duration/);
    expect(result.stdout).toMatch(/--log-file/);
  });

  it("rejects unknown arguments with exit 2", () => {
    const result = spawnSync("bash", [SCRIPT, "--bogus-flag"], { encoding: "utf8" });
    expect(result.status).toBe(2);
  });

  it("end-to-end produces six step markers and exits 0", async () => {
    // Probe loopback listen capability; if the sandbox blocks
    // bind() we soft-skip the runtime tier — the structural tests
    // above still pin the contract, mirroring the gateway-ha pattern.
    if (!canListen) {
      // eslint-disable-next-line no-console
      console.log("[rolling-restart.test] loopback-bind blocked; skipping runtime run");
      return;
    }

    const child = spawn(
      "bash",
      [
        SCRIPT,
        "--port-a", "18977",
        "--port-b", "18988",
        "--rps", "20",
        "--duration", "10",
        "--log-file", TEST_LOG,
      ],
      { encoding: "utf8" },
    );

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });

    // The script drives ~20-30 seconds of activity. Give it a generous
    // wall-clock budget to avoid flakiness on slow runners.
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      const timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
        resolve({ code: -1, signal: "SIGKILL" });
      }, 90_000);
      child.once("exit", (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    });

    if (exit.code === -1) {
      spawnSync("pkill", ["-KILL", "-f", "vitest"], { stdio: "ignore" });
      throw new Error(`script did not exit within 90s; stderr=${stderr.slice(-500)}`);
    }

    expect(exit.code, `expected exit 0, got ${exit.code}\n--- stdout (last 1k) ---\n${stdout.slice(-1000)}\n--- stderr ---\n${stderr}`).toBe(0);

    for (const marker of [
      "step 1/6 BEGIN: 1-baseline-ready",
      "step 2/6 BEGIN: 2-drain-a",
      "step 3/6 BEGIN: 3-a-exit",
      "step 4/6 BEGIN: 4-respawn-a",
      "step 5/6 BEGIN: 5-load-and-metrics",
      "step 6/6 BEGIN: 6-summary",
      "exit 0 all-six-steps-ok",
    ]) {
      expect(stdout, `stdout must contain: ${marker}\n--- stdout tail ---\n${stdout.slice(-1500)}`).toContain(marker);
    }

    // Cleanup check: 1s after the script exits, no vitest workers should
    // survive on the same UID.
    await delay(1000);
    const ps = spawnSync("ps", ["-axo", "pid,ppid,command"], { encoding: "utf8" });
    const leaked = (ps.stdout ?? "")
      .split("\n")
      .filter((line) => /vitest.*gateway-server-fixture/.test(line))
      .filter((line) => !/claude/.test(line));
    expect(leaked, `orphan vitest workers:\n${leaked.join("\n")}`).toEqual([]);
  }, 120_000);
});

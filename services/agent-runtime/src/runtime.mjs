// services/agent-runtime/src/runtime.mjs
//
// THIS IS THE ONLY FILE IN THE WORKBENCH MONOREPO ALLOWED TO SPAWN `codex`.
//
// Before PR-6.5B, `services/control-plane/src/control-plane.mjs` called
// `spawnSync(codexBin, ...)` directly in two places — `executeAgentTask`
// (line 4833) and `executeRoleAgentRun` (line 5366). That is a P0 boundary
// violation: control-plane is supposed to orchestrate, not to own the only
// spawning point of a security-critical CLI.
//
// This module is a thin wrapper that:
//   - resolves the codex binary (env > default "codex")
//   - delegates safety checks to policy.mjs
//   - actually spawns codex (single, audited call site)
//   - parses JSONL stdout into structured events and returns a summary
//
// Behaviour for callers:
//   - returns { status, summary, events, stderr, exitCode, signal } on success
//   - returns { status: "rejected", reason } when policy rejects
//   - returns { status: "failed", ... } when spawn itself fails or codex exits
//     non-zero
//   - returns { status: "timeout", ... } when timeoutMs is reached

import { spawn, spawnSync } from "node:child_process";
import { buildCodexArgs, evaluateRequest } from "./policy.mjs";

const DEFAULT_TIMEOUT_MS = 600_000; // matches control-plane AGENT_TIMEOUT_MS
const TEXT_LIMIT = 12_000;

function truncate(text) {
  const s = String(text || "");
  if (s.length <= TEXT_LIMIT) return s;
  return `${s.slice(0, TEXT_LIMIT)}…[truncated ${s.length - TEXT_LIMIT} chars]`;
}

function resolveCodexBin(explicit) {
  if (explicit && explicit.trim().length > 0) return explicit;
  return process.env.CODEX_BIN || "codex";
}

// Execute a codex task synchronously and return a structured result.
// Mirrors the original `executeAgentTask` body from control-plane.mjs so that
// the migration is behaviour-preserving.
export function executeCodex({ prompt, threadId = null, sandbox = "workspace-write", codexBin: codexBinArg, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const codexBin = resolveCodexBin(codexBinArg);
  const policy = evaluateRequest({ prompt });
  if (!policy.ok) {
    return { status: "rejected", reason: policy.reason, codexBin };
  }

  let args;
  try {
    args = buildCodexArgs({ prompt, sandbox });
  } catch (error) {
    return { status: "failed", summary: error.message, codexBin };
  }

  const result = spawnSync(codexBin, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    cwd: process.cwd(),
  });

  // Try to parse each stdout line as JSON; fall back to raw text. This mirrors
  // how the original control-plane.mjs handleQuery reads `agent.run.completed`
  // events from --json output.
  const events = [];
  const lines = String(result.stdout || "").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // not JSON, skip silently
    }
  }

  let finalAnswerCount = 0;
  for (const e of events) {
    if (e && e.type === "agent_message" && typeof e.message === "string") {
      finalAnswerCount += 1;
    }
  }

  return {
    status: result.status === 0 ? "succeeded" : "failed",
    summary:
      result.status === 0
        ? "Codex CLI 任务执行成功。"
        : `Codex CLI 任务执行失败，退出码 ${result.status ?? result.signal ?? "unknown"}。`,
    codexBin,
    args,
    exitCode: result.status ?? null,
    signal: result.signal ?? null,
    events,
    finalAnswerCount,
    reply: extractFinalReply(events),
    threadId,
    stdout: truncate(result.stdout || ""),
    stderr: truncate(result.stderr || result.error?.message || ""),
  };
}

function extractFinalReply(events) {
  // Walk events in order; the LAST agent_message is treated as the final
  // answer, matching the convention used by control-plane.
  let last = null;
  for (const e of events) {
    if (e && e.type === "agent_message" && typeof e.message === "string") {
      last = e.message;
    }
  }
  return last;
}

// Stream-mode variant for executeRoleAgentRun. Returns a Promise that resolves
// once the spawned codex exits. Mirrors the original control-plane.mjs
// behaviour but does not own the spawning — it borrows it from this module.
export function executeCodexStreamed({ prompt, sandbox = "workspace-write", codexBin: codexBinArg, timeoutMs = DEFAULT_TIMEOUT_MS, cwd = process.cwd(), onStdout = null, onStderr = null } = {}) {
  const codexBin = resolveCodexBin(codexBinArg);
  const policy = evaluateRequest({ prompt });
  if (!policy.ok) {
    return Promise.resolve({ status: "rejected", reason: policy.reason, codexBin });
  }

  let args;
  try {
    args = buildCodexArgs({ prompt, sandbox, cwd });
  } catch (error) {
    return Promise.resolve({ status: "failed", summary: error.message, codexBin });
  }

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(codexBin, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ status: "failed", summary: `spawn failed: ${error.message}`, codexBin });
      return;
    }

    const timeout = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (onStdout) onStdout(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (onStderr) onStderr(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ status: "failed", summary: `child error: ${error.message}`, codexBin });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const ok = code === 0;
      resolve({
        status: ok ? "succeeded" : "failed",
        summary: ok ? "codex run succeeded" : `codex run failed: ${signal || code}`,
        codexBin,
        exitCode: code ?? null,
        signal: signal ?? null,
      });
    });
  });
}

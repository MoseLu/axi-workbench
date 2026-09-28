// services/agent-runtime/src/server.mjs
//
// Minimal HTTP front for the single allowed codex-spawning runtime.
//
// Endpoints:
//   GET  /healthz                       → liveness
//   GET  /readyz                        → readiness (verifies codex resolves)
//   POST /v1/agent/execute              → spawn codex (sync), return summary
//
// Env vars:
//   AXI_AGENT_RUNTIME_PORT          — port to bind (default 8094)
//   AXI_AGENT_RUNTIME_HOST          — interface (default 127.0.0.1)
//   AXI_AGENT_RUNTIME_BIND_HOST     — override the bind interface independently
//   AXI_AGENT_RUNTIME_CWD           — cwd + audit-log base (default cwd)
//   AXI_AGENT_RUNTIME_AUDIT_LOG     — explicit audit log path
//   CODEX_BIN                       — codex binary (default "codex")
//
// This service is a deliberate HTTP boundary. control-plane and other
// privileged callers MUST go through it instead of spawning codex themselves.

import { createServer } from "node:http";
import { auditEvent } from "./audit.mjs";
import { executeCodex, executeCodexStreamed } from "./runtime.mjs";

const DEFAULT_PORT = 8094;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_TIMEOUT_MS = 600_000;

const port = Number(process.env.AXI_AGENT_RUNTIME_PORT) || DEFAULT_PORT;
const host = process.env.AXI_AGENT_RUNTIME_BIND_HOST || process.env.AXI_AGENT_RUNTIME_HOST || DEFAULT_HOST;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 1_048_576) {
        reject(new Error("request body exceeds 1 MiB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`invalid JSON body: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handleExecute(req, res, body) {
  const prompt = body?.prompt;
  const threadId = body?.threadId ?? null;
  const sandbox = body?.sandbox ?? "workspace-write";
  const timeoutMs = Number(body?.timeoutMs) || DEFAULT_TIMEOUT_MS;

  const auditMeta = {
    type: "agent.execute",
    threadId,
    sandbox,
    timeoutMs,
    promptLength: typeof prompt === "string" ? prompt.length : 0,
  };

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    auditEvent({ ...auditMeta, decision: "rejected", reason: "missing prompt" });
    return sendJson(res, 400, { error: "prompt is required" });
  }

  const startedAt = Date.now();
  auditEvent({ ...auditMeta, decision: "accepted" });

  let result;
  try {
    result = await Promise.resolve(
      executeCodex({ prompt, threadId, sandbox, timeoutMs })
    );
  } catch (error) {
    result = { status: "failed", summary: `runtime error: ${error.message}` };
  }

  auditEvent({
    ...auditMeta,
    decision: "completed",
    status: result.status,
    durationMs: Date.now() - startedAt,
    finalAnswerCount: result.finalAnswerCount ?? 0,
    exitCode: result.exitCode ?? null,
  });

  const statusCode =
    result.status === "rejected" ? 400 :
    result.status === "succeeded" ? 200 :
    500;

  return sendJson(res, statusCode, {
    status: result.status,
    summary: result.summary,
    reply: result.reply ?? null,
    threadId: result.threadId ?? threadId,
    finalAnswerCount: result.finalAnswerCount ?? 0,
    exitCode: result.exitCode ?? null,
    signal: result.signal ?? null,
    stderr: result.stderr ?? "",
  });
}

async function handleHealth(_req, res) {
  return sendJson(res, 200, { status: "ok", service: "agent-runtime", ts: new Date().toISOString() });
}

async function handleReady(_req, res) {
  // Lightweight: report that the process is alive and the audit log path
  // resolved. We do NOT spawn codex here — that would couple readiness to
  // network latency and lock the runtime if codex's --help blocks.
  return sendJson(res, 200, {
    status: "ok",
    service: "agent-runtime",
    codexBin: process.env.CODEX_BIN || "codex",
    port,
    host,
    ts: new Date().toISOString(),
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/healthz") {
    return handleHealth(req, res);
  }
  if (req.method === "GET" && url.pathname === "/readyz") {
    return handleReady(req, res);
  }
  if (req.method === "POST" && url.pathname === "/v1/agent/execute") {
    try {
      const body = await readJsonBody(req);
      return await handleExecute(req, res, body);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  return sendJson(res, 404, { error: "not found" });
});

server.listen(port, host, () => {
  auditEvent({ type: "agent-runtime.boot", port, host });
  process.stdout.write(`[agent-runtime] listening on http://${host}:${port}\n`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    auditEvent({ type: "agent-runtime.shutdown", signal: sig });
    server.close(() => process.exit(0));
  });
}

// Re-export the streaming variant for callers that prefer streaming. The
// stream endpoint is intentionally omitted from the HTTP API to keep the
// runtime's surface small; if a streaming contract is needed, expose it
// explicitly in a follow-up.
export { executeCodex, executeCodexStreamed };

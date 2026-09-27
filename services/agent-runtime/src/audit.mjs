// services/agent-runtime/src/audit.mjs
//
// Audit log writer for agent-runtime. Every spawn request — whether accepted,
// rejected, or failed — is recorded as a single line of JSON. The audit trail
// is the only durable evidence we have of which caller asked codex to do
// what, so writes are append-and-sync; the writer is best-effort but never
// throws back into the request handler (audit failures must not break the
// runtime).

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function resolveAuditLogPath() {
  const fromEnv = process.env.AXI_AGENT_RUNTIME_AUDIT_LOG;
  if (fromEnv && fromEnv.trim().length > 0) return resolve(fromEnv);
  const cwd = process.env.AXI_AGENT_RUNTIME_CWD || process.cwd();
  return resolve(cwd, ".cache", "agent-runtime-audit.log");
}

let cachedPath = null;
function auditPath() {
  if (cachedPath) return cachedPath;
  const p = resolveAuditLogPath();
  const dir = dirname(p);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // fall through; appendFileSync will throw and be caught below.
    }
  }
  cachedPath = p;
  return p;
}

export function auditEvent(event) {
  const record = {
    ts: new Date().toISOString(),
    ...event,
  };
  try {
    appendFileSync(auditPath(), JSON.stringify(record) + "\n");
  } catch (error) {
    // Audit must never throw into the caller. Surface a stderr line so an
    // operator can notice a misconfigured disk.
    try {
      process.stderr.write(`[agent-runtime] audit write failed: ${error?.message || error}\n`);
    } catch {
      // give up
    }
  }
  return record;
}

// For tests: reset the cached path so a different env can take effect.
export function _resetAuditPathForTests() {
  cachedPath = null;
}

export const __test__ = { auditPath };

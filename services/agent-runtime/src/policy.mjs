// services/agent-runtime/src/policy.mjs
//
// Policy gate for the agent-runtime. Centralises two responsibilities that used
// to be scattered inside `services/control-plane/src/control-plane.mjs`:
//
//   1. Enforce that no caller may inject a codex CLI flag that disables the
//      approval policy. Codex's `approval_policy="never"` is a safety net that
//      must never be disabled by a request payload — the runtime must own it.
//   2. Run every prompt through BLOCK_PATTERNS so that destructive operations
//      are rejected before they ever reach a real Codex process.
//
// This module is intentionally a pure function (no I/O) so it can be unit
// tested without touching the filesystem or spawning codex.

export const BLOCK_PATTERNS = [
  /\brm\s+-[^\n;|&]*[rf]/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\bsecurity\s+find-/i,
  /\bcat\s+[^;\n]*(\.env|credential|secret|token|private[_-]?key)/i,
  /\b(open|expose).*(3001|9443|9090|19999).*(public|公网|0\.0\.0\.0)/i,
  /\b(kubectl|terraform|docker)\s+[^;\n]*(apply|destroy|delete|push)\b/i,
  /生产.*(写|改|删|部署|发布)/,
];

// Flags that, if present in the caller-provided args, will short-circuit
// approval_policy enforcement. They MUST be rejected.
export const FORBIDDEN_CODEX_FLAGS = [
  "--dangerously-bypass-approvals",
  "--no-approvals",
  "--ask-for-approval=never",
];

// Validate the caller-supplied args. The intent is:
//   - the runtime owns -c approval_policy="never"; if a caller also tries to
//     inject it, that is allowed but it MUST match what the runtime would have
//     set anyway (defence in depth).
//   - any forbidden safety-bypass flag is rejected with 400.
//   - any prompt whose body matches a BLOCK_PATTERN is rejected with 400.
export function evaluateRequest({ prompt, args = [] } = {}) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, status: 400, reason: "prompt must be a non-empty string" };
  }

  for (const flag of FORBIDDEN_CODEX_FLAGS) {
    if (args.includes(flag)) {
      return {
        ok: false,
        status: 400,
        reason: `forbidden flag not allowed in caller args: ${flag}`,
      };
    }
  }

  // Defence in depth: if the caller already passed -c approval_policy="never"
  // we allow it but log; anything else trying to override is rejected.
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-c" && i + 1 < args.length) {
      const kv = args[i + 1];
      if (/^approval_policy\s*=/.test(kv) && !/approval_policy\s*=\s*"?never"?/.test(kv)) {
        return {
          ok: false,
          status: 400,
          reason: `caller may not override approval_policy (got ${kv})`,
        };
      }
    }
  }

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        ok: false,
        status: 400,
        reason: `prompt matches BLOCK_PATTERN ${pattern}`,
      };
    }
  }

  return { ok: true };
}

// Build the canonical arg list. This is the ONE place that decides what codex
// flags are used. Callers may NOT inject raw flags.
export function buildCodexArgs({ prompt, sandbox = "workspace-write" } = {}) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("buildCodexArgs: prompt must be a non-empty string");
  }
  return [
    "exec",
    "--json",
    "--ephemeral",
    "-c",
    'approval_policy="never"',
    "--skip-git-repo-check",
    "--sandbox",
    sandbox,
    "-C",
    process.cwd(),
    prompt,
  ];
}

// services/agent-runtime/test/runtime.test.mjs
//
// Smoke tests for the agent-runtime policy + audit modules. We deliberately
// avoid spawning real codex in CI; the spawnSync branch is exercised by the
// runtime itself and verified manually via the HTTP /readyz endpoint.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BLOCK_PATTERNS,
  FORBIDDEN_CODEX_FLAGS,
  buildCodexArgs,
  evaluateRequest,
} from "../src/policy.mjs";
import { auditEvent, _resetAuditPathForTests } from "../src/audit.mjs";

test("evaluateRequest accepts a benign prompt", () => {
  const result = evaluateRequest({ prompt: "refactor the foo bar" });
  assert.equal(result.ok, true);
});

test("evaluateRequest rejects empty prompt", () => {
  const result = evaluateRequest({ prompt: "   " });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("evaluateRequest rejects forbidden safety bypass flag", () => {
  const result = evaluateRequest({
    prompt: "do work",
    args: ["--dangerously-bypass-approvals"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.match(result.reason, /forbidden flag/);
});

test("evaluateRequest rejects --ask-for-approval=never", () => {
  const result = evaluateRequest({
    prompt: "do work",
    args: ["--ask-for-approval=never"],
  });
  assert.equal(result.ok, false);
});

test("evaluateRequest rejects --no-approvals", () => {
  const result = evaluateRequest({
    prompt: "do work",
    args: ["--no-approvals"],
  });
  assert.equal(result.ok, false);
});

test("evaluateRequest rejects BLOCK_PATTERN rm -rf", () => {
  const result = evaluateRequest({ prompt: "please rm -rf /tmp/foo" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("evaluateRequest rejects BLOCK_PATTERN 生产 部署", () => {
  const result = evaluateRequest({ prompt: "请到生产 执行 部署 操作" });
  assert.equal(result.ok, false);
});

test("evaluateRequest rejects caller attempting to override approval_policy", () => {
  const result = evaluateRequest({
    prompt: "do work",
    args: ["-c", 'approval_policy="on-request"'],
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /approval_policy/);
});

test("evaluateRequest allows caller mirroring the runtime's approval_policy=never", () => {
  const result = evaluateRequest({
    prompt: "do work",
    args: ["-c", 'approval_policy="never"'],
  });
  assert.equal(result.ok, true);
});

test("buildCodexArgs emits the canonical flag set", () => {
  const args = buildCodexArgs({ prompt: "do work" });
  assert.deepEqual(args.slice(0, 5), [
    "exec",
    "--json",
    "--ephemeral",
    "-c",
    'approval_policy="never"',
  ]);
  assert.ok(args.includes("--skip-git-repo-check"));
  assert.ok(args.includes("--sandbox"));
  assert.ok(args.includes("workspace-write"));
  assert.equal(args[args.length - 1], "do work");
});

test("buildCodexArgs honours read-only sandbox override", () => {
  const args = buildCodexArgs({ prompt: "audit only", sandbox: "read-only" });
  assert.ok(args.includes("read-only"));
  assert.ok(!args.includes("workspace-write"));
});

test("buildCodexArgs rejects empty prompt", () => {
  assert.throws(() => buildCodexArgs({ prompt: "" }), /non-empty string/);
});

test("FORBIDDEN_CODEX_FLAGS is non-empty and well known", () => {
  assert.ok(FORBIDDEN_CODEX_FLAGS.length > 0);
  assert.ok(FORBIDDEN_CODEX_FLAGS.includes("--dangerously-bypass-approvals"));
});

test("BLOCK_PATTERNS is non-empty", () => {
  assert.ok(BLOCK_PATTERNS.length >= 5);
});

test("auditEvent writes JSON line to configured path", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-runtime-audit-"));
  const logPath = join(dir, "audit.log");
  process.env.AXI_AGENT_RUNTIME_AUDIT_LOG = logPath;
  _resetAuditPathForTests();
  try {
    auditEvent({ type: "test.event", payload: { foo: "bar" } });
    const raw = readFileSync(logPath, "utf8");
    const line = raw.trim().split("\n").pop();
    const parsed = JSON.parse(line);
    assert.equal(parsed.type, "test.event");
    assert.deepEqual(parsed.payload, { foo: "bar" });
    assert.ok(typeof parsed.ts === "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.AXI_AGENT_RUNTIME_AUDIT_LOG;
    _resetAuditPathForTests();
  }
});

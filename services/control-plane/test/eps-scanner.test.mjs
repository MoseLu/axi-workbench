import test from "node:test";
import assert from "node:assert/strict";
import { createEpsAudit } from "../src/eps/scanner.mjs";

test("EPS scanner discovers Workbench routes, clients, and backend port mappings", () => {
  const audit = createEpsAudit({ workspaceRoot: process.cwd().replace(/\/services\/control-plane$/, "") });
  assert.equal(audit.status, "completed");
  assert.ok(audit.summary.assets > 0);
  assert.ok(audit.summary.backendRoutes > 0);
  assert.ok(audit.summary.clientCalls > 0);
  assert.ok(audit.ports.some((port) => port.hostPort === 18088 && port.containerPort === 8080));
  assert.ok(audit.findings.some((finding) => finding.severity === "high"));
});

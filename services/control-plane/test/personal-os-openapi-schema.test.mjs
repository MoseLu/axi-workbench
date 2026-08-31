import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("openapi/personal-os.v1.yaml"), "utf8");

test("Personal OS OpenAPI documents the four Gateway-facing routes", () => {
  for (const route of [
    "/api/v1/control-plane/personal-os/queue:",
    "/api/v1/control-plane/personal-os/projects/{projectId}:",
    "/api/v1/control-plane/personal-os/focus:",
    "contractVersion:",
    "generatedAt:",
    "warnings:",
    "PersonalOsProjectPatch:",
    "PersonalOsFocusUpdate:",
    "gatewaySession:",
  ]) {
    assert.ok(source.includes(route), "OpenAPI is missing " + route);
  }
});

test("Personal OS OpenAPI does not describe private AgentRun fields", () => {
  for (const field of ["prompt:", "cwd:", "stdout:", "stderr:", "provider_secret:", "access_token:"]) {
    assert.equal(source.includes(field), false, "OpenAPI must not expose " + field);
  }
});

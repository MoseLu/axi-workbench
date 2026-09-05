import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane } from "../src/control-plane.mjs";
import { createControlPlaneHttpServer } from "../src/server.mjs";

function invokeServer(server, { method, url, headers = {}, body }) {
  const fullHeaders = { host: "127.0.0.1", ...headers };
  let payload = body;
  if (payload !== undefined && typeof payload !== "string") {
    payload = JSON.stringify(payload);
    fullHeaders["content-type"] = "application/json";
  }
  return new Promise((resolve) => {
    const chunks = payload ? [Buffer.from(payload)] : [];
    const req = {
      method,
      url,
      headers: fullHeaders,
      [Symbol.asyncIterator]() { return this; },
      async next() {
        if (chunks.length === 0) return { value: undefined, done: true };
        return { value: chunks.shift(), done: false };
      },
    };
    const responseHeaders = {};
    const res = {
      req,
      statusCode: 200,
      writeHead(code, headersToWrite) {
        this.statusCode = code;
        Object.assign(responseHeaders, headersToWrite);
        return this;
      },
      end(value) {
        resolve({ status: this.statusCode, headers: responseHeaders, body: value ? value.toString("utf8") : "" });
      },
    };
    server.emit("request", req, res);
  });
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "axi-personal-os-http-"));
  const projectPath = join(root, "products", "sample-app");
  mkdirSync(projectPath, { recursive: true });
  const graphPath = join(root, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects: {
    "sample-app": {
      name: "示例应用",
      kind: "product",
      path: projectPath,
      consumes: ["axi-ui"],
    },
    "reference-app": {
      name: "参考项目",
      kind: "reference-project",
      lifecycle: "legacy-reference",
      path: join(root, "references", "reference-app"),
    },
  } }));
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    graphPath,
    cacheDir: join(root, ".cache"),
    coreApiToken: "unused-by-control-plane",
    personalOsRuntimeReader: async () => ({
      services: [{ id: "sample-app-web", cwd: projectPath, pm2: { status: "online" }, health: { ok: true } }],
      warnings: [],
    }),
  });
  const server = createControlPlaneHttpServer({
    controlPlane,
    coreApiToken: "core-token",
    allowedOrigins: ["http://allowed-origin.test"],
  });
  return { controlPlane, server };
}

function json(response) {
  return JSON.parse(response.body);
}

test("Personal OS HTTP routes use the core bearer boundary and return a versioned queue", async () => {
  const { controlPlane, server } = fixture();
  const anonymous = await invokeServer(server, { method: "GET", url: "/personal-os/queue" });
  assert.equal(anonymous.status, 401);
  const authenticated = await invokeServer(server, {
    method: "GET",
    url: "/personal-os/queue?view=all",
    headers: { authorization: "Bearer core-token" },
  });
  assert.equal(authenticated.status, 200);
  const body = json(authenticated);
  assert.equal(body.contractVersion, 1);
  assert.deepEqual(body.source, {
    project: "workspace.graph",
    runtime: "devsvc",
    metadata: "personal-os.sqlite",
  });
  assert.deepEqual(body.items.map((item) => item.id), ["sample-app"]);
  assert.equal(body.items[0].runtime.state, "running");
  controlPlane.personalOs.close();
});

test("gateway web identity can reach Personal OS without exposing the core bearer to the browser", async () => {
  const { controlPlane, server } = fixture();
  const response = await invokeServer(server, {
    method: "GET",
    url: "/internal/web/v1/personal-os/queue?view=all",
    headers: {
      "x-axi-internal-token": "axi-development-internal-token",
      "x-axi-subject": "owner-subject",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(json(response).contractVersion, 1);
  controlPlane.personalOs.close();
});

test("Personal OS project writes enforce finishLine and optimistic revisions", async () => {
  const { controlPlane, server } = fixture();
  const invalid = await invokeServer(server, {
    method: "PATCH",
    url: "/personal-os/projects/sample-app",
    headers: { authorization: "Bearer core-token" },
    body: { lifecycleOverride: "building", revision: 0 },
  });
  assert.equal(invalid.status, 400);
  assert.equal(json(invalid).error, "invalid_request");

  const updated = await invokeServer(server, {
    method: "PATCH",
    url: "/personal-os/projects/sample-app",
    headers: { authorization: "Bearer core-token" },
    body: { lifecycleOverride: "building", finishLine: "完成主流程", revision: 0 },
  });
  assert.equal(updated.status, 200);
  assert.equal(json(updated).overlay.revision, 1);
  assert.equal(json(updated).project.lifecycle, "building");

  const conflict = await invokeServer(server, {
    method: "PATCH",
    url: "/personal-os/projects/sample-app",
    headers: { authorization: "Bearer core-token" },
    body: { finishLine: "过期写入", revision: 0 },
  });
  assert.equal(conflict.status, 409);
  assert.equal(json(conflict).current.revision, 1);
  controlPlane.personalOs.close();
});

test("Personal OS focus is persisted and reflected by the queue", async () => {
  const { controlPlane, server } = fixture();
  const initial = await invokeServer(server, {
    method: "GET",
    url: "/personal-os/focus",
    headers: { authorization: "Bearer core-token" },
  });
  assert.equal(json(initial).focus.revision, 0);
  const updated = await invokeServer(server, {
    method: "PUT",
    url: "/personal-os/focus",
    headers: { authorization: "Bearer core-token" },
    body: { projectId: "sample-app", revision: 0 },
  });
  assert.equal(updated.status, 200);
  assert.equal(json(updated).focus.projectId, "sample-app");
  const queue = await invokeServer(server, {
    method: "GET",
    url: "/personal-os/queue?view=today",
    headers: { authorization: "Bearer core-token" },
  });
  assert.equal(json(queue).items[0].focus, true);
  controlPlane.personalOs.close();
});

test("Personal OS rejects unknown projects and reports CORS write methods", async () => {
  const { controlPlane, server } = fixture();
  const missing = await invokeServer(server, {
    method: "GET",
    url: "/personal-os/projects/reference-app",
    headers: { authorization: "Bearer core-token" },
  });
  assert.equal(missing.status, 404);
  const cors = await invokeServer(server, { method: "OPTIONS", url: "/personal-os/queue", headers: { origin: "http://allowed-origin.test" } });
  assert.equal(cors.status, 204);
  assert.match(cors.headers["Access-Control-Allow-Methods"], /PATCH/);
  assert.match(cors.headers["Access-Control-Allow-Methods"], /PUT/);
  controlPlane.personalOs.close();
});

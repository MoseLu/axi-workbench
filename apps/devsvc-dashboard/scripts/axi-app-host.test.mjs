import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createAxiAppHost,
  defaultAxiAppRegistry,
  isHostedProxyRequest,
  loadAxiAppRegistry,
  parseHostedAppPath,
  resolveHealthPath,
  resolveReadinessPath
} from "./axi-app-host.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = path.dirname(path.dirname(projectRoot));
const dashboardAppIds = [
  "axi-fleet-console",
  "axi-coder",
  "axi-verification-inbox",
  "axi-docs",
  "axi-image-preview",
  "axi-agent-platform"
];

/**
 * Spin up a tiny HTTP server that maps a path to a status code/handler.
 * Returns { port, close } for deterministic cleanup.
 */
function startFakeUpstream(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const result = handler(url.pathname);
      if (result === null) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      const status = typeof result === "number" ? result : 200;
      res.writeHead(status, { "content-type": "text/plain" });
      res.end(`status=${status}`);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate fake upstream port"));
        return;
      }
      resolve({
        port: address.port,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
  });
}

/**
 * Build a registry that points a single app at a pre-existing upstream.
 * Avoids actually spawning the app process for tests.
 */
function buildStaticRegistry({ appId, healthPath, readinessPath, port }) {
  return [
    {
      appId,
      title: "Test App",
      capabilities: ["web"],
      cwd: "/tmp",
      defaultRoute: "/",
      healthPath: healthPath || "/",
      readinessPath: readinessPath || "/",
      icon: "app",
      menuGroups: [],
      nativeFallback: false,
      packageManager: "npm",
      routes: ["/"],
      startCommand: `echo should-not-spawn-${port}`,
      executionBoundary: {
        owner: "Test Owner",
        authorization: "test-only",
        audit: "test",
        fallback: "test fallback"
      }
    },
    { appId: "__upstream_port__", port }
  ];
}

test("parseHostedAppPath returns app id and nested route", () => {
  assert.deepEqual(parseHostedAppPath("/apps/axi-fleet-console/dashboard"), {
    appId: "axi-fleet-console",
    appPath: "/dashboard"
  });
});

test("parseHostedAppPath ignores non app routes", () => {
  assert.equal(parseHostedAppPath("/overview"), null);
});

test("isHostedProxyRequest keeps visible app routes for the dashboard shell", () => {
  const url = new URL("http://127.0.0.1/apps/axi-fleet-console/dashboard");
  assert.equal(isHostedProxyRequest(url, { method: "GET", headers: { "sec-fetch-dest": "document" } }), false);
});

test("isHostedProxyRequest proxies iframe and Vite asset traffic", () => {
  const frame = new URL("http://127.0.0.1/apps/axi-fleet-console/dashboard?__axi_frame=1");
  const viteClient = new URL("http://127.0.0.1/apps/axi-fleet-console/@vite/client");
  assert.equal(isHostedProxyRequest(frame), true);
  assert.equal(isHostedProxyRequest(viteClient), true);
});

test("default registry keeps ports as host-runtime placeholders", () => {
  const registry = defaultAxiAppRegistry("/workspace");
  assert.equal(registry.some((app) => app.startCommand.includes("--port ${port}")), true);
  assert.equal(registry.some((app) => /--port\s+(4173|1420|17889)/u.test(app.startCommand)), false);
});

test("default registry exposes hierarchical hosted app menus", () => {
  const registry = defaultAxiAppRegistry("/workspace");
  assert.equal(registry.every((app) => Array.isArray(app.menuGroups) && app.menuGroups.length > 0), true);
  assert.equal(registry.some((app) => app.menuGroups.some((group) => group.children.length > 1)), true);
  assert.equal(registry.flatMap((app) => app.menuGroups.flatMap((group) => group.children)).every((item) => item.route.startsWith("/")), true);
});

test("dashboard managed apps remain clipped inside the host content plane", () => {
  const registries = [
    defaultAxiAppRegistry("/workspace"),
    loadAxiAppRegistry("/workspace", path.join(projectRoot, "config", "axi-apps.json"))
  ];

  for (const registry of registries) {
    for (const appId of dashboardAppIds) {
      const app = registry.find((candidate) => candidate.appId === appId);
      assert.equal(app?.nativeFallback, false, `${appId} must not escape the dashboard layout through a native webview`);
      assert.equal(app?.capabilities.includes("native-fallback"), false, `${appId} must not advertise an unused native fallback`);
    }
  }
});

test("registry loader reads the renamed dashboard config path by default", () => {
  const registry = loadAxiAppRegistry(workspaceRoot);
  assert.deepEqual(registry.map((app) => app.appId), dashboardAppIds);
});

test("D-level specialist entries declare owner, authorization, audit, and fallback without becoming host actions", () => {
  for (const registry of [defaultAxiAppRegistry("/workspace"), loadAxiAppRegistry("/workspace", path.join(projectRoot, "config", "axi-apps.json"))]) {
    for (const appId of ["axi-fleet-console", "axi-coder", "axi-verification-inbox"]) {
      const boundary = registry.find((app) => app.appId === appId)?.executionBoundary;
      assert.ok(boundary?.owner, `${appId} owner`);
      assert.ok(boundary?.authorization, `${appId} authorization`);
      assert.ok(boundary?.audit, `${appId} audit`);
      assert.ok(boundary?.fallback, `${appId} fallback`);
    }
  }
});

test("every dashboard app declares both a healthPath and readinessPath", () => {
  for (const app of loadAxiAppRegistry(workspaceRoot)) {
    assert.equal(typeof app.healthPath, "string", `${app.appId} missing healthPath`);
    assert.equal(typeof app.readinessPath, "string", `${app.appId} missing readinessPath`);
    assert.ok(app.healthPath.startsWith("/"), `${app.appId} healthPath must be rooted`);
    assert.ok(app.readinessPath.startsWith("/"), `${app.appId} readinessPath must be rooted`);
  }
});

test("resolveReadinessPath falls back to healthPath when readinessPath is missing", () => {
  assert.equal(resolveReadinessPath({ healthPath: "/health" }), "/health");
  assert.equal(resolveReadinessPath({ healthPath: "/", readinessPath: "/ready" }), "/ready");
  assert.equal(resolveReadinessPath({}), "/");
  assert.equal(resolveReadinessPath({ readinessPath: "no-leading-slash" }), "/");
});

test("resolveHealthPath returns a rooted path or / when missing", () => {
  assert.equal(resolveHealthPath({ healthPath: "/health" }), "/health");
  assert.equal(resolveHealthPath({}), "/");
  assert.equal(resolveHealthPath({ healthPath: "bad" }), "/");
});

test("publicApp exposes healthContract so dashboards can render readiness vs page distinctions", () => {
  const host = createAxiAppHost({
    workspaceRoot: "/workspace",
    registry: [
      {
        appId: "test-app",
        title: "Test App",
        cwd: "/tmp",
        defaultRoute: "/",
        healthPath: "/",
        readinessPath: "/__ready",
        icon: "app",
        menuGroups: [],
        capabilities: ["web"],
        nativeFallback: false,
        routes: ["/"],
        startCommand: "echo"
      }
    ],
    runtimeDir: "/tmp/axi-runtime-test"
  });
  const view = host.statusFor("test-app");
  assert.deepEqual(view.healthContract, { healthPath: "/", readinessPath: "/__ready" });
  assert.equal(view.failure, null);
  assert.equal(view.attempt, null);
});

test("classifyHealth distinguishes ready, page-only, and unavailable", async () => {
  const ready = await startFakeUpstream(() => 200);
  const partial = await startFakeUpstream((path) => (path === "/__ready" ? 503 : 200));
  const dead = await startFakeUpstream(() => null);

  try {
    const readyHost = createAxiAppHost({
      workspaceRoot: "/workspace",
      registry: buildStaticRegistry({ appId: "ready-app", readinessPath: "/", port: ready.port }).slice(0, 1),
      runtimeDir: "/tmp/axi-runtime-ready"
    });
    const partialHost = createAxiAppHost({
      workspaceRoot: "/workspace",
      registry: buildStaticRegistry({ appId: "partial-app", readinessPath: "/__ready", port: partial.port }).slice(0, 1),
      runtimeDir: "/tmp/axi-runtime-partial"
    });
    const deadHost = createAxiAppHost({
      workspaceRoot: "/workspace",
      registry: buildStaticRegistry({ appId: "dead-app", readinessPath: "/", port: dead.port }).slice(0, 1),
      runtimeDir: "/tmp/axi-runtime-dead"
    });

    const readyState = { app: readyHost.statusFor("ready-app"), port: ready.port };
    const partialState = { app: partialHost.statusFor("partial-app"), port: partial.port };
    const deadState = { app: deadHost.statusFor("dead-app"), port: dead.port };

    const readyResult = await readyHost.classifyHealth(readyState);
    assert.equal(readyResult.status, "ready");
    assert.equal(readyResult.readinessCode, 200);
    assert.equal(readyResult.healthOk, true);

    const partialResult = await partialHost.classifyHealth(partialState);
    assert.equal(partialResult.status, "page-only");
    assert.equal(partialResult.readinessCode, 503);
    assert.equal(partialResult.healthOk, true);

    const deadResult = await deadHost.classifyHealth(deadState);
    assert.equal(deadResult.status, "unavailable");
    assert.equal(deadResult.healthOk, false);
  } finally {
    await Promise.all([ready.close(), partial.close(), dead.close()]);
  }
});

test("startApp retries once and then exposes an error state with owner hint when readiness never converges", async () => {
  // Upstream that returns 200 on health but never returns 200 on readiness,
  // simulating a service whose page renders but whose runtime is unhealthy.
  const upstream = await startFakeUpstream((path) => (path === "/__ready" ? 503 : 200));
  const fatalCmd = process.platform === "win32" ? "exit 1" : "false";
  const host = createAxiAppHost({
    workspaceRoot: "/workspace",
    registry: [
      {
        appId: "axi-docs",
        title: "Axi Docs",
        cwd: "/tmp",
        defaultRoute: "/",
        healthPath: "/",
        readinessPath: "/__ready",
        icon: "search",
        menuGroups: [],
        capabilities: ["web", "docs"],
        nativeFallback: false,
        routes: ["/"],
        startCommand: `${fatalCmd} ${upstream.port}`,
        executionBoundary: {
          owner: "Axi Docs Team",
          authorization: "docs-only",
          audit: "docs audit",
          fallback: "docs fallback"
        }
      }
    ],
    runtimeDir: "/tmp/axi-runtime-retry"
  });

  try {
    const result = await host.startApp("axi-docs");
    assert.equal(result.status, "error");
    assert.ok(result.failure, "failure descriptor must be present");
    assert.equal(result.failure.owner, "Axi Docs Team");
    assert.equal(result.failure.retryable, true);
    assert.match(result.failure.lastError, /exited|readiness/);
    assert.ok(Array.isArray(result.failure.logs));
    assert.ok(result.attempt >= 2, `expected at least 2 attempts, got ${result.attempt}`);
    assert.deepEqual(result.healthContract, { healthPath: "/", readinessPath: "/__ready" });
  } finally {
    await upstream.close();
  }
});

test("startApp reports degraded state when page is accessible but readiness endpoint never returns 200", async () => {
  // Upstream that responds 200 on health (page accessible) but 503 on readiness,
  // simulating a service whose page renders but whose runtime is unhealthy.
  const upstream = await startFakeUpstream((path) => (path === "/__ready" ? 503 : 200));
  // Use a long-lived node process that binds to the upstream port and forwards,
  // so waitForReady hits the upstream with both health and readiness probes.
  const port = upstream.port;
  const proxyCmd = [
    `${process.execPath} -e "`,
    `const http = require('http');`,
    `const proxy = http.createServer((req, res) => {`,
    `  const opts = { hostname: '127.0.0.1', port: ${port}, path: req.url, method: req.method, headers: req.headers };`,
    `  const upstream = http.request(opts, (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); });`,
    `  upstream.on('error', () => { res.writeHead(502); res.end('bad'); });`,
    `  req.pipe(upstream);`,
    `});`,
    `proxy.listen(parseInt(process.env.PORT || '0', 10), '127.0.0.1');`,
    `setInterval(() => {}, 1000);`,
    `"`
  ].join("");
  const host = createAxiAppHost({
    workspaceRoot: "/workspace",
    registry: [
      {
        appId: "axi-agent-platform",
        title: "Axi Agent Platform",
        cwd: "/tmp",
        defaultRoute: "/",
        healthPath: "/",
        readinessPath: "/__ready",
        icon: "work",
        menuGroups: [],
        capabilities: ["web", "agent-runtime"],
        nativeFallback: false,
        routes: ["/"],
        startCommand: proxyCmd,
        executionBoundary: {
          owner: "Axi Agent Platform Team",
          authorization: "agent-only",
          audit: "agent audit",
          fallback: "agent fallback"
        }
      }
    ],
    runtimeDir: "/tmp/axi-runtime-degraded"
  });

  try {
    // First, prove classifyHealth correctly identifies the page-only state.
    const live = await host.classifyHealth({
      app: host.statusFor("axi-agent-platform"),
      port: upstream.port
    });
    assert.equal(live.status, "page-only");
    assert.equal(live.readinessCode, 503);
    assert.equal(live.healthOk, true);

    // Now drive startApp — it should converge to "degraded" once waitForReady exits.
    const result = await host.startApp("axi-agent-platform");
    assert.equal(
      result.status,
      "degraded",
      `expected degraded status, got ${result.status}; failure=${JSON.stringify(result.failure)}`
    );
    assert.ok(result.failure, "failure descriptor must be present on degraded state");
    assert.match(result.failure.lastError, /readiness endpoint .*__ready returned 503/);
    assert.equal(result.failure.owner, "Axi Agent Platform Team");
    assert.equal(result.failure.retryable, true);
    assert.deepEqual(result.healthContract, { healthPath: "/", readinessPath: "/__ready" });
  } finally {
    await upstream.close();
    await host.stopApp("axi-agent-platform");
  }
});

test("stopApp clears failure and attempt metadata so the next start begins fresh", async () => {
  const fatalCmd = process.platform === "win32" ? "exit 1" : "false";
  const host = createAxiAppHost({
    workspaceRoot: "/workspace",
    registry: [
      {
        appId: "axi-docs",
        title: "Axi Docs",
        cwd: "/tmp",
        defaultRoute: "/",
        healthPath: "/",
        readinessPath: "/__ready",
        icon: "search",
        menuGroups: [],
        capabilities: ["web"],
        nativeFallback: false,
        routes: ["/"],
        startCommand: fatalCmd,
        executionBoundary: {
          owner: "Owner",
          authorization: "auth",
          audit: "audit",
          fallback: "fallback"
        }
      }
    ],
    runtimeDir: "/tmp/axi-runtime-stop"
  });

  const errored = await host.startApp("axi-docs");
  assert.equal(errored.status, "error");
  assert.ok(errored.failure);

  const stopped = await host.stopApp("axi-docs");
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.failure, null);
  assert.equal(stopped.attempt, null);
});

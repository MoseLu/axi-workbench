import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { defaultAxiAppRegistry, isHostedProxyRequest, loadAxiAppRegistry, parseHostedAppPath } from "./axi-app-host.mjs";

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

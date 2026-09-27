import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "UNKNOWN"]);
const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".turbo", ".cache"]);

function walk(root, result = []) {
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, result);
    else if (/\.(go|ts|tsx|js|mjs|yaml|yml|json)$/.test(entry.name)) result.push(path);
  }
  return result;
}

function assetId(value) {
  return `api:${Buffer.from(value).toString("base64url")}`;
}

function pushRoute(routes, method, path, source, platform = "backend") {
  if (!METHODS.has(method) || !path.startsWith("/")) return;
  const normalized = path.replace(/\/+/g, "/").replace(/:\w+/g, ":param");
  const key = `${method} ${normalized}`;
  if (!routes.some((route) => route.key === key && route.platform === platform)) {
    routes.push({ key, method, path: normalized, platform, source });
  }
}

function scanGoRoutes(file, text, routes) {
  const patterns = [
    /\.(GET|POST|PUT|PATCH|DELETE)\(\s*["'`]([^"'`]+)["'`]/g,
    /\.(GET|POST|PUT|PATCH|DELETE)\(\s*[^,]+,\s*["'`]([^"'`]+)["'`]/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) pushRoute(routes, match[1], match[2], file);
  }
}

function scanFrontendCalls(file, text, routes) {
  const patterns = [
    /\.(get|post|put|patch|delete)\s*<*[^\n]*?>*\s*\(\s*["'`]([^"'`]+)["'`]/gi,
    /["'`](\/api\/v\d+\/[^"'`? ]+)["'`]/g,
  ];
  for (const [index, pattern] of patterns.entries()) {
    for (const match of text.matchAll(pattern)) {
      if (index === 0) pushRoute(routes, match[1].toUpperCase(), match[2], file, file.includes("mobile") ? "mobile" : file.includes("desktop") ? "desktop" : "web");
      else pushRoute(routes, "UNKNOWN", match[1], file, file.includes("mobile") ? "mobile" : file.includes("desktop") ? "desktop" : "web");
    }
  }
}

function scanOpenApi(file, text, routes) {
  for (const match of text.matchAll(/^\s{2}(\/api\/v\d+\/[^:]+):\s*$/gm)) {
    pushRoute(routes, "UNKNOWN", match[1].trim(), file, "contract");
  }
}

function scanPorts(file, text) {
  const ports = [];
  for (const match of text.matchAll(/(?:127\.0\.0\.1:)?(\d{4,5})\s*[:>-]\s*(\d{4,5})/g)) {
    ports.push({ hostPort: Number(match[1]), containerPort: Number(match[2]), source: file });
  }
  return ports;
}

function finding(id, severity, message, refs = []) {
  return { id, severity, message, refs };
}

export function createEpsAudit({ workspaceRoot = process.env.AXI_WORKSPACE_ROOT || resolve(process.cwd(), "../..") } = {}) {
  const root = resolve(workspaceRoot);
  const sourceRoots = ["services/api-gateway", "services/control-plane", "packages/gateway-contracts", "packages/api-client", "apps/workbench", "apps/workbench-mobile", "apps/workbench-desktop", "docker-compose.backend.yml", "../../dev-services.config.json"];
  const files = sourceRoots.flatMap((path) => {
    const candidate = resolve(root, path);
    return existsSync(candidate) && statSync(candidate).isFile() ? [candidate] : walk(candidate);
  });
  const routes = [];
  const ports = [];
  for (const file of files) {
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    if (file.endsWith(".go")) scanGoRoutes(file, text, routes);
    if (/\.(ts|tsx|js|mjs)$/.test(file)) scanFrontendCalls(file, text, routes);
    if (/openapi|swagger/i.test(file)) scanOpenApi(file, text, routes);
    if (file.endsWith("docker-compose.backend.yml") || file.endsWith("dev-services.config.json")) ports.push(...scanPorts(file, text));
  }
  const backend = routes.filter((route) => route.platform === "backend");
  const client = routes.filter((route) => ["web", "mobile", "desktop"].includes(route.platform));
  const findings = [];
  for (const route of client) {
    if (route.method === "UNKNOWN") continue;
    if (!backend.some((candidate) => candidate.key === route.key || (candidate.method === route.method && candidate.path === route.path))) {
      findings.push(finding(`client-route-missing:${route.key}`, "high", `前端调用未发现对应后端路由：${route.key}`, [route.source]));
    }
  }
  for (const port of ports) {
    if (port.hostPort === 18088 && port.containerPort !== 8080) findings.push(finding("gateway-port-mismatch", "blocker", "API Gateway 主机映射不是 18088 -> 8080", [port.source]));
  }
  return {
    id: randomUUID(),
    status: "completed",
    createdAt: new Date().toISOString(),
    workspaceRoot: root,
    summary: { assets: routes.length, backendRoutes: backend.length, clientCalls: client.length, ports: ports.length, findings: findings.length },
    assets: routes.map((route) => ({ id: assetId(`${route.platform}:${route.key}`), project: "axi-workbench", application: route.platform === "backend" ? "api-gateway" : "workbench", platform: route.platform, method: route.method, path: route.path, owner: route.platform === "backend" ? "services/api-gateway" : route.source, service: route.platform === "backend" ? "api-gateway" : null, contractRef: route.platform === "contract" ? route.source : null, environment: "development", status: "discovered", source: relative(root, route.source) })),
    ports: ports.map((port) => ({ ...port, source: relative(root, port.source) })),
    findings,
  };
}

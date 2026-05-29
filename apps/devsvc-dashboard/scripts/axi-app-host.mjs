import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const frameFlag = "__axi_frame";
const statusOrder = new Set(["idle", "starting", "ready", "stopped", "error"]);

export function defaultAxiAppRegistry(workspaceRoot) {
  const node22 = path.join(workspaceRoot, "scripts", "run-node22-command.sh");
  return [
    {
      appId: "axi-fleet-console",
      capabilities: ["web", "ops", "dashboard"],
      cwd: path.join(workspaceRoot, "projects", "axi-workbench", "infra", "fleet-console", "dashboard"),
      defaultRoute: "/dashboard",
      healthPath: "/",
      icon: "database",
      menuGroups: [
        {
          key: "operations",
          label: "运维工作台",
          icon: "app",
          children: [
            { key: "dashboard", label: "仪表盘", icon: "stats", route: "/dashboard" },
            { key: "devices", label: "服务器管理", icon: "device", route: "/devices" },
            { key: "services", label: "服务管理", icon: "component", route: "/services" }
          ]
        },
        {
          key: "governance",
          label: "资产治理",
          icon: "auth",
          children: [
            { key: "projects", label: "项目管理", icon: "workbench", route: "/projects" },
            { key: "credentials", label: "凭证管理", icon: "auth", route: "/credentials" }
          ]
        }
      ],
      nativeFallback: false,
      packageManager: "npm",
      routes: ["/dashboard", "/devices", "/services", "/projects", "/credentials"],
      startCommand: `${node22} npm run dev -- --host 127.0.0.1 --port \${port} --strictPort`,
      title: "Axi Fleet Console"
    },
    {
      appId: "axi-coder",
      capabilities: ["web", "workbench"],
      cwd: path.join(workspaceRoot, "projects", "axi-workbench", "apps", "axi-coder"),
      defaultRoute: "/overview",
      healthPath: "/",
      icon: "workbench",
      menuGroups: [
        {
          key: "workbench",
          label: "编码工作台",
          icon: "workbench",
          children: [
            { key: "overview", label: "总览", icon: "stats", route: "/overview" },
            { key: "terminal", label: "终端", icon: "params", route: "/terminal" },
            { key: "agent", label: "任务执行", icon: "work", route: "/agent" }
          ]
        },
        {
          key: "contracts",
          label: "合同与伴随端",
          icon: "iot",
          children: [
            { key: "providers", label: "模型供应商", icon: "database", route: "/providers" },
            { key: "mobile", label: "移动伴随端", icon: "phone", route: "/mobile" }
          ]
        },
        {
          key: "diagnostics",
          label: "诊断",
          icon: "log",
          children: [
            { key: "logs", label: "日志", icon: "log", route: "/logs" }
          ]
        }
      ],
      nativeFallback: false,
      packageManager: "pnpm",
      routes: ["/overview", "/terminal", "/providers", "/mobile", "/agent", "/logs"],
      startCommand: `${node22} pnpm exec vite --host 127.0.0.1 --port \${port} --strictPort`,
      title: "Axi 编码器"
    },
    {
      appId: "axi-verification-inbox",
      capabilities: ["web", "accounts", "verification-inbox"],
      cwd: path.join(workspaceRoot, "projects", "axi-workbench", "apps", "verification-inbox"),
      defaultRoute: "/",
      healthPath: "/",
      icon: "auth",
      menuGroups: [
        {
          key: "accounts",
          label: "账号验证",
          icon: "auth",
          children: [
            { key: "inbox", label: "验证收件箱", icon: "auth", route: "/" }
          ]
        }
      ],
      nativeFallback: false,
      packageManager: "npm",
      routes: ["/"],
      startCommand: `${node22} npm run dev -- --host 127.0.0.1 --port \${port} --strictPort`,
      title: "Axi Verification Inbox"
    },
    {
      appId: "axi-docs",
      capabilities: ["web", "docs", "knowledge", "search"],
      cwd: path.join(workspaceRoot, "projects", "axi-docs", "app"),
      defaultRoute: "/",
      healthPath: "/",
      icon: "search",
      menuGroups: [
        {
          key: "knowledge",
          label: "知识库",
          icon: "search",
          children: [
            { key: "home", label: "文档首页", icon: "search", route: "/" }
          ]
        }
      ],
      nativeFallback: false,
      packageManager: "pnpm",
      routes: ["/"],
      startCommand: `${node22} pnpm exec vite --host 127.0.0.1 --port \${port} --strictPort`,
      title: "Axi Docs"
    },
    {
      appId: "axi-image-preview",
      capabilities: ["web", "image", "gallery", "preview"],
      cwd: path.join(workspaceRoot, "projects", "axi-image-preview"),
      defaultRoute: "/",
      healthPath: "/",
      icon: "app",
      menuGroups: [
        {
          key: "gallery",
          label: "视觉预览",
          icon: "app",
          children: [
            { key: "gallery", label: "壁纸预览", icon: "app", route: "/" }
          ]
        }
      ],
      nativeFallback: false,
      packageManager: "npm",
      routes: ["/", "/homeViewLook/:wallpaperId"],
      startCommand: `${node22} npm exec vite -- --host 127.0.0.1 --port \${port} --strictPort`,
      title: "Axi Image Preview"
    },
    {
      appId: "axi-agent-platform",
      capabilities: ["web", "agent-runtime", "tasks", "memory"],
      cwd: path.join(workspaceRoot, "projects", "axi-agent-platform", "frontend"),
      defaultRoute: "/",
      healthPath: "/",
      icon: "work",
      menuGroups: [
        {
          key: "agent",
          label: "Agent 平台",
          icon: "work",
          children: [
            { key: "chat", label: "对话", icon: "msg", route: "/" },
            { key: "dashboard", label: "运行概览", icon: "stats", route: "/dashboard" },
            { key: "settings", label: "设置", icon: "params", route: "/settings" }
          ]
        }
      ],
      nativeFallback: false,
      packageManager: "npm",
      routes: ["/", "/dashboard", "/settings"],
      startCommand: `${node22} npm exec vite -- --host 127.0.0.1 --port \${port} --strictPort`,
      title: "Axi Agent Platform"
    }
  ];
}

export function loadAxiAppRegistry(workspaceRoot, configPath = path.join(workspaceRoot, "projects", "axi-workbench", "apps", "devsvc-dashboard", "config", "axi-apps.json")) {
  if (!fs.existsSync(configPath)) return defaultAxiAppRegistry(workspaceRoot);
  const rawApps = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return rawApps.map((app) => ({
    ...app,
    cwd: String(app.cwd).replaceAll("${workspaceRoot}", workspaceRoot),
    startCommand: String(app.startCommand).replaceAll("${workspaceRoot}", workspaceRoot)
  }));
}

export function parseHostedAppPath(pathname) {
  const match = /^\/apps\/([^/]+)(\/.*)?$/u.exec(pathname);
  if (!match) return null;
  return {
    appId: decodeURIComponent(match[1]),
    appPath: match[2] || "/"
  };
}

export function isHostedProxyRequest(url, req = { method: "GET", headers: {} }) {
  const parsed = parseHostedAppPath(url.pathname);
  if (!parsed) return false;
  if (url.searchParams.has(frameFlag)) return true;
  if (req.method && req.method !== "GET") return true;
  const dest = String(req.headers?.["sec-fetch-dest"] || "");
  if (dest && dest !== "document") return true;
  return /\/(@vite|@react-refresh|node_modules|src|assets)\b/u.test(url.pathname) || /\.[a-z0-9]{2,8}$/iu.test(url.pathname);
}

export async function allocatePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") reject(new Error("failed to allocate tcp port"));
        else resolve(address.port);
      });
    });
  });
}

export function createAxiAppHost({ workspaceRoot, registry = loadAxiAppRegistry(workspaceRoot), runtimeDir }) {
  const apps = new Map(registry.map((app) => [app.appId, app]));
  const runtime = new Map();
  const tabsPath = path.join(runtimeDir || path.join(workspaceRoot, ".devsvc"), "axi-dashboard-tabs.json");

  function appBase(appId) {
    return `/apps/${appId}/`;
  }

  function appRoute(app, route = app.defaultRoute) {
    return `${appBase(app.appId).replace(/\/$/u, "")}${route.startsWith("/") ? route : `/${route}`}`;
  }

  function frameRoute(app, route = app.defaultRoute) {
    const next = new URL(appRoute(app, route), "http://127.0.0.1");
    next.searchParams.set(frameFlag, "1");
    return `${next.pathname}${next.search}`;
  }

  function publicApp(app, state = runtime.get(app.appId)) {
    return {
      appId: app.appId,
      capabilities: app.capabilities || [],
      defaultRoute: app.defaultRoute,
      frameRoute: frameRoute(app),
      hostedMode: true,
      icon: app.icon,
      menuGroups: app.menuGroups || [],
      nativeFallback: Boolean(app.nativeFallback),
      route: appRoute(app),
      routes: app.routes || [],
      running: state?.status === "ready" || state?.status === "starting",
      status: statusOrder.has(state?.status) ? state.status : "idle",
      title: app.title,
      updatedAt: state?.updatedAt || null
    };
  }

  function pushLog(state, chunk) {
    const lines = String(chunk).split(/\r?\n/u).filter(Boolean);
    state.logs.push(...lines.slice(-20));
    state.logs = state.logs.slice(-80);
  }

  async function healthCheck(state) {
    const target = new URL(state.app.healthPath || "/", `http://127.0.0.1:${state.port}`);
    return new Promise((resolve) => {
      const req = http.request(target, { method: "GET", timeout: 1500 }, (res) => {
        res.resume();
        resolve((res.statusCode || 500) < 500);
      });
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    });
  }

  async function waitForReady(state) {
    for (let index = 0; index < 45; index += 1) {
      if (await healthCheck(state)) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  async function startApp(appId) {
    const app = apps.get(appId);
    if (!app) throw new Error(`unknown axi app: ${appId}`);
    const existing = runtime.get(appId);
    if (existing?.child && existing.status !== "stopped" && existing.status !== "error") {
      if (existing.status === "starting") {
        const ready = existing.readyPromise ? await existing.readyPromise : await waitForReady(existing);
        if (ready) {
          existing.status = "ready";
          existing.updatedAt = new Date().toISOString();
          return publicApp(app, existing);
        }
      }
      if (existing.status === "ready" || await healthCheck(existing)) {
        existing.status = "ready";
        existing.updatedAt = new Date().toISOString();
        return publicApp(app, existing);
      }
    }

    const port = await allocatePort();
    const base = appBase(appId);
    const command = app.startCommand.replaceAll("${port}", String(port)).replaceAll("${base}", base);
    const state = {
      app,
      base,
      child: null,
      logs: [],
      port,
      readyPromise: null,
      status: "starting",
      updatedAt: new Date().toISOString()
    };
    const env = {
      ...process.env,
      AXI_APP_BASE: base,
      AXI_APP_ID: appId,
      AXI_APP_PORT: String(port),
      AXI_HOST_ROUTE: appRoute(app),
      AXI_HOSTED_APP: "1",
      PORT: String(port),
      VITE_AXI_APP_ID: appId,
      VITE_AXI_APP_BASE: base,
      VITE_AXI_HOSTED_APP: "1"
    };
    const child = spawn(command, { cwd: app.cwd, env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    state.child = child;
    runtime.set(appId, state);
    child.stdout.on("data", (chunk) => pushLog(state, chunk));
    child.stderr.on("data", (chunk) => pushLog(state, chunk));
    child.on("exit", (code, signal) => {
      state.status = code === 0 ? "stopped" : "error";
      state.updatedAt = new Date().toISOString();
      pushLog(state, `process exited: code=${code ?? "-"} signal=${signal ?? "-"}`);
    });

    state.readyPromise = waitForReady(state);
    state.status = await state.readyPromise ? "ready" : "error";
    state.updatedAt = new Date().toISOString();
    if (state.status === "error") pushLog(state, "health check did not become ready");
    return publicApp(app, state);
  }

  async function stopApp(appId) {
    const app = apps.get(appId);
    if (!app) throw new Error(`unknown axi app: ${appId}`);
    const state = runtime.get(appId);
    if (state?.child && state.status !== "stopped") {
      state.child.kill("SIGTERM");
      state.status = "stopped";
      state.updatedAt = new Date().toISOString();
    }
    return publicApp(app, state);
  }

  function readTabs() {
    try {
      return JSON.parse(fs.readFileSync(tabsPath, "utf8"));
    } catch {
      return [];
    }
  }

  function writeTabs(tabs) {
    fs.mkdirSync(path.dirname(tabsPath), { recursive: true });
    fs.writeFileSync(tabsPath, JSON.stringify(tabs, null, 2));
  }

  function normalizeTab(tab) {
    const app = apps.get(String(tab.appId || ""));
    if (!app) return null;
    const route = String(tab.route || appRoute(app));
    if (!route.startsWith(`/apps/${app.appId}/`)) return null;
    return {
      appId: app.appId,
      id: String(tab.id || `${app.appId}:${route}`),
      route,
      title: String(tab.title || app.title),
      updatedAt: new Date().toISOString()
    };
  }

  function statusFor(appId) {
    const app = apps.get(appId);
    if (!app) throw new Error(`unknown axi app: ${appId}`);
    return publicApp(app);
  }

  async function proxyRequest(req, res, url) {
    const parsed = parseHostedAppPath(url.pathname);
    if (!parsed || !isHostedProxyRequest(url, req)) return false;
    const app = apps.get(parsed.appId);
    if (!app) return false;
    await startApp(app.appId);
    const state = runtime.get(app.appId);
    const upstreamUrl = new URL(`${url.pathname}${url.search}`, `http://127.0.0.1:${state.port}`);
    upstreamUrl.searchParams.delete(frameFlag);
    const proxy = http.request(
      {
        headers: { ...req.headers, host: `127.0.0.1:${state.port}`, "x-axi-app-id": app.appId },
        hostname: "127.0.0.1",
        method: req.method,
        path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
        port: state.port
      },
      (upstream) => {
        res.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(res);
      }
    );
    proxy.on("error", (error) => {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    });
    req.pipe(proxy);
    return true;
  }

  async function handleApi(req, res, url, helpers) {
    if (req.method === "GET" && url.pathname === "/api/apps") {
      helpers.sendJson(res, 200, { apps: [...apps.values()].map((app) => publicApp(app)) });
      return true;
    }
    const appAction = /^\/api\/apps\/([^/]+)\/(start|stop|status)$/u.exec(url.pathname);
    if (appAction) {
      const [, appId, action] = appAction;
      const result = action === "start" ? await startApp(appId) : action === "stop" ? await stopApp(appId) : statusFor(appId);
      helpers.sendJson(res, 200, result);
      return true;
    }
    if (url.pathname === "/api/tabs") {
      if (req.method === "GET") helpers.sendJson(res, 200, { tabs: readTabs() });
      else if (req.method === "POST") {
        const tab = normalizeTab(await helpers.readJson(req));
        if (!tab) throw new Error("invalid tab");
        const tabs = [tab, ...readTabs().filter((item) => item.id !== tab.id)].slice(0, 12);
        writeTabs(tabs);
        helpers.sendJson(res, 200, { tabs });
      } else if (req.method === "DELETE") {
        writeTabs([]);
        helpers.sendJson(res, 200, { tabs: [] });
      } else return false;
      return true;
    }
    const tabAction = /^\/api\/tabs\/([^/]+)$/u.exec(url.pathname);
    if (tabAction && (req.method === "PATCH" || req.method === "DELETE")) {
      const tabId = decodeURIComponent(tabAction[1]);
      const patch = req.method === "PATCH" ? await helpers.readJson(req) : {};
      const tabs = req.method === "DELETE"
        ? readTabs().filter((tab) => tab.id !== tabId)
        : readTabs().map((tab) => tab.id === tabId ? { ...tab, ...patch, updatedAt: new Date().toISOString() } : tab);
      writeTabs(tabs);
      helpers.sendJson(res, 200, { tabs });
      return true;
    }
    return false;
  }

  async function handleUpgrade(req, socket, head) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const parsed = parseHostedAppPath(url.pathname);
    if (!parsed) return false;
    try {
      await startApp(parsed.appId);
      const state = runtime.get(parsed.appId);
      const upstreamUrl = new URL(`${url.pathname}${url.search}`, `http://127.0.0.1:${state.port}`);
      upstreamUrl.searchParams.delete(frameFlag);
      const upstream = net.connect(state.port, "127.0.0.1", () => {
        const headers = Object.entries({ ...req.headers, host: `127.0.0.1:${state.port}` })
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n");
        upstream.write(`${req.method} ${upstreamUrl.pathname}${upstreamUrl.search} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
        if (head.length) upstream.write(head);
        socket.pipe(upstream);
        upstream.pipe(socket);
      });
      upstream.on("error", () => socket.destroy());
    } catch {
      socket.destroy();
    }
    return true;
  }

  return { handleApi, handleUpgrade, proxyRequest, startApp, stopApp, statusFor };
}

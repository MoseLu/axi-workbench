import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const frameFlag = "__axi_frame";
const statusOrder = new Set(["idle", "starting", "ready", "stopped", "error", "degraded"]);
const READINESS_TIMEOUT_MS = 1500;
const READINESS_MAX_ATTEMPTS = 45;
const START_RETRY_DELAY_MS = 750;
const START_RETRY_MAX = 1;

/**
 * Resolve the readiness path for a hosted app.
 * If the registry entry defines `readinessPath`, use it; otherwise fall back
 * to `healthPath` so existing entries keep working.
 *
 * @param {object} app hosted app registry entry
 * @returns {string} readiness path beginning with "/"
 */
export function resolveReadinessPath(app) {
  const candidate = typeof app?.readinessPath === "string" && app.readinessPath.trim().length > 0
    ? app.readinessPath.trim()
    : app?.healthPath;
  return candidate && candidate.startsWith("/") ? candidate : "/";
}

/**
 * Resolve the health (page accessibility) path for a hosted app.
 * Falls back to `/` if `healthPath` is missing or malformed.
 *
 * @param {object} app hosted app registry entry
 * @returns {string} health path beginning with "/"
 */
export function resolveHealthPath(app) {
  const candidate = typeof app?.healthPath === "string" && app.healthPath.trim().length > 0
    ? app.healthPath.trim()
    : "/";
  return candidate.startsWith("/") ? candidate : "/";
}

export function defaultAxiAppRegistry(workspaceRoot) {
  const node22 = path.join(workspaceRoot, "scripts", "run-node22-command.sh");
  return [
    {
      appId: "axi-fleet-console",
      capabilities: ["web", "ops", "dashboard"],
      cwd: path.join(workspaceRoot, "projects", "axi-workbench", "infra", "fleet-console", "dashboard"),
      defaultRoute: "/dashboard",
      executionBoundary: {
        owner: "Fleet Console（物理服务层）",
        authorization: "Fleet 自身授权与高风险确认",
        audit: "Fleet 操作审计",
        fallback: "服务不可用时仅显示状态，不在 Host 复刻执行按钮"
      },
      healthPath: "/",
      readinessPath: "/",
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
      executionBoundary: {
        owner: "Axi Coder（受管开发运行时）",
        authorization: "Coder 任务政策与运行时授权",
        audit: "Coder 任务、工具与产物审计",
        fallback: "不可用时保留受控入口与错误状态，不由 Host 执行任务"
      },
      healthPath: "/",
      readinessPath: "/",
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
      executionBoundary: {
        owner: "Verification Inbox / 原生邮件桥接",
        authorization: "收件箱自身账号与邮件访问授权",
        audit: "验证读取与操作审计",
        fallback: "原生桥接不可用时仅报告不可用，不把邮件动作复制到 Host"
      },
      healthPath: "/",
      readinessPath: "/",
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
      readinessPath: "/",
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
      readinessPath: "/",
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
      readinessPath: "/",
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
      executionBoundary: app.executionBoundary || null,
      hostedMode: true,
      icon: app.icon,
      menuGroups: app.menuGroups || [],
      nativeFallback: Boolean(app.nativeFallback),
      route: appRoute(app),
      routes: app.routes || [],
      healthPath: resolveHealthPath(app),
      readinessPath: resolveReadinessPath(app),
      running: state?.status === "ready" || state?.status === "starting",
      status: statusOrder.has(state?.status) ? state.status : "idle",
      title: app.title,
      healthContract: {
        healthPath: resolveHealthPath(app),
        readinessPath: resolveReadinessPath(app)
      },
      failure: state?.failure || null,
      attempt: state?.attempt || null,
      updatedAt: state?.updatedAt || null
    };
  }

  function pushLog(state, chunk) {
    const lines = String(chunk).split(/\r?\n/u).filter(Boolean);
    state.logs.push(...lines.slice(-20));
    state.logs = state.logs.slice(-80);
  }

  async function healthCheck(state) {
    const target = new URL(resolveHealthPath(state.app), `http://127.0.0.1:${state.port}`);
    return new Promise((resolve) => {
      const req = http.request(target, { method: "GET", timeout: 1500 }, (res) => {
        res.resume();
        const code = res.statusCode || 500;
        resolve(code >= 200 && code < 400);
      });
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    });
  }

  /**
   * Probe the readiness endpoint of an app. Returns the HTTP status code
   * (or 0 if the connection failed) and never throws.
   *
   * A readiness endpoint is distinct from a page-level health endpoint:
   * it should return 200 only when the underlying runtime/service is ready
   * to handle traffic. A 200 on the root page does not imply readiness.
   */
  async function checkReadiness(state) {
    const target = new URL(resolveReadinessPath(state.app), `http://127.0.0.1:${state.port}`);
    return new Promise((resolve) => {
      const req = http.request(
        target,
        { method: "GET", timeout: READINESS_TIMEOUT_MS },
        (res) => {
          res.resume();
          resolve(res.statusCode || 500);
        }
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(0);
      });
      req.on("error", () => resolve(0));
      req.end();
    });
  }

  /**
   * Classify the combined readiness + page-accessibility probe into one of:
   * - "ready": readiness 200 AND health < 500
   * - "page-only": readiness non-200 but health < 500 (page accessible, service not ready)
   * - "unavailable": both readiness and health failed
   *
   * @returns {Promise<{status: "ready"|"page-only"|"unavailable", readinessCode: number, healthOk: boolean}>}
   */
  async function classifyHealth(state) {
    const [readinessCode, healthOk] = await Promise.all([
      checkReadiness(state),
      healthCheck(state)
    ]);
    let status;
    if (readinessCode >= 200 && readinessCode < 300 && healthOk) status = "ready";
    else if (healthOk) status = "page-only";
    else status = "unavailable";
    return { status, readinessCode, healthOk };
  }

  async function waitForReady(state) {
    let lastResult = null;
    for (let index = 0; index < READINESS_MAX_ATTEMPTS; index += 1) {
      const result = await classifyHealth(state);
      lastResult = result;
      if (result.status === "ready") return result;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return lastResult;
  }

  /**
   * Build the failure description shown in the dashboard when an app cannot
   * be brought up. Includes owner, suggested actions, and retry hints.
   */
  function buildFailureState(state, error) {
    const boundary = state.app.executionBoundary || {};
    return {
      owner: boundary.owner || state.app.title || state.app.appId,
      authorization: boundary.authorization || null,
      fallback: boundary.fallback || null,
      suggestion: error?.suggestion
        || "检查启动日志、端口冲突或上游依赖，必要时联系 Owner 项目维护者。",
      retryable: true,
      lastError: error?.message || "readiness contract did not converge",
      logs: state.logs.slice(-20)
    };
  }

  async function startApp(appId) {
    const app = apps.get(appId);
    if (!app) throw new Error(`unknown axi app: ${appId}`);
    const existing = runtime.get(appId);
    if (existing?.child && existing.status !== "stopped" && existing.status !== "error" && existing.status !== "degraded") {
      if (existing.status === "starting") {
        const ready = existing.readyPromise ? await existing.readyPromise : await waitForReady(existing);
        if (ready) {
          existing.status = "ready";
          existing.updatedAt = new Date().toISOString();
          return publicApp(app, existing);
        }
      }
      if (existing.status === "ready") {
        return publicApp(app, existing);
      }
      // Page-accessible but not fully ready (e.g. running service without /ready endpoint)
      const live = await classifyHealth(existing);
      if (live.status === "ready") {
        existing.status = "ready";
        existing.updatedAt = new Date().toISOString();
        return publicApp(app, existing);
      }
      if (live.status === "page-only") {
        existing.status = "degraded";
        existing.failure = buildFailureState(existing, {
          message: `readiness endpoint ${resolveReadinessPath(app)} returned ${live.readinessCode}, page is accessible`,
          suggestion: `${app.title} 的根页面已可访问，但 readiness 端点未返回 200，请联系 Owner 项目确认运行时健康状态。`
        });
        existing.updatedAt = new Date().toISOString();
        return publicApp(app, existing);
      }
    }

    return attemptStart(appId);
  }

  /**
   * Spawn the app process and wait for it to become ready.
   * On failure, performs at most START_RETRY_MAX retries before
   * recording a structured failure state with owner context.
   */
  async function attemptStart(appId, attempt = 0) {
    const app = apps.get(appId);
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
      updatedAt: new Date().toISOString(),
      attempt: attempt + 1
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
    let child;
    try {
      child = spawn(command, { cwd: app.cwd, env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      pushLog(state, `spawn failed: ${error.message}`);
      return finalizeStartFailure(app, state, attempt, { message: `spawn failed: ${error.message}` });
    }
    state.child = child;
    runtime.set(appId, state);
    child.stdout.on("data", (chunk) => pushLog(state, chunk));
    child.stderr.on("data", (chunk) => pushLog(state, chunk));
    let exitedEarly = false;
    let exitInfo = null;
    child.on("exit", (code, signal) => {
      exitedEarly = true;
      exitInfo = { code, signal };
      pushLog(state, `process exited: code=${code ?? "-"} signal=${signal ?? "-"}`);
    });

    const result = await waitForReady(state);
    if (result && result.status === "ready") {
      state.status = "ready";
      state.failure = null;
      state.updatedAt = new Date().toISOString();
      return publicApp(app, state);
    }

    // Distinguish between a process that died vs. one that is alive but not ready.
    if (exitedEarly) {
      const reason = exitInfo?.code === 0
        ? "process exited cleanly before readiness contract converged"
        : `process exited with code=${exitInfo?.code ?? "?"} signal=${exitInfo?.signal ?? "?"}`;
      return finalizeStartFailure(app, state, attempt, { message: reason });
    }
    if (result && result.status === "page-only") {
      state.status = "degraded";
      state.failure = buildFailureState(state, {
        message: `readiness endpoint ${resolveReadinessPath(app)} returned ${result.readinessCode}, page is accessible`,
        suggestion: `${app.title} 的根页面已可访问，但 readiness 端点未返回 200，请联系 Owner 项目确认运行时健康状态。`
      });
      state.updatedAt = new Date().toISOString();
      return publicApp(app, state);
    }
    return finalizeStartFailure(app, state, attempt, {
      message: `readiness contract did not converge at ${resolveReadinessPath(app)} within ${READINESS_MAX_ATTEMPTS} attempts`
    });
  }

  async function finalizeStartFailure(app, state, attempt, error) {
    if (state.child && !state.child.killed) {
      try {
        state.child.kill("SIGTERM");
      } catch {
        /* ignore - child may already have exited */
      }
    }
    if (attempt < START_RETRY_MAX) {
      pushLog(state, `start attempt ${attempt + 1} failed: ${error.message}; retrying once`);
      await new Promise((resolve) => setTimeout(resolve, START_RETRY_DELAY_MS));
      return attemptStart(app.appId, attempt + 1);
    }
    state.status = "error";
    state.failure = buildFailureState(state, error);
    state.updatedAt = new Date().toISOString();
    pushLog(state, `start failed permanently after ${attempt + 1} attempt(s): ${error.message}`);
    return publicApp(app, state);
  }

  async function stopApp(appId) {
    const app = apps.get(appId);
    if (!app) throw new Error(`unknown axi app: ${appId}`);
    const state = runtime.get(appId);
    if (state?.child && state.status !== "stopped") {
      state.child.kill("SIGTERM");
      state.status = "stopped";
      state.failure = null;
      state.attempt = null;
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

  return {
    handleApi,
    handleUpgrade,
    proxyRequest,
    startApp,
    stopApp,
    statusFor,
    classifyHealth,
    resolveHealthPath,
    resolveReadinessPath
  };
}

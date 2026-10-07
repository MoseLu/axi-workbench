#!/usr/bin/env node
/**
 * Workbench dev-stub gateway.
 *
 * A pure-Node mock HTTP server (no npm dependencies) bound to 127.0.0.1:8088.
 * The Vite dev server (`apps/workbench/vite.config.ts`) proxies `/api/*` here so
 * that the workbench admin routes can boot without a live gateway. The contract
 * mirrors the responses expected by:
 *   - apps/workbench/src/contexts/AuthContext.tsx (refreshSession → /sessions/current)
 *   - apps/workbench/src/pages/Login.tsx (resume / quick login)
 *   - apps/workbench/src/lib/webDeviceLogin.ts (QR create + status)
 *   - apps/workbench/src/lib/navBadges.ts (nav-badges)
 *   - apps/workbench/src/pages/admin/* (observability + control-plane stubs)
 *
 * Usage:
 *   node apps/workbench/dev-stub/server.mjs            # foreground
 *   PORT=9000 node apps/workbench/dev-stub/server.mjs  # override port
 *
 * SIGTERM / SIGINT → exit 0.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number.parseInt(process.env.PORT ?? '8088', 10);
const HOST = '127.0.0.1';
const STARTED_AT = new Date().toISOString();

const ADMIN_USER = {
  subject: 'admin@local',
  email: 'admin@local',
  name: 'Admin',
};

const SESSION_PAYLOAD = {
  authenticated: true,
  user: ADMIN_USER,
  expiresAt: '2099-01-01T00:00:00Z',
};

const RESUME_PAYLOAD = {
  resumable: true,
  user: ADMIN_USER,
  expiresAt: '2099-01-01T00:00:00Z',
};

const NAV_BADGES_PAYLOAD = {
  home: 0,
  projects: 0,
  workspace: 0,
  me: 0,
  unreadTotal: 0,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, X-Axi-Device-Id, X-Axi-Internal-Token, X-Axi-Subject, X-Axi-QR-Poll-Token',
  'Access-Control-Max-Age': '600',
};

function logLine(method, path, status) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${method} ${path} -> ${status}`);
}

function jsonResponse(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...CORS_HEADERS,
    ...extraHeaders,
  });
  res.end(payload);
}

function notFound(req, res) {
  jsonResponse(res, 404, { error: `mock not implemented: ${req.url}` });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({ __raw: raw });
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Minimal viable shape for /api/v1/observability/events so that
 * `Observability.tsx` can call `nextEvents.events.map(...)` without
 * crashing the page. Empty event list, but a valid wrapper object.
 */
function observabilityEventsShape() {
  return { events: [] };
}

/**
 * Minimal viable shape for /api/v1/observability/overview so the
 * description string in `Observability.tsx` renders as "事件 0 · 项目 0
 * · 服务 0" instead of `undefined`.
 */
function observabilityOverviewShape() {
  return {
    totalEvents: 0,
    projects: 0,
    services: 0,
    warnings: { total: 0, open: 0 },
    chain: { valid: true },
  };
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = req.url ?? '/';
  const method = req.method ?? 'GET';
  const deviceId = req.headers['x-axi-device-id'];

  // 1. POST /api/v1/sessions/resume — quick-login resume probe from Login.tsx
  if (method === 'POST' && url.startsWith('/api/v1/sessions/resume')) {
    if (deviceId) {
      // eslint-disable-next-line no-console
      console.log(`    X-Axi-Device-Id: ${deviceId}`);
    }
    logLine(method, url, 200);
    jsonResponse(res, 200, RESUME_PAYLOAD);
    return;
  }

  // 2. GET /api/v1/sessions/current — refreshSession in AuthContext
  if (method === 'GET' && url.startsWith('/api/v1/sessions/current')) {
    logLine(method, url, 200);
    jsonResponse(res, 200, SESSION_PAYLOAD);
    return;
  }

  // DELETE /api/v1/sessions/current — logout (no body needed)
  if (method === 'DELETE' && url.startsWith('/api/v1/sessions/current')) {
    logLine(method, url, 204);
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // POST /api/v1/sessions — password login
  if (
    method === 'POST' &&
    url.startsWith('/api/v1/sessions') &&
    !url.includes('/resume') &&
    !url.includes('/device-qr') &&
    !url.includes('/email')
  ) {
    await readBody(req);
    logLine(method, url, 200);
    jsonResponse(res, 200, SESSION_PAYLOAD);
    return;
  }

  // POST /api/v1/sessions/email — email-code confirm
  if (method === 'POST' && url.startsWith('/api/v1/sessions/email')) {
    await readBody(req);
    logLine(method, url, 200);
    jsonResponse(res, 200, { authenticated: true, user: ADMIN_USER });
    return;
  }

  // POST /api/v1/sessions/device-qr/:id — consume QR
  if (method === 'POST' && url.startsWith('/api/v1/sessions/device-qr/')) {
    await readBody(req);
    logLine(method, url, 200);
    jsonResponse(res, 200, { authenticated: true });
    return;
  }

  // 3. POST /api/v1/auth/device-login/qr — create QR
  if (
    method === 'POST' &&
    url.startsWith('/api/v1/auth/device-login/qr') &&
    !url.match(/qr\/[^/]+/u)
  ) {
    logLine(method, url, 200);
    // webDeviceLogin.ts asserts:
    //   webLoginId matches /^weblogin_[A-Za-z0-9_-]{16,}$/
    //   scanToken + pollToken match /^[A-Za-z0-9_-]{32,}$/
    //   expiresAt is finite number
    jsonResponse(res, 200, {
      ok: true,
      webLoginId: 'weblogin_mock_dev_stub_id_1234567890',
      scanToken: `mock-scan-${randomUUID().replace(/-/g, '')}`,
      pollToken: `mock-poll-${randomUUID().replace(/-/g, '')}`,
      expiresAt: 4_102_444_800_000, // 2099-01-01T00:00:00Z
    });
    return;
  }

  // 4. GET /api/v1/auth/device-login/qr/:id — poll QR status
  if (method === 'GET' && url.match(/^\/api\/v1\/auth\/device-login\/qr\/[^/]+$/u)) {
    logLine(method, url, 200);
    jsonResponse(res, 200, {
      ok: true,
      status: 'waiting_scan',
      webLoginId: 'weblogin_mock_dev_stub_id_1234567890',
      expiresAt: 4_102_444_800_000,
    });
    return;
  }

  // 5. GET /api/v1/notifications/nav-badges
  if (method === 'GET' && url.startsWith('/api/v1/notifications/nav-badges')) {
    logLine(method, url, 200);
    jsonResponse(res, 200, NAV_BADGES_PAYLOAD);
    return;
  }

  // 6. GET /api/v1/observability/* — keep page from 502
  if (method === 'GET' && url.startsWith('/api/v1/observability/')) {
    if (url.includes('/overview')) {
      logLine(method, url, 200);
      jsonResponse(res, 200, observabilityOverviewShape());
      return;
    }
    if (url.includes('/events')) {
      logLine(method, url, 200);
      jsonResponse(res, 200, observabilityEventsShape());
      return;
    }
    logLine(method, url, 200);
    jsonResponse(res, 200, {});
    return;
  }

  // POST /api/v1/observability/ui-contract-gaps — silent accept
  if (method === 'POST' && url.startsWith('/api/v1/observability/')) {
    await readBody(req);
    logLine(method, url, 204);
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // 6b. /api/v1/control-plane/* — keep page from 502
  if (url.startsWith('/api/v1/control-plane/')) {
    await readBody(req);
    logLine(method, url, 200);
    jsonResponse(res, 200, {});
    return;
  }

  // 6c. /api/v1/auth/oidc/* — redirect/JSON so beginLogin doesn't blow up
  if (url.startsWith('/api/v1/auth/oidc/')) {
    logLine(method, url, 200);
    jsonResponse(res, 200, {});
    return;
  }

  // 6d. /api/v1/auth/email-verifications → challenge id so code form keeps going
  if (method === 'POST' && url.startsWith('/api/v1/auth/email-verifications')) {
    await readBody(req);
    logLine(method, url, 200);
    jsonResponse(res, 200, {
      challengeId: 'mock-challenge',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    return;
  }

  // 6e. /api/v1/users/me/profile PATCH → success
  if (method === 'PATCH' && url.startsWith('/api/v1/users/me/profile')) {
    await readBody(req);
    logLine(method, url, 200);
    jsonResponse(res, 200, { user: ADMIN_USER });
    return;
  }

  // 7. everything else → 404 JSON
  logLine(method, url, 404);
  notFound(req, res);
}

const server = createServer((req, res) => {
  void handle(req, res).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[stub server] unhandled error:', err);
    try {
      jsonResponse(res, 500, { error: String(err?.message ?? err) });
    } catch {
      res.end();
    }
  });
});

server.listen(PORT, HOST, () => {
  const banner = [
    `[${STARTED_AT}] workbench dev-stub listening on http://${HOST}:${PORT}`,
    '  - POST /api/v1/sessions/resume            -> resumable session',
    '  - GET  /api/v1/sessions/current           -> authenticated session',
    '  - POST /api/v1/auth/device-login/qr       -> mock QR',
    '  - GET  /api/v1/notifications/nav-badges   -> zero badges',
    '  - GET  /api/v1/observability/*            -> minimal empty payload',
    '  - GET  /api/v1/control-plane/*            -> {}',
    '  - other                                  -> 404 { error: "mock not implemented: ..." }',
  ];
  for (const line of banner) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[${new Date().toISOString()}] received ${signal}, closing dev-stub (${HOST}:${PORT})`);
  server.close(() => {
    process.exit(0);
  });
  // Force-exit if close hangs (no keep-alive sockets in mock)
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
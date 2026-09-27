#!/usr/bin/env node
/**
 * Desktop one-click local runtime (Codex-style sidecar supervisor).
 *
 * Ensures the local API plane is listening, then optionally stays alive as
 * the parent of processes it started so they die with the Mac app.
 *
 *   node ensure-local-runtime.mjs --wait
 *   node ensure-local-runtime.mjs --supervise
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { request as httpsRequest } from 'node:https'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(scriptDir, '..')
export const repoRoot = resolve(desktopRoot, '../..')
export const LOCAL_HTTPS_HOST = '127.0.0.1'
export const LOCAL_HTTPS_PORT = 8443
export const LOCAL_HTTPS_HOSTNAME = 'workbench.axiomaticworld.com'
export const LOCAL_HTTPS_ORIGIN = `https://${LOCAL_HTTPS_HOSTNAME}:${LOCAL_HTTPS_PORT}`
export const POSTGRES_PORT = 15432
export const REDIS_PORT = 16379

export const SERVICES = [
  {
    name: 'control-plane',
    port: 8092,
    health: 'http://127.0.0.1:8092/health',
    command: ['bash', 'services/control-plane/scripts/dev-run.sh'],
  },
  {
    name: 'identity-adapter',
    port: 8081,
    health: 'http://127.0.0.1:8081/health',
    command: ['bash', 'services/identity-adapter/scripts/dev-run.sh'],
  },
  {
    name: 'platform-core',
    port: 8082,
    health: 'http://127.0.0.1:8082/health',
    command: ['bash', 'services/platform-core/scripts/dev-run.sh'],
  },
  {
    name: 'api-gateway',
    port: 8088,
    health: 'http://127.0.0.1:8088/health',
    command: ['bash', 'services/api-gateway/scripts/dev-run.sh'],
  },
  {
    name: 'local-https',
    port: LOCAL_HTTPS_PORT,
    health: `${LOCAL_HTTPS_ORIGIN}/health`,
    command: [process.execPath, 'apps/workbench/scripts/serve-local-https.mjs'],
    https: true,
  },
]

export function parseArgs(argv) {
  const wait = argv.includes('--wait')
  return {
    wait,
    supervise: argv.includes('--supervise') || !wait,
    skipDocker: argv.includes('--skip-docker'),
  }
}

export function isWorkbenchRoot(root) {
  return (
    existsSync(resolve(root, 'services/api-gateway/scripts/dev-run.sh')) &&
    existsSync(resolve(root, 'services/control-plane/scripts/dev-run.sh'))
  )
}

function parseDotEnvValue(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed.replace(/\s+#.*$/u, '').trim()
}

/** Load only missing environment variables from the project-local .env. */
export function loadProjectEnv(root) {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return false
  const source = readFileSync(envPath, 'utf8')
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u)
    if (!match) continue
    const [, key, rawValue] = match
    if (!(key in process.env)) process.env[key] = parseDotEnvValue(rawValue)
  }
  return true
}

export function resolveLocalTlsConfig(root) {
  const certValue = process.env.WORKBENCH_TLS_CERT_FILE?.trim()
  const keyValue = process.env.WORKBENCH_TLS_KEY_FILE?.trim()
  if (!certValue || !keyValue) {
    throw new Error(
      '缺少 WORKBENCH_TLS_CERT_FILE / WORKBENCH_TLS_KEY_FILE；请在项目 .env 中配置 workbench 域名证书和私钥路径。',
    )
  }
  const certPath = resolve(root, certValue)
  const keyPath = resolve(root, keyValue)
  if (!existsSync(certPath)) throw new Error(`本机 HTTPS 证书不存在: ${certPath}`)
  if (!existsSync(keyPath)) throw new Error(`本机 HTTPS 私钥不存在: ${keyPath}`)

  const configuredHost = process.env.WORKBENCH_HTTPS_HOST?.trim() || LOCAL_HTTPS_HOST
  const configuredPort = Number(process.env.WORKBENCH_HTTPS_PORT || LOCAL_HTTPS_PORT)
  if (!['127.0.0.1', 'localhost', '::1'].includes(configuredHost)) {
    throw new Error(`WORKBENCH_HTTPS_HOST 必须是本机地址，当前为 ${configuredHost}`)
  }
  if (configuredPort !== LOCAL_HTTPS_PORT) {
    throw new Error(`WORKBENCH_HTTPS_PORT 必须为 ${LOCAL_HTTPS_PORT}，当前为 ${configuredPort}`)
  }

  process.env.WORKBENCH_TLS_CERT_FILE = certPath
  process.env.WORKBENCH_TLS_KEY_FILE = keyPath
  process.env.WORKBENCH_HTTPS_HOST = LOCAL_HTTPS_HOST
  process.env.WORKBENCH_HTTPS_PORT = String(LOCAL_HTTPS_PORT)
  process.env.WORKBENCH_LOCAL_GATEWAY_ORIGIN = 'http://127.0.0.1:8088'
  process.env.WORKBENCH_LOCAL_CONTROL_PLANE_ORIGIN = 'http://127.0.0.1:8092'
  return { certPath, keyPath }
}

function probePort(port, timeoutMs = 400) {
  return new Promise((resolveProbe) => {
    const socket = createConnection({ host: '127.0.0.1', port }, () => {
      socket.end()
      resolveProbe(true)
    })
    socket.setTimeout(timeoutMs, () => {
      socket.destroy()
      resolveProbe(false)
    })
    socket.once('error', () => {
      socket.destroy()
      resolveProbe(false)
    })
  })
}

export async function probeHealth(url, timeoutMs = 800) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function probeHttpsHealth(url, timeoutMs = 800) {
  const target = new URL(url)
  return new Promise((resolveProbe) => {
    const request = httpsRequest({
      hostname: LOCAL_HTTPS_HOST,
      port: Number(target.port || LOCAL_HTTPS_PORT),
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      servername: target.hostname,
      headers: { host: target.host },
      rejectUnauthorized: true,
      timeout: timeoutMs,
    }, (response) => {
      response.resume()
      resolveProbe(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300))
    })
    request.once('error', () => resolveProbe(false))
    request.once('timeout', () => {
      request.destroy()
      resolveProbe(false)
    })
    request.end()
  })
}

async function waitUntil(label, check, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await check()) return Date.now() - started
    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  }
  throw new Error(`[desktop-runtime] timed out waiting for ${label} after ${timeoutMs}ms`)
}

function spawnOwned(command, args, cwd, children) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })
  children.push(child)
  child.on('error', (error) => {
    console.error(`[desktop-runtime] failed to spawn ${command}:`, error)
  })
  return child
}

async function ensureDocker(root) {
  if (!existsSync(resolve(root, 'docker-compose.yml'))) return
  const composeUp = await probePort(POSTGRES_PORT)
  const redisUp = await probePort(REDIS_PORT)
  if (composeUp && redisUp) {
    console.log('[desktop-runtime] docker infra already listening')
    return
  }
  console.log('[desktop-runtime] starting docker compose postgres/redis')
  const result = spawnSync('docker', ['compose', 'up', '-d', 'postgres', 'redis'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`docker compose up exited ${result.status ?? 'unknown'}`)
  }
  await waitUntil(`postgres :${POSTGRES_PORT}`, () => probePort(POSTGRES_PORT), 45_000)
  await waitUntil(`redis :${REDIS_PORT}`, () => probePort(REDIS_PORT), 20_000)
}

function probeService(service) {
  return service.https ? probeHttpsHealth(service.health) : probeHealth(service.health)
}

function terminateChildren(children) {
  for (const child of children) {
    if (!child.killed) {
      try {
        if (process.platform !== 'win32' && child.pid) {
          process.kill(-child.pid, 'SIGTERM')
        }
        child.kill('SIGTERM')
      } catch {
        // already reaped
      }
    }
  }
}

export async function ensureServices(root, options = {}) {
  if (!isWorkbenchRoot(root)) {
    throw new Error(`[desktop-runtime] not an axi-workbench root: ${root}`)
  }
  loadProjectEnv(root)
  resolveLocalTlsConfig(root)
  const children = []
  const started = []
  if (!options.skipDocker) {
    await ensureDocker(root)
  }

  try {
    for (const service of SERVICES) {
      if (await probeService(service)) {
        console.log(`[desktop-runtime] ${service.name} already healthy`)
        continue
      }
      console.log(`[desktop-runtime] starting ${service.name}`)
      spawnOwned(service.command[0], service.command.slice(1), root, children)
      started.push(service.name)
      await waitUntil(service.name, () => probeService(service), options.timeoutMs ?? 45_000)
      console.log(`[desktop-runtime] ${service.name} ready`)
    }
  } catch (error) {
    terminateChildren(children)
    throw error
  }

  return { children, started }
}

function shutdown(children, code = 0) {
  terminateChildren(children)
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        try {
          if (process.platform !== 'win32' && child.pid) {
            process.kill(-child.pid, 'SIGKILL')
          }
          child.kill('SIGKILL')
        } catch {
          // already reaped
        }
      }
    }
    process.exit(code)
  }, 500)
}

function startDependencyMonitor(children) {
  let checking = false
  const monitor = setInterval(async () => {
    if (checking) return
    checking = true
    try {
      const postgresUp = await probePort(POSTGRES_PORT)
      const redisUp = await probePort(REDIS_PORT)
      if (!postgresUp || !redisUp) {
        console.error(
          `[desktop-runtime] docker dependency lost (postgres=${postgresUp}, redis=${redisUp}); stopping app-owned services`,
        )
        clearInterval(monitor)
        shutdown(children, 1)
      }
    } finally {
      checking = false
    }
  }, 5_000)
  monitor.unref()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const root = process.env.AXI_WORKBENCH_ROOT || repoRoot
  const { children } = await ensureServices(root, options)
  if (!options.supervise || children.length === 0) {
    return
  }
  process.on('SIGINT', () => shutdown(children, 130))
  process.on('SIGTERM', () => shutdown(children, 143))
  startDependencyMonitor(children)
  if (process.platform !== 'win32' && process.env.AXI_DESKTOP_SUPERVISOR === '1') {
    const parentPid = process.ppid
    const parentWatch = setInterval(() => {
      if (parentPid > 1 && process.ppid === 1) {
        clearInterval(parentWatch)
        shutdown(children, 0)
      }
    }, 500)
    parentWatch.unref()
  }
  await new Promise(() => {})
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (invokedDirectly) {
  main().catch((error) => {
    console.error('[desktop-runtime] fatal:', error.message ?? error)
    process.exit(1)
  })
}

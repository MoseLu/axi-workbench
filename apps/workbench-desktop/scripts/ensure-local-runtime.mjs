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
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const desktopRoot = resolve(scriptDir, '..')
export const repoRoot = resolve(desktopRoot, '../..')

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
  })
  children.push(child)
  child.on('error', (error) => {
    console.error(`[desktop-runtime] failed to spawn ${command}:`, error)
  })
  return child
}

async function ensureDocker(root) {
  if (!existsSync(resolve(root, 'docker-compose.yml'))) return
  const composeUp = await probePort(5432)
  const redisUp = await probePort(6379)
  if (composeUp && redisUp) {
    console.log('[desktop-runtime] docker infra already listening')
    return
  }
  console.log('[desktop-runtime] starting docker compose infra')
  const result = spawnSync('docker', ['compose', 'up', '-d'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`docker compose up exited ${result.status ?? 'unknown'}`)
  }
  await waitUntil('postgres :5432', () => probePort(5432), 45_000)
  await waitUntil('redis :6379', () => probePort(6379), 20_000)
}

export async function ensureServices(root, options = {}) {
  if (!isWorkbenchRoot(root)) {
    throw new Error(`[desktop-runtime] not an axi-workbench root: ${root}`)
  }
  const children = []
  const started = []
  if (!options.skipDocker) {
    try {
      await ensureDocker(root)
    } catch (error) {
      console.error(
        '[desktop-runtime] docker infra unavailable; continuing with process start.',
        error.message ?? error,
      )
    }
  }

  for (const service of SERVICES) {
    if (await probeHealth(service.health)) {
      console.log(`[desktop-runtime] ${service.name} already healthy`)
      continue
    }
    console.log(`[desktop-runtime] starting ${service.name}`)
    spawnOwned(service.command[0], service.command.slice(1), root, children)
    started.push(service.name)
    await waitUntil(service.name, () => probeHealth(service.health), options.timeoutMs ?? 45_000)
    console.log(`[desktop-runtime] ${service.name} ready`)
  }

  return { children, started }
}

function shutdown(children, code = 0) {
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill('SIGTERM')
      } catch {
        // already reaped
      }
    }
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        try {
          child.kill('SIGKILL')
        } catch {
          // already reaped
        }
      }
    }
    process.exit(code)
  }, 500)
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

#!/usr/bin/env node
/**
 * dev-desktop.mjs
 *
 * 一次性拉起 Axi Workbench 的双端 dev：
 *   - 终端 1（Web）：`pnpm dev:workbench`  -> vite 监听 127.0.0.1:5183
 *   - 终端 2（Tauri）：`pnpm --filter @axi/workbench-desktop dev:split`
 *
 * 设计原则：
 *   - 只用 Node 内置模块（child_process / net），不引入新依赖。
 *   - Web dev 通过探测端口就绪后才拉 Tauri，避免 Tauri WebView 抢先访问 5183 失败。
 *   - 子进程共享 stdio，父进程退出时所有子进程一并 SIGTERM，shell 上 Ctrl+C 行为符合直觉。
 *   - `--print-only` 模式仅打印两条命令，不实际拉起进程，方便人工双终端场景对照。
 */

import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const projectRoot = resolve(packageRoot, '../..')
const args = process.argv.slice(2)

const WEB_URL = 'http://127.0.0.1:5183'
const WEB_HOST = '127.0.0.1'
const WEB_PORT = 5183
const READY_TIMEOUT_MS = 30_000
const PROBE_INTERVAL_MS = 250

const printOnly = args.includes('--print-only')

const WEB_CMD = ['pnpm', ['dev:workbench']]
const TAURI_CMD = ['pnpm', ['--filter', '@axi/workbench-desktop', 'dev:split']]

function fmtCommand([command, commandArgs]) {
  return [command, ...commandArgs].join(' ')
}

if (printOnly) {
  console.log('[dev-desktop] manual two-terminal commands:')
  console.log(`  terminal A: ${fmtCommand(WEB_CMD)}`)
  console.log(`  terminal B: ${fmtCommand(TAURI_CMD)}`)
  process.exit(0)
}

function probePort(host, port) {
  return new Promise((resolveProbe) => {
    const socket = createConnection({ host, port }, () => {
      socket.end()
      resolveProbe(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolveProbe(false)
    })
    socket.setTimeout(500, () => {
      socket.destroy()
      resolveProbe(false)
    })
  })
}

async function waitForWeb(timeoutMs) {
  const startedAt = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ok = await probePort(WEB_HOST, WEB_PORT)
    if (ok) return Date.now() - startedAt
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `[dev-desktop] timed out after ${timeoutMs}ms waiting for ${WEB_URL}. ` +
          'Make sure `pnpm dev:workbench` boots vite without errors and nothing else is occupying 5183.',
      )
    }
    await new Promise((r) => setTimeout(r, PROBE_INTERVAL_MS))
  }
}

const children = []
let shuttingDown = false

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill('SIGTERM')
      } catch {
        // ignore: process may have been reaped already
      }
    }
  }
  // 给子进程 500ms 自杀时间，结束不掉就再砍一次。
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        try {
          child.kill('SIGKILL')
        } catch {
          // ignore
        }
      }
    }
    process.exit(exitCode)
  }, 500)
}

process.on('SIGINT', () => shutdown(130))
process.on('SIGTERM', () => shutdown(143))

function spawnStep(label, [command, commandArgs], cwd) {
  const child = spawn(command, commandArgs, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })
  children.push(child)

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    const reason = signal ? `signal ${signal}` : `status ${code ?? 'unknown'}`
    console.error(`[dev-desktop] ${label} exited (${reason}); tearing down`)
    shutdown(code ?? 0)
  })

  child.on('error', (error_) => {
    console.error(`[dev-desktop] ${label} failed to start:`, error_)
    shutdown(1)
  })

  return child
}

async function main() {
  console.log(`[dev-desktop] starting web dev: ${fmtCommand(WEB_CMD)}`)
  console.log(`[dev-desktop] web dev URL: ${WEB_URL}`)
  spawnStep('web', WEB_CMD, projectRoot)

  const waited = await waitForWeb(READY_TIMEOUT_MS)
  console.log(`[dev-desktop] web dev ready after ${waited}ms; starting tauri: ${fmtCommand(TAURI_CMD)}`)

  spawnStep('tauri', TAURI_CMD, packageRoot)
}

main().catch((error) => {
  console.error('[dev-desktop] fatal:', error.message ?? error)
  shutdown(1)
})
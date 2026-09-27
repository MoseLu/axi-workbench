#!/usr/bin/env node
/**
 * Local desktop restart flow.
 *
 * Rebuilds the local bundle, replaces the installed application, and starts
 * it again. This gives the developer machine the same "restart to upgrade"
 * experience as a packaged updater without pretending that a local source
 * tree is a distributable update server.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const bundlePath = resolve(packageRoot, 'src-tauri/target/release/bundle/macos/Axi 工作台.app')
const installedPath = '/Applications/Axi 工作台.app'
const appExecutable = `${installedPath}/Contents/MacOS/workbench-desktop`

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: packageRoot, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('[desktop-restart] building the current local SemVer package')
run('pnpm', ['build:local'])

if (!existsSync(bundlePath)) {
  throw new Error(`[desktop-restart] built bundle missing: ${bundlePath}`)
}

const running = spawnSync('pgrep', ['-f', appExecutable], { encoding: 'utf8' })
if (running.status === 0) {
  for (const pid of running.stdout.trim().split(/\s+/).filter(Boolean)) {
    run('kill', [pid])
  }
}

run('ditto', ['--rsrc', '--extattr', bundlePath, installedPath])

// 把本机构建标识写入已安装的 .app/Contents/Resources/，让运行时无需依赖编译时 env 即可识别
// local-project 模式（参见 src-tauri/src/runtime.rs::local_project_mode）。
const installedBuildProfile = `${installedPath}/Contents/Resources/.build-profile`
run('cp', ['-f', resolve(packageRoot, 'src-tauri/.build-profile'), installedBuildProfile])

run('codesign', ['--verify', '--deep', '--strict', installedPath])
run('open', [installedPath])
console.log('[desktop-restart] installed and restarted Axi 工作台')

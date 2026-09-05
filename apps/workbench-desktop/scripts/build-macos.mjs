import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const bundleRoot = resolve(packageRoot, 'src-tauri/target/release/bundle')
const appBundleName = 'Axi 工作台.app'
const dmgPrefix = 'Axi 工作台_'
const appPath = resolve(packageRoot, `src-tauri/target/release/bundle/macos/${appBundleName}`)
const args = process.argv.slice(2)
const isCi = process.env.CI === 'true' || process.env.CI === '1'
const configuredIdentity = process.env.APPLE_SIGNING_IDENTITY?.trim()
const signingIdentity = configuredIdentity || (isCi ? '' : '-')

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
  }
}

if (!signingIdentity) {
  console.error(
    '[macos-build] CI requires APPLE_SIGNING_IDENTITY or an imported Developer ID certificate',
  )
  process.exit(1)
}

run(process.execPath, ['scripts/generate-source-icon.mjs'])
run('pnpm', ['exec', 'tauri', 'icon', 'src-tauri/icons/icon.svg', '--output', 'src-tauri/icons'])

const configOverlay = JSON.stringify({
  bundle: {
    macOS: {
      signingIdentity,
    },
  },
})

function withBundleTarget(target) {
  const buildArgs = [...args]
  const bundleArgIndex = buildArgs.indexOf('--bundles')
  const inlineBundleArgIndex = buildArgs.findIndex((arg) => arg.startsWith('--bundles='))

  if (bundleArgIndex >= 0) {
    buildArgs.splice(bundleArgIndex, 2, '--bundles', target)
  } else if (inlineBundleArgIndex >= 0) {
    buildArgs.splice(inlineBundleArgIndex, 1, `--bundles=${target}`)
  } else {
    buildArgs.push('--bundles', target)
  }

  return buildArgs
}

const requestedBundles = (() => {
  const bundleArgIndex = args.indexOf('--bundles')
  if (bundleArgIndex >= 0) return args[bundleArgIndex + 1] ?? ''
  const inlineBundleArg = args.find((arg) => arg.startsWith('--bundles='))
  return inlineBundleArg?.slice('--bundles='.length) ?? ''
})()
const wantsDmg = requestedBundles.split(',').includes('dmg')

function tauriBuild(target) {
  run('pnpm', ['exec', 'tauri', 'build', ...withBundleTarget(target), '--config', configOverlay])
}

function findDmg() {
  const dmgDir = join(bundleRoot, 'dmg')
  const candidates = readdirSync(dmgDir)
    .filter((name) => name.startsWith(dmgPrefix) && name.endsWith('.dmg'))
    .map((name) => join(dmgDir, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)

  const dmgPath = candidates[0]
  if (!dmgPath) throw new Error(`[macos-build] missing DMG in ${dmgDir}`)
  return dmgPath
}

function verifyApp(bundlePath) {
  if (!existsSync(bundlePath)) {
    throw new Error(`[macos-build] missing bundle: ${bundlePath}`)
  }
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', bundlePath])
}

function signDmg(dmgPath) {
  const signArgs = ['--force']
  if (signingIdentity !== '-') signArgs.push('--timestamp')
  signArgs.push('--sign', signingIdentity, dmgPath)
  run('codesign', signArgs)
  run('codesign', ['--verify', '--verbose=2', dmgPath])
}

function verifyDmg(dmgPath) {
  console.log(`[macos-build] verifying embedded app in ${dmgPath}`)
  const attach = spawnSync('hdiutil', ['attach', '-nobrowse', '-readonly', dmgPath], {
    cwd: packageRoot,
    env: process.env,
    encoding: 'utf8',
  })

  if (attach.error) throw attach.error
  if (attach.status !== 0) {
    throw new Error(`${attach.stdout}\n${attach.stderr}`.trim())
  }

  const mountPath = `${attach.stdout}\n${attach.stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.includes('/Volumes/'))
    ?.split(/\s+/)
    .at(-1)

  if (!mountPath) {
    throw new Error(`[macos-build] unable to locate mounted volume for ${dmgPath}`)
  }

  try {
    verifyApp(join(mountPath, appBundleName))
  } finally {
    const detach = spawnSync('hdiutil', ['detach', mountPath], {
      cwd: packageRoot,
      env: process.env,
      encoding: 'utf8',
    })
    if (detach.status !== 0) {
      console.warn(`[macos-build] warning: failed to detach ${mountPath}: ${detach.stderr}`)
    }
  }
}

const stagingRoot = wantsDmg ? mkdtempSync(join(tmpdir(), 'axi-workbench-app-')) : null
const stagedAppPath = stagingRoot ? join(stagingRoot, appBundleName) : null

try {
  if (wantsDmg) {
    // Tauri 清理 DMG 打包后的 macos/Axi 工作台.app，先保留已验签版本。
    tauriBuild('app')
    verifyApp(appPath)
    cpSync(appPath, stagedAppPath, { recursive: true })

    tauriBuild('dmg')
    const dmgPath = findDmg()
    signDmg(dmgPath)
    verifyDmg(dmgPath)

    rmSync(appPath, { recursive: true, force: true })
    cpSync(stagedAppPath, appPath, { recursive: true })
  } else {
    tauriBuild('app')
  }

  verifyApp(appPath)
} finally {
  if (stagingRoot) rmSync(stagingRoot, { recursive: true, force: true })
}

console.log(
  `[macos-build] signed bundle verified (${signingIdentity === '-' ? 'ad hoc' : signingIdentity})`,
)

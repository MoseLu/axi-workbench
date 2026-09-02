// workbench-desktop 契约校验：
//  1. apps/workbench 的 Vite 构建产物必须存在；
//  2. 落地为 workbench-dist/ 软链接或拷贝，供 Tauri frontendDist 使用；
//  3. src-tauri/icons/icon.icns 必须存在。

import { existsSync, mkdirSync, cpSync, rmSync, statSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopDir = join(__dirname, '..')
const repoRoot = join(desktopDir, '..', '..')

const workbenchDist = join(repoRoot, 'apps', 'workbench', 'dist')
const targetDir = join(desktopDir, 'workbench-dist')
const iconIcns = join(desktopDir, 'src-tauri', 'icons', 'icon.icns')
const webIcon = join(repoRoot, 'apps', 'workbench', 'public', 'favicon.svg')

let failed = false

if (!existsSync(workbenchDist)) {
  console.error(
    `[verify-desktop-contracts] FAIL: ${workbenchDist} 不存在。请先跑 \`pnpm --filter @axi/workbench build\`。`,
  )
  failed = true
} else {
  console.log(`[verify-desktop-contracts] OK: web dist 存在 (${statSync(workbenchDist).size} bytes)`)
}

if (existsSync(targetDir)) {
  rmSync(targetDir, { recursive: true, force: true })
}
mkdirSync(targetDir, { recursive: true })
cpSync(workbenchDist, targetDir, { recursive: true })
console.log(`[verify-desktop-contracts] OK: 已镜像 web dist -> workbench-dist/`)

if (!existsSync(iconIcns)) {
  console.error(`[verify-desktop-contracts] FAIL: ${iconIcns} 不存在`)
  failed = true
} else {
  console.log(`[verify-desktop-contracts] OK: icon.icns 已就位`)
}

const favicon = existsSync(webIcon) ? readFileSync(webIcon, 'utf8') : ''
const angularPetals = [
  'M16 16 8.25 8.25 11.75 3.5 16 2 20.25 3.5 23.75 8.25z',
  'M16 16 23.75 8.25 28.5 11.75 30 16 28.5 20.25 23.75 23.75z',
  'M16 16 23.75 23.75 20.25 28.5 16 30 11.75 28.5 8.25 23.75z',
  'M16 16 8.25 23.75 3.5 20.25 2 16 3.5 11.75 8.25 8.25z',
]
if (!existsSync(webIcon) || angularPetals.some((path) => !favicon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不是中心对称的四色角切花瓣: ${webIcon}`)
  failed = true
} else if (/ d="[^\"]*[CcQqSsAa]/.test(favicon)) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不得包含圆弧路径命令: ${webIcon}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: Web favicon 为中心对称的直线角切花瓣')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

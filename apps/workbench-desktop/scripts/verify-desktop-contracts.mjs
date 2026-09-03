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
const desktopIconSource = join(desktopDir, 'src-tauri', 'icons', 'icon.svg')
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
const layeredPetals = [
  'M16 13.35 13.35 12.1 10.85 8.15 11.6 4.25 14.05 1.55 16 0.85 17.95 1.55 20.4 4.25 21.15 8.15 18.65 12.1z',
  'M16 11.85 14.55 11.15 12.45 7.8 13 5.1 14.65 3.15 16 2.65 17.35 3.15 19 5.1 19.55 7.8 17.45 11.15z',
  'transform="rotate(90 16 16)"',
  'transform="rotate(180 16 16)"',
  'transform="rotate(270 16 16)"',
  '<circle cx="16" cy="16" r="3.6"',
]
if (!existsSync(webIcon) || layeredPetals.some((path) => !favicon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不是中心对称的四色层叠花瓣: ${webIcon}`)
  failed = true
} else if (/ d="[^\"]*[CcQqSsAa]/.test(favicon)) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不得包含圆弧路径命令: ${webIcon}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: Web favicon 为中心对称的直线层叠花瓣')
}

const desktopIcon = existsSync(desktopIconSource) ? readFileSync(desktopIconSource, 'utf8') : ''
if (!existsSync(desktopIconSource)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不存在: ${desktopIconSource}`)
  failed = true
} else if (/ d="[^\"]*[CcQqSsAa]/.test(desktopIcon)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不得包含圆弧路径命令: ${desktopIconSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 桌面图标母版使用直线几何')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

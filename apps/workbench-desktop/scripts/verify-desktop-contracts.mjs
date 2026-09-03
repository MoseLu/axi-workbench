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
const roundedPetals = [
  '#0167FF',
  '#FF0167',
  '#E6FF01',
  '#67FF01',
  '#00E5FF',
  '#9901FF',
  'M16 0.18 C13.55 1.35 11 3.1 10.65 5.3 C10.65 6.7 11.25 7.75 11.85 8.8 L16 16 L20.15 8.8 C20.75 7.75 21.35 6.7 21.35 5.3 C21 3.1 18.45 1.35 16 0.18 Z',
  'M16 2.05 C14.4 3 13.1 4.6 13 6.3 C12.9 8 14 10 15.3 12.4 C15.55 12.9 15.8 13.45 16 13.95 C16.2 13.45 16.45 12.9 16.7 12.4 C18 10 19.1 8 19 6.3 C18.9 4.6 17.6 3 16 2.05 Z',
  'stroke="#000000"',
  'fill="none" stroke="#000000" stroke-opacity="0.72"',
  'stroke-opacity="0.9"',
  'stroke-width="0.24"',
  'transform="rotate(60 16 16)"',
  'transform="rotate(120 16 16)"',
  'transform="rotate(180 16 16)"',
  'transform="rotate(240 16 16)"',
  'transform="rotate(300 16 16)"',
  '<circle cx="16" cy="16" r="2.48"',
]
if (!existsSync(webIcon) || roundedPetals.some((path) => !favicon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不是中心对称的六色圆润花瓣: ${webIcon}`)
  failed = true
} else if (/<(?:rect|radialGradient)\b|axi-icon-bg/.test(favicon)) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不得包含不透明背景底板: ${webIcon}`)
  failed = true
} else if (/fill="#FFFFFF" fill-opacity="0.2"|stroke="#FFFFFF" stroke-opacity="0.42"/.test(favicon)) {
  console.error('[verify-desktop-contracts] FAIL: 花瓣双层边缘必须使用黑色线条，不得保留白色内层或外描边')
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: Web favicon 为中心对称的六色圆润花瓣')
}

const desktopIcon = existsSync(desktopIconSource) ? readFileSync(desktopIconSource, 'utf8') : ''
const desktopIconTreatment = ['scale(31)', 'fill="none"']
if (!existsSync(desktopIconSource)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不存在: ${desktopIconSource}`)
  failed = true
} else if (
  [...roundedPetals, ...desktopIconTreatment].some((path) => !desktopIcon.includes(path)) ||
  /<(?:rect|radialGradient)\b|axi-icon-bg/.test(desktopIcon)
) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版未同步透明立体花瓣几何: ${desktopIconSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 桌面图标母版使用透明立体花瓣几何')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

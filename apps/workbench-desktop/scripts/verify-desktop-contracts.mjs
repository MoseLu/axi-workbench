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
  '#7FB5FF',
  '#FF929D',
  '#FFE07A',
  '#79E6A4',
  '#70E0EE',
  '#C39AFF',
  'M16 16 L9.95 5.55 C10.75 2.65 13.03 0.6 16 0.42 C18.97 0.6 21.25 2.65 22.05 5.55 Z',
  'M16 14.85 L12.55 7.2 C13.1 4.8 14.35 2.75 16 1.85 C17.65 2.75 18.9 4.8 19.45 7.2 Z',
  'stroke="#21364F"',
  'stroke="#274968"',
  'stroke-opacity="0.9"',
  'stroke-width="0.26"',
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

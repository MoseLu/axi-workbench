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
  '#72A7FF',
  '#FF7B84',
  '#FFD166',
  '#67D891',
  '#5FD9E8',
  '#B88CFF',
  'M16 0.35 C14 1.25 12 3.15 11.45 5.65 C10.75 8.75 12.55 11.85 15.1 13.5',
  'M16 2.5 C14.7 3.25 13.55 4.65 13.1 6.45 C12.6 8.55 13.9 10.95 15.35 12.55',
  'transform="rotate(60 16 16)"',
  'transform="rotate(120 16 16)"',
  'transform="rotate(180 16 16)"',
  'transform="rotate(240 16 16)"',
  'transform="rotate(300 16 16)"',
  '<circle cx="16" cy="16" r="2.6"',
]
if (!existsSync(webIcon) || roundedPetals.some((path) => !favicon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不是中心对称的六色圆润花瓣: ${webIcon}`)
  failed = true
} else if (/ d="[^\"]*[Aa]/.test(favicon)) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 必须使用规范的贝塞尔圆润轮廓: ${webIcon}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: Web favicon 为中心对称的六色圆润花瓣')
}

const desktopIcon = existsSync(desktopIconSource) ? readFileSync(desktopIconSource, 'utf8') : ''
const desktopIconTreatment = ['scale(30)']
if (!existsSync(desktopIconSource)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不存在: ${desktopIconSource}`)
  failed = true
} else if ([...roundedPetals, ...desktopIconTreatment].some((path) => !desktopIcon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版未同步圆润花瓣几何: ${desktopIconSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 桌面图标母版使用圆润贝塞尔几何')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

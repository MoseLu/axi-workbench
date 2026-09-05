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
const tauriConfig = join(desktopDir, 'src-tauri', 'tauri.conf.json')
const macosInfoPlist = join(desktopDir, 'src-tauri', 'Info.plist')
const tauriCapabilities = join(desktopDir, 'src-tauri', 'capabilities', 'default.json')
const loginPageSource = join(repoRoot, 'apps', 'workbench', 'src', 'pages', 'Login.tsx')
const loginStylesSource = join(repoRoot, 'apps', 'workbench', 'src', 'pages', 'Login.css')
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

const config = existsSync(tauriConfig) ? JSON.parse(readFileSync(tauriConfig, 'utf8')) : null
const loginWindow = config?.app?.windows?.find((window) => window.label === 'login')
const mainWindow = config?.app?.windows?.find((window) => window.label === 'main')
if (
  loginWindow?.title !== 'Axi 工作台 — 登录' ||
  loginWindow?.width !== 800 ||
  loginWindow?.height !== 365 ||
  loginWindow?.minWidth !== 800 ||
  loginWindow?.minHeight !== 365 ||
  loginWindow?.resizable !== false ||
  loginWindow?.maximizable !== false ||
  loginWindow?.titleBarStyle !== 'Overlay' ||
  loginWindow?.hiddenTitle !== true ||
  JSON.stringify(loginWindow?.trafficLightPosition) !== JSON.stringify({ x: 13, y: 26 }) ||
  loginWindow?.theme !== 'Light' ||
  loginWindow?.backgroundColor?.toLowerCase() !== '#ffffff'
) {
  console.error(`[verify-desktop-contracts] FAIL: 登录窗口必须是 800x365 的 Web 对齐紧凑画布: ${tauriConfig}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 登录窗口使用固定 800x365 Overlay 浅色紧凑画布')
}
if (
  mainWindow?.title !== 'Axi 工作台' ||
  mainWindow?.resizable !== true ||
  mainWindow?.maximizable !== true ||
  mainWindow?.minimizable !== true ||
  mainWindow?.closable !== true
) {
  console.error(`[verify-desktop-contracts] FAIL: 主应用窗口必须保留可放缩和绿色缩放能力: ${tauriConfig}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 主应用窗口保留可放缩和绿色缩放能力')
}

const plist = existsSync(macosInfoPlist) ? readFileSync(macosInfoPlist, 'utf8') : ''
if (
  config?.bundle?.macOS?.infoPlist !== 'Info.plist' ||
  !existsSync(macosInfoPlist) ||
  !plist.includes('<key>CFBundleDevelopmentRegion</key>') ||
  !plist.includes('<string>zh-Hans</string>') ||
  !plist.includes('<key>CFBundleLocalizations</key>') ||
  !/<key>CFBundleDisplayName<\/key>\s*<string>Axi 工作台<\/string>/.test(plist) ||
  !/<key>CFBundleName<\/key>\s*<string>Axi 工作台<\/string>/.test(plist)
) {
  console.error(`[verify-desktop-contracts] FAIL: macOS 应用包必须声明中文 AppKit 本地化: ${macosInfoPlist}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: macOS 应用包声明 zh-Hans 本地化')
}

const loginPage = existsSync(loginPageSource) ? readFileSync(loginPageSource, 'utf8') : ''
const loginStyles = existsSync(loginStylesSource) ? readFileSync(loginStylesSource, 'utf8') : ''
const capabilities = existsSync(tauriCapabilities) ? JSON.parse(readFileSync(tauriCapabilities, 'utf8')) : null
if (!Array.isArray(capabilities?.windows) || !capabilities.windows.includes('login')) {
  console.error(`[verify-desktop-contracts] FAIL: login 窗口未被授予标题栏拖拽权限: ${tauriCapabilities}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: login 窗口位于拖拽权限范围')
}
if (
  !loginPage.includes('data-tauri-drag-region') ||
  !loginStyles.includes('.axi-login-drag-region') ||
  !loginStyles.includes('cursor: default') ||
  /cursor:\s*(?:grab|grabbing)\b/.test(loginStyles)
) {
  console.error(`[verify-desktop-contracts] FAIL: 登录窗口缺少可用的 macOS 拖拽区域: ${loginPageSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 登录窗口提供 Overlay 标题栏拖拽区域')
}

const favicon = existsSync(webIcon) ? readFileSync(webIcon, 'utf8') : ''
const requiredIconGeometry = [
  '#0167FF',
  '#FF0167',
  '#E6FF01',
  '#67FF01',
  '#00E5FF',
  '#9901FF',
  '#D14DFF',
  '#FF9A3D',
  '#C8FF3D',
  '#3DFFB0',
  '#3D9BFF',
  '#8E4DFF',
  '#000000',
  'M16 0.18 C13.55 1.35 11 3.1 10.65 5.3 C10.65 6.7 11.25 7.75 11.85 8.8 L14.976 14.223 A2.05 2.05 0 0 1 17.024 14.223 L20.15 8.8 C20.75 7.75 21.35 6.7 21.35 5.3 C21 3.1 18.45 1.35 16 0.18 Z',
  'M16 2.05 C14.4 3 13.1 4.6 13 6.3 C12.9 8 14 10 15.3 12.4 C15.55 12.9 15.8 13.45 16 13.95 C16.2 13.45 16.45 12.9 16.7 12.4 C18 10 19.1 8 19 6.3 C18.9 4.6 17.6 3 16 2.05 Z',
  'stroke="#000000"',
  'stroke-width="0.28"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
  'transform="rotate(60 16 16)"',
  'transform="rotate(120 16 16)"',
  'transform="rotate(180 16 16)"',
  'transform="rotate(240 16 16)"',
  'transform="rotate(300 16 16)"',
  'data-center="swirl"',
  'data-center-piece="violet-blue"',
  'data-center-piece="red-yellow"',
  'data-center-piece="yellow-green"',
  'data-center-piece="green-cyan"',
  'data-center-piece="cyan-violet"',
  'data-center-piece="blue-red"',
  'M16 16 C16.805 15.635 16.805 14.196 16 14.05 A1.95 1.95 0 0 1 17.689 15.025 C17.964 15.795 16.719 16.514 16 16 Z',
]
if (!existsSync(webIcon) || requiredIconGeometry.some((path) => !favicon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不是中心对称的十二色弧形花心: ${webIcon}`)
  failed = true
} else if (/<(?:rect|radialGradient)\b|axi-icon-bg/.test(favicon)) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不得包含不透明背景底板: ${webIcon}`)
  failed = true
} else if (/fill="#FFFFFF" fill-opacity="0.2"|stroke="#FFFFFF" stroke-opacity="0.42"|stroke-opacity=/.test(favicon)) {
  console.error('[verify-desktop-contracts] FAIL: 花瓣双层边缘必须使用干净黑色线条，不得保留白色或透明重影描边')
  failed = true
} else if ((favicon.match(/<path\b/g) ?? []).length !== 18 || /transform="[^"']*translate/.test(favicon) || /<circle\b|M16 15\.05 L16\.82/.test(favicon)) {
  console.error('[verify-desktop-contracts] FAIL: 六瓣花心必须由六个连续弧形花心瓣组成，且花瓣根部不得被中心覆盖')
  failed = true
} else {
  const fills = [...favicon.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(([, color]) => color)
  const outerFills = fills.slice(0, 6)
  const centerFills = fills.slice(6, 12)
  if (new Set([...outerFills, ...centerFills]).size !== 12 || centerFills.some((color) => outerFills.includes(color))) {
    console.error('[verify-desktop-contracts] FAIL: 花瓣与花心必须使用互不重复的十二种颜色')
    failed = true
  } else {
    console.log('[verify-desktop-contracts] OK: Web favicon 为中心对称的十二色弧形花瓣')
  }
}

const desktopIcon = existsSync(desktopIconSource) ? readFileSync(desktopIconSource, 'utf8') : ''
const desktopIconTreatment = ['scale(31)', 'fill="none"']
if (!existsSync(desktopIconSource)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不存在: ${desktopIconSource}`)
  failed = true
} else if (
  [...requiredIconGeometry, ...desktopIconTreatment].some((path) => !desktopIcon.includes(path)) ||
  /<(?:rect|radialGradient|circle)\b|axi-icon-bg/.test(desktopIcon)
) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版未同步透明双线花瓣几何: ${desktopIconSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 桌面图标母版使用透明双线花瓣几何')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

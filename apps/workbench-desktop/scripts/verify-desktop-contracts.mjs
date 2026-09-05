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

// Favicon 几何契约单源:apps/workbench-shared/src/brand/favicon-geometry.json。
// 改了 favicon SVG 必须同步这个 JSON,否则 desktop + mobile 双端 verify 会 fail。
const faviconGeometryPath = join(
  repoRoot,
  'apps',
  'workbench-shared',
  'src',
  'brand',
  'favicon-geometry.json',
)
const faviconGeometry = existsSync(faviconGeometryPath)
  ? JSON.parse(readFileSync(faviconGeometryPath, 'utf8'))
  : null

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
// 几何契约来自 apps/workbench-shared/src/brand/favicon-geometry.json,与 mobile 端共用同源。
const requiredIconGeometry = faviconGeometry
  ? [
      ...faviconGeometry.fills,
      faviconGeometry.pathAnchors.outerPetal,
      faviconGeometry.pathAnchors.petalVein,
      `stroke="${faviconGeometry.stroke}"`,
      `stroke-width="${faviconGeometry.strokeWidth}"`,
      `stroke-linecap="${faviconGeometry.strokeLinecap}"`,
      `stroke-linejoin="${faviconGeometry.strokeLinejoin}"`,
      ...faviconGeometry.petalTransforms,
      faviconGeometry.centerSwirlAttribute,
      ...faviconGeometry.centerPieceAnchors,
      faviconGeometry.pathAnchors.centerPetal,
    ]
  : null
const forbiddenWebElements = faviconGeometry
  ? new RegExp(faviconGeometry.invariants.forbiddenWebElementsPattern)
  : null
const forbiddenWebFills = faviconGeometry
  ? new RegExp(faviconGeometry.invariants.forbiddenWebFillsPattern)
  : null
const forbiddenDesktopLayout = faviconGeometry
  ? new RegExp(faviconGeometry.invariants.forbiddenDesktopLayoutPattern)
  : null
if (!existsSync(webIcon) || !faviconGeometry || requiredIconGeometry.some((path) => !favicon.includes(path))) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不是中心对称的十二色弧形花心: ${webIcon}`)
  failed = true
} else if (forbiddenWebElements.test(favicon)) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 不得包含不透明背景底板: ${webIcon}`)
  failed = true
} else if (forbiddenWebFills.test(favicon)) {
  console.error('[verify-desktop-contracts] FAIL: 花瓣双层边缘必须使用干净黑色线条，不得保留白色或透明重影描边')
  failed = true
} else if (
  (favicon.match(/<path\b/g) ?? []).length !== faviconGeometry.invariants.totalPaths ||
  forbiddenDesktopLayout.test(favicon)
) {
  console.error('[verify-desktop-contracts] FAIL: 六瓣花心必须由六个连续弧形花心瓣组成，且花瓣根部不得被中心覆盖')
  failed = true
} else {
  const fills = [...favicon.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(([, color]) => color)
  const outerFills = fills.slice(0, faviconGeometry.invariants.uniqueOuterColors)
  const centerFills = fills.slice(
    faviconGeometry.invariants.uniqueOuterColors,
    faviconGeometry.invariants.uniqueOuterColors + faviconGeometry.invariants.uniqueCenterColors,
  )
  if (
    new Set([...outerFills, ...centerFills]).size !== faviconGeometry.invariants.uniqueOuterPlusCenterColors ||
    centerFills.some((color) => outerFills.includes(color))
  ) {
    console.error('[verify-desktop-contracts] FAIL: 花瓣与花心必须使用互不重复的十二种颜色')
    failed = true
  } else {
    console.log('[verify-desktop-contracts] OK: Web favicon 为中心对称的十二色弧形花瓣')
  }
}

const desktopIcon = existsSync(desktopIconSource) ? readFileSync(desktopIconSource, 'utf8') : ''
const desktopIconTreatment = faviconGeometry
  ? [...faviconGeometry.invariants.requiredDesktopTreatments]
  : ['scale(31)', 'fill="none"']
const forbiddenDesktopElements = faviconGeometry
  ? new RegExp(faviconGeometry.invariants.forbiddenDesktopElementsPattern)
  : null
if (!existsSync(desktopIconSource)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不存在: ${desktopIconSource}`)
  failed = true
} else if (
  !faviconGeometry ||
  [...requiredIconGeometry, ...desktopIconTreatment].some((entry) => !desktopIcon.includes(entry)) ||
  forbiddenDesktopElements.test(desktopIcon)
) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版未同步透明双线花瓣几何: ${desktopIconSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 桌面图标母版使用透明双线花瓣几何')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

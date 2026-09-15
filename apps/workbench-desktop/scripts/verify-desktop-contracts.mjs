// workbench-desktop 契约校验：
//  1. apps/workbench 的 Vite 构建产物必须存在；
//  2. 落地为 workbench-dist/ 软链接或拷贝，供 Tauri frontendDist 使用；
//  3. src-tauri/icons/icon.icns 必须存在。

import { existsSync, mkdirSync, cpSync, rmSync, statSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const desktopDir = join(__dirname, '..')
const repoRoot = join(desktopDir, '..', '..')

// Dango-family favicon contract source: apps/workbench-shared/src/brand/favicon-geometry.json.
// Web, mobile, and desktop must keep the same family image and fixed order.
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

function readTextFiles(root, output = []) {
  if (!existsSync(root)) return output
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      readTextFiles(path, output)
    } else if (/\.(?:css|html|js|json|map)$/u.test(entry.name)) {
      output.push(readFileSync(path, 'utf8'))
    }
  }
  return output
}

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

if (process.env.AXI_DESKTOP_PACKAGE === 'true') {
  const packagedGatewayBaseURL = process.env.VITE_API_BASE_URL?.trim()
  const packagedFiles = readTextFiles(workbenchDist)
  const packagedSource = packagedFiles.join('\n')
  const allowLocalGateway = process.env.AXI_DESKTOP_ALLOW_LOCAL_GATEWAY === 'true'
  const allowedGateway = packagedGatewayBaseURL === 'https://workbench.axiomaticworld.com'
    || (allowLocalGateway && (
      packagedGatewayBaseURL === 'http://127.0.0.1:8088'
      || packagedGatewayBaseURL === 'https://workbench.axiomaticworld.com:8443'
    ))
  if (
    !allowedGateway
    || !packagedSource.includes(packagedGatewayBaseURL)
  ) {
    console.error(
      '[verify-desktop-contracts] FAIL: macOS 包的 Gateway 地址不符合公网或显式本地调试契约',
    )
    failed = true
  } else {
    console.log(`[verify-desktop-contracts] OK: Gateway 地址已注入 (${packagedGatewayBaseURL})`)
  }
}

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
  config?.productName !== 'Axi 工作台' ||
  loginWindow?.title !== 'Axi 工作台 — 登录' ||
  loginWindow?.width !== 380 ||
  loginWindow?.height !== 440 ||
  loginWindow?.minWidth !== 380 ||
  loginWindow?.minHeight !== 440 ||
  loginWindow?.resizable !== false ||
  loginWindow?.maximizable !== false ||
  loginWindow?.decorations !== false ||
  loginWindow?.transparent !== true ||
  loginWindow?.theme !== 'Light' ||
  loginWindow?.backgroundColor?.toLowerCase() !== '#00000000'
) {
  console.error(`[verify-desktop-contracts] FAIL: 应用名称或登录窗口必须符合中文客户端契约: ${tauriConfig}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 登录窗口使用固定 380x440 无原生装饰透明圆角画布')
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
  !/<key>CFBundleName<\/key>\s*<string>Axi 工作台<\/string>/.test(plist) ||
  !/<key>NSAppTransportSecurity<\/key>[\s\S]*?<key>NSAllowsLocalNetworking<\/key>\s*<true\/>/.test(plist) ||
  /<key>NSAllowsArbitraryLoadsInWebContent<\/key>\s*<true\/>/.test(plist) ||
  !/<key>NSExceptionDomains<\/key>[\s\S]*?<key>localhost<\/key>[\s\S]*?<key>NSExceptionAllowsInsecureHTTPLoads<\/key>\s*<true\/>/.test(plist) ||
  !/<key>127\.0\.0\.1<\/key>[\s\S]*?<key>NSExceptionAllowsInsecureHTTPLoads<\/key>\s*<true\/>/.test(plist)
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
  !loginPage.includes('axi-login-window-close') ||
  !loginStyles.includes('.axi-login-drag-region') ||
  !loginStyles.includes('cursor: default') ||
  /cursor:\s*(?:grab|grabbing)\b/.test(loginStyles)
) {
  console.error(`[verify-desktop-contracts] FAIL: 登录窗口缺少可用的 macOS 拖拽区域: ${loginPageSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 登录窗口提供自定义关闭按钮和拖拽区域')
}

const favicon = existsSync(webIcon) ? readFileSync(webIcon, 'utf8') : ''
const escapedImageHref = faviconGeometry?.imageHref?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const forbiddenLegacyElements = faviconGeometry
  ? new RegExp(faviconGeometry.invariants.forbiddenLegacyElementsPattern)
  : null
if (
  !existsSync(webIcon) ||
  !faviconGeometry ||
  !favicon.includes(`viewBox="${faviconGeometry.viewBox}"`) ||
  !new RegExp(`<image[^>]+href="${escapedImageHref}"`).test(favicon) ||
  !favicon.includes(`data-family-layout="${faviconGeometry.layoutAttribute}"`)
) {
  console.error(`[verify-desktop-contracts] FAIL: Web favicon 未使用七成员团子大家族主图: ${webIcon}`)
  failed = true
} else if (forbiddenLegacyElements.test(favicon)) {
  console.error('[verify-desktop-contracts] FAIL: Web favicon 仍包含已归档的六瓣花几何')
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: Web favicon 使用七成员团子大家族主图')
}

const desktopIcon = existsSync(desktopIconSource) ? readFileSync(desktopIconSource, 'utf8') : ''
if (!existsSync(desktopIconSource)) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版不存在: ${desktopIconSource}`)
  failed = true
} else if (
  !faviconGeometry ||
  !desktopIcon.includes(faviconGeometry.invariants.requiredDesktopViewBox) ||
  !desktopIcon.includes(faviconGeometry.invariants.requiredDesktopImage) ||
  !desktopIcon.includes(`data-family-layout="${faviconGeometry.layoutAttribute}"`) ||
  !desktopIcon.includes('preserveAspectRatio="xMidYMid meet"')
) {
  console.error(`[verify-desktop-contracts] FAIL: 桌面图标母版未同步团子大家族主图: ${desktopIconSource}`)
  failed = true
} else {
  console.log('[verify-desktop-contracts] OK: 桌面图标母版使用团子大家族主图')
}

if (failed) process.exit(1)
console.log('[verify-desktop-contracts] 全部通过')

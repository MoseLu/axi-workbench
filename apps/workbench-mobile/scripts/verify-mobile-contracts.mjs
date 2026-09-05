import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
// Favicon 几何契约单源:apps/workbench-shared/src/brand/favicon-geometry.json。
// mobile 必须保持与 web / desktop 同样的 totalPaths 路径 + uniqueOuterPlusCenterColors
// 种互不重复 fill 色 + outer/center 分组;改了 favicon SVG 必须同步 JSON。
const faviconGeometryPath = path.resolve(
  appRoot,
  '../workbench-shared/src/brand/favicon-geometry.json',
);
if (!fs.existsSync(faviconGeometryPath)) {
  throw new Error(
    `missing favicon geometry contract at ${faviconGeometryPath}`,
  );
}
const faviconGeometry = JSON.parse(fs.readFileSync(faviconGeometryPath, 'utf8'));
const requiredTotalPaths = faviconGeometry.invariants.totalPaths;
const requiredUniqueColors = faviconGeometry.invariants.uniqueOuterPlusCenterColors;
const requiredOuterColors = faviconGeometry.invariants.uniqueOuterColors;

const read = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8');
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) throw new Error(message);
};
const forbidMatch = (text, pattern, message) => {
  if (pattern.test(text)) throw new Error(message);
};

const app = read('src/App.tsx');
const index = read('index.html');
const mobileLocale = read('src/i18n.ts');
const nativeStrings = fs.readFileSync(path.join(appRoot, 'android/app/src/main/res/values/strings.xml'), 'utf8');
const startupView = read('android/app/src/main/java/com/workbench/mobile/ui/startup/BrandLoadingView.kt');
const deprecatedNativeManualLogin = read('android/app/src/main/java/com/workbench/mobile/ui/screens/manual/DeprecatedNativeManualLogin.kt');
const loginKotlinDir = path.join(appRoot, 'android/app/src/main/java/com/workbench/mobile/ui/screens/manual');
const shell = read('src/layouts/MobileShell.tsx');
const header = read('src/components/MobileHeader.tsx');
const tabBar = read('src/components/MobileTabBar.tsx');
const mobileIcons = read('src/components/MobileIcons.tsx');
const login = read('src/pages/LoginPage.tsx');
const navigation = read('src/lib/navigation.ts');
const scan = read('src/pages/ScanPage.tsx');
const pairingScan = read('src/pages/PairingScanPage.tsx');
const pairingQr = read('src/lib/mobilePairingQr.ts');
const loginConfirm = read('src/pages/WebLoginConfirmPage.tsx');
const approvalScan = read('src/lib/approvalScan.ts');
const webLoginQr = read('src/lib/webLoginQr.ts');
const mobileControl = read('src/lib/mobileControl.ts');
const home = read('src/pages/HomePage.tsx');
const projects = read('src/pages/ProjectsPage.tsx');
const workspace = read('src/pages/FocusPage.tsx');
const search = read('src/pages/SearchPage.tsx');
const packageJson = read('package.json');
const mobileStyles = read('src/styles/wechat-mobile.css');
const mobileFavicon = read('public/favicon.svg');
const webFavicon = fs.readFileSync(path.resolve(appRoot, '../workbench/public/favicon.svg'), 'utf8');

requireMatch(app, /MobileShell/, 'mobile application must own an independent shell');
requireMatch(app, /WorkbenchLocaleProvider[\s\S]*BrowserRouter/, 'mobile application must mount shared locale before its own router');
requireMatch(app, /path="scan"/, 'mobile application must own the approval scan route');
requireMatch(app, /path="scan\/pair"/, 'mobile application must own the QR pairing scan route');
requireMatch(shell, /isScanRoute[\s\S]*axi-mobile-app--scanner/, 'scan must have an independent full-screen mobile surface');
requireMatch(shell, /MobileHeader[\s\S]*MobileTabBar/, 'ordinary mobile routes must own their header and tab bar composition');
requireMatch(header, /wb-mobile-topbar/, 'mobile header must keep the WeChat-style mobile top bar');
requireMatch(tabBar, /wb-bottom-nav/, 'mobile tab bar must keep the WeChat-style four-tab navigation');
requireMatch(navigation, /MobileNavKey\s*=\s*'home'\s*\|\s*'projects'\s*\|\s*'workspace'\s*\|\s*'me'/, 'mobile navigation must have exactly four primary tab keys');
forbidMatch(navigation, /\{\s*key:\s*'scan'/, 'scan must not occupy a bottom-navigation tab');
requireMatch(header, /navigate\('\/scan'\)/, 'mobile header plus menu must own the scan entry');
forbidMatch(header, /wb-mobile-topbar__btn--scan|login\/confirm-web/, 'mobile profile must not add a second top-bar scan affordance; QR flows belong to the scan menu');
requireMatch(packageJson, /"@axi\/workbench-foundation"/, 'mobile app must consume the shared foundation package');
requireMatch(index, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/, 'mobile index must expose the shared 32px brand icon');
requireMatch(index, /rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48\.png"/, 'mobile index must expose the shared 48px brand icon');
requireMatch(index, /rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/, 'mobile index must expose the shared SVG brand icon');
requireMatch(index, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/, 'mobile index must expose the shared home-screen brand icon');
requireMatch(index, /<title>Axi 工作台<\/title>/, 'mobile document title must use the Chinese product name by default');
requireMatch(mobileLocale, /'zh-CN':\s*\{[\s\S]*?'app\.name': 'Axi 工作台'/, 'Chinese mobile locale must define the product name');
requireMatch(mobileLocale, /'en-US':\s*\{[\s\S]*?'app\.name': 'Axi Workbench'/, 'English mobile locale must define the product name');
requireMatch(nativeStrings, /<string name="app_name">Axi 工作台<\/string>/, 'Android launcher must use the Chinese product name');
requireMatch(startupView, /R\.string\.app_name[\s\S]*R\.string\.startup_preparing_workspace/, 'Android startup loading must use localized app resources');
if (mobileFavicon !== webFavicon) {
  throw new Error('mobile favicon must remain byte-identical to the Workbench Web flower mark');
}
// 12 路径、12 种互不重复 fill 色、外 6 + 心 6 的契约从 favicon-geometry.json 读,
// 与 verify-desktop-contracts.mjs 同源。
if ((mobileFavicon.match(/<path\b/g) ?? []).length !== requiredTotalPaths) {
  throw new Error(`mobile favicon must contain ${requiredTotalPaths} paths (twelve petal contours + six curved center pieces)`);
}
const mobileFills = [...mobileFavicon.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(([, color]) => color);
if (
  new Set(mobileFills.slice(0, requiredUniqueColors)).size !== requiredUniqueColors ||
  mobileFills
    .slice(requiredOuterColors, requiredUniqueColors)
    .some((color) => mobileFills.slice(0, requiredOuterColors).includes(color))
) {
  throw new Error(`mobile favicon must preserve ${requiredUniqueColors} distinct bright brand colors`);
}
requireMatch(mobileIcons, /AxiSvgIcon[\s\S]*resolveAxiWorkbenchIcon/, 'mobile icons must resolve to the shared Axi SVG registry');
requireMatch(login, /AxiLogoMark/, 'mobile login must use the shared twelve-color Axi mark');
requireMatch(login, /login\.emailCode/, 'mobile login must offer the QQ Mail verification entry');
requireMatch(login, /requestEmailCode/, 'mobile login must request a server-side email challenge');
requireMatch(login, /confirmEmailCode/, 'mobile login must confirm the server-side email challenge');
requireMatch(login, /challengeId/, 'mobile login must retain the opaque challenge identifier');
requireMatch(login, /one-time-code/, 'mobile login must expose Android one-time-code autofill');
forbidMatch(login, /beginLogin/, 'mobile email-code entry must not silently redirect into OIDC');
forbidMatch(login, /password/i, 'mobile login must not reintroduce a password flow');

// Kotlin 端登录契约（与 docs/decisions/0001-kotlin-manual-login.md 对齐）。
// 历史 Kotlin 登录实现被保留为 DeprecatedNativeManualLogin.kt，但它不能从导航图
// 触发；如果未来有人重新挂载到 NavHost，或新建第二个 Kotlin 登录文件，CI 会拦截。
const KOTLIN_DEPRECATED_LOGIN_BASENAMES = new Set(['DeprecatedNativeManualLogin.kt']);
requireMatch(deprecatedNativeManualLogin, /@Deprecated\(/, 'deprecated native manual login must be marked @Deprecated');
const kotlinLoginFiles = fs.readdirSync(loginKotlinDir)
  .filter((name) => name.endsWith('.kt'))
  .map((name) => ({ name, text: read(`android/app/src/main/java/com/workbench/mobile/ui/screens/manual/${name}`) }));
const activeKotlinLogin = kotlinLoginFiles.filter(({ name }) => !KOTLIN_DEPRECATED_LOGIN_BASENAMES.has(name));
if (activeKotlinLogin.length > 0) {
  const offenders = activeKotlinLogin.map(({ name }) => name).join(', ');
  throw new Error(`mobile Kotlin manual login directory must only contain DeprecatedNativeManualLogin.kt (found: ${offenders}); see docs/decisions/0001-kotlin-manual-login.md`);
}
for (const { name, text } of activeKotlinLogin) {
  forbidMatch(text, /password/i, `${name} must not reintroduce a Kotlin-side password flow`);
}
requireMatch(header, /MobileIcon className="wb-mobile-topbar__plus" name="plus"/, 'mobile header must render the shared plus glyph inside its mobile-only circular affordance');
requireMatch(mobileStyles, /\.wb-mobile-topbar__plus svg[\s\S]*width:\s*10px/, 'mobile plus affordance must size the shared SVG inside its mobile-only circle');
requireMatch(scan, /parseApprovalScanPayload[\s\S]*resolveMobileApprovalScan/, 'top-level Scan must resolve an opaque domain approval URI through the control plane');
requireMatch(pairingScan, /parseMobilePairingQrPayload[\s\S]*scanMobilePairingQr/, 'pairing scan must submit the Web-owned QR through the mobile control plane');
requireMatch(pairingScan, /completeScannedMobilePairing/, 'pairing scan must poll for explicit Web owner confirmation');
requireMatch(pairingQr, /axi-mobile-pair-v1[\s\S]*webPairingId[\s\S]*scanToken/, 'pairing QR parser must require the strict Web pairing payload');
requireMatch(approvalScan, /axi:\/\/approval/, 'domain approval QR must use its own opaque URI scheme');
forbidMatch(approvalScan, /ticket|projectId|actionId/, 'domain approval URI must not carry identity tickets or business object fields');
requireMatch(loginConfirm, /parseWebLoginQrPayload[\s\S]*approveMobileWebLoginQr/, 'web login confirmation must use the isolated device-login QR flow');
requireMatch(webLoginQr, /kind:\s*'axi-web-login-v1'/, 'computer login QR must retain its explicit payload kind');
requireMatch(webLoginQr, /WEB_LOGIN_ID_PATTERN[\s\S]*OPAQUE_TOKEN_PATTERN/, 'computer login QR must validate the opaque transaction and scan tokens');
requireMatch(mobileControl, /web-login\/qr\/scan/, 'paired-device confirmation must use the gateway mobile web-login route');
forbidMatch(loginConfirm, /parseQRApprovalPayload|qrApprovalEndpoint|credentials:\s*'include'/, 'computer login QR must not fall back to the unrelated OIDC approval-cookie route');
for (const [name, page] of [['Home', home], ['Projects', projects], ['Workspace', workspace]]) {
  requireMatch(page, /useMobileWorkspaceQuery/, `${name} must render the authenticated control-plane projection`);
  requireMatch(page, /MobileProjectionState/, `${name} must render a truthful pairing/permission/service state`);
}
requireMatch(workspace, /runMobileProjectAction/, 'workspace actions must submit a registered server-side action');
forbidMatch(workspace, /setTasks|toggleTask|task\.done|localStorage|sessionStorage/, 'workspace must not turn local task state into a completed action');
forbidMatch(`${home}\n${projects}\n${workspace}`, /DEMO_|mock(?:Project|Task|Data)|staticProjects/, 'mobile projection pages must not restore hard-coded business data');
requireMatch(search, /useMobileWorkspaceQuery[\s\S]*MobileProjectionState/, 'mobile search must query the same authenticated projection');
forbidMatch(search, /const corpus\s*=\s*\[|storyGraph|navigationReview|syncStatus/, 'mobile search must not restore static showcase results');
requireMatch(mobileControl, /resolveGatewayURL\(`\/api\/v1\/mobile/, 'mobile control calls must use the API Gateway boundary');
requireMatch(mobileControl, /Ed25519/, 'mobile device pairing must use the server-compatible Ed25519 key proof');
requireMatch(mobileControl, /control-plane\/mobile\/pair-approval/, 'mobile pairing must obtain owner approval through the authenticated Web session');
requireMatch(mobileControl, /ownerApprovalToken/, 'mobile pairing confirmation must carry the owner approval token');
requireMatch(mobileControl, /indexedDB/, 'paired mobile devices must keep their key material outside web storage');
requireMatch(mobileControl, /extractable\)\s*throw|record\.privateKey\.extractable/, 'persisted device keys must remain non-extractable');
forbidMatch(mobileControl, /localhost:8092|CONTROL_PLANE_URL|localStorage|sessionStorage/, 'mobile must not call or persist control-plane credentials directly');

forbidMatch(app, /from ['"]@axi\/shell['"]|<AxiDashboardShell/, 'mobile app must not import the Web admin dashboard shell');
forbidMatch(shell, /<AxiDashboardShell|<AxiBreadcrumb|<AxiTabBar/, 'mobile shell must not inherit Web admin chrome');
forbidMatch(header, /AxiMark|AxiBreadcrumb|AxiTabBar/, 'mobile header must not inherit Web branding or navigation chrome');
forbidMatch(`${app}\n${shell}\n${header}\n${tabBar}`, /(?:\.\.\/)+workbench\//, 'mobile app must not import implementation code from the Web app');
forbidMatch(`${mobileIcons}\n${header}\n${tabBar}`, /<svg|<path|<circle|<rect/, 'mobile must not maintain a parallel hand-drawn icon set');
forbidMatch(mobileStyles, /\.wb-mobile-topbar__plus::before|\.wb-mobile-topbar__plus::after/, 'mobile plus affordance must not redraw the shared glyph with CSS pseudo-elements');
forbidMatch(`${scan}\n${loginConfirm}`, /(?:localStorage|sessionStorage|console\.(?:log|debug|info))/, 'scan flows must not persist or log QR credentials');

forbidMatch(app, /com\.axi\.workbench\.mobile|MainActivity|WebView/, 'the Vite mobile surface must not claim ownership of the separate physical APK shell');

console.log('Workbench Mobile UI contracts: PASS');

import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8');
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) throw new Error(message);
};
const forbidMatch = (text, pattern, message) => {
  if (pattern.test(text)) throw new Error(message);
};

const app = read('src/App.tsx');
const shell = read('src/layouts/MobileShell.tsx');
const header = read('src/components/MobileHeader.tsx');
const tabBar = read('src/components/MobileTabBar.tsx');
const mobileIcons = read('src/components/MobileIcons.tsx');
const login = read('src/pages/LoginPage.tsx');
const navigation = read('src/lib/navigation.ts');
const scan = read('src/pages/ScanPage.tsx');
const loginConfirm = read('src/pages/WebLoginConfirmPage.tsx');
const approvalScan = read('src/lib/approvalScan.ts');
const qrLogin = read('src/lib/qrLogin.ts');
const mobileControl = read('src/lib/mobileControl.ts');
const home = read('src/pages/HomePage.tsx');
const projects = read('src/pages/ProjectsPage.tsx');
const workspace = read('src/pages/FocusPage.tsx');
const search = read('src/pages/SearchPage.tsx');
const packageJson = read('package.json');
const mobileStyles = read('src/styles/wechat-mobile.css');

requireMatch(app, /MobileShell/, 'mobile application must own an independent shell');
requireMatch(app, /WorkbenchLocaleProvider[\s\S]*BrowserRouter/, 'mobile application must mount shared locale before its own router');
requireMatch(app, /path="scan"/, 'mobile application must own the scan route');
requireMatch(shell, /isScanRoute[\s\S]*axi-mobile-app--scanner/, 'scan must have an independent full-screen mobile surface');
requireMatch(shell, /MobileHeader[\s\S]*MobileTabBar/, 'ordinary mobile routes must own their header and tab bar composition');
requireMatch(header, /wb-mobile-topbar/, 'mobile header must keep the WeChat-style mobile top bar');
requireMatch(tabBar, /wb-bottom-nav/, 'mobile tab bar must keep the WeChat-style four-tab navigation');
requireMatch(navigation, /MobileNavKey\s*=\s*'home'\s*\|\s*'projects'\s*\|\s*'workspace'\s*\|\s*'me'/, 'mobile navigation must have exactly four primary tab keys');
forbidMatch(navigation, /\{\s*key:\s*'scan'/, 'scan must not occupy a bottom-navigation tab');
requireMatch(header, /navigate\('\/scan'\)/, 'mobile header plus menu must own the scan entry');
requireMatch(packageJson, /"@axi\/workbench-foundation"/, 'mobile app must consume the shared foundation package');
requireMatch(mobileIcons, /AxiSvgIcon[\s\S]*resolveAxiWorkbenchIcon/, 'mobile icons must resolve to the shared Axi SVG registry');
requireMatch(login, /AxiLogoMark/, 'mobile login must use the shared four-color Axi mark');
requireMatch(login, /login\.emailCode/, 'mobile login must offer the QQ Mail verification entry');
requireMatch(login, /requestEmailCode/, 'mobile login must request a server-side email challenge');
requireMatch(login, /confirmEmailCode/, 'mobile login must confirm the server-side email challenge');
requireMatch(login, /challengeId/, 'mobile login must retain the opaque challenge identifier');
requireMatch(login, /one-time-code/, 'mobile login must expose Android one-time-code autofill');
forbidMatch(login, /beginLogin/, 'mobile email-code entry must not silently redirect into OIDC');
forbidMatch(login, /password/i, 'mobile login must not reintroduce a password flow');
requireMatch(header, /MobileIcon className="wb-mobile-topbar__plus" name="plus"/, 'mobile header must render the shared plus glyph inside its mobile-only circular affordance');
requireMatch(mobileStyles, /\.wb-mobile-topbar__plus svg[\s\S]*width:\s*10px/, 'mobile plus affordance must size the shared SVG inside its mobile-only circle');
requireMatch(scan, /parseApprovalScanPayload[\s\S]*resolveMobileApprovalScan/, 'top-level Scan must resolve an opaque domain approval URI through the control plane');
requireMatch(approvalScan, /axi:\/\/approval/, 'domain approval QR must use its own opaque URI scheme');
forbidMatch(approvalScan, /ticket|projectId|actionId/, 'domain approval URI must not carry identity tickets or business object fields');
requireMatch(loginConfirm, /parseQRApprovalPayload[\s\S]*qrApprovalEndpoint/, 'web login confirmation must retain the isolated OIDC QR transaction flow');
requireMatch(loginConfirm, /credentials:\s*'include'/, 'OIDC login confirmation must use the verified mobile session cookie');
requireMatch(qrLogin, /ticket remains in local function scope/, 'QR ticket handling must remain in transient memory');
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
forbidMatch(mobileControl, /localhost:8092|CONTROL_PLANE_URL|localStorage|sessionStorage/, 'mobile must not call or persist control-plane credentials directly');

forbidMatch(app, /from ['"]@axi\/shell['"]|<AxiDashboardShell/, 'mobile app must not import the Web admin dashboard shell');
forbidMatch(shell, /<AxiDashboardShell|<AxiBreadcrumb|<AxiTabBar/, 'mobile shell must not inherit Web admin chrome');
forbidMatch(header, /AxiMark|AxiBreadcrumb|AxiTabBar/, 'mobile header must not inherit Web branding or navigation chrome');
forbidMatch(`${app}\n${shell}\n${header}\n${tabBar}`, /(?:\.\.\/)+workbench\//, 'mobile app must not import implementation code from the Web app');
forbidMatch(`${mobileIcons}\n${header}\n${tabBar}`, /<svg|<path|<circle|<rect/, 'mobile must not maintain a parallel hand-drawn icon set');
forbidMatch(mobileStyles, /\.wb-mobile-topbar__plus::before|\.wb-mobile-topbar__plus::after/, 'mobile plus affordance must not redraw the shared glyph with CSS pseudo-elements');
forbidMatch(`${scan}\n${loginConfirm}`, /(?:localStorage|sessionStorage|console\.(?:log|debug|info))/, 'scan flows must not persist or log QR credentials');

console.log('Workbench Mobile UI contracts: PASS');

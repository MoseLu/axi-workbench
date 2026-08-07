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
const qrLogin = read('src/lib/qrLogin.ts');
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
forbidMatch(login, /password/i, 'mobile login must not reintroduce a password flow');
requireMatch(header, /MobileIcon className="wb-mobile-topbar__plus" name="plus"/, 'mobile header must render the shared plus glyph inside its mobile-only circular affordance');
requireMatch(mobileStyles, /\.wb-mobile-topbar__plus svg[\s\S]*width:\s*10px/, 'mobile plus affordance must size the shared SVG inside its mobile-only circle');
requireMatch(scan, /parseQRApprovalPayload[\s\S]*qrApprovalEndpoint/, 'scan must parse the opaque Axi approval URI before requesting approval');
requireMatch(scan, /credentials:\s*'include'/, 'scan approval must use the verified mobile session cookie');
requireMatch(qrLogin, /ticket remains in local function scope/, 'QR ticket handling must remain in transient memory');

forbidMatch(app, /from ['"]@axi\/shell['"]|<AxiDashboardShell/, 'mobile app must not import the Web admin dashboard shell');
forbidMatch(shell, /<AxiDashboardShell|<AxiBreadcrumb|<AxiTabBar/, 'mobile shell must not inherit Web admin chrome');
forbidMatch(header, /AxiMark|AxiBreadcrumb|AxiTabBar/, 'mobile header must not inherit Web branding or navigation chrome');
forbidMatch(`${app}\n${shell}\n${header}\n${tabBar}`, /(?:\.\.\/)+workbench\//, 'mobile app must not import implementation code from the Web app');
forbidMatch(`${mobileIcons}\n${header}\n${tabBar}`, /<svg|<path|<circle|<rect/, 'mobile must not maintain a parallel hand-drawn icon set');
forbidMatch(mobileStyles, /\.wb-mobile-topbar__plus::before|\.wb-mobile-topbar__plus::after/, 'mobile plus affordance must not redraw the shared glyph with CSS pseudo-elements');
forbidMatch(scan, /(?:localStorage|sessionStorage|console\.(?:log|debug|info))/, 'scan must not persist or log QR approval credentials');

console.log('Workbench Mobile UI contracts: PASS');
